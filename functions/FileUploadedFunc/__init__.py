# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import logging
import os
import json
import random
import azure.functions as func
from azure.storage.blob import generate_blob_sas
from azure.storage.queue import QueueClient, TextBase64EncodePolicy
from shared_code.status_log import StatusLog, State, StatusClassification

azure_blob_connection_string = os.environ["BLOB_CONNECTION_STRING"]
cosmosdb_url = os.environ["COSMOSDB_URL"]
cosmosdb_key = os.environ["COSMOSDB_KEY"]
cosmosdb_database_name = os.environ["COSMOSDB_DATABASE_NAME"]
cosmosdb_container_name = os.environ["COSMOSDB_CONTAINER_NAME"]
non_pdf_submit_queue = os.environ["NON_PDF_SUBMIT_QUEUE"]
pdf_polling_queue = os.environ["PDF_POLLING_QUEUE"]
pdf_submit_queue = os.environ["PDF_SUBMIT_QUEUE"]
media_submit_queue = os.environ["MEDIA_SUBMIT_QUEUE"]
max_seconds_hide_on_upload = int(os.environ["MAX_SECONDS_HIDE_ON_UPLOAD"])
FUNCTION_NAME = "FileUploadedFunc"

status_log = StatusLog(cosmosdb_url, cosmosdb_key, cosmosdb_database_name, cosmosdb_container_name)

def main(myblob: func.InputStream):
    """ Function to read supported file types and pass to the correct queue for processing"""
    try:
        status_log.upsert_document(myblob.name, 'File Uploaded', StatusClassification.INFO, State.PROCESSING, True)
        status_log.upsert_document(myblob.name, f'{FUNCTION_NAME} - FileUploadedFunc function started', StatusClassification.DEBUG)

        # Create message structure to send to queue
        file_extension = os.path.splitext(myblob.name)[1][1:].lower()
        if file_extension == 'pdf':
             # If the file is a PDF a message is sent to the PDF processing queue.
            queue_name = pdf_submit_queue
        elif file_extension in ['htm', 'html', 'docx', 'xlsx']:
            # Else a message is sent to the non PDF processing queue
            queue_name = non_pdf_submit_queue
        elif file_extension in ['flv', 'mxf', 'gxf', 'ts', 'ps', '3gp', '3gpp', 'mpg', 'wmv', 'asf', 'avi', 'wmv', 'mp4', 'm4a', 'm4v', 'isma', 'ismv', 'dvr-ms', 'mkv', 'wav', 'mov']:
            # Else a message is sent to the media processing queue
            queue_name = media_submit_queue
        else:
            # Unknown file type
            logging.info("Unknown file type")
            error_message = f"{FUNCTION_NAME} - Unexpected file type submitted {file_extension}"
            status_log.state_description = error_message
            status_log.upsert_document(myblob.name, error_message, StatusClassification.ERROR, State.SKIPPED)

        # Create message
        message = {
            "blob_name": f"{myblob.name}",
            "blob_uri": f"{myblob.uri}",
            "submit_queued_count": 1
        }
        message_string = json.dumps(message)

        # Queue message with a random backoff so as not to put the next function under unnecessary load
        queue_client = QueueClient.from_connection_string(azure_blob_connection_string, queue_name, message_encode_policy=TextBase64EncodePolicy())
        backoff =  random.randint(1, max_seconds_hide_on_upload)
        queue_client.send_message(message_string, visibility_timeout = backoff)
        status_log.upsert_document(myblob.name, f'{FUNCTION_NAME} - {file_extension} file sent to submit queue. Visible in {backoff} seconds', StatusClassification.DEBUG, State.QUEUED)

    except Exception as e:
        status_log.upsert_document(myblob.name, f"{FUNCTION_NAME} - An error occurred - {str(e)}", StatusClassification.ERROR, State.ERROR)

    status_log.save_document()
