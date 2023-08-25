from azure.cosmos import CosmosClient, PartitionKey
from flask import jsonify

import base64

class RequestLog:

    def __init__(self, url, key, database_name, container_name):
        """ Constructor function """
        self._url = url
        self._key = key
        self._database_name = database_name
        self._container_name = container_name
        self.cosmos_client = CosmosClient(url=self._url, credential=self._key)

        # Select a database (will create it if it doesn't exist)
        self.database = self.cosmos_client.get_database_client(
            self._database_name)
        if self._database_name not in [db['id'] for db in self.cosmos_client.list_databases()]:
            self.database = self.cosmos_client.create_database(
                self._database_name)

        # Select a container (will create it if it doesn't exist)
        self.container = self.database.get_container_client(
            self._container_name)
        if self._container_name not in [container['id'] for container
                                        in self.database.list_containers()]:
            self.container = self.database.create_container(id=self._container_name,
                                                            partition_key=PartitionKey(path="/request_id"))

    def log_request_response(self, logger, request_id, request_body, response_body, start_time, finish_time):
        """Log the JSON Request and Response into CosmosDB"""

        try:
            logger.info('Logging Request ID %s', request_id)

            document_id = base64.urlsafe_b64encode(request_id.encode()).decode()

            # Remove request_id if present in response_body
            response_body.pop("request_id", None)

            json_document = jsonify(
                {
                "id": document_id,
                "request_id": request_id,
                "request_body": request_body,
                "response_body": response_body,
                "start_timestamp": str(start_time.strftime('%Y-%m-%d %H:%M:%S')),
                "finish_timestamp": str(finish_time.strftime('%Y-%m-%d %H:%M:%S')),
                }
            )

            self.container.create_item(body = json_document.json)

        except Exception as ex:
            logger.exception("Exception in log_request_response. Error: %s", str(ex))
