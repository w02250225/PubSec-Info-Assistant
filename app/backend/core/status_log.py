# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

""" Library of code for status logs reused across various calling features """
import os
import re
from datetime import datetime
import base64
from enum import Enum
import logging
from typing import List, Optional
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions
import traceback, sys

class State(Enum):
    """ Enum for state of a process """
    PROCESSING = "Processing"
    SKIPPED = "Skipped"
    QUEUED = "Queued"
    COMPLETE = "Complete"
    ERROR = "Error"
    THROTTLED = "Throttled"
    UPLOADED = "Uploaded"
    DELETED = "Deleted"
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
        self.cosmos_client = None
        self._log_document = {}


    async def initialize(self):
        self.cosmos_client = CosmosClient(url = self._url, credential = self._key)
        self.database = await self.cosmos_client.create_database_if_not_exists(id = self._database_name)
        self.container = await self.database.create_container_if_not_exists(id = self._container_name, partition_key = PartitionKey(path="/file_path"))


    def encode_document_id(self, document_id):
        """ encode a path/file name to remove unsafe chars for a cosmos db id """
        safe_id = base64.urlsafe_b64encode(document_id.encode()).decode()
        return safe_id


    async def read_all_files_status(self, user_id: str, is_admin: bool):
        """ 
        Function to issue a query and return resulting docs          
        args
            within_n_hours - integer representing from how many hours ago to return docs for
            folder_name - return docs within this folder
        """

        query_string = "SELECT c.id, c.file_path, c.file_name, c.folder_name, \
            c.tags, c.state, c.start_timestamp, c.state_description,  \
            ARRAY_SLICE(c.status_updates,-1)[0].status_timestamp AS state_timestamp \
            FROM c"

        query_string += " ORDER BY c._ts DESC"

        items = [item async for item in self.container.query_items(query = query_string)]

        # Filter items based on user access
        if not is_admin:
            user_folder_pattern = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
            items = [item for item in items if not user_folder_pattern.match(item['folder_name']) or item['folder_name'] == user_id]

        return items


    async def upsert_document(self,
                              document_path,
                              status,
                              status_classification: StatusClassification,
                              state: Optional[State] = None,
                              fresh_start = False,
                              tags_list: Optional[List] = None):
        """ Asynchronous function to upsert a status item for a specified id in CosmosDB"""
        base_name = os.path.basename(document_path)
        document_id = self.encode_document_id(document_path)
        document_path_parts = document_path.split('/')
        folder_name = document_path_parts[1] if len(document_path_parts) > 2 else None

        # add status to standard logger
        logging.info(f"{status} DocumentID - {document_id}")

        # If this event is the start of an upload, remove any existing status files for this path
        if fresh_start:
            try:
                await self.container.delete_item(item=document_id, partition_key=document_path)
            except exceptions.CosmosResourceNotFoundError:
                pass

        json_document = ""
        try:
            # if the document exists and if this is the first call to the function from the parent,
            # then retrieve the stored document from cosmos, otherwise, use the log stored in self
            if self._log_document.get(document_id, "") == "":
                json_document = await self.container.read_item(item=document_id, partition_key=document_path)
            else:
                json_document = self._log_document[document_id]

            # Check if we need to set/update tags
            if tags_list is not None:
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
            json_document = self._create_new_json_document(document_id, document_path, base_name, folder_name, state, status, status_classification, tags_list)
        except Exception:
            # log the exception with stack trace to the status log
            json_document = self._create_error_json_document(document_id, document_path, base_name, folder_name, state, status, status_classification, tags_list)

        self._log_document[document_id] = json_document


    def _create_new_json_document(self, document_id, document_path, base_name, folder_name, state, status, status_classification, tags_list):
        return {
            "id": document_id,
            "file_path": document_path,
            "file_name": base_name,
            "folder_name": folder_name,
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
    

    def _create_error_json_document(self, document_id, document_path, base_name, folder_name, state, status, status_classification, tags_list):
        return {
            "id": document_id,
            "file_path": document_path,
            "file_name": base_name,
            "folder_name": folder_name,
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
                    "stack_trace": self.get_stack_trace()
                }
            ]
        }


    async def update_document_state(self, document_path, state_str):
        """Asynchronously updates the state of the document in CosmosDB"""
        try:
            document_id = self.encode_document_id(document_path)
            logging.info(f"{state_str} DocumentID - {document_id}")

            if self._log_document.get(document_id, "") != "":
                json_document = self._log_document[document_id]
                json_document['state'] = state_str
                json_document['state_timestamp'] = str(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                await self.save_document(document_path)
                self._log_document[document_id] = json_document
            else:
                logging.warning(f"Document with ID {document_id} not found.")
        except Exception as err:
            logging.error(f"An error occurred while updating the document state: {str(err)}")
     

    async def save_document(self, document_path):
        """Asynchronously saves the document in CosmosDB"""
        document_id = self.encode_document_id(document_path)
        await self.container.upsert_item(body=self._log_document[document_id])
        self._log_document[document_id] = ""
     

    async def delete_document(self, document_path):
        """Asynchronously deletes the document in CosomsDB"""
        document_id = self.encode_document_id(document_path)
        await self.container.delete_item(item=document_id, partition_key=document_path)


    async def get_all_tags(self):
        """ Returns all tags in the database """
        query_string = "SELECT DISTINCT VALUE t FROM c JOIN t IN c.tags"
        tag_array = [item async for item in self.container.query_items(query = query_string)]
        return ",".join(tag_array)
    

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