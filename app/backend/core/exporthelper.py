import logging
import io
import time
from docx import Document
from htmldocx import HtmlToDocx
from azure.storage.blob import (BlobServiceClient)
from flask import session

def export_to_blob(request: str, blob_service_client: BlobServiceClient, container_name: str):
    try:
        user_id = session.get('user_data', {}).get('userPrincipalName') or "Unknown User"
        
        export = create_docx(request["title"],
                             request["answer"],
                             request["citations"])

        blob_name = upload_to_blob(export,
                                   request["request_id"],
                                   user_id,
                                   blob_service_client,
                                   container_name)
        
        return blob_name

    except Exception as ex:
        logging.exception("Exception in export_to_blob")
        return str(ex)

def create_docx(title: str, answer: str, citations: str):
    try:
        document = Document()
        html_parser = HtmlToDocx()
        stream = io.BytesIO()

        document._body.clear_content() #Remove blank lines from new document

        document.add_heading(title, 0) #Add heading
        answer_html = answer.replace('\n', '<br />') # Replace newline with <br />
        html_parser.add_html_to_document(answer_html, document) # Add the answer content
        citations_html = citations.replace('\n', '<br />') # Replace newline with <br />
        html_parser.add_html_to_document(citations_html, document) # Add the citations

        document.save(stream)
        stream.seek(0)

        return stream

    except Exception as ex:
        logging.exception("Exception in create_docx")
        return str(ex)

def upload_to_blob(input_stream: io.BytesIO(), request_id: str,
                   user_id: str, blob_service_client: BlobServiceClient,
                   container_name: str):
    try:
        timestamp = time.strftime("%Y%m%d%H%M%S")
        blob_name = f"{user_id}/{timestamp}_{request_id}.docx"
        blob_client = blob_service_client.get_blob_client(container=container_name,
                                                          blob=blob_name)
        blob_client.upload_blob(input_stream, blob_type="BlockBlob")

        return blob_name

    except Exception as ex:
        logging.exception("Exception in upload_to_blob")
        return str(ex)
