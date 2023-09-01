# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import logging
import mimetypes
import os
import urllib.parse
import uuid
from datetime import datetime, timedelta
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
from requests_oauthlib import OAuth2Session

AZURE_BLOB_STORAGE_ACCOUNT = os.environ.get("AZURE_BLOB_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_BLOB_STORAGE_KEY = os.environ.get("AZURE_BLOB_STORAGE_KEY")
AZURE_BLOB_STORAGE_CONTAINER = os.environ.get("AZURE_BLOB_STORAGE_CONTAINER") or "content"
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

APP_SECRET = os.getenv('APP_SECRET')
CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')
TENANT_ID = os.getenv('TENANT_ID')
REDIRECT_URI = os.getenv('REDIRECT_URI') or 'http://localhost:5000/authorized'
AUTHORIZATION_ENDPOINT = os.getenv('AUTHORIZATION_ENDPOINT') or f'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize'
TOKEN_ENDPOINT = os.getenv('TOKEN_ENDPOINT') or f'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token'
SCOPES = ['openid', 'User.Read', 'profile', 'email']

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
# logger.setLevel(logging.DEBUG)

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

app = Flask(__name__)
app.secret_key = APP_SECRET

oauth = OAuth2Session(
    CLIENT_ID, redirect_uri=REDIRECT_URI, scope=SCOPES)


def check_authenticated():
    if 'oauth_token' not in session and request.endpoint not in ['authorized', 'login']:
        return redirect(url_for('login'))


@app.route('/login')
def login():
    # Redirect to the OAuth2 flow
    authorization_url, _ = oauth.authorization_url(AUTHORIZATION_ENDPOINT)

    return redirect(authorization_url)


@app.route('/authorized')
def authorized():
    token = oauth.fetch_token(
        TOKEN_ENDPOINT,
        client_secret=CLIENT_SECRET,
        authorization_response=request.url
    )

    # Get user info from Graph API
    user_info = oauth.get(
        'https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,jobTitle,mail,userPrincipalName').json()

    # Store token and user information in the session
    user_info['session_id'] = str(uuid.uuid4())
    session['oauth_token'] = token
    session['user_info'] = user_info

    return redirect('/')


@app.route('/user')
def get_user_info():
    user_info = session['user_info']
    return jsonify(user_info)


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
        session_id = session['user_info']['session_id']
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
            logger, session_id, request_id, request.json, r, start_time, finish_time)

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


if __name__ == "__main__":
    app.run()


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


# Return AZURE_OPENAI_CHATGPT_DEPLOYMENT
@app.route("/getInfoData")
def get_info_data():
    response = jsonify(
        {
            "AZURE_OPENAI_CHATGPT_DEPLOYMENT": f"{AZURE_OPENAI_CHATGPT_DEPLOYMENT}",
            "AZURE_OPENAI_CHATGPT_MODEL": f"{AZURE_OPENAI_CHATGPT_MODEL}",
        })
    return response


app.before_request(check_authenticated)
