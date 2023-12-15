# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

""" Library of code for status logs reused across various calling features """
import os
import re
from datetime import datetime, timedelta
import base64
from enum import Enum
import logging
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
    

    async def read_file_status(self,
                               file_id: str,
                               status_query_level: StatusQueryLevel = StatusQueryLevel.CONCISE):
        """ 
        Function to issue a query and return resulting single doc        
        args
            status_query_level - the StatusQueryLevel value representing concise 
            or verbose status updates to be included
            file_id - if you wish to return a single document by its path     
        """
        query_string = f"SELECT * FROM c WHERE c.id = '{self.encode_document_id(file_id)}'"

        items = [item async for item in self.container.query_items(query = query_string)]

        # Now we have the document, remove the status updates that are
        # considered 'non-verbose' if required
        if status_query_level == StatusQueryLevel.CONCISE:
            for item in items:
                # Filter out status updates that have status_classification == "debug"
                item['status_updates'] = [update for update in item['status_updates']
                                          if update['status_classification'] != 'Debug']

        return items


    async def read_files_status_by_timeframe(self, user_id: str, is_admin: bool):
        """ 
        Function to issue a query and return resulting docs          
        args
            within_n_hours - integer representing from how many hours ago to return docs for
            folder_name - return docs within this folder
        """

        query_string = "SELECT c.id, c.file_path, c.file_name, c.folder_name, c.tags, \
            c.state, c.start_timestamp, c.state_description, c.state_timestamp \
            FROM c"

        # conditions = []    
        # if within_n_hours != -1:
        #     from_time = datetime.utcnow() - timedelta(hours=within_n_hours)
        #     from_time_string = str(from_time.strftime('%Y-%m-%d %H:%M:%S'))
        #     conditions.append(f"c.start_timestamp > '{from_time_string}'")

        # if state != State.ALL:
        #     conditions.append(f"c.state = '{state.value}'")

        # if folders != 'ALL':
        #     conditions.append(f"udf.folderMatch(c.folder_name, '{folders}')")

        # if tags != 'ALL':
        #     conditions.append(f"udf.tagMatch(c.tags, '{tags}')")

        # if conditions:
        #     query_string += " WHERE " + " AND ".join(conditions)

        query_string += " ORDER BY c.state_timestamp DESC"

        items = [item async for item in self.container.query_items(query = query_string)]

        # Filter items based on user access
        if not is_admin:
            user_folder_pattern = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
            items = [item for item in items if not user_folder_pattern.match(item['folder_name']) or item['folder_name'] == user_id]

        return items


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
