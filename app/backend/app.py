# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import logging
import mimetypes
import os
import json
import time
import urllib.parse
from datetime import datetime, timedelta
from fastapi.staticfiles import StaticFiles
import openai
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
import traceback
from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
from azure.mgmt.cognitiveservices import CognitiveServicesManagementClient
from azure.search.documents import SearchClient
from azure.storage.blob import (
    AccountSasPermissions,
    BlobServiceClient,
    ResourceTypes,
    generate_account_sas,
)
from flask import Flask, jsonify, request
from shared_code.status_log import State, StatusClassification, StatusLog
from shared_code.tags_helper import TagsHelper
from typing import List



# === ENV Setup ===

ENV = {
    "AZURE_BLOB_STORAGE_ACCOUNT": None,
    "AZURE_BLOB_STORAGE_ENDPOINT": None,
    "AZURE_BLOB_STORAGE_KEY": None,
    "AZURE_BLOB_STORAGE_CONTAINER": "content",
    "AZURE_SEARCH_SERVICE": "gptkb",
    "AZURE_SEARCH_SERVICE_ENDPOINT": None,
    "AZURE_SEARCH_SERVICE_KEY": None,
    "AZURE_SEARCH_INDEX": "gptkbindex",
    "AZURE_OPENAI_SERVICE": "myopenai",
    "AZURE_OPENAI_RESOURCE_GROUP": "",
    "AZURE_OPENAI_CHATGPT_DEPLOYMENT": "gpt-35-turbo-16k",
    "AZURE_OPENAI_CHATGPT_MODEL_NAME": "",
    "AZURE_OPENAI_CHATGPT_MODEL_VERSION": "",
    "USE_AZURE_OPENAI_EMBEDDINGS": "false",
    "EMBEDDING_DEPLOYMENT_NAME": "",
    "AZURE_OPENAI_EMBEDDINGS_MODEL_NAME": "",
    "AZURE_OPENAI_EMBEDDINGS_VERSION": "",
    "AZURE_OPENAI_SERVICE_KEY": None,
    "AZURE_SUBSCRIPTION_ID": None,
    "IS_GOV_CLOUD_DEPLOYMENT": "false",
    "CHAT_WARNING_BANNER_TEXT": "",
    "APPLICATION_TITLE": "Information Assistant, built with Azure OpenAI",
    "KB_FIELDS_CONTENT": "content",
    "KB_FIELDS_PAGENUMBER": "pages",
    "KB_FIELDS_SOURCEFILE": "file_uri",
    "KB_FIELDS_CHUNKFILE": "chunk_file",
    "COSMOSDB_URL": None,
    "COSMOSDB_KEY": None,
    "COSMOSDB_LOG_DATABASE_NAME": "statusdb",
    "COSMOSDB_LOG_CONTAINER_NAME": "statuscontainer",
    "COSMOSDB_TAGS_DATABASE_NAME": "tagsdb",
    "COSMOSDB_TAGS_CONTAINER_NAME": "tagscontainer",
    "QUERY_TERM_LANGUAGE": "English",
    "TARGET_EMBEDDINGS_MODEL": "BAAI/bge-small-en-v1.5",
    "ENRICHMENT_APPSERVICE_NAME": "enrichment"
}

for key, value in ENV.items():
    new_value = os.getenv(key)
    if new_value is not None:
        ENV[key] = new_value
    elif value is None:
        raise ValueError(f"Environment variable {key} not set")

str_to_bool = {'true': True, 'false': False}

log = logging.getLogger("uvicorn")
# log.setLevel(logging.DEBUG)

# embedding_service_suffix = "xyoek"

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed,
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential()
azure_search_key_credential = AzureKeyCredential(ENV["AZURE_SEARCH_SERVICE_KEY"])

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = "https://" + ENV["AZURE_OPENAI_SERVICE"] + ".openai.azure.com/"
openai.api_version = "2023-06-01-preview"

# Setup StatusLog to allow access to CosmosDB for logging
statusLog = StatusLog(
    ENV["COSMOSDB_URL"], ENV["COSMOSDB_KEY"], ENV["COSMOSDB_LOG_DATABASE_NAME"], ENV["COSMOSDB_LOG_CONTAINER_NAME"]
)
tagsHelper = TagsHelper(
    ENV["COSMOSDB_URL"], ENV["COSMOSDB_KEY"], ENV["COSMOSDB_TAGS_DATABASE_NAME"], ENV["COSMOSDB_TAGS_CONTAINER_NAME"]
)

# Comment these two lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
# openai.api_type = "azure_ad"
# openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = ENV["AZURE_OPENAI_SERVICE_KEY"]

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=ENV["AZURE_SEARCH_SERVICE_ENDPOINT"],
    index_name=ENV["AZURE_SEARCH_INDEX"],
    credential=azure_search_key_credential,
)
blob_client = BlobServiceClient(
    account_url=ENV["AZURE_BLOB_STORAGE_ENDPOINT"],
    credential=ENV["AZURE_BLOB_STORAGE_KEY"],
)
blob_container = blob_client.get_container_client(ENV["AZURE_BLOB_STORAGE_CONTAINER"])

model_name = ''
model_version = ''

if (str_to_bool.get(ENV["IS_GOV_CLOUD_DEPLOYMENT"])):
    model_name = ENV["AZURE_OPENAI_CHATGPT_MODEL_NAME"]
    model_version = ENV["AZURE_OPENAI_CHATGPT_MODEL_VERSION"]
    embedding_model_name = ENV["AZURE_OPENAI_EMBEDDINGS_MODEL_NAME"]
    embedding_model_version = ENV["AZURE_OPENAI_EMBEDDINGS_VERSION"]
else:
    # Set up OpenAI management client
    openai_mgmt_client = CognitiveServicesManagementClient(
        credential=azure_credential,
        subscription_id=ENV["AZURE_SUBSCRIPTION_ID"])

    deployment = openai_mgmt_client.deployments.get(
        resource_group_name=ENV["AZURE_OPENAI_RESOURCE_GROUP"],
        account_name=ENV["AZURE_OPENAI_SERVICE"],
        deployment_name=ENV["AZURE_OPENAI_CHATGPT_DEPLOYMENT"])

    model_name = deployment.properties.model.name
    model_version = deployment.properties.model.version

    if (str_to_bool.get(ENV["USE_AZURE_OPENAI_EMBEDDINGS"])):
        embedding_deployment = openai_mgmt_client.deployments.get(
            resource_group_name=ENV["AZURE_OPENAI_RESOURCE_GROUP"],
            account_name=ENV["AZURE_OPENAI_SERVICE"],
            deployment_name=ENV["EMBEDDING_DEPLOYMENT_NAME"])

        embedding_model_name = embedding_deployment.properties.model.name
        embedding_model_version = embedding_deployment.properties.model.version
    else:
        embedding_model_name = ""
        embedding_model_version = ""

chat_approaches = {
    "rrr": ChatReadRetrieveReadApproach(
        search_client,
        ENV["AZURE_OPENAI_SERVICE"],
        ENV["AZURE_OPENAI_SERVICE_KEY"],
        ENV["AZURE_OPENAI_CHATGPT_DEPLOYMENT"],
        ENV["KB_FIELDS_SOURCEFILE"],
        ENV["KB_FIELDS_CONTENT"],
        ENV["KB_FIELDS_PAGENUMBER"],
        ENV["KB_FIELDS_CHUNKFILE"],
        ENV["AZURE_BLOB_STORAGE_CONTAINER"],
        blob_client,
        ENV["QUERY_TERM_LANGUAGE"],
        model_name,
        model_version,
        str_to_bool.get(ENV["IS_GOV_CLOUD_DEPLOYMENT"]),
        ENV["TARGET_EMBEDDINGS_MODEL"],
        ENV["ENRICHMENT_APPSERVICE_NAME"]
    )
}


# Create API
app = FastAPI(
    title="IA Web API",
    description="A simple API",
    version="0.1.0",
    docs_url="/docs",
)

@app.get("/", include_in_schema=False, response_class=RedirectResponse)
async def root():
    return RedirectResponse(url="/index.html")


@app.post("/chat")
async def chat(request: Request):
    """Chat with the bot using a given approach"""
    start_time_req = time.time()
    json_body = await request.json()
    approach = json_body.get("approach")
    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return {"error": "unknown approach"}, 400
        r = impl.run(json_body.get("history", []), json_body.get("overrides", {}))

        end_time_req = time.time()
        elapsed_time_req = end_time_req - start_time_req
        print(f"The request took {elapsed_time_req} seconds to complete.")
        # To fix citation bug,below code is added.aparmar
        return {
                "data_points": r["data_points"],
                "answer": r["answer"],
                "thoughts": r["thoughts"],
                "citation_lookup": r["citation_lookup"],
            }
        

    except Exception as ex:
        print(f"Error in chat:: {ex}")
        traceback.print_exc()
        return {"error": str(ex)}, 500

@app.get("/getblobclienturl")
async def get_blob_client_url():
    """Get a URL for a file in Blob Storage with SAS token"""
    sas_token = generate_account_sas(
        ENV["AZURE_BLOB_STORAGE_ACCOUNT"],
        ENV["AZURE_BLOB_STORAGE_KEY"],
        resource_types=ResourceTypes(object=True, service=True, container=True),
        permission=AccountSasPermissions(
            read=True,
            write=True,
            list=True,
            delete=False,
            add=True,
            create=True,
            update=True,
            process=False,
        ),
        expiry=datetime.utcnow() + timedelta(hours=1),
    )
    return {"url": f"{blob_client.url}?{sas_token}"}

@app.post("/getalluploadstatus")
async def get_all_upload_status():
    """Get the status of all file uploads in the last N hours"""
    timeframe = request.json["timeframe"]
    state = request.json["state"]
    try:
        results = statusLog.read_files_status_by_timeframe(timeframe, State[state])
    except Exception as ex:
        log.exception("Exception in /getalluploadstatus")
        return {"error": str(ex)}, 500
    return results

@app.post("/logstatus")
async def logstatus():
    """Log the status of a file upload to CosmosDB"""
    try:
        path = request.json["path"]
        status = request.json["status"]
        status_classification = StatusClassification[request.json["status_classification"].upper()]
        state = State[request.json["state"].upper()]

        statusLog.upsert_document(document_path=path,
                                  status=status,
                                  status_classification=status_classification,
                                  state=state,
                                  fresh_start=True)
        statusLog.save_document(document_path=path)
        
    except Exception as ex:
        log.exception("Exception in /logstatus")
        return {"error": str(ex)}, 500
    return {"status": 200}

# Return AZURE_OPENAI_CHATGPT_DEPLOYMENT
@app.get("/getInfoData")
async def get_info_data():
    """Get the info data for the app"""
    response = {
            "AZURE_OPENAI_CHATGPT_DEPLOYMENT": ENV["AZURE_OPENAI_CHATGPT_DEPLOYMENT"],
            "AZURE_OPENAI_MODEL_NAME": f"{model_name}",
            "AZURE_OPENAI_MODEL_VERSION": f"{model_version}",
            "AZURE_OPENAI_SERVICE": ENV["AZURE_OPENAI_SERVICE"],
            "AZURE_SEARCH_SERVICE": ENV["AZURE_SEARCH_SERVICE"],
            "AZURE_SEARCH_INDEX": ENV["AZURE_SEARCH_INDEX"],
            "TARGET_LANGUAGE": ENV["QUERY_TERM_LANGUAGE"],
            "USE_AZURE_OPENAI_EMBEDDINGS": ENV["USE_AZURE_OPENAI_EMBEDDINGS"],
            "EMBEDDINGS_DEPLOYMENT": ENV["EMBEDDING_DEPLOYMENT_NAME"],
            "EMBEDDINGS_MODEL_NAME": f"{embedding_model_name}",
            "EMBEDDINGS_MODEL_VERSION": f"{embedding_model_version}",
        }
    return response

# Return AZURE_OPENAI_CHATGPT_DEPLOYMENT
@app.get("/getWarningBanner")
async def get_warning_banner():
    """Get the warning banner text"""
    response ={
            "WARNING_BANNER_TEXT": ENV["CHAT_WARNING_BANNER_TEXT"]
        }
    return response

@app.post("/getcitation")
async def get_citation():
    """Get the citation for a given file"""
    citation = urllib.parse.unquote(request.json["citation"])
    try:
        blob = blob_container.get_blob_client(citation).download_blob()
        decoded_text = blob.readall().decode()
        results = json.loads(decoded_text)
    except Exception as ex:
        log.exception("Exception in /getalluploadstatus")
        return {"error": str(ex)}, 500
    return results.json

# Return APPLICATION_TITLE
@app.get("/getApplicationTitle")
async def get_application_title():
    """Get the application title text"""
    response = {
            "APPLICATION_TITLE": ENV["APPLICATION_TITLE"]
        }
    return response

@app.get("/getalltags")
async def get_all_tags():
    """Get the status of all tags in the system"""
    try:
        results = tagsHelper.get_all_tags()
    except Exception as ex:
        log.exception("Exception in /getalltags")
        return {"error": str(ex)}, 500
    return results

app.mount("/", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    log.info("IA WebApp Starting Up...")
