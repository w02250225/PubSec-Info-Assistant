import base64
import logging
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
from quart import session

class UserDataLog:

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
        self.container = await self.database.create_container_if_not_exists(id = self._container_name, partition_key = PartitionKey("/user_id"))


    async def upsert_user_session(self):
        """Insert/update the user session into CosmosDB"""
        try:
            user_data = session["user_data"]
            session_id = user_data["session_id"]
            document_id = base64.urlsafe_b64encode(session_id.encode()).decode()

            logging.info('Logging user login for Session ID %s', session_id)
            
            json_document = {
                "id": document_id,
                **user_data,  # Unpack from user_data
                }

            await self.container.upsert_item(body = json_document)

        except Exception as ex:
            logging.exception("Exception in upsert_user_session. Error: %s", str(ex))


    async def get_user_session(self):
        """Get current user session data from CosmosDB"""
        try:
            user_data = session["user_data"]
            session_id = user_data["session_id"]
            document_id = base64.urlsafe_b64encode(session_id.encode()).decode()
            
            await self.container.read_item(item=document_id, partition_key=user_data["user_id"])

        except Exception as ex:
            logging.exception("Exception in log_response. Error: %s", str(ex))
