import base64
import logging
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions
from quart import jsonify, request, session

class ConfigHelper:
    """ Class for managing config Cosmos DB"""

    def __init__(self, url, key, database_name, container_name):
        """ Constructor function """
        self._url = url
        self._key = key
        self._database_name = database_name
        self._container_name = container_name
        self.cosmos_client = None
        self._documents = {}


    async def initialize(self):
        self.cosmos_client = CosmosClient(url = self._url, credential = self._key)
        self.database = await self.cosmos_client.create_database_if_not_exists(id = self._database_name)
        self.container = await self.database.create_container_if_not_exists(id = self._container_name, partition_key = PartitionKey(path="/user_id"))


    def encode_document_id(self, user_id: str, prompt_name: str):
        """ Encode a string to remove unsafe chars for a cosmos db id """
        document_id = user_id + prompt_name
        safe_id = base64.urlsafe_b64encode(document_id.encode()).decode()
        return safe_id


    async def get_prompt_templates(self, user_id: str, is_admin: bool):
        "Function to issue a query and return resulting docs"

        try:
            query_string = """SELECT c.id,
        c.user_id,
        c.display_name,
        c.deployment_name,
        c.prompt_override,
        c.response_length,
        c.temperature,
        c.top_p,
        c.retrieval_mode
    FROM   c
    WHERE  ( NOT is_defined(c.archived)
            OR c.archived = false)"""

            # Add filter for user_id if not admin
            query_string += f" AND c.user_id IN ('System', '{user_id}')" if not is_admin else ""

            query_string += " ORDER BY c.display_name DESC"

            items = [item async for item in self.container.query_items(query = query_string)]

            return items

        except Exception as error:
            logging.error("An error occurred in upsert_prompt_template. ", error)
            raise


    async def upsert_prompt_template(self):
        """ Asynchronous function to upsert an item in CosmosDB"""
        request_data = await request.json
        user_id = session.get('user_data', {}).get('userPrincipalName') or "Unknown User"
        template_fields = [
            "user_id", "display_name", "deployment_name", "prompt_override",
            "response_length", "temperature", "top_p", "retrieval_mode", "archived"]
            
        # Filter the request data based on the above fields
        prompt_template = {key: request_data[key] for key in template_fields if key in request_data}
        document_id = self.encode_document_id(prompt_template["user_id"], prompt_template["display_name"])
        prompt_template["id"] = document_id

        try:
            # Attempt to read from CosmosDB
            current_document = await self.container.read_item(item=document_id, partition_key=user_id)

            if current_document.get("user_id", "") != user_id:
                return jsonify({"error": "You are not allowed to edit this template"}), 400

            # Compare the current document with the request data
            if all(current_document.get(key) == prompt_template.get(key) for key in prompt_template):
                # If all values are the same, do not upsert
                return jsonify({"message": "No update required, document unchanged"}), 200
        except exceptions.CosmosResourceNotFoundError:
            # Document does not exist, proceed with upsert
            pass

        try:
            # Upsert the document as it's either new or has changes
            await self.container.upsert_item(prompt_template)
            return jsonify({"message": "Prompt Template saved successfully", "id": document_id}), 200

        except Exception as error:
            logging.error("An error occurred in upsert_prompt_template. ", error)
            raise
