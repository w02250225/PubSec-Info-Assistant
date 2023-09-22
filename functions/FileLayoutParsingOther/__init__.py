# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import logging
import os
import json
from io import BytesIO
import azure.functions as func
from azure.storage.queue import QueueClient, TextBase64EncodePolicy
from shared_code.status_log import StatusLog, State, StatusClassification
from shared_code.utilities import Utilities
import mammoth
import requests
import pandas as pd

azure_blob_storage_account = os.environ["BLOB_STORAGE_ACCOUNT"]
azure_blob_storage_endpoint = os.environ["BLOB_STORAGE_ACCOUNT_ENDPOINT"]
azure_blob_drop_storage_container = os.environ["BLOB_STORAGE_ACCOUNT_UPLOAD_CONTAINER_NAME"]
azure_blob_content_storage_container = os.environ["BLOB_STORAGE_ACCOUNT_OUTPUT_CONTAINER_NAME"]
azure_blob_storage_key = os.environ["BLOB_STORAGE_ACCOUNT_KEY"]
azure_blob_connection_string = os.environ["BLOB_CONNECTION_STRING"]
azure_blob_log_storage_container = os.environ["BLOB_STORAGE_ACCOUNT_LOG_CONTAINER_NAME"]
cosmosdb_url = os.environ["COSMOSDB_URL"]
cosmosdb_key = os.environ["COSMOSDB_KEY"]
cosmosdb_database_name = os.environ["COSMOSDB_DATABASE_NAME"]
cosmosdb_container_name = os.environ["COSMOSDB_CONTAINER_NAME"]
non_pdf_submit_queue = os.environ["NON_PDF_SUBMIT_QUEUE"]
pdf_polling_queue = os.environ["PDF_POLLING_QUEUE"]
pdf_submit_queue = os.environ["PDF_SUBMIT_QUEUE"]
text_enrichment_queue = os.environ["TEXT_ENRICHMENT_QUEUE"]
CHUNK_TARGET_SIZE = int(os.environ["CHUNK_TARGET_SIZE"])

utilities = Utilities(azure_blob_storage_account, azure_blob_storage_endpoint,
                      azure_blob_drop_storage_container, azure_blob_content_storage_container,
                      azure_blob_storage_key)

FUNCTION_NAME = "FileLayoutParsingOther"

def main(msg: func.QueueMessage) -> None:
    try:
        status_log = StatusLog(cosmosdb_url, cosmosdb_key,
                              cosmosdb_database_name, cosmosdb_container_name)
        logging.info('Python queue trigger function processed a queue item: %s',
                     msg.get_body().decode('utf-8'))

        # Receive message from the queue
        message_body = msg.get_body().decode('utf-8')
        message_json = json.loads(message_body)
        blob_name = message_json['blob_name']
        blob_uri = message_json['blob_uri']
        status_log.upsert_document(
            blob_name, f'{FUNCTION_NAME} - Starting to parse the non-PDF file', StatusClassification.INFO, State.PROCESSING)
        status_log.upsert_document(
            blob_name, f'{FUNCTION_NAME} - Message received from non-pdf submit queue', StatusClassification.DEBUG)

        # construct blob url
        blob_path_plus_sas = utilities.get_blob_and_sas(blob_name)
        status_log.upsert_document(
            blob_name, f'{FUNCTION_NAME} - SAS token generated to access the file', StatusClassification.DEBUG)

        file_name, file_extension, file_directory = utilities.get_filename_and_extension(blob_name)

        response = requests.get(blob_path_plus_sas, timeout=30)
        response.raise_for_status()
        if file_extension in ['.docx']:
            docx_file = BytesIO(response.content)
            # Convert the downloaded Word document to HTML
            result = mammoth.convert_to_html(docx_file)
            status_log.upsert_document(
                blob_name, f'{FUNCTION_NAME} - HTML generated from DocX by mammoth', StatusClassification.DEBUG)
            html = result.value  # The generated HTML
        elif file_extension in ['.xlsx']:
            xlsx_file = BytesIO(response.content)
            # Convert the downloaded Excel document to HTML
            sheets = pd.read_excel(xlsx_file, sheet_name=None)
            html = f'<h1>{file_name}</h1>\n'
            for sheet_name, sheet_df in sheets.items():
                title = f'<h2>{sheet_name}</h2>\n'
                df_html = sheet_df.to_html(na_rep='')
                html += title + df_html
            status_log.upsert_document(
                blob_name, f'{FUNCTION_NAME} - HTML generated from XLSX', StatusClassification.DEBUG)
        else:
            html = response.text

        # build the document map from HTML for all non-pdf file types
        status_log.upsert_document(
            blob_name, f'{FUNCTION_NAME} - Starting document map build', StatusClassification.DEBUG)
        document_map = utilities.build_document_map_html(
            blob_name, blob_uri, html, azure_blob_log_storage_container)
        status_log.upsert_document(
            blob_name, f'{FUNCTION_NAME} - Document map build complete, starting chunking', StatusClassification.DEBUG)
        chunk_count = utilities.build_chunks(
            document_map, blob_name, blob_uri, CHUNK_TARGET_SIZE)
        status_log.upsert_document(
            blob_name, f'{FUNCTION_NAME} - Chunking complete. {chunk_count} chunks created', StatusClassification.DEBUG)

        # submit message to the enrichment queue to continue processing
        queue_client = QueueClient.from_connection_string(
            azure_blob_connection_string, queue_name=text_enrichment_queue, message_encode_policy=TextBase64EncodePolicy())
        message_json["enrichment_queued_count"] = 1
        message_string = json.dumps(message_json)
        queue_client.send_message(message_string)
        status_log.upsert_document(
            blob_name, f"{FUNCTION_NAME} - message sent to enrichment queue", StatusClassification.DEBUG, State.QUEUED)

    except Exception as ex:
        status_log.upsert_document(
            blob_name, f"{FUNCTION_NAME} - An error occurred - {str(ex)}", StatusClassification.ERROR, State.ERROR)

    status_log.save_document()
