import logging
import azure.functions as func
import os
import json
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from shared_code.status_log import State, StatusClassification, StatusLog

AZURE_SEARCH_SERVICE_ENDPOINT = os.environ["AZURE_SEARCH_SERVICE_ENDPOINT"]
AZURE_SEARCH_INDEX = os.environ["AZURE_SEARCH_INDEX"]
AZURE_SEARCH_SERVICE_KEY = os.environ["AZURE_SEARCH_SERVICE_KEY"]
BLOB_STORAGE_ACCOUNT_ENDPOINT = os.environ["BLOB_STORAGE_ACCOUNT_ENDPOINT"]
COSMOSDB_URL = os.environ["COSMOSDB_URL"]
COSMOSDB_KEY = os.environ["COSMOSDB_KEY"]
COSMOSDB_LOG_DATABASE_NAME = os.environ["COSMOSDB_LOG_DATABASE_NAME"]
COSMOSDB_LOG_CONTAINER_NAME = os.environ["COSMOSDB_LOG_CONTAINER_NAME"]

FUNCTION_NAME = "IndexUpdate"
MAX_CHARS_FOR_DETECTION = 1000

SEARCH_CLIENT = SearchClient(
    endpoint = AZURE_SEARCH_SERVICE_ENDPOINT,
    index_name = AZURE_SEARCH_INDEX,
    credential = AzureKeyCredential(AZURE_SEARCH_SERVICE_KEY),
)

statusLog = StatusLog(
    COSMOSDB_URL, COSMOSDB_KEY, COSMOSDB_LOG_DATABASE_NAME, COSMOSDB_LOG_CONTAINER_NAME
)     

def main(msg: func.QueueMessage) -> None:
    '''This function is triggered by a message in the vector-index-update queue.
    It will perform actions on documents in the Azure AI Search Index'''

    try:
        message_body = msg.get_body().decode("utf-8")
        message_json = json.loads(message_body)
        file_path = message_json["file_path"]
        file_uri = message_json["file_uri"]
        action = message_json["action"]
   
        logging.info(
            "Python queue trigger function processed a queue item: %s",
            msg.get_body().decode("utf-8"),
        )

        statusLog.upsert_document(
            file_path,
            f"{FUNCTION_NAME} - Received message from vector-index-update queue ",
            StatusClassification.DEBUG,
        )
        
        if action == "delete":
            deletes = delete_search_documents(file_uri)
            message = f"Deleted {deletes} documents in vector store"

        elif action == "updateTags":
            new_tags = message_json["tags"]
            updates = update_search_documents_tags(file_uri, new_tags)
            message = f"Updated {updates} documents in vector store"

        else:
            message = f"Unsupported action type provided '{action}'"

        statusLog.upsert_document(
            file_path,
            f"{FUNCTION_NAME} - {message}",
            StatusClassification.DEBUG,
        )
   
    except Exception as error:
        statusLog.upsert_document(
            file_path,
            f"{FUNCTION_NAME} - An error occurred - {str(error)}",
            StatusClassification.ERROR,
            State.ERROR,
        )
        
    statusLog.save_document(file_path)


def delete_search_documents(file_uri: str):
    try:
        results = SEARCH_CLIENT.search(search_text="*", filter=f"file_uri eq '{file_uri}'", select="id")
        
        documents_to_delete = [{"@search.action": "delete", "id": result["id"]} for result in results]
        
        if len(documents_to_delete) > 0:
            SEARCH_CLIENT.delete_documents(documents_to_delete)
            
        return len(documents_to_delete)
    
    except Exception as error:
        logging.exception(f"Exception in delete_search_documents. {str(error)}")
        return 0


def update_search_documents_tags(file_uri: str, new_tags: list[str]):
    try:
        results = SEARCH_CLIENT.search(search_text="*", filter=f"file_uri eq '{file_uri}'", select="id, tags")
        
        documents_to_update = []
        for result in results:
            current_tags = result.get("tags", [])
            if current_tags != new_tags:
                documents_to_update.append({"@search.action": "merge", "id": result["id"], "tags": new_tags})

        if len(documents_to_update) > 0:
            SEARCH_CLIENT.merge_documents(documents_to_update)
            
        return len(documents_to_update)
    
    except Exception as error:
        logging.exception(f"Exception in update_search_documents_tags. {str(error)}")
        return 0
