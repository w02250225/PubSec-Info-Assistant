# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import json
import logging
import os
import threading
import time
import re
from datetime import datetime
import time
from typing import List
import base64
import random
import requests
from urllib.parse import unquote
from azure.storage.blob import BlobServiceClient
from azure.storage.queue import QueueClient, TextBase64EncodePolicy
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from data_model import (EmbeddingResponse, ModelInfo, ModelListResponse, StatusResponse)
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from model_handling import load_models
from openai import AzureOpenAI, RateLimitError
from opencensus.ext.azure.log_exporter import AzureLogHandler
from tenacity import retry, stop_after_attempt, wait_random_exponential, before_sleep_log
from sentence_transformers import SentenceTransformer
from shared_code.utilities_helper import UtilitiesHelper
from shared_code.status_log import State, StatusClassification, StatusLog
import tiktoken

os.environ['TZ'] = 'Australia/Brisbane'
time.tzset()

# === ENV Setup ===

ENV = {
    "AZURE_BLOB_STORAGE_KEY": None,
    "EMBEDDINGS_QUEUE": None,
    "LOG_LEVEL": "DEBUG", # Will be overwritten by LOG_LEVEL in Environment
    "DEQUEUE_MESSAGE_BATCH_SIZE": 1,
    "AZURE_BLOB_STORAGE_ACCOUNT": None,
    "AZURE_BLOB_STORAGE_CONTAINER": None,
    "AZURE_BLOB_STORAGE_ENDPOINT": None,
    "AZURE_BLOB_STORAGE_UPLOAD_CONTAINER": None,
    "COSMOSDB_URL": None,
    "COSMOSDB_KEY": None,
    "COSMOSDB_LOG_DATABASE_NAME": None,
    "COSMOSDB_LOG_CONTAINER_NAME": None,
    "MAX_EMBEDDING_REQUEUE_COUNT": 5,
    "EMBEDDING_REQUEUE_BACKOFF": 60,
    "AZURE_OPENAI_SERVICE": None,
    "AZURE_OPENAI_SERVICE_KEY": None,
    "AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME": None,
    "AZURE_OPENAI_API_VERSION": None,
    "AZURE_SEARCH_INDEX": None,
    "AZURE_SEARCH_SERVICE": None,
    "AZURE_SEARCH_SERVICE_ENDPOINT": None,
    "AZURE_SEARCH_SERVICE_KEY": None,
    "BLOB_CONNECTION_STRING": None,
    "TARGET_EMBEDDINGS_MODEL": None,
    "EMBEDDING_VECTOR_SIZE": None,
    "IS_GOV_CLOUD_DEPLOYMENT": None
}

str_to_bool = {'true': True, 'false': False}

for key, value in ENV.items():
    new_value = os.getenv(key)
    if new_value is not None:
        ENV[key] = new_value
    elif value is None:
        raise ValueError(f"Environment variable {key} not set")

BLOB_SERVICE_CLIENT = BlobServiceClient.from_connection_string(ENV["BLOB_CONNECTION_STRING"])
CONTAINER_CLIENT = BLOB_SERVICE_CLIENT.get_container_client(ENV["AZURE_BLOB_STORAGE_CONTAINER"])

SEARCH_CLIENT = SearchClient(endpoint=ENV["AZURE_SEARCH_SERVICE_ENDPOINT"],
                             index_name=ENV["AZURE_SEARCH_INDEX"],
                             credential=AzureKeyCredential(ENV["AZURE_SEARCH_SERVICE_KEY"]))

OPENAI_CLIENT = AzureOpenAI(api_version = ENV["AZURE_OPENAI_API_VERSION"],
                            azure_endpoint = f'https://{ENV["AZURE_OPENAI_SERVICE"]}.openai.azure.com',
                            api_key = ENV["AZURE_OPENAI_SERVICE_KEY"])                          

class AzOAIEmbedding(object):
    """A wrapper for a Azure OpenAI Embedding model"""
    def __init__(self, deployment_name) -> None:
        self.deployment_name = deployment_name

    def wait_strategy(retry_state):
        exception = retry_state.outcome.exception()
        if isinstance(exception, RateLimitError):
            log.debug("RateLimitError occurred, waiting for 30 seconds before retrying...")
            return 30
        else:
            log.debug("A retryable error occurred: %s. Waiting with exponential backoff...", str(retry_state.outcome.exception()))
            exp = wait_random_exponential(multiplier=1, max=10)
            return exp(retry_state=retry_state)

    @retry(
        wait=wait_strategy,
        stop=stop_after_attempt(5),
        before_sleep=before_sleep_log(logging, logging.INFO)
    )
    def encode(self, texts):
        """Embeds a list of texts using a given model"""

        response = OPENAI_CLIENT.embeddings.create(
            model=self.deployment_name,
            input=texts
        )
        
        return response
    
class STModel(object):
    """A wrapper for a sentence-transformers model"""
    def __init__(self, deployment_name) -> None:
        self.deployment_name = deployment_name

    @retry(wait=wait_random_exponential(multiplier=1, max=10), stop=stop_after_attempt(5))
    def encode(self, texts) -> None:
        """Embeds a list of texts using a given model"""
        model = SentenceTransformer(self.deployment_name)
        response = model.encode(texts)
        return response

# === Get Logger ===
log = logging.getLogger("uvicorn")
log.setLevel(ENV["LOG_LEVEL"])
if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    log.addHandler(AzureLogHandler())
log.info("Starting up")

# === Azure Setup ===

utilities_helper = UtilitiesHelper(
    azure_blob_storage_account=ENV["AZURE_BLOB_STORAGE_ACCOUNT"],
    azure_blob_storage_endpoint=ENV["AZURE_BLOB_STORAGE_ENDPOINT"],
    azure_blob_storage_key=ENV["AZURE_BLOB_STORAGE_KEY"],
)

statusLog = StatusLog(ENV["COSMOSDB_URL"], ENV["COSMOSDB_KEY"], ENV["COSMOSDB_LOG_DATABASE_NAME"], ENV["COSMOSDB_LOG_CONTAINER_NAME"])

# === API Setup ===

start_time = datetime.now()

IS_READY = False

#download models
log.debug("Loading embedding models...")
models, model_info = load_models()

# Add Azure OpenAI Embedding & additional Model
models["azure-openai_" + ENV["AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"]] = AzOAIEmbedding(
    ENV["AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"])

model_info["azure-openai_" + ENV["AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"]] = {
    "model": "azure-openai_" + ENV["AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"],
    "vector_size": 1536,
    # Source: https://platform.openai.com/docs/guides/embeddings/what-are-embeddings
}

log.debug("Models loaded")
IS_READY = True

# Create API
app = FastAPI(
    title="Text Embedding Service",
    description="A simple API and Queue Polling service that uses sentence-transformers to embed text",
    version="0.1.0",
    openapi_tags=[
        {"name": "models", "description": "Get information about the available models"},
        {"name": "health", "description": "Health check"},
    ],
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# === API Routes ===
@app.get("/", include_in_schema=False, response_class=RedirectResponse)
def root():
    return RedirectResponse(url="/docs")

@app.get("/health", response_model=StatusResponse, tags=["health"])
def health():
    """Returns the health of the API

    Returns:
        StatusResponse: The health of the API
    """

    uptime = datetime.now() - start_time
    uptime_seconds = uptime.total_seconds()

    output = {"status": None, "uptime_seconds": uptime_seconds, "version": app.version}

    if IS_READY:
        output["status"] = "ready"
    else:
        output["status"] = "loading"

    return output


# Models and Embeddings
@app.get("/models", response_model=ModelListResponse, tags=["models"])
def get_models():
    """Returns a list of available models

    Returns:
        ModelListResponse: A list of available models
    """
    return {"models": list(model_info.values())}


@app.get("/models/{model}", response_model=ModelInfo, tags=["models"])
def get_model(model: str):
    """Returns information about a given model

    Args:
        model (str): The name of the model

    Returns:
        ModelInfo: Information about the model
    """

    if model not in models:
        return {"message": f"Model {model} not found"}
    return model_info[model]


@app.post("/models/{model}/embed", response_model=EmbeddingResponse, tags=["models"])
def embed_texts(model: str, texts: List[str]):
    """Embeds a list of texts using a given model
    Args:
        model (str): The name of the model
        texts (List[str]): A list of texts

    Returns:
        EmbeddingResponse: The embeddings of the texts
    """

    output = {}
    if model not in models:
        return {"message": f"Model {model} not found"}

    # Dont bother embedding if it exceeds the token input limit
    if token_count(texts[0]) > 8191:
        return {
            "model": model,
            "model_info": model_info[model],
            "data": []
            }

    model_obj = models[model]
    try:
        if model.startswith("azure-openai_"):
            embeddings = model_obj.encode(texts)
            embeddings = embeddings.data[0].embedding
        else:
            embeddings = model_obj.encode(texts)
            embeddings = embeddings.tolist()[0]

        output = {
            "model": model,
            "model_info": model_info[model],
            "data": embeddings
        }

    except Exception as error:
        logging.error(f"Failed to embed: {str(error)}")
        raise HTTPException(status_code=500, detail=f"Failed to embed: {str(error)}") from error

    return output


def num_tokens_from_string( string: str, encoding_name: str) -> int:
    """ Function to return the number of tokens in a text string"""
    encoding = tiktoken.get_encoding(encoding_name)
    num_tokens = len(encoding.encode(string))
    return num_tokens


def token_count( input_text):
    """ Function to return the number of tokens in a text string"""
    # For gpt-4, gpt-3.5-turbo, text-embedding-ada-002, you need to use cl100k_base
    encoding = "cl100k_base"
    token_count = num_tokens_from_string(input_text, encoding)
    return token_count


def index_sections(chunks):
    """ Pushes a batch of content to the search index
    """
    results = SEARCH_CLIENT.upload_documents(documents=chunks)
    succeeded = sum([1 for r in results if r.succeeded])
    log.debug(f"\tIndexed {len(results)} chunks, {succeeded} succeeded")


def get_tags(blob_path):
    """ Gets the tags from the blob metadata and uploads them to cosmos db"""
    file_name, file_extension, file_directory = utilities_helper.get_filename_and_extension(blob_path)
    path = file_directory + file_name + file_extension
    blob_client = BLOB_SERVICE_CLIENT.get_blob_client(
        container = ENV["AZURE_BLOB_STORAGE_UPLOAD_CONTAINER"],
        blob = path)
    blob_properties = blob_client.get_blob_properties()
    tags = blob_properties.metadata.get("Tags") or blob_properties.metadata.get("tags")
    
    if tags is not None:
        if isinstance(tags, str):
            tags_list = [unquote(tag) for tag in tags.split(",")]
        else:
            tags_list = [unquote(tags)]
    else:
        tags_list = []

    return tags_list

@app.on_event("startup") 
def startup_event():
    poll_thread = threading.Thread(target=poll_queue_thread)
    poll_thread.daemon = True
    poll_thread.start()

def poll_queue_thread():
    while True:
        poll_queue()
        time.sleep(5)     
        
def poll_queue() -> None:
    """Polls the queue for messages and embeds them"""

    if IS_READY == False:
        log.debug("Skipping poll_queue call, models not yet loaded")
        return

    queue_client = QueueClient.from_connection_string(
        conn_str=ENV["BLOB_CONNECTION_STRING"], queue_name=ENV["EMBEDDINGS_QUEUE"]
    )

    log.debug("Polling embeddings queue for messages...")
    response = queue_client.receive_messages(max_messages=int(ENV["DEQUEUE_MESSAGE_BATCH_SIZE"]))
    messages = [x for x in response]

    if not messages:
        log.debug("No messages to process. Waiting for a couple of minutes...")
        time.sleep(120)  # Sleep for 2 minutes
        return

    target_embeddings_model = re.sub(r'[^a-zA-Z0-9_\-.]', '_', ENV["TARGET_EMBEDDINGS_MODEL"])

    # Remove from queue to prevent duplicate processing from any additional instances
    for message in messages:
        queue_client.delete_message(message)

    for message in messages:
        message_b64 = message.content
        message_json = json.loads(base64.b64decode(message_b64))
        blob_path = message_json["blob_name"]

        try:
            statusLog.upsert_document(blob_path, f'Embeddings process started with model {target_embeddings_model}', StatusClassification.INFO, State.PROCESSING)

            file_name, file_extension, file_directory  = utilities_helper.get_filename_and_extension(blob_path)
            chunk_folder_path = file_directory + file_name + file_extension
            index_chunks = []

            # Iterate over the chunks in the container
            chunk_list = CONTAINER_CLIENT.list_blobs(name_starts_with=chunk_folder_path)
            chunks = list(chunk_list)
            i = 0
            for chunk in chunks:

                statusLog.update_document_state( blob_path, f"Indexing {i+1}/{len(chunks)}")
                # open the file and extract the content
                blob_path_plus_sas = utilities_helper.get_blob_and_sas(
                    ENV["AZURE_BLOB_STORAGE_CONTAINER"] + '/' + chunk.name)
                response = requests.get(blob_path_plus_sas)
                response.raise_for_status()
                chunk_dict = json.loads(response.text)

                # create the json to be indexed
                try:
                    text = (
                        chunk_dict["translated_title"] + " \n " +
                        chunk_dict["translated_subtitle"] + " \n " +
                        chunk_dict["translated_section"] + " \n " +
                        chunk_dict["translated_content"]
                    )
                except KeyError:
                    text = (
                        chunk_dict["title"] + " \n " +
                        chunk_dict["subtitle"] + " \n " +
                        chunk_dict["section"] + " \n " +
                        chunk_dict["content"]
                    )

                # create embedding
                embedding = embed_texts(target_embeddings_model, [text])
                embedding_data = embedding['data']

                tag_list = get_tags(chunk_dict["file_name"])

                index_chunk = {}
                index_chunk['id'] = statusLog.encode_document_id(chunk.name)
                index_chunk['processed_datetime'] = f"{chunk_dict['processed_datetime']}+00:00"
                index_chunk['file_name'] = chunk_dict["file_name"]
                index_chunk['file_uri'] = chunk_dict["file_uri"]
                index_chunk['folder'] = file_directory[:-1]
                index_chunk['tags'] = tag_list
                index_chunk['chunk_file'] = chunk.name
                index_chunk['file_class'] = chunk_dict["file_class"]
                index_chunk['title'] = chunk_dict["title"]
                index_chunk['pages'] = chunk_dict["pages"]
                index_chunk['translated_title'] = chunk_dict.get("translated_title")
                index_chunk['content'] = text
                index_chunk['contentVector'] = embedding_data
                index_chunk['entities'] = chunk_dict["entities"]
                index_chunk['key_phrases'] = chunk_dict["key_phrases"]
                index_chunks.append(index_chunk)
                i += 1

                # push batch of content to index
                if i % 200 == 0:
                    index_sections(index_chunks)
                    index_chunks = []

            # push remainder chunks content to index
            if len(index_chunks) > 0:
                index_sections(index_chunks)

            statusLog.upsert_document(blob_path,
                                      'Embeddings process complete',
                                      StatusClassification.INFO,
                                      State.COMPLETE)

        except Exception as error:
            # Dequeue message and update the embeddings queued count to limit the max retries
            try:
                requeue_count = message_json['embeddings_queued_count']
            except KeyError:
                requeue_count = 0
            requeue_count += 1

            if requeue_count <= int(ENV["MAX_EMBEDDING_REQUEUE_COUNT"]):
                message_json['embeddings_queued_count'] = requeue_count
                # Requeue with a random backoff within limits
                queue_client = QueueClient.from_connection_string(
                    ENV["BLOB_CONNECTION_STRING"],
                    ENV["EMBEDDINGS_QUEUE"],
                    message_encode_policy=TextBase64EncodePolicy())
                message_string = json.dumps(message_json)
                max_seconds = int(ENV["EMBEDDING_REQUEUE_BACKOFF"]) * (requeue_count**2)
                backoff = random.randint(
                    int(ENV["EMBEDDING_REQUEUE_BACKOFF"]) * requeue_count, max_seconds)
                queue_client.send_message(message_string, visibility_timeout=backoff)
                statusLog.upsert_document(blob_path, f'Message requed to embeddings queue, attempt {str(requeue_count)}. Visible in {str(backoff)} seconds. Error: {str(error)}.',
                                          StatusClassification.ERROR,
                                          State.QUEUED)
            else:
                # max retries has been reached
                statusLog.upsert_document(
                    blob_path,
                    f"An error occurred, max requeue limit was reached. Error description: {str(error)}",
                    StatusClassification.ERROR,
                    State.ERROR,
                )

        statusLog.save_document(blob_path)
