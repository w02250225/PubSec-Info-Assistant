# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
import traceback, sys
import base64

class TagsHelper:
    """ Helper class for tag functions"""

    def __init__(self, url, key, database_name, container_name):
        """ Constructor function """
        self._url = url
        self._key = key
        self._database_name = database_name
        self._container_name = container_name
        self.cosmos_client = None


    async def initialize(self):
        self.cosmos_client = CosmosClient(url = self._url, credential = self._key)
        self.database = await self.cosmos_client.create_database_if_not_exists(id = self._database_name)
        self.container = await self.database.create_container_if_not_exists(id = self._container_name, partition_key = PartitionKey(path="/file_path"))


    async def get_all_tags(self):
        """ Returns all tags in the database """
        query = "SELECT DISTINCT VALUE t FROM c JOIN t IN c.tags"
        tag_array = [item async for item in self.container.query_items(query = query)]
        return ",".join(tag_array)
    
    async def upsert_document(self, document_path, tags_list):
        """ Upserts a document into the database """
        document_id = self.encode_document_id(document_path)
        document = {
            "id": document_id,
            "file_path": document_path,
            "tags": tags_list
        }
        await self.container.upsert_item(document)

    def encode_document_id(self, document_id):
        """ encode a path/file name to remove unsafe chars for a cosmos db id """
        safe_id = base64.urlsafe_b64encode(document_id.encode()).decode()
        return safe_id
    
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