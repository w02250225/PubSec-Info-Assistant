import base64
import logging
from azure.cosmos import CosmosClient, PartitionKey
from flask import jsonify, session

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
                                                            partition_key=PartitionKey("/user_id", "/session_id"))

    def log_request_response(self, request_id, request_body, response_body, start_time, finish_time):
        """Log the JSON Request and Response into CosmosDB"""
        try:
            document_id = base64.urlsafe_b64encode(request_id.encode()).decode()
            session_id = session["state"]
            user_id = session.get('user_data', {}).get('userPrincipalName') or "Unknown User"

            logging.info('Logging Request ID %s for Session ID %s', request_id, session_id)

            # Remove request_id if present in response_body
            response_body.pop("request_id", None)

            json_document = jsonify(
                {
                "id": document_id,
                "user_id": user_id,
                "session_id": session_id,
                "request_id": request_id,
                "request_body": request_body,
                "response_body": response_body,
                "start_timestamp": str(start_time.strftime('%Y-%m-%d %H:%M:%S')),
                "finish_timestamp": str(finish_time.strftime('%Y-%m-%d %H:%M:%S')),
                }
            )

            self.container.create_item(body = json_document.json)

        except Exception as ex:
            logging.exception("Exception in log_request_response. Error: %s", str(ex))
