# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from datetime import datetime, timedelta

import asyncio
import base64
import json
import logging
import mimetypes
import os
import time
import urllib.parse
import uuid
import core.exporthelper as exporthelper
import msal
import requests

from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.core.credentials import AzureKeyCredential
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
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
from quart import (
    Quart,
    Blueprint,
    jsonify,
    make_response,
    redirect,
    request,
    send_file,
    session,
    url_for
)
from openai import APIError, AsyncAzureOpenAI, AsyncOpenAI
from opencensus.ext.azure.log_exporter import AzureLogHandler
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from request_log import RequestLog
from shared_code.status_log import State, StatusClassification, StatusLog
from shared_code.tags_helper import TagsHelper
from typing import AsyncGenerator

str_to_bool = {'true': True, 'false': False}
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

ERROR_MESSAGE = """The application encountered an error processing your request.
Error type: {error_type}"""
ERROR_MESSAGE_FILTER = """Your message contains content that was flagged by the OpenAI content filter."""

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

# app = Quart(__name__)

msal_client = msal.ConfidentialClientApplication(
    CLIENT_ID, authority=AUTHORITY,
    client_credential=CLIENT_SECRET,
)

azure_credential = DefaultAzureCredential()
azure_search_key_credential = AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY)

# Setup logger
# logger = logging.getLogger(__name__)
# logger.addHandler(AzureLogHandler())
# if DEBUG:
#     logger.setLevel(logging.DEBUG)

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

# Set up clients for OpenAI, Cognitive Search and Storage
OPENAI_CLIENT: AsyncOpenAI

if OPENAI_HOST == "azure":
    token_provider = get_bearer_token_provider(azure_credential, "https://cognitiveservices.azure.com/.default")
    OPENAI_CLIENT = AsyncAzureOpenAI(
        api_version = AZURE_OPENAI_API_VERSION,
        azure_endpoint = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com",
        api_key = AZURE_OPENAI_SERVICE_KEY
        # azure_ad_token_provider = token_provider,
    )
else:
    openai_client = AsyncOpenAI(
        api_key=OPENAI_API_KEY,
        organization=OPENAI_ORGANIZATION,
    )

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

EMBEDDING_MODEL_NAME = AZURE_OPENAI_EMBEDDINGS_MODEL_NAME
EMBEDDING_MODEL_VERSION = AZURE_OPENAI_EMBEDDINGS_MODEL_VERSION
ALL_GPT_DEPLOYMENTS = []
GPT_DEPLOYMENT = {
    'deploymentName': '',
    'modelName': '',
    'modelVersion': ''
}

async def fetch_deployments():
    """Set up OpenAI management client"""
    openai_mgmt_client = CognitiveServicesManagementClient(
        credential=azure_credential,
        subscription_id=AZURE_SUBSCRIPTION_ID)

    async for deployment in openai_mgmt_client.deployments.list(
        resource_group_name=AZURE_OPENAI_RESOURCE_GROUP,
        account_name=AZURE_OPENAI_ACCOUNT_NAME):

        capabilities = deployment.properties.capabilities
        if capabilities.get('chatCompletion'):
            ALL_GPT_DEPLOYMENTS.append({
                'deploymentName': deployment.name,
                'modelName': deployment.properties.model.name,
                'modelVersion': deployment.properties.model.version
            })
        
        if deployment.name == AZURE_OPENAI_CHATGPT_DEPLOYMENT:
            GPT_DEPLOYMENT['deploymentName'] = deployment.name
            GPT_DEPLOYMENT['modelName'] = deployment.properties.model.name
            GPT_DEPLOYMENT['modelVersion'] = deployment.properties.model.version
        
        if USE_AZURE_OPENAI_EMBEDDINGS and deployment.name == EMBEDDING_DEPLOYMENT_NAME:
            EMBEDDING_MODEL_NAME = deployment.properties.model.name
            EMBEDDING_MODEL_VERSION = deployment.properties.model.version

    # Sort the GPT_DEPLOYMENTS list for the UI
    ALL_GPT_DEPLOYMENTS.sort(key=lambda x: x['deploymentName'])

bp = Blueprint("routes", __name__, static_folder="static")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

def token_is_valid():
    if "token_expires_at" in session:
        expiration_time = session["token_expires_at"]
        current_time = time.time()
        return current_time < expiration_time  # Check if token has expired
    return False  # Token expiration time not found in session


def check_authenticated():
    non_auth_endpoints = ['routes.authorized', 'routes.login', 'routes.logout']
    if request.endpoint not in non_auth_endpoints and not token_is_valid():
        return redirect(url_for('routes.login'))


def error_dict(error: Exception) -> dict:
    if isinstance(error, APIError) and error.code == "content_filter":
        return {"error": ERROR_MESSAGE_FILTER}
    return {"error": ERROR_MESSAGE.format(error_type=type(error))}


def error_response(error: Exception, route: str, status_code: int = 500):
    logging.exception("Exception in %s: %s", route, error)
    if isinstance(error, APIError) and error.code == "content_filter":
        status_code = 400
    return jsonify(error_dict(error)), status_code


async def format_as_ndjson(r: AsyncGenerator[dict, None], request_id: str) -> AsyncGenerator[str, None]:
    try:
        async for event in r:
            event["request_id"] = request_id
            yield json.dumps(event, ensure_ascii=False) + "\n"
    except Exception as e:
        logging.exception("Exception while generating response stream. Request ID: %s\nError:", request_id, e)
        yield json.dumps(error_dict(e))


@bp.route("/login")
async def login():
    session["state"] = str(uuid.uuid4())
    auth_url = msal_client.get_authorization_request_url(
        scopes=SCOPES,
        state=session["state"],
        redirect_uri=url_for("routes.authorized", _external=True, _scheme=SCHEME)
    )
    return redirect(auth_url)


@bp.route("/authorized")
async def authorized():
    if request.args.get("state") != session.get("state"):
        return redirect("/")  # State mismatch, abort.

    if "error" in request.args:
        return "Error: " + request.args["error_description"]

    if request.args.get("code"):
        token_response = msal_client.acquire_token_by_authorization_code(
            request.args["code"],
            scopes=SCOPES,
            redirect_uri=url_for("routes.authorized", _external=True, _scheme=SCHEME)
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

    return redirect(url_for("routes.login"))


@bp.route("/logout")
async def logout():
    session.clear()
    return redirect(LOGOUT_URL)


@bp.route("/", defaults={"path": "index.html"})
@bp.route("/<path:path>")
async def static_file(path):
    """Serve static files from the 'static' directory"""
    return await bp.send_static_file(path)


@bp.route("/chat", methods=["POST"])
async def chat():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    context = request_json.get("context", {})
    request_id = str(uuid.uuid4())
    start_time = datetime.now()

    try:    
        session_gpt_deployment = session.get('gpt_deployment', GPT_DEPLOYMENT)

        # Log the request to CosmosDB
        # json_document = requestLog.log_request(
        #         request_id, 
        #         session_gpt_deployment, 
        #         request.json, 
        #         start_time)

        approach = ChatReadRetrieveReadApproach(
            SEARCH_CLIENT,
            OPENAI_CLIENT,
            session_gpt_deployment.get("deploymentName"),
            session_gpt_deployment.get("modelName"),
            KB_FIELDS_SOURCEFILE,
            KB_FIELDS_CONTENT,
            KB_FIELDS_PAGENUMBER,
            KB_FIELDS_CHUNKFILE,
            AZURE_BLOB_STORAGE_CONTAINER,
            BLOB_CLIENT,
            QUERY_TERM_LANGUAGE,
            TARGET_EMBEDDING_MODEL,
            ENRICHMENT_APPSERVICE_NAME
        )
        
        result = await approach.run(
            request_json["messages"],
            stream = request_json.get("stream", False),
            context = context,
            session_state = request_json.get("session_state"),
            )
        if isinstance(result, dict):
            # finish_time = datetime.now()
            # requestLog.log_response(request_id, json_document, result, finish_time)
            # Check if there was an error
            if result.get("error_message"):
                raise ValueError(result["error_message"])
            
            result["request_id"] = request_id
            return jsonify(result)
        else:
            response = await make_response(format_as_ndjson(result, request_id))
            response.timeout = None  # type: ignore
            response.mimetype = "application/json-lines"
            return response
    except Exception as error:
        # finish_time = datetime.now()
        # Send the response body if it made it that far, otherwise send the exception message
        # requestLog.log_response(request_id, json_document, locals().get('r', {"error_message": str(ex)}), finish_time)
        return error_response(error, "/chat")
        
        # # Check if there was an error
        # if r.get("error_message"):
        #     raise ValueError(r["error_message"]) 

        # response = jsonify(
        #     {
        #         "data_points": r["data_points"],
        #         "answer": r["answer"],
        #         "thoughts": r["thoughts"],
        #         "citation_lookup": r["citation_lookup"],
        #         "request_id": request_id,
        #         "generated_query": r["generated_query"],
        #     }
        # )

        # finish_time = datetime.now()

        # # Log the request/response to CosmosDB
        # requestLog.log_response(request_id, json_document, r, finish_time)

        # return response


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
    file_name = urllib.parse.unquote(request_data["file_name"])
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


@bp.route("/getAllUploadStatus", methods=["POST"])
async def get_all_upload_status():
    """Get the status of all file uploads in the last N hours"""
    request_data = await request.json
    timeframe = request_data.get("timeframe")
    state = request_data.get("state")
    folder_name = request_data.get("folder_name")
    try:
        results = statusLog.read_files_status_by_timeframe(timeframe, State[state], folder_name)
    except Exception as ex:
        logging.exception("Exception in /getAllUploadStatus")
        return jsonify({"error": str(ex)}), 500
    return jsonify(results)


@bp.route("/logStatus", methods=["POST"])
async def log_status():
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


@bp.route("/getInfoData")
async def get_info_data():
    """Get the info data for the app"""
    session_gpt_deployment = session.get('gpt_deployment', GPT_DEPLOYMENT)

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
        user_data["session_id"] = session["state"]

        graph_data = requests.get(
            "https://graph.microsoft.com/v1.0/me/photos/48x48/$value",
            timeout=30,
            stream=True,
            headers={"Authorization": "Bearer " + session["access_token"]},
        )

        if graph_data.status_code == 200:
            base64_image = base64.b64encode(graph_data.content).decode('utf-8')
            user_data['base64_image'] = base64_image

        return jsonify(user_data)
    
    except Exception as ex:
        logging.exception("Exception in /getUserData")
        return jsonify({"error": str(ex)}), 500


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
    citation = urllib.parse.unquote(request_data["citation"])
    try:
        blob = blob_container.get_blob_client(citation)
        blob_data = await blob.download_blob()
        decoded_text = await blob_data.readall()
        results = json.loads(decoded_text.decode())

    except Exception as ex:
        logging.exception("Exception in /getCitation")
        return jsonify({"error": str(ex)}), 500

    return jsonify(results)


@bp.route('/exportAnswer', methods=["POST"])
async def export():
    try:
        request_data = await request.json
        session_gpt_deployment = session.get('gpt_deployment', GPT_DEPLOYMENT)
        file_name, export_file = exporthelper.export_to_blob(request_data,
                                                             export_container,
                                                             session_gpt_deployment.get('deploymentName'),
                                                             session_gpt_deployment.get('modelName'))

        return send_file(export_file,
                         as_attachment=True,
                         download_name=file_name
                         )

    except Exception as ex:
        logging.exception("Exception in /exportAnswer")
        return jsonify({"error": str(ex)}), 500


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
        results = tagsHelper.get_all_tags()
    except Exception as ex:
        logging.exception("Exception in /getAllTags")
        return jsonify({"error": str(ex)}), 500
    return jsonify(results)


@bp.route("/getGptDeployments", methods=["GET"])
async def get_gpt_deployments():
    """Get a list of all GPT model deployments"""
    try:
        return jsonify(ALL_GPT_DEPLOYMENTS)
    except Exception as ex:
        logging.exception("Exception in /getGptDeployments")
        return jsonify({"error": str(ex)}), 500


@bp.route("/setGptDeployment", methods=["POST"])
async def set_gpt_deployment():
    """Update the GPT deployment model/version etc."""
    data = request.get_json()
    session.setdefault('gpt_deployment', {})
    keys = ['deploymentName', 'modelName', 'modelVersion']

    if all(key in data for key in keys):
        for key in keys:
            session['gpt_deployment'][key] = data[key]

        session.modified = True
        
        return jsonify({'message': 'GPT Deployment information updated successfully'}), 200
    else:
        # If some keys are missing, return an error
        missing_keys = [key for key in keys if key not in data]
        return jsonify({'error': 'Missing required information', 'missing_keys': missing_keys}), 400
        


asyncio.run(fetch_deployments())

def create_app():
    app = Quart(__name__)
    app.config['SECRET_KEY'] = APP_SECRET
    app.config['SESSION_PERMANENT'] = True
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
    bp.before_request(check_authenticated)
    app.register_blueprint(bp)

    # if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    #     configure_azure_monitor()
    #     # This tracks HTTP requests made by aiohttp:
    #     AioHttpClientInstrumentor().instrument()
    #     # This tracks HTTP requests made by httpx/openai:
    #     HTTPXClientInstrumentor().instrument()
    #     # This middleware tracks app route requests:
    #     app.asgi_app = OpenTelemetryMiddleware(app.asgi_app)  # type: ignore[method-assign]

    # Level should be one of https://docs.python.org/3/library/logging.html#logging-levels
    default_level = "DEBUG"  # In development, log more verbosely
    if os.getenv("WEBSITE_HOSTNAME"):  # In production, don't log as heavily
        default_level = "INFO"
    logging.basicConfig(level = os.getenv("APP_LOG_LEVEL", default_level))

    # if allowed_origin := os.getenv("ALLOWED_ORIGIN"):
    #     app.logger.info("CORS enabled for %s", allowed_origin)
    #     cors(app, allow_origin=allowed_origin, allow_methods=["GET", "POST"])
    return app