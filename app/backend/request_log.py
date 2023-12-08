import base64
import logging
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
from quart import session

class RequestLog:

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
        self.container = await self.database.create_container_if_not_exists(id = self._container_name, partition_key = PartitionKey("/user_id", "/session_id"))


    async def log_request(self, request_id, gpt_deployment, request_body, start_time):
        """Log the JSON Request into CosmosDB"""
        try:
            document_id = base64.urlsafe_b64encode(request_id.encode()).decode()
            session_id = session["state"]
            user_id = session.get('user_data', {}).get('userPrincipalName') or "Unknown User"

            logging.info('Logging Request ID %s for Session ID %s', request_id, session_id)

            json_document = {
                "id": document_id,
                "user_id": user_id,
                "session_id": session_id,
                "request_id": request_id,
                "request": request_body,
                "gpt_deployment_name": gpt_deployment['deploymentName'],
                "gpt_model_name": gpt_deployment['modelName'],
                "gpt_model_version": gpt_deployment['modelVersion'],
                "start_timestamp": str(start_time.strftime('%Y-%m-%d %H:%M:%S')),
                }

            await self.container.create_item(body = json_document)

            return json_document

        except Exception as ex:
            logging.exception("Exception in log_request. Error: %s", str(ex))


    async def log_response(self, request_id, json_document, finish_time):
        """Upsert the JSON Request into CosmosDB"""
        try:
            logging.info('Updating Request ID %s with Response', request_id,)

            json_document["finish_timestamp"] = str(finish_time.strftime('%Y-%m-%d %H:%M:%S'))

            await self.container.upsert_item(body = json_document)

        except Exception as ex:
            logging.exception("Exception in log_response. Error: %s", str(ex))
