# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

""" Library of code for status logs reused across various calling features """
import os
import time
from datetime import datetime, timedelta
import base64
from enum import Enum
import logging
from typing import List, Optional
from azure.cosmos import CosmosClient, PartitionKey, exceptions
import traceback, sys

os.environ['TZ'] = 'Australia/Brisbane'
time.tzset()

class State(Enum):
    """ Enum for state of a process """
    PROCESSING = "Processing"
    SKIPPED = "Skipped"
    QUEUED = "Queued"
    COMPLETE = "Complete"
    ERROR = "Error"
    THROTTLED = "Throttled"
    UPLOADED = "Uploaded"
    ALL = "All"

class StatusClassification(Enum):
    """ Enum for classification of a status message """
    DEBUG = "Debug"
    INFO = "Info"
    ERROR = "Error"

class StatusQueryLevel(Enum):
    """ Enum for level of detail of a status query """
    CONCISE = "Concise"
    VERBOSE = "Verbose"

class StatusLog:
    """ Class for logging status of various processes to Cosmos DB"""

    def __init__(self, url, key, database_name, container_name):
        """ Constructor function """
        self._url = url
        self._key = key
        self._database_name = database_name
        self._container_name = container_name
        self.cosmos_client = CosmosClient(url=self._url, credential=self._key)
        self._log_document = {}

        # Select a database (will create it if it doesn't exist)
        self.database = self.cosmos_client.get_database_client(self._database_name)
        if self._database_name not in [db['id'] for db in self.cosmos_client.list_databases()]:
            self.database = self.cosmos_client.create_database(self._database_name)

        # Select a container (will create it if it doesn't exist)
        self.container = self.database.get_container_client(self._container_name)
        if self._container_name not in [container['id'] for container
                                        in self.database.list_containers()]:
            self.container = self.database.create_container(id=self._container_name,
                partition_key=PartitionKey(path="/file_path"))

    def encode_document_id(self, document_id):
        """ encode a path/file name to remove unsafe chars for a cosmos db id """
        safe_id = base64.urlsafe_b64encode(document_id.encode()).decode()
        return safe_id


    def upsert_document(self,
                        document_path,
                        status,
                        status_classification: StatusClassification,
                        state: Optional[State] = None,
                        fresh_start = False,
                        tags_list: Optional[List] = None):
        """ Function to upsert a status item for a specified id """
        base_name = os.path.basename(document_path)
        document_id = self.encode_document_id(document_path)
        document_path_parts = document_path.split('/')
        folder_name = document_path_parts[1] if len(document_path_parts) > 2 else None

        # add status to standard logger
        logging.info(f"{status} DocumentID - {document_id}")

        # If this event is the start of an upload, remove any existing status files for this path
        if fresh_start:
            try:
                self.container.delete_item(item=document_id, partition_key=document_path)
            except exceptions.CosmosResourceNotFoundError:
                pass

        json_document = ""
        try:
            # if the document exists and if this is the first call to the function from the parent,
            # then retrieve the stored document from cosmos, otherwise, use the log stored in self
            if self._log_document.get(document_id, "") == "":
                json_document = self.container.read_item(item=document_id, partition_key=document_path)
            else:
                json_document = self._log_document[document_id]

            # Check if we need to set tags
            if tags_list is not None and ("tags" not in json_document or not json_document["tags"]):
                json_document["tags"] = tags_list
            
            # Check if there has been a state change, and therefore to update state
            if state is not None and json_document['state'] != state.value:
                json_document['state'] = state.value
                json_document['state_timestamp'] = str(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

            # Append a new item to the array
            status_updates = json_document["status_updates"]
            new_item = {
                "status": status,
                "status_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                "status_classification": str(status_classification.value)
            }

            if status_classification == StatusClassification.ERROR:
                new_item["stack_trace"] = self.get_stack_trace()

            status_updates.append(new_item)
        except exceptions.CosmosResourceNotFoundError:
            # this is a new document
            json_document = {
                "id": document_id,
                "file_path": document_path,
                "file_name": base_name,
                "folder_name" : folder_name,
                "tags": tags_list,
                "state": str(state.value),
                "start_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                "state_description": "",
                "state_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                "status_updates": [
                    {
                        "status": status,
                        "status_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                        "status_classification": str(status_classification.value)
                    }
                ]
            }
        except Exception:
            # log the exception with stack trace to the status log
            json_document = {
                "id": document_id,
                "file_path": document_path,
                "file_name": base_name,
                "folder_name" : folder_name,
                "tags": tags_list,
                "state": str(state.value),
                "start_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                "state_description": "",
                "state_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                "status_updates": [
                    {
                        "status": status,
                        "status_timestamp": str(datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                        "status_classification": str(status_classification.value),
                        "stack_trace": self.get_stack_trace() if not fresh_start else None
                    }
                ]
            }

        self._log_document[document_id] = json_document

    def update_document_state(self, document_path, state_str):
        """Updates the state of the document in the storage"""
        try:
            document_id = self.encode_document_id(document_path)
            logging.info(f"{state_str} DocumentID - {document_id}")
            document_id = self.encode_document_id(document_path)
            if self._log_document.get(document_id, "") != "":
                json_document = self._log_document[document_id]
                json_document['state'] = state_str
                json_document['state_timestamp'] = str(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                self.save_document(document_path)
                self._log_document[document_id] = json_document
            else:
                logging.warning(f"Document with ID {document_id} not found.")
        except Exception as err:
            logging.error(f"An error occurred while updating the document state: {str(err)}")      

    def save_document(self, document_path):
        """Saves the document in the storage"""
        document_id = self.encode_document_id(document_path)
        self.container.upsert_item(body=self._log_document[document_id])
        self._log_document[document_id] = ""

    def get_stack_trace(self):
        """ Returns the stack trace of the current exception"""
        exc = sys.exc_info()[0]
        stack = traceback.extract_stack()[:-1]  # last one would be full_stack()
        if exc is not None:  # i.e. an exception is present
            del stack[-1]       # remove call of full_stack, the printed exception
                                # will contain the caught exception caller instead
        trc = 'Traceback (most recent call last):\n'
        stackstr = trc + ''.join(traceback.format_list(stack))
        if exc is not None:
            stackstr += '  ' + traceback.format_exc().lstrip(trc)
        return stackstr
