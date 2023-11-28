# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from datetime import datetime, timedelta

import json
import logging
import os
import time
import urllib.parse
import uuid
import core.exporthelper as exporthelper
import msal
import openai
import requests

from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
from azure.mgmt.cognitiveservices import CognitiveServicesManagementClient
from azure.search.documents import SearchClient
from azure.storage.blob import (
    AccountSasPermissions,
    BlobSasPermissions,
    BlobServiceClient,
    ResourceTypes,
    generate_account_sas,
    generate_blob_sas,
)
from flask import Flask, jsonify, redirect, request, send_file, session, url_for
from opencensus.ext.azure.log_exporter import AzureLogHandler
from shared_code.status_log import State, StatusClassification, StatusLog
from request_log import RequestLog
from shared_code.tags_helper import TagsHelper

str_to_bool = {'true': True, 'false': False}
# Replace these with your own values, either in environment variables or directly here
AZURE_BLOB_STORAGE_ACCOUNT = os.environ.get("AZURE_BLOB_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_BLOB_STORAGE_ENDPOINT = os.environ.get("AZURE_BLOB_STORAGE_ENDPOINT")
AZURE_BLOB_STORAGE_KEY = os.environ.get("AZURE_BLOB_STORAGE_KEY")
AZURE_BLOB_EXPORT_CONTAINER = os.environ.get("AZURE_BLOB_EXPORT_CONTAINER") or "export"
AZURE_BLOB_STORAGE_CONTAINER = os.environ.get("AZURE_BLOB_STORAGE_CONTAINER") or "content"
AZURE_BLOB_UPLOAD_CONTAINER = os.environ.get("AZURE_BLOB_UPLOAD_CONTAINER") or "upload"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "gptkb"
AZURE_SEARCH_SERVICE_ENDPOINT = os.environ.get("AZURE_SEARCH_SERVICE_ENDPOINT")
AZURE_SEARCH_SERVICE_KEY = os.environ.get("AZURE_SEARCH_SERVICE_KEY")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "gptkbindex"
AZURE_OPENAI_ACCOUNT_NAME = os.environ.get("AZURE_OPENAI_ACCOUNT_NAME") or "myopenai"
AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or AZURE_OPENAI_ACCOUNT_NAME
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "gpt-35-turbo-16k"
AZURE_OPENAI_RESOURCE_GROUP = os.environ.get("AZURE_OPENAI_RESOURCE_GROUP") or ""
AZURE_OPENAI_CHATGPT_MODEL_NAME = ( os.environ.get("AZURE_OPENAI_CHATGPT_MODEL_NAME") or "")
AZURE_OPENAI_CHATGPT_MODEL_VERSION = ( os.environ.get("AZURE_OPENAI_CHATGPT_MODEL_VERSION") or "")
USE_AZURE_OPENAI_EMBEDDINGS = str_to_bool.get(os.environ.get("USE_AZURE_OPENAI_EMBEDDINGS").lower()) or False
EMBEDDING_DEPLOYMENT_NAME = ( os.environ.get("EMBEDDING_DEPLOYMENT_NAME") or "")
AZURE_OPENAI_EMBEDDINGS_MODEL_NAME = ( os.environ.get("AZURE_OPENAI_EMBEDDINGS_MODEL_NAME") or "")
AZURE_OPENAI_EMBEDDINGS_VERSION = ( os.environ.get("AZURE_OPENAI_EMBEDDINGS_VERSION") or "")

AZURE_OPENAI_SERVICE_KEY = os.environ.get("AZURE_OPENAI_SERVICE_KEY")
AZURE_SUBSCRIPTION_ID = os.environ.get("AZURE_SUBSCRIPTION_ID")
IS_GOV_CLOUD_DEPLOYMENT = str_to_bool.get(os.environ.get("IS_GOV_CLOUD_DEPLOYMENT").lower()) or False
CHAT_WARNING_BANNER_TEXT = os.environ.get("CHAT_WARNING_BANNER_TEXT") or ""

TARGET_EMBEDDING_MODEL = os.environ.get("TARGET_EMBEDDING_MODEL") or "azure-openai_text-embedding-ada-002"
ENRICHMENT_APPSERVICE_NAME = os.environ.get("ENRICHMENT_APPSERVICE_NAME") or "enrichment"
APPLICATION_TITLE = os.environ.get("APPLICATION_TITLE") or "Coeus - Internal Use Only"

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "content"
KB_FIELDS_PAGENUMBER = os.environ.get("KB_FIELDS_PAGENUMBER") or "pages"
KB_FIELDS_SOURCEFILE = os.environ.get("KB_FIELDS_SOURCEFILE") or "file_uri"
KB_FIELDS_CHUNKFILE = os.environ.get("KB_FIELDS_CHUNKFILE") or "chunk_file"

COSMOSDB_URL = os.environ.get("COSMOSDB_URL")
COSMODB_KEY = os.environ.get("COSMOSDB_KEY")
COSMOSDB_REQUESTLOG_DATABASE_NAME = os.environ.get("COSMOSDB_REQUESTLOG_DATABASE_NAME")
COSMOSDB_REQUESTLOG_CONTAINER_NAME = os.environ.get("COSMOSDB_REQUESTLOG_CONTAINER_NAME")
COSMOSDB_LOG_DATABASE_NAME = os.environ.get("COSMOSDB_LOG_DATABASE_NAME") or "statusdb"
COSMOSDB_LOG_CONTAINER_NAME = os.environ.get("COSMOSDB_LOG_CONTAINER_NAME") or "statuscontainer"
COSMOSDB_TAGS_DATABASE_NAME = os.environ.get("COSMOSDB_TAGS_DATABASE_NAME") or "tagdb"
COSMOSDB_TAGS_CONTAINER_NAME = os.environ.get("COSMOSDB_TAGS_CONTAINER_NAME") or "tagcontainer"

QUERY_TERM_LANGUAGE = os.environ.get("QUERY_TERM_LANGUAGE") or "English"

# Oauth
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID")
REDIRECT_URI = os.getenv("REDIRECT_URI") or "http://localhost:5000/authorized"
AUTHORITY = os.getenv("AUTHORITY") or f"https://login.microsoftonline.com/{TENANT_ID}"
SCOPES = ["User.Read"]

# Misc app settings
APP_SECRET = os.getenv("APP_SECRET")
DEBUG = os.getenv("CODESPACES") == "true"
SCHEME = "http" if DEBUG else "https"
LOGOUT_URL = os.getenv("LOGOUT_URL") or "https://treasuryqld.sharepoint.com/sites/corporate/"

os.environ['TZ'] = 'Australia/Brisbane'
time.tzset()

app = Flask(__name__)
app.config['SECRET_KEY'] = APP_SECRET
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)

msal_client = msal.ConfidentialClientApplication(
    CLIENT_ID, authority=AUTHORITY,
    client_credential=CLIENT_SECRET,
)

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed,
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential()
azure_search_key_credential = AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = "2023-06-01-preview"

# Setup logger
logger = logging.getLogger(__name__)
logger.addHandler(AzureLogHandler())
if DEBUG:
    logger.setLevel(logging.DEBUG)

# Setup StatusLog to allow access to CosmosDB for logging
statusLog = StatusLog(
    COSMOSDB_URL, COSMODB_KEY, COSMOSDB_LOG_DATABASE_NAME, COSMOSDB_LOG_CONTAINER_NAME
)
tagsHelper = TagsHelper(
    COSMOSDB_URL, COSMODB_KEY, COSMOSDB_TAGS_DATABASE_NAME, COSMOSDB_TAGS_CONTAINER_NAME
)

# Setup RequestLog to allow access to CosmosDB for request logging
requestLog = RequestLog(
    COSMOSDB_URL, COSMODB_KEY, COSMOSDB_REQUESTLOG_DATABASE_NAME, COSMOSDB_REQUESTLOG_CONTAINER_NAME
)

# Comment these two lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
# openai.api_type = "azure_ad"
# openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = AZURE_OPENAI_SERVICE_KEY

# Set up clients for Cognitive Search and Storage
SEARCH_CLIENT = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_search_key_credential,
)
BLOB_CLIENT = BlobServiceClient(
    account_url=f"https://{AZURE_BLOB_STORAGE_ACCOUNT}.blob.core.windows.net",
    credential=AZURE_BLOB_STORAGE_KEY,
)
blob_container = BLOB_CLIENT.get_container_client(AZURE_BLOB_STORAGE_CONTAINER)
export_container = BLOB_CLIENT.get_container_client(AZURE_BLOB_EXPORT_CONTAINER)

MODEL_NAME = ''
MODEL_VERSION = ''

if (IS_GOV_CLOUD_DEPLOYMENT):
    MODEL_NAME = AZURE_OPENAI_CHATGPT_MODEL_NAME
    MODEL_VERSION = AZURE_OPENAI_CHATGPT_MODEL_VERSION
    embedding_model_name = AZURE_OPENAI_EMBEDDINGS_MODEL_NAME
    embedding_model_version = AZURE_OPENAI_EMBEDDINGS_VERSION
else:
    # Set up OpenAI management client
    openai_mgmt_client = CognitiveServicesManagementClient(
        credential=azure_credential,
        subscription_id=AZURE_SUBSCRIPTION_ID)

    deployment = openai_mgmt_client.deployments.get(
        resource_group_name=AZURE_OPENAI_RESOURCE_GROUP,
        account_name=AZURE_OPENAI_ACCOUNT_NAME,
        deployment_name=AZURE_OPENAI_CHATGPT_DEPLOYMENT)

    MODEL_NAME = deployment.properties.model.name
    MODEL_VERSION = deployment.properties.model.version

    if USE_AZURE_OPENAI_EMBEDDINGS:
        embedding_deployment = openai_mgmt_client.deployments.get(
            resource_group_name=AZURE_OPENAI_RESOURCE_GROUP,
            account_name=AZURE_OPENAI_ACCOUNT_NAME,
            deployment_name=EMBEDDING_DEPLOYMENT_NAME)

        embedding_model_name = embedding_deployment.properties.model.name
        embedding_model_version = embedding_deployment.properties.model.version
    else:
        embedding_model_name = ""
        embedding_model_version = ""

chat_approaches = {
    "rrr": ChatReadRetrieveReadApproach(
        SEARCH_CLIENT,
        AZURE_OPENAI_SERVICE,
        AZURE_OPENAI_SERVICE_KEY,
        AZURE_OPENAI_CHATGPT_DEPLOYMENT,
        KB_FIELDS_SOURCEFILE,
        KB_FIELDS_CONTENT,
        KB_FIELDS_PAGENUMBER,
        KB_FIELDS_CHUNKFILE,
        AZURE_BLOB_STORAGE_CONTAINER,
        BLOB_CLIENT,
        QUERY_TERM_LANGUAGE,
        MODEL_NAME,
        MODEL_VERSION,
        IS_GOV_CLOUD_DEPLOYMENT,
        TARGET_EMBEDDING_MODEL,
        ENRICHMENT_APPSERVICE_NAME
    )
}


def token_is_valid():
    if "token_expires_at" in session:
        expiration_time = session["token_expires_at"]
        current_time = time.time()
        return current_time < expiration_time  # Check if token has expired
    return False  # Token expiration time not found in session


def check_authenticated():
    non_auth_endpoints = ['authorized', 'login', 'logout']
    if request.endpoint not in non_auth_endpoints and not token_is_valid():
        return redirect(url_for('login'))
    return None


@app.route("/login")
def login():
    session["state"] = str(uuid.uuid4())
    auth_url = msal_client.get_authorization_request_url(
        scopes=SCOPES,
        state=session["state"],
        redirect_uri=url_for("authorized", _external=True, _scheme=SCHEME)
    )
    return redirect(auth_url)


@app.route("/authorized")
def authorized():
    if request.args.get("state") != session.get("state"):
        return redirect("/")  # State mismatch, abort.

    if "error" in request.args:
        return "Error: " + request.args["error_description"]

    if request.args.get("code"):
        token_response = msal_client.acquire_token_by_authorization_code(
            request.args["code"],
            scopes=SCOPES,
            redirect_uri=url_for("authorized", _external=True, _scheme=SCHEME)
        )
        if "error" in token_response:
            return "Error: " + token_response["error_description"]

        session["access_token"] = token_response["access_token"]
        session["token_expires_at"] = token_response["expires_in"] + time.time()

        graph_data = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            timeout=30,
            headers={"Authorization": "Bearer " + session["access_token"]},
        ).json()

        session["user_data"] = graph_data

        return redirect("/")

    return redirect(url_for("login"))


@app.route("/user")
def get_user_info():
    user_data = session["user_data"]
    user_data["session_id"] = session["state"]
    return jsonify(user_data)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(LOGOUT_URL)


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    """Serve static files from the 'static' directory"""
    return app.send_static_file(path)


@app.route("/chat", methods=["POST"])
def chat():
    """Chat with the bot using a given approach"""
    approach = request.json["approach"]
    try:
        request_id = str(uuid.uuid4())
        start_time = datetime.now()

        # Log the request to CosmosDB
        json_document = requestLog.log_request(request_id, request.json, start_time)

        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["history"],
                     request.json.get("overrides") or {})
        
        # Check if there was an error
        if r.get("error_message"):
            raise ValueError(r["error_message"]) 

        response = jsonify(
            {
                "data_points": r["data_points"],
                "answer": r["answer"],
                "thoughts": r["thoughts"],
                "citation_lookup": r["citation_lookup"],
                "request_id": request_id,
                "generated_query": r["generated_query"],
            }
        )

        finish_time = datetime.now()

        # Log the request/response to CosmosDB
        requestLog.log_response(request_id, json_document, r, finish_time)

        return response

    except Exception as ex:
        finish_time = datetime.now()
        # Send the response body if it made it that far, otherwise send the exception message
        requestLog.log_response(request_id, json_document, locals().get('r', {"error_message": str(ex)}), finish_time)
        logging.exception("Exception in /chat")
        return jsonify({"error": str(ex)}), 500


@app.route("/getblobclienturl")
def get_blob_client_url():
    """Get a URL for a file in Blob Storage with SAS token"""
    sas_token = generate_account_sas(
        AZURE_BLOB_STORAGE_ACCOUNT,
        AZURE_BLOB_STORAGE_KEY,
        resource_types=ResourceTypes(
            object=True, service=True, container=True),
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
    return jsonify({"url": f"{BLOB_CLIENT.url}?{sas_token}"})


@app.route("/getBlobUrl", methods=["POST"])
def get_blob_sas():
    file_name = urllib.parse.unquote(request.json["file_name"])
    sas_token = generate_blob_sas(
        account_name=AZURE_BLOB_STORAGE_ACCOUNT,
        container_name=AZURE_BLOB_UPLOAD_CONTAINER,
        blob_name=file_name,
        account_key=AZURE_BLOB_STORAGE_KEY,
        permission=BlobSasPermissions(
            read=True,
            write=False,
            list=False,
            delete=False,
            add=False,
            create=False,
            update=False,
            process=False,
        ),
        expiry=datetime.utcnow() + timedelta(minutes=15),
    )
    return jsonify({"url": f"{BLOB_CLIENT.url}{AZURE_BLOB_UPLOAD_CONTAINER}/{file_name}?{sas_token}"})


@app.route("/getAllUploadStatus", methods=["POST"])
def get_all_upload_status():
    """Get the status of all file uploads in the last N hours"""
    timeframe = request.json.get("timeframe")
    state = request.json.get("state")
    folder_name = request.json.get("folder_name")
    try:
        results = statusLog.read_files_status_by_timeframe(timeframe, State[state], folder_name)
    except Exception as ex:
        logging.exception("Exception in /getAllUploadStatus")
        return jsonify({"error": str(ex)}), 500
    return jsonify(results)


@app.route("/logStatus", methods=["POST"])
def log_status():
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
        logging.exception("Exception in /logStatus")
        return jsonify({"error": str(ex)}), 500
    return jsonify({"status": 200})


@app.route("/getInfoData")
def get_info_data():
    """Get the info data for the app"""
    user_data = session["user_data"]
    user_data["session_id"] = session["state"]
    response = jsonify(
        {
            "AZURE_OPENAI_CHATGPT_DEPLOYMENT": f"{AZURE_OPENAI_CHATGPT_DEPLOYMENT}",
            "AZURE_OPENAI_MODEL_NAME": f"{MODEL_NAME}",
            "AZURE_OPENAI_MODEL_VERSION": f"{MODEL_VERSION}",
            "AZURE_OPENAI_SERVICE": f"{AZURE_OPENAI_SERVICE}",
            "AZURE_SEARCH_SERVICE": f"{AZURE_SEARCH_SERVICE}",
            "AZURE_SEARCH_INDEX": f"{AZURE_SEARCH_INDEX}",
            "TARGET_LANGUAGE": f"{QUERY_TERM_LANGUAGE}",
            "USE_AZURE_OPENAI_EMBEDDINGS": USE_AZURE_OPENAI_EMBEDDINGS,
            "EMBEDDINGS_DEPLOYMENT": f"{EMBEDDING_DEPLOYMENT_NAME}",
            "EMBEDDINGS_MODEL_NAME": f"{embedding_model_name}",
            "EMBEDDINGS_MODEL_VERSION": f"{embedding_model_version}",
            "USER_DATA": user_data
        })
    return response


@app.route("/getWarningBanner")
def get_warning_banner():
    """Get the warning banner text"""
    response = jsonify(
        {
            "WARNING_BANNER_TEXT": f"{CHAT_WARNING_BANNER_TEXT}"
        })
    return response


@app.route("/getCitation", methods=["POST"])
def get_citation():
    """Get the citation for a given file"""
    citation = urllib.parse.unquote(request.json["citation"])
    try:
        blob = blob_container.get_blob_client(citation).download_blob()
        decoded_text = blob.readall().decode()
        results = jsonify(json.loads(decoded_text))

    except Exception as ex:
        logging.exception("Exception in /getCitation")
        return jsonify({"error": str(ex)}), 500

    return jsonify(results.json)


@app.route('/exportAnswer', methods=["POST"])
def export():
    try:
        file_name, export_file = exporthelper.export_to_blob(request.json,
                                                             export_container,
                                                             AZURE_OPENAI_SERVICE,
                                                             AZURE_OPENAI_SERVICE_KEY,
                                                             AZURE_OPENAI_CHATGPT_DEPLOYMENT,
                                                             MODEL_NAME)

    except Exception as ex:
        logging.exception("Exception in /exportAnswer")
        return jsonify({"error": str(ex)}), 500

    return send_file(export_file,
                     as_attachment=True,
                     download_name=file_name
                     )

# Return APPLICATION_TITLE
@app.route("/getApplicationTitle")
def get_application_title():
    """Get the application title text"""
    response = jsonify(
        {
            "APPLICATION_TITLE": f"{APPLICATION_TITLE}"
        })
    return response


@app.route("/getAllTags", methods=["GET"])
def get_all_tags():
    """Get the status of all tags in the system"""
    try:
        results = tagsHelper.get_all_tags()
    except Exception as ex:
        logging.exception("Exception in /getAllTags")
        return jsonify({"error": str(ex)}), 500
    return jsonify(results)

app.before_request(check_authenticated)

if __name__ == "__main__":
    # app.run(debug=DEBUG)
    logging.info("IA WebApp Starting Up...")
    app.run(threaded=True)
