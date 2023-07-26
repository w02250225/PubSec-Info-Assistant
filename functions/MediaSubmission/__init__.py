# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import os
import azure.functions as func
from azure.storage.blob import generate_blob_sas
from shared_code.status_log import StatusLog, State, StatusClassification
from shared_code.utilities import Utilities

from azure.identity import ClientSecretCredential

azure_blob_storage_account = os.environ["BLOB_STORAGE_ACCOUNT"]
azure_blob_drop_storage_container = os.environ["BLOB_STORAGE_ACCOUNT_UPLOAD_CONTAINER_NAME"]
azure_blob_content_storage_container = os.environ["BLOB_STORAGE_ACCOUNT_OUTPUT_CONTAINER_NAME"]
azure_blob_storage_key = os.environ["BLOB_STORAGE_ACCOUNT_KEY"]
azure_blob_connection_string = os.environ["BLOB_CONNECTION_STRING"]
azure_blob_log_storage_container = os.environ["BLOB_STORAGE_ACCOUNT_LOG_CONTAINER_NAME"]
cosmosdb_url = os.environ["COSMOSDB_URL"]
cosmosdb_key = os.environ["COSMOSDB_KEY"]
cosmosdb_database_name = os.environ["COSMOSDB_DATABASE_NAME"]
cosmosdb_container_name = os.environ["COSMOSDB_CONTAINER_NAME"]


def main(msg: func.QueueMessage) -> None:

    statusLog = StatusLog(cosmosdb_url, cosmosdb_key, cosmosdb_database_name, cosmosdb_container_name)
    utilities = Utilities(azure_blob_storage_account, azure_blob_drop_storage_container, azure_blob_content_storage_container, azure_blob_storage_key)
    function_name = "FileLayoutParsingOther"
    
    
    azure_resource_manager = "https://management.azure.com";
    credential = ClientSecretCredential(tenant_id, client_id, client_secret)





#Get ARM bearer token used to query AVAM for account access token.
def get_arm_token():
    # Get ARM access token (bearer token)
    token_context = "https://management.azure.com/.default"
    token = credential.get_token(token_context).token
    return token

# Get account level access token for Azure Video Analyzer for Media
def get_account_access_token(arm_token): 
    logger.info('Retrieving AVAM access token')
    request_url = f'{azure_resource_manager}/subscriptions/{subscription_id}/resourceGroups/{resource_group_name}/providers/Microsoft.VideoIndexer/accounts/{vi_account_name}/generateAccessToken?api-version={api_version}'
    headers = CaseInsensitiveDict()
    headers["Accept"] = "application/json"
    headers["Authorization"] = "Bearer " + arm_token
    body = '{"permissionType":"Contributor","scope":"Account","projectId":null,"videoId":null}'
    body = json.loads(body)
    response = req.post(request_url, headers=headers, json=body)
    response = response.json()
    logger.info(f"AVAM access token retreived at {datetime.now()}")
    return response["accessToken"]

# Refresh access tokens
def refresh_access_tokens():
    global token_refresh_time
    
    logger.info('Refreshing ARM and AVAM tokens.')
    token_refresh_time = datetime.now() + timedelta(minutes=55)
    arm_token = get_arm_token()
    # Return token dictionary as both tokens are used elsewhere, ARM token is also needed to get AVAM access token.
    return {
        "arm" : arm_token, 
        "avam" : get_account_access_token(arm_token)}