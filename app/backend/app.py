# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from datetime import datetime, timedelta

import logging
import mimetypes
import os
import requests
import time
import urllib.parse
import uuid
import msal
import openai

from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from azure.storage.blob import (
    AccountSasPermissions,
    BlobServiceClient,
    ResourceTypes,
    generate_account_sas,
)
from flask import Flask, jsonify, redirect, request, session, url_for
from opencensus.ext.azure.log_exporter import AzureLogHandler
from shared_code.status_log import State, StatusLog
from request_log import RequestLog

AZURE_BLOB_STORAGE_ACCOUNT = os.environ.get("AZURE_BLOB_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_BLOB_STORAGE_KEY = os.environ.get("AZURE_BLOB_STORAGE_KEY")
AZURE_BLOB_STORAGE_CONTAINER = os.environ.get("AZURE_BLOB_STORAGE_CONTAINER") or "content"
AZURE_BLOB_CONNECTION_STRING = f"DefaultEndpointsProtocol=https;AccountName={AZURE_BLOB_STORAGE_ACCOUNT};AccountKey={AZURE_BLOB_STORAGE_KEY};EndpointSuffix=core.windows.net"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "gptkb"
AZURE_SEARCH_SERVICE_KEY = os.environ.get("AZURE_SEARCH_SERVICE_KEY")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "gptkbindex"
AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or "myopenai"
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_MODEL = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL") or "gpt-35-turbo"
AZURE_OPENAI_SERVICE_KEY = os.environ.get("AZURE_OPENAI_SERVICE_KEY")

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "merged_content"
KB_FIELDS_CATEGORY = os.environ.get("KB_FIELDS_CATEGORY") or "category"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "file_storage_path"

COSMOSDB_URL = os.environ.get("COSMOSDB_URL")
COSMODB_KEY = os.environ.get("COSMOSDB_KEY")
COSMOSDB_DATABASE_NAME = os.environ.get("COSMOSDB_DATABASE_NAME") or "statusdb"
COSMOSDB_CONTAINER_NAME = os.environ.get("COSMOSDB_CONTAINER_NAME") or "statuscontainer"
COSMOSDB_REQUESTLOG_DATABASE_NAME = os.environ.get("COSMOSDB_REQUESTLOG_DATABASE_NAME")
COSMOSDB_REQUESTLOG_CONTAINER_NAME = os.environ.get("COSMOSDB_REQUESTLOG_CONTAINER_NAME")
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
    COSMOSDB_URL, COSMODB_KEY, COSMOSDB_DATABASE_NAME, COSMOSDB_CONTAINER_NAME
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

chat_approaches = {
    "rrr": ChatReadRetrieveReadApproach(
        SEARCH_CLIENT,
        AZURE_OPENAI_SERVICE,
        AZURE_OPENAI_SERVICE_KEY,
        AZURE_OPENAI_CHATGPT_DEPLOYMENT,
        AZURE_OPENAI_CHATGPT_MODEL,
        KB_FIELDS_SOURCEPAGE,
        KB_FIELDS_CONTENT,
        BLOB_CLIENT,
        QUERY_TERM_LANGUAGE,
    )
}

def token_is_valid():
    if "token_expires_at" in session:
        expiration_time = session["token_expires_at"]
        current_time = time.time()
        return current_time < expiration_time # Check if token has expired
    return False  # Token expiration time not found in session


def check_authenticated():
    non_auth_endpoints = ['authorized', 'login', 'logout']
    if request.endpoint not in non_auth_endpoints and not token_is_valid():
        return redirect(url_for('login'))
    return None


@app.route("/login")
def login():
    session["session_id"] = str(uuid.uuid4())
    auth_url = msal_client.get_authorization_request_url(
        scopes=SCOPES,
        state=session["session_id"],
        redirect_uri=url_for("authorized", _external=True, _scheme=SCHEME)
    )
    return redirect(auth_url)


@app.route("/authorized")
def authorized():
    if request.args.get("state") != session.get("session_id"):
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

        return redirect("/")

    return redirect(url_for("login"))

@app.route("/user")
def get_user_info():
    if "access_token" in session:
        graph_data = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            timeout=30,
            headers={"Authorization": "Bearer " + session["access_token"]},
        ).json()
    return jsonify(graph_data)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(LOGOUT_URL)


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

# Return blob path with SAS token for citation access
@app.route("/content/<path:path>")
def content_file(path):
    blob = blob_container.get_blob_client(path).download_blob()
    mime_type = blob.properties["content_settings"]["content_type"]
    file_extension = blob.properties["name"].split(".")[-1:]
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    if mime_type == "text/plain" and file_extension[0] in ["htm", "html"]:
        mime_type = "text/html"
    print(
        "Using mime type: "
        + mime_type
        + "for file with extension: "
        + file_extension[0]
    )
    return (
        blob.readall(),
        200,
        {
            "Content-Type": mime_type,
            "Content-Disposition": f"inline; filename={urllib.parse.quote(path, safe='')}",
        },
    )


@app.route("/chat", methods=["POST"])
def chat():
    approach = request.json["approach"]
    try:
        request_id = str(uuid.uuid4())
        start_time = datetime.now()
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["history"],
                     request.json.get("overrides") or {})

        # return jsonify(r)
        # To fix citation bug,below code is added.aparmar
        response = jsonify(
            {
                "data_points": r["data_points"],
                "answer": r["answer"],
                "thoughts": r["thoughts"],
                "citation_lookup": r["citation_lookup"],
                "request_id": request_id,
            }
        )

        finish_time = datetime.now()

        # Log the request/response to CosmosDB
        requestLog.log_request_response(
            logger, request_id, request.json, r, start_time, finish_time)

        return response

    except Exception as e:
        logger.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500


@app.route("/getblobclienturl")
def get_blob_client_url():
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


@app.route("/getalluploadstatus", methods=["POST"])
def get_all_upload_status():
    timeframe = request.json["timeframe"]
    state = request.json["state"]
    try:
        results = statusLog.read_files_status_by_timeframe(
            timeframe, State[state])
    except Exception as e:
        logger.exception("Exception in /getalluploadstatus")
        return jsonify({"error": str(e)}), 500
    return jsonify(results)


@app.route("/getInfoData")
def get_info_data():
    response = jsonify(
        {
            "AZURE_OPENAI_CHATGPT_DEPLOYMENT": f"{AZURE_OPENAI_CHATGPT_DEPLOYMENT}",
            "AZURE_OPENAI_CHATGPT_MODEL": f"{AZURE_OPENAI_CHATGPT_MODEL}",
        })
    return response


if __name__ == "__main__":
    app.run()


app.before_request(check_authenticated)
