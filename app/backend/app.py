# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from datetime import datetime, timedelta

import base64
import json
import logging
import mimetypes
import os
import re
import time
import urllib.parse
import uuid
import core.exporthelper as exporthelper
import msal
import requests

from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from approaches.chat import ChatApproach
from azure.core.credentials import AzureKeyCredential
from azure.identity.aio import DefaultAzureCredential#, get_bearer_token_provider
from azure.mgmt.cognitiveservices.aio import CognitiveServicesManagementClient
from azure.monitor.opentelemetry import configure_azure_monitor
from azure.search.documents.aio import SearchClient
from azure.storage.blob.aio import BlobServiceClient
from azure.storage.blob import (
    AccountSasPermissions,
    BlobSasPermissions,
    ResourceTypes,
    generate_account_sas,
    generate_blob_sas,
)
from azure.storage.queue.aio import QueueClient
from azure.storage.queue import TextBase64EncodePolicy
from openai import APIError, AsyncAzureOpenAI, AsyncOpenAI
# from opencensus.ext.azure.log_exporter import AzureLogHandler
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from quart import (
    Quart,
    Blueprint,
    current_app,
    jsonify,
    make_response,
    redirect,
    request,
    send_file,
    session,
    url_for
)
from quart_cors import cors
from core.request_log import RequestLog
from core.status_log import State, StatusClassification, StatusLog
from core.userdata_log import UserDataLog
from typing import AsyncGenerator

str_to_bool = {"true": True, "false": False}
AZURE_BLOB_STORAGE_ACCOUNT = os.environ.get("AZURE_BLOB_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_BLOB_STORAGE_ENDPOINT = os.environ.get("AZURE_BLOB_STORAGE_ENDPOINT")
AZURE_BLOB_STORAGE_KEY = os.environ.get("AZURE_BLOB_STORAGE_KEY")
AZURE_BLOB_EXPORT_CONTAINER = os.environ.get("AZURE_BLOB_EXPORT_CONTAINER") or "export"
AZURE_BLOB_STORAGE_CONTAINER = os.environ.get("AZURE_BLOB_STORAGE_CONTAINER") or "content"
AZURE_BLOB_UPLOAD_CONTAINER = os.environ.get("AZURE_BLOB_UPLOAD_CONTAINER") or "upload"
AZURE_BLOB_WEBSITE_CONTAINER = os.environ.get("AZURE_BLOB_WEBSITE_CONTAINER") or "website"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "gptkb"
AZURE_SEARCH_SERVICE_ENDPOINT = os.environ.get("AZURE_SEARCH_SERVICE_ENDPOINT")
AZURE_SEARCH_SERVICE_KEY = os.environ.get("AZURE_SEARCH_SERVICE_KEY")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "vector-index"
SEARCH_INDEX_UPDATE_QUEUE = os.environ["SEARCH_INDEX_UPDATE_QUEUE"]

OPENAI_HOST = os.environ.get("OPENAI_HOST") or "azure"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY") or "NA"
OPENAI_ORGANIZATION = os.environ.get("OPENAI_ORGANIZATION") or "NA"
AZURE_OPENAI_ACCOUNT_NAME = os.environ.get("AZURE_OPENAI_ACCOUNT_NAME") or "myopenai"
AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or AZURE_OPENAI_ACCOUNT_NAME
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "gpt-35-turbo-16k"
AZURE_OPENAI_RESOURCE_GROUP = os.environ.get("AZURE_OPENAI_RESOURCE_GROUP") or ""
AZURE_OPENAI_CHATGPT_MODEL_NAME = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL_NAME") or ""
AZURE_OPENAI_CHATGPT_MODEL_VERSION = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL_VERSION") or ""
USE_AZURE_OPENAI_EMBEDDINGS = str_to_bool.get(os.environ.get("USE_AZURE_OPENAI_EMBEDDINGS").lower()) or False
EMBEDDING_DEPLOYMENT_NAME = os.environ.get("EMBEDDING_DEPLOYMENT_NAME") or ""
AZURE_OPENAI_EMBEDDINGS_MODEL_NAME = os.environ.get("AZURE_OPENAI_EMBEDDINGS_MODEL_NAME") or ""
AZURE_OPENAI_EMBEDDINGS_MODEL_VERSION = os.environ.get("AZURE_OPENAI_EMBEDDINGS_MODEL_VERSION") or ""

AZURE_OPENAI_SERVICE_KEY = os.environ.get("AZURE_OPENAI_SERVICE_KEY")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION")
AZURE_SUBSCRIPTION_ID = os.environ.get("AZURE_SUBSCRIPTION_ID")
CHAT_WARNING_BANNER_TEXT = os.environ.get("CHAT_WARNING_BANNER_TEXT") or ""

TARGET_EMBEDDINGS_MODEL = os.environ.get("TARGET_EMBEDDINGS_MODEL")
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
COSMOSDB_USER_DATABASE_NAME = os.environ.get("COSMOSDB_USER_DATABASE_NAME") or "userdatadb"
COSMOSDB_USER_CONTAINER_NAME = os.environ.get("COSMOSDB_USER_CONTAINER_NAME") or "userdatacontainer"

QUERY_TERM_LANGUAGE = os.environ.get("QUERY_TERM_LANGUAGE") or "English"

ERROR_MESSAGE_TEMPLATE = """The application encountered an error processing your request.\n\n{error_message}"""
ERROR_MESSAGE_FILTER = """Your message contains content that was flagged by the OpenAI content filter."""

# Oauth
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID")
REDIRECT_URI = os.getenv("REDIRECT_URI") or "http://localhost:5000/authorized"
AUTHORITY = os.getenv("AUTHORITY") or f"https://login.microsoftonline.com/{TENANT_ID}"
SCOPES = ["User.Read"]
ADMIN_GROUP_NAME = os.getenv("ADMIN_GROUP_NAME")

# Misc app settings
APP_SECRET = os.getenv("APP_SECRET")
DEBUG = os.getenv("CODESPACES") == "true"
SCHEME = "http" if DEBUG else "https"
LOGOUT_URL = os.getenv("LOGOUT_URL") or "https://www.treasury.qld.gov.au/"

os.environ["TZ"] = "Australia/Brisbane"
time.tzset()

azure_credential = DefaultAzureCredential()
azure_search_key_credential = AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)

# Set up clients
MSAL_CLIENT = None
OPENAI_CLIENT = None
SEARCH_CLIENT = None
BLOB_CLIENT = None
QUEUE_CLIENT = None
BLOB_CONTAINER_CONTENT = None
BLOB_CONTAINER_UPLOAD = None
BLOB_CONTAINER_EXPORT = None
BLOB_CONTAINER_WEBSITE = None

def create_msal_client():
    return msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET
)


async def create_openai_client():
    if OPENAI_HOST == "azure":
        # token_provider = get_bearer_token_provider(azure_credential, "https://cognitiveservices.azure.com/.default")
        return AsyncAzureOpenAI(
            api_version = AZURE_OPENAI_API_VERSION,
            azure_endpoint = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com",
            api_key = AZURE_OPENAI_SERVICE_KEY
            # azure_ad_token_provider = token_provider,
        )
    else:
        return AsyncOpenAI(
            api_key=OPENAI_API_KEY,
            organization=OPENAI_ORGANIZATION,
        )
    

async def create_blob_client():
    return BlobServiceClient(
    account_url = f"https://{AZURE_BLOB_STORAGE_ACCOUNT}.blob.core.windows.net",
    credential = AZURE_BLOB_STORAGE_KEY,
)


async def create_search_client():
    return SearchClient(
    endpoint = f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name = AZURE_SEARCH_INDEX,
    credential = azure_search_key_credential,
)


async def create_queue_client():
    return QueueClient.from_connection_string(
        conn_str = f"DefaultEndpointsProtocol=https;AccountName={AZURE_BLOB_STORAGE_ACCOUNT};AccountKey={AZURE_BLOB_STORAGE_KEY};EndpointSuffix=core.windows.net",
        queue_name = SEARCH_INDEX_UPDATE_QUEUE,
        message_encode_policy = TextBase64EncodePolicy()
    )
    

EMBEDDING_MODEL_NAME = AZURE_OPENAI_EMBEDDINGS_MODEL_NAME
EMBEDDING_MODEL_VERSION = AZURE_OPENAI_EMBEDDINGS_MODEL_VERSION
ALL_GPT_DEPLOYMENTS = []
GPT_DEPLOYMENT = {
    "deploymentName": "",
    "modelName": "",
    "modelVersion": ""
}

async def fetch_deployments():
    """Set up OpenAI management client"""
    global GPT_DEPLOYMENT, EMBEDDING_MODEL_NAME, EMBEDDING_MODEL_VERSION
    openai_mgmt_client = CognitiveServicesManagementClient(
        credential=azure_credential,
        subscription_id=AZURE_SUBSCRIPTION_ID)

    async for deployment in openai_mgmt_client.deployments.list(
        resource_group_name=AZURE_OPENAI_RESOURCE_GROUP,
        account_name=AZURE_OPENAI_ACCOUNT_NAME):

        capabilities = deployment.properties.capabilities
        if capabilities.get("chatCompletion"):
            ALL_GPT_DEPLOYMENTS.append({
                "deploymentName": deployment.name,
                "modelName": deployment.properties.model.name,
                "modelVersion": deployment.properties.model.version
            })
        
        if deployment.name == AZURE_OPENAI_CHATGPT_DEPLOYMENT:
            GPT_DEPLOYMENT["deploymentName"] = deployment.name
            GPT_DEPLOYMENT["modelName"] = deployment.properties.model.name
            GPT_DEPLOYMENT["modelVersion"] = deployment.properties.model.version
        
        if USE_AZURE_OPENAI_EMBEDDINGS and deployment.name == EMBEDDING_DEPLOYMENT_NAME:
            EMBEDDING_MODEL_NAME = deployment.properties.model.name
            EMBEDDING_MODEL_VERSION = deployment.properties.model.version

    # Sort the GPT_DEPLOYMENTS list for the UI
    ALL_GPT_DEPLOYMENTS.sort(key=lambda x: x["deploymentName"])

bp = Blueprint("routes", __name__, static_folder="static")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

# Dictionary to track streaming sessions
active_sessions = {}

def token_is_valid():
    if "token_expires_at" in session:
        expiration_time = session["token_expires_at"]
        current_time = time.time()
        return current_time < expiration_time  # Check if token has expired
    return False  # Token expiration time not found in session

def acquire_token_silently():
    # Check if the session already has a user account to try acquiring token silently
    if "user_data" in session and "userPrincipalName" in session["user_data"]:
        username = session["user_data"]["userPrincipalName"]
        accounts = MSAL_CLIENT.get_accounts(username=username)
        if accounts:  # Check if the list is not empty
            account = accounts[0]  # Safely get the first account
            result = MSAL_CLIENT.acquire_token_silent(SCOPES, account=account)

            if result and "access_token" in result:
                current_time = time.time()
                # Only update if the token is different or has expired/near expiry
                if ("access_token" not in session or 
                    session["access_token"] != result["access_token"] or 
                    "token_expires_at" not in session or 
                    session["token_expires_at"] - current_time <= 300):  # 300 seconds (5 minutes) buffer for token expiry
                    
                    session["access_token"] = result["access_token"]
                    session["token_expires_at"] = result["expires_in"] + current_time
                    
                return True
    return False


def before_request():
    non_auth_endpoints = ["routes.authorized", "routes.login", "routes.logout"]
    if request.endpoint not in non_auth_endpoints and not acquire_token_silently():
        # Store request URL for after login
        session["redirect_url"] = request.url
        if request.accept_mimetypes.best == "application/json":
            # Return a JSON response for API calls
            return jsonify({"error": "Unauthorized"}), 401
        else:
            # Return a redirect for regular web requests
            return redirect(url_for("routes.login"))


def error_dict(error: Exception) -> dict:
    if isinstance(error, APIError) and error.code == "content_filter":
        return {"error": ERROR_MESSAGE_FILTER}
    
    error_message = str(error)

    # Check if error has an attribute named "body"
    if hasattr(error, "body") and isinstance(error.body, dict):
        error_body = error.body
        error_message = error_body.get("message", error_message)
    
    return { "error": ERROR_MESSAGE_TEMPLATE.format(error_message = error_message) }

        
def error_response(error: Exception, route: str, status_code: int = 500):
    logging.exception("Exception in %s: %s", route, error)
    if isinstance(error, APIError) and error.code == "content_filter":
        status_code = 400
    return jsonify(error_dict(error)), status_code


async def format_response(session_id: str, 
                          result: AsyncGenerator[dict, None], 
                          request_log: RequestLog, 
                          request_doc: dict) -> AsyncGenerator[str, None]:
    try:
        accumulated_content = ""
        error_message = ""
        request_doc.setdefault("response", {})
        request_id = request_doc["request_id"]
        completion_tokens = 0
        async for event in result:
            completion_tokens += 1
            event["request_id"] = request_id
            choice = event.get("choices", [{}])[0]
            context = choice.get("context", {})
            delta = choice.get("delta", {})
            
            # Update request_doc with data from each event
            # Check if generated_query is set context as this chunk
            # will contain the extra info we need, data_points/citations etc.
            if context.get("generated_query"):
                for key, value in context.items():
                    request_doc["response"][key] = value

            if context.get("error_message"):
                error_message = context["error_message"]
                raise Exception(error_message)

            content = delta.get("content")
            if content:
                accumulated_content += content

            followup_questions = context.get("followup_questions")
            if followup_questions:
                request_doc["response"].setdefault("followup_questions", followup_questions)
            
            if session_id not in active_sessions:
                request_doc["response"].setdefault("cancelled", True)
                break

            yield json.dumps(event, ensure_ascii=False) + "\n"

    except Exception as e:
        error_message = str(e)
        request_doc["response"]["error_message"] = error_message
        logging.exception("Exception while generating response stream. %s", e)
        yield json.dumps(error_dict(e))

    finally:
        if accumulated_content:
            # Add the full answer to the request_doc
            request_doc["response"].setdefault("completion_tokens", completion_tokens)
            request_doc["response"].setdefault("answer", accumulated_content)

        # Add error_message to request_doc
        if error_message:
            request_doc["response"]["error_message"] = error_message

        # active_sessions.pop(request_id, None)
        finish_time = datetime.now()
        await request_log.log_response(request_id, request_doc, finish_time)


async def get_website_blob_json(blob_name: str):
    try:
        # Setup blob client
        blob_client = BLOB_CONTAINER_WEBSITE.get_blob_client(blob_name)
        
        # Download the JSON file content
        blob_data = await blob_client.download_blob()
        json_content = await blob_data.readall()

        return json.loads(json_content)
   
    except Exception as error:
        return jsonify({
            "error": str(error)
        })


@bp.route("/login")
async def login():
    session["state"] = str(uuid.uuid4())
    auth_url = MSAL_CLIENT.get_authorization_request_url(
        scopes=SCOPES,
        state=session["state"],
        redirect_uri=REDIRECT_URI
    )
    return redirect(auth_url)


@bp.route("/authorized")
async def authorized():
    if request.args.get("state") != session.get("state"):
        return redirect("/")  # State mismatch, abort.

    if "error" in request.args:
        return "Error: " + request.args["error_description"]

    if request.args.get("code"):
        token_response = MSAL_CLIENT.acquire_token_by_authorization_code(
            request.args["code"],
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        if "error" in token_response:
            return "Error: " + token_response["error_description"]

        session_timestamp = str(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        session["access_token"] = token_response["access_token"]
        session["token_expires_at"] = token_response["expires_in"] + time.time()

        user_data = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            timeout=30,
            headers={"Authorization": "Bearer " + session["access_token"]},
        ).json()
        user_data["user_id"] = user_data.pop("id")

        group_data = requests.get(
            "https://graph.microsoft.com/v1.0/me/memberOf",
            timeout=30,
            headers={"Authorization": "Bearer " + session["access_token"]},
        ).json()

        is_admin = any(group.get("displayName", "") == ADMIN_GROUP_NAME for group in group_data.get("value", []))
        
        user_data["is_admin"] = is_admin
        user_data["tou_accepted"] = is_admin # skip TOU for admins
        user_data["tou_accepted_timestamp"] = session_timestamp if is_admin else None
        user_data["session_id"] = session["state"]
        user_data["session_timestamp"] = session_timestamp

        session["user_data"] = user_data
        await current_app.userdata_log.upsert_user_session()
        
        # Redirect user to the stored URL or a default one if not available
        redirect_url = session.pop("redirect_url", "/")
        
        return redirect(redirect_url)

    return redirect(url_for("routes.login"))


@bp.route("/logout")
async def logout():
    session.clear()
    return redirect(LOGOUT_URL)


@bp.route("/", defaults={"path": "index.html"})
@bp.route("/<path:path>")
async def static_file(path):
    """Serve static files from the "static" directory"""
    return await bp.send_static_file(path)


@bp.route("/chat", methods=["POST"])
async def chat():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    
    session_id = session["state"]
    active_sessions[session_id] = True
    request_json = await request.get_json()
    request_context = request_json.get("context", {})
    request_id = str(uuid.uuid4())
    start_time = datetime.now()

    try:
        session_gpt_deployment = session.get("gpt_deployment", GPT_DEPLOYMENT)

        # Log the request to CosmosDB
        request_log = current_app.request_log
        request_doc = await request_log.log_request(
                request_id, 
                session_gpt_deployment, 
                request_json, 
                start_time)
        
        retrieval_mode = request_context.get("overrides", {}).get("retrieval_mode", "none")

        if retrieval_mode == "none":
            approach = ChatApproach(
                OPENAI_CLIENT,
                session_gpt_deployment.get("deploymentName"),
                session_gpt_deployment.get("modelName"),
                session_gpt_deployment.get("modelVersion"),
            )

        else:
            approach = ChatReadRetrieveReadApproach(
                SEARCH_CLIENT,
                OPENAI_CLIENT,
                BLOB_CLIENT,
                session_gpt_deployment.get("deploymentName"),
                session_gpt_deployment.get("modelName"),
                session_gpt_deployment.get("modelVersion"),
                KB_FIELDS_SOURCEFILE,
                KB_FIELDS_CONTENT,
                KB_FIELDS_PAGENUMBER,
                KB_FIELDS_CHUNKFILE,
                AZURE_BLOB_STORAGE_CONTAINER,
                QUERY_TERM_LANGUAGE,
                TARGET_EMBEDDINGS_MODEL,
                ENRICHMENT_APPSERVICE_NAME
            )
        
        result = await approach.run(
            request_json["messages"],
            stream = request_json.get("stream", False),
            context = request_context,
            session_state = request_json.get("session_state"),
            )
        
        if isinstance(result, dict):
            if result.get("error_message"):
                raise ValueError(result["error_message"])
            
            result["request_id"] = request_id
            return jsonify(result)
        else:
            response = await make_response(format_response(session_id, result, request_log, request_doc))
            response.timeout = None
            response.mimetype = "application/json-lines"
            return response
        
    except Exception as error:
        return error_response(error, "/chat")


@bp.route("/stopStream", methods=["POST"])
async def stop_stream():
    session_id = session["state"]
    if session_id in active_sessions:
        active_sessions.pop(session_id, None)
        return json.dumps({"status": "Stop request sent"})
    else:
        return json.dumps({"status": f"Session ID {session_id} not found in active_sessions"})


@bp.route("/getBlobClientUrl")
async def get_blob_client_url():
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


@bp.route("/getBlobUrl", methods=["POST"])
async def get_blob_sas():
    request_data = await request.json
    user_folder_pattern = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
    user_id = session["user_data"].get("userPrincipalName", "Unknown User")
    is_admin = session["user_data"].get("is_admin", False)
    file_path = urllib.parse.unquote(request_data["file_path"])
    file_path_parts = file_path.split("/")
    folder_name = file_path_parts[1] if len(file_path_parts) > 2 else None

    # If user is admin or accessing a file from their own folder
    if is_admin or (folder_name and user_folder_pattern.match(folder_name) and folder_name == user_id):
        sas_token = generate_blob_sas(
            account_name=AZURE_BLOB_STORAGE_ACCOUNT,
            container_name=AZURE_BLOB_UPLOAD_CONTAINER,
            blob_name=file_path,
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
        return jsonify({"url": f"{BLOB_CLIENT.url}{AZURE_BLOB_UPLOAD_CONTAINER}/{file_path}?{sas_token}"})
    else:
        return jsonify({"error": "You do not have access to this file"})


@bp.route("/getAllUploadStatus", methods=["GET"])
async def get_all_upload_status():
    """Get the status of all file uploads in the last N hours"""
    user_id = session["user_data"].get("userPrincipalName", "Unknown User")
    is_admin = session["user_data"].get("is_admin", False)
    try:
        results = await current_app.status_log.read_all_files_status(user_id, is_admin)
    except Exception as error:
        logging.exception("Exception in /getAllUploadStatus")
        return jsonify({"error": str(error)}), 500
    return jsonify(results)


@bp.route("/logStatus", methods=["POST"])
async def log_status():
    """Log the status of a file upload to CosmosDB"""
    request_data = await request.json
    try:
        path = request_data["path"]
        status = request_data["status"]
        tags = request_data["tags"]
        status_classification = StatusClassification[request_data["status_classification"].upper()]
        state = State[request_data["state"].upper()]

        await current_app.status_log.upsert_document(
                            document_path = path,
                            status = status,
                            status_classification = status_classification,
                            state = state,
                            tags_list = tags,
                            fresh_start = True)
        
        await current_app.status_log.save_document(document_path=path)

    except Exception as error:
        logging.exception("Exception in /logStatus")
        return jsonify({"error": str(error)}), 500
    return jsonify({"status": 200})


@bp.route("/getInfoData")
async def get_info_data():
    """Get the info data for the app"""
    session_gpt_deployment = session.get("gpt_deployment", GPT_DEPLOYMENT)

    response = jsonify(
        {
            "AZURE_OPENAI_CHATGPT_DEPLOYMENT": f"{session_gpt_deployment.get('deploymentName')}",
            "AZURE_OPENAI_MODEL_NAME": f"{session_gpt_deployment.get('modelName')}",
            "AZURE_OPENAI_MODEL_VERSION": f"{session_gpt_deployment.get('modelVersion')}",
            "AZURE_OPENAI_SERVICE": f"{AZURE_OPENAI_SERVICE}",
            "AZURE_SEARCH_SERVICE": f"{AZURE_SEARCH_SERVICE}",
            "AZURE_SEARCH_INDEX": f"{AZURE_SEARCH_INDEX}",
            "TARGET_LANGUAGE": f"{QUERY_TERM_LANGUAGE}",
            "USE_AZURE_OPENAI_EMBEDDINGS": USE_AZURE_OPENAI_EMBEDDINGS,
            "EMBEDDINGS_DEPLOYMENT": f"{EMBEDDING_DEPLOYMENT_NAME}",
            "EMBEDDINGS_MODEL_NAME": f"{EMBEDDING_MODEL_NAME}",
            "EMBEDDINGS_MODEL_VERSION": f"{EMBEDDING_MODEL_VERSION}"
        })
    return response


@bp.route("/getUserData")
async def get_user_data():
    try:
        user_data = session["user_data"]
        access_token = session["access_token"]

        photo_data = requests.get(
            "https://graph.microsoft.com/v1.0/me/photos/48x48/$value",
            timeout=30,
            stream=True,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if photo_data.status_code == 200:
            base64_image = base64.b64encode(photo_data.content).decode("utf-8")
            user_data["base64_image"] = base64_image

        return jsonify(user_data)
    
    except Exception as error:
        logging.exception("Exception in /getUserData")
        return jsonify({"error": str(error)}), 500


@bp.route("/getWarningBanner")
async def get_warning_banner():
    """Get the warning banner text"""
    response = jsonify(
        {
            "WARNING_BANNER_TEXT": f"{CHAT_WARNING_BANNER_TEXT}"
        })
    return response


@bp.route("/getCitation", methods=["POST"])
async def get_citation():
    """Get the citation for a given file"""
    request_data = await request.get_json()
    
    # Check if citation is in the request data and is not empty
    citation = request_data.get("citation")
    if not citation:
        # If citation is not set or is empty, ignore it
        return jsonify({"message": "No citation provided"}), 200

    # Continue with the processing as citation is available
    citation = urllib.parse.unquote(citation)
    try:
        blob = BLOB_CONTAINER_CONTENT.get_blob_client(citation)
        blob_data = await blob.download_blob()
        decoded_text = await blob_data.readall()
        results = json.loads(decoded_text.decode())
        
        return jsonify(results)

    except Exception as error:
        logging.exception("Exception in /getCitation")
        return jsonify({"error": str(error)}), 500


@bp.route("/exportAnswer", methods=["POST"])
async def export():
    try:
        request_data = await request.json
        session_gpt_deployment = session.get("gpt_deployment", GPT_DEPLOYMENT)
        file_name, export_file = await exporthelper.export_to_blob(
                                    request_data,
                                    BLOB_CONTAINER_EXPORT,
                                    OPENAI_CLIENT,
                                    session_gpt_deployment.get("deploymentName"),
                                    session_gpt_deployment.get("modelName"))

        return await send_file( export_file,
                                as_attachment = True,
                                attachment_filename = file_name
                                )

    except Exception as error:
        logging.exception("Exception in /exportAnswer")
        return jsonify({"error": str(error)}), 500


@bp.route("/getApplicationTitle")
async def get_application_title():
    """Get the application title text"""
    response = jsonify(
        {
            "APPLICATION_TITLE": f"{APPLICATION_TITLE}"
        })
    return response


@bp.route("/getAllTags", methods=["GET"])
async def get_all_tags():
    """Get the status of all tags in the system"""
    try:
        results = await current_app.status_log.get_all_tags()
    except Exception as error:
        logging.exception("Exception in /getAllTags")
        return jsonify({"error": str(error)}), 500
    return jsonify(results)


@bp.route("/getGptDeployments", methods=["GET"])
async def get_gpt_deployments():
    """Get a list of all GPT model deployments"""
    try:
        return jsonify(ALL_GPT_DEPLOYMENTS)
    except Exception as error:
        logging.exception("Exception in /getGptDeployments")
        return jsonify({"error": str(error)}), 500


@bp.route("/setGptDeployment", methods=["POST"])
async def set_gpt_deployment():
    """Update the GPT deployment model/version etc."""
    request_data = await request.json
    session.setdefault("gpt_deployment", {})
    keys = ["deploymentName", "modelName", "modelVersion"]

    if all(key in request_data for key in keys):
        for key in keys:
            session["gpt_deployment"][key] = request_data[key]

        session.modified = True
        
        return jsonify({"message": "GPT Deployment information updated successfully"}), 200
    else:
        # If some keys are missing, return an error
        missing_keys = [key for key in keys if key not in request_data]
        return jsonify({"error": "Missing required information", "missing_keys": missing_keys}), 400

@bp.route("/getPromptTemplates", methods=["GET"])
async def get_prompt_templates():
    """Get a list of all Prompt Templates"""
    try:
        blob_name = "prompt_templates.json"
        template_data = await get_website_blob_json(blob_name)
        return jsonify(template_data)
    
    except Exception as error:
        logging.exception("Exception in /getPromptTemplates")
        return jsonify({"error": str(error)}), 500


@bp.route("/termsOfUse", methods=["GET", "POST"])
async def terms():
    try:
        # If it"s a POST request, set tou_accepted to True
        if request.method == "POST":
            request_data = await request.json
            timestamp = str(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            version_pattern = r"^\d+(\.\d+)*$"
            tou_version = request_data["tou_version"]

            if re.match(version_pattern, tou_version):
                session["user_data"]["tou_version"] = tou_version
            else:
                return jsonify({"error": "Invalid tou_version format"}), 400

            session["user_data"]["tou_accepted"] = True
            session["user_data"]["tou_accepted_timestamp"] = timestamp
            session.modified = True
            
            await current_app.userdata_log.upsert_user_session()

            return jsonify({"message": "Terms of Use acceptance recorded successfully"}), 200
        
        # If it"s a GET request, display the terms to the user
        elif request.method == "GET":
            blob_name = "terms.json"
            tou_data = await get_website_blob_json(blob_name)
            return jsonify(tou_data)
        
        else:
            return jsonify({"error": "Method not allowed"}), 405
    
    except Exception as error:
        logging.exception("Exception in /termsOfUse")
        return jsonify({"error": str(error)}), 500
    

@bp.route("/deleteFile", methods=["POST"])
async def delete_file():
    try:
        request_data = await request.json
        user_id = session["user_data"].get("userPrincipalName", "Unknown User")
        is_admin = session["user_data"].get("is_admin", False)
        file_path = request_data["file_path"]
        file_path_parts = file_path.split("/")
        folder_name = file_path_parts[1] if len(file_path_parts) > 2 else None

        if not is_admin and folder_name != user_id:
            return jsonify({"error": "Only Admin users can edit this file"}), 400
        
        await current_app.status_log.upsert_document(
                            document_path = file_path,
                            status = f"Deleted by {user_id}",
                            status_classification = StatusClassification.INFO,
                            state =  State.DELETED)
        
        await current_app.status_log.save_document(document_path=file_path)

        message = {
            "file_uri": f"{BLOB_CLIENT.url}{urllib.parse.quote(file_path)}",
            "file_path": file_path,
            "action": "delete"
        }
        message_string = json.dumps(message)
        # Queue a message for the tags to be updated in the Vector DB
        await QUEUE_CLIENT.send_message(message_string)
        
        # TODO
        # delete upload blob?
        # delete content blobs?

        return jsonify({"message": "File deleted successfully"}), 200
    
    except Exception as error:
        logging.exception("Exception in /deleteFile")
        return jsonify({"error": str(error)}), 500


@bp.route("/updateFileTags", methods=["POST"])
async def update_file_tags():
    try:
        request_data = await request.json
        user_id = session["user_data"].get("userPrincipalName", "Unknown User")
        is_admin = session["user_data"].get("is_admin", False)
        file_path = request_data["file_path"]
        file_path_parts = file_path.split("/")
        folder_name = file_path_parts[1] if len(file_path_parts) > 2 else None
        new_tags = request_data["tags"]

        if not is_admin and folder_name != user_id:
            return jsonify({"error": "Only Admin users can edit this file"}), 400
        
        await current_app.status_log.upsert_document(
                            document_path = file_path,
                            status = f"Tags updated by {user_id}",
                            status_classification = StatusClassification.INFO,
                            tags_list = new_tags)
        
        await current_app.status_log.save_document(document_path = file_path)

        message = {
            "file_uri": f"{BLOB_CLIENT.url}{urllib.parse.quote(file_path)}",
            "file_path": file_path,
            "action": "updateTags",
            "tags": new_tags
        }
        message_string = json.dumps(message)
        # Queue a message for the tags to be updated in the Vector DB
        await QUEUE_CLIENT.send_message(message_string)

        return jsonify({"message": "Tags updated successfully"}), 200
    
    except Exception as error:
        logging.exception("Exception in /updateFileTags")
        return jsonify({"error": str(error)}), 500


@bp.route("/getFaq", methods=["GET"])
async def get_faq():
    try:
        blob_name = "faq.json"
        faq_data = await get_website_blob_json(blob_name)
        return jsonify(faq_data)
        
    except Exception as error:
        logging.exception("Exception in /getFaq")
        return jsonify({"error": str(error)}), 500


def create_app():
    app = Quart(__name__)
    app.config["SECRET_KEY"] = APP_SECRET
    app.config["SESSION_PERMANENT"] = True
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)
    
    request_log = RequestLog(COSMOSDB_URL, COSMODB_KEY, COSMOSDB_REQUESTLOG_DATABASE_NAME, COSMOSDB_REQUESTLOG_CONTAINER_NAME)
    status_log = StatusLog(COSMOSDB_URL, COSMODB_KEY, COSMOSDB_LOG_DATABASE_NAME, COSMOSDB_LOG_CONTAINER_NAME)
    userdata_log = UserDataLog(COSMOSDB_URL, COSMODB_KEY, COSMOSDB_USER_DATABASE_NAME, COSMOSDB_USER_CONTAINER_NAME)

    @app.before_serving
    async def init():
        global MSAL_CLIENT, OPENAI_CLIENT, SEARCH_CLIENT, BLOB_CLIENT, QUEUE_CLIENT, BLOB_CONTAINER_CONTENT, \
        BLOB_CONTAINER_UPLOAD, BLOB_CONTAINER_EXPORT, BLOB_CONTAINER_WEBSITE

        MSAL_CLIENT = create_msal_client()
        OPENAI_CLIENT = await create_openai_client()
        SEARCH_CLIENT = await create_search_client()
        BLOB_CLIENT = await create_blob_client()
        QUEUE_CLIENT = await create_queue_client()

        BLOB_CONTAINER_CONTENT = BLOB_CLIENT.get_container_client(AZURE_BLOB_STORAGE_CONTAINER)
        BLOB_CONTAINER_UPLOAD = BLOB_CLIENT.get_container_client(AZURE_BLOB_UPLOAD_CONTAINER)
        BLOB_CONTAINER_EXPORT = BLOB_CLIENT.get_container_client(AZURE_BLOB_EXPORT_CONTAINER)
        BLOB_CONTAINER_WEBSITE = BLOB_CLIENT.get_container_client(AZURE_BLOB_WEBSITE_CONTAINER)
        
        await request_log.initialize()
        await status_log.initialize()
        await userdata_log.initialize()
        await fetch_deployments()

    app.request_log = request_log
    app.status_log = status_log
    app.userdata_log = userdata_log

    bp.before_request(before_request)
    app.register_blueprint(bp)

    @app.after_serving
    async def cleanup():
        global OPENAI_CLIENT, SEARCH_CLIENT, BLOB_CLIENT
        
        await OPENAI_CLIENT.close()
        await SEARCH_CLIENT.close()
        await BLOB_CLIENT.close()

    if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
        configure_azure_monitor()
        # This tracks HTTP requests made by aiohttp:
        AioHttpClientInstrumentor().instrument()
        # This tracks HTTP requests made by httpx/openai:
        HTTPXClientInstrumentor().instrument()
        # This middleware tracks app route requests:
        app.asgi_app = OpenTelemetryMiddleware(app.asgi_app)  # type: ignore[method-assign]

    # Level should be one of https://docs.python.org/3/library/logging.html#logging-levels
    default_level = "DEBUG"  # In development, log more verbosely
    if os.getenv("WEBSITE_HOSTNAME"):  # In production, don"t log as heavily
        default_level = "INFO"
    logging.basicConfig(level = os.getenv("APP_LOG_LEVEL", default_level))

    if allowed_origin := os.getenv("ALLOWED_ORIGIN"):
        app.logger.info("CORS enabled for %s", allowed_origin)
        cors(app, allow_origin = "*", allow_methods=["GET", "POST"])
    return app