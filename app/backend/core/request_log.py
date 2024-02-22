import base64
import json
import logging
import pandas as pd
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions
from quart import session
from typing import Any, Dict, List

class RequestLog:

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
        self.container = await self.database.create_container_if_not_exists(id = self._container_name, partition_key = PartitionKey("/user_id"))


    def encode_document_id(self, user_id: str, conversation_id: str):
        """ Encode a string to remove unsafe chars for a cosmos db id """
        document_id = user_id + conversation_id
        safe_id = base64.urlsafe_b64encode(document_id.encode()).decode()
        return safe_id


    async def log_request(self,
                          openai_client,
                          conversation_id,
                          request_id,
                          gpt_deployment,
                          request_body,
                          start_time):
        """Log the JSON Request into CosmosDB"""
        session_id = session["state"]
        user_id = session.get("user_data", {}).get("userPrincipalName") or "Unknown User"
        document_id = self.encode_document_id(user_id, conversation_id)
        
        logging.info("Logging Request ID %s for Session ID %s", request_id, session_id)

        json_document = None
        try:
            # Check if the log document exists in memory, otherwise fetch from Cosmos DB
            if document_id in self._log_document and self._log_document[document_id]:
                json_document = self._log_document[document_id]
            else:
                # Fetch the document from Cosmos DB
                cosmos_response = await self.container.read_item(item=document_id, partition_key=user_id)
                json_document = cosmos_response

            # Ensure json_document has a "history" key and it"s a list
            if "history" not in json_document or not isinstance(json_document["history"], list):
                json_document["history"] = []

            history = json_document["history"]
            new_request = {
                "request_id": request_id,
                "session_id": session_id,
                "gpt_deployment_name": gpt_deployment["deploymentName"],
                "gpt_model_name": gpt_deployment["modelName"],
                "gpt_model_version": gpt_deployment["modelVersion"],
                "start_timestamp": str(start_time.strftime("%Y-%m-%d %H:%M:%S")),
                "request": request_body
                }
            
            history.append(new_request)

        except exceptions.CosmosResourceNotFoundError:
            # this is a new document
            json_document = await self._create_new_json_document(
                openai_client,
                user_id,
                document_id, 
                session_id,
                conversation_id,
                request_id,
                gpt_deployment,
                request_body,
                start_time)
        except Exception as ex:
            logging.exception("Exception in log_request. Error: %s", str(ex))

        finally:
            self._log_document[document_id] = json_document
            await self.save_document(document_id)
            return document_id


    async def _create_new_json_document(self,
                                  openai_client,
                                  user_id,
                                  document_id,
                                  session_id,
                                  conversation_id,
                                  request_id,
                                  gpt_deployment,
                                  request_body,
                                  start_time):
        conversation_title = await self.generate_conversation_title(
            openai_client, 
            gpt_deployment,
            request_body["messages"][0]["content"])
        
        start_timestamp = str(start_time.strftime("%Y-%m-%d %H:%M:%S")),
        
        return {
                "id": document_id,
                "user_id": user_id,
                "conversation_id": conversation_id,
                "conversation_name": conversation_title,
                "conversation_start": start_timestamp,
                "conversation_end": start_timestamp,
                "history": [
                    {
                        "request_id": request_id,
                        "session_id": session_id,
                        "gpt_deployment_name": gpt_deployment["deploymentName"],
                        "gpt_model_name": gpt_deployment["modelName"],
                        "gpt_model_version": gpt_deployment["modelVersion"],
                        "start_timestamp": start_timestamp,
                        "request": request_body
                    }
                ]
            }


    async def log_response(self,
                           document_id,
                           request_id,
                           response,
                           finish_time):
        """Upsert the JSON Request into CosmosDB"""
        try:
            logging.info("Updating Request ID %s with Response", request_id)

            json_document = self._log_document[document_id]
            finish_timestamp = str(finish_time.strftime("%Y-%m-%d %H:%M:%S"))

            # Update the conversation end time
            json_document["conversation_end"] = finish_timestamp

            # Find the request_id in history
            for request in json_document["history"]:
                if request.get("request_id") == request_id:
                    request["response"] = response
                    request["finish_timestamp"] = finish_timestamp
                    break  # request_id is unique, break after finding the match

            await self.save_document(document_id)
            self._log_document.pop(document_id, None)

        except Exception as ex:
            logging.exception("Exception in log_response. Error: %s", str(ex))


    async def save_document(self, document_id):
        """Asynchronously saves the document in CosmosDB"""
        await self.container.upsert_item(body=self._log_document[document_id])


    async def get_conversation_history(self, user_id):
        try:
            query = f"""SELECT TOP 100
        c.user_id,
        c.session_id,
        c.conversation_id,
        c.conversation_name,
        c.conversation_start,
        c.conversation_end
    FROM   c
    WHERE  c.user_id = '{user_id}'
        AND IS_DEFINED(c.conversation_name)
        AND EXISTS (
            SELECT VALUE h
            FROM h IN c.history
            WHERE IS_DEFINED(h.response) AND IS_DEFINED(h.response.answer)
        )
    ORDER BY c.conversation_end DESC"""
            
            items = [item async for item in self.container.query_items(query = query)]

            # Convert to DataFrame for easier manipulation
            df = pd.DataFrame(items)

            # Get today's date
            today = pd.to_datetime('today').normalize()
            
            # Define the start of the week, last week, and last month
            start_of_week = today - pd.Timedelta(days=today.weekday())
            start_of_last_week = start_of_week - pd.Timedelta(weeks=1)
            start_of_last_month = (today.replace(day=1) - pd.Timedelta(days=1)).replace(day=1)
            
            # Function to categorize each date
            def group_date(date):
                if date >= today:
                    return 'Today'
                elif date >= start_of_week:
                    return 'This Week'
                elif date >= start_of_last_week:
                    return 'Last Week'
                elif date >= start_of_last_month:
                    return 'Last Month'
                else:
                    return 'Older'
            
            # Apply categorization
            df['date_category'] = pd.to_datetime(df['conversation_end']).apply(group_date)
            
            # Convert DataFrame back to list of dicts
            grouped_items = df.to_dict('records')
            
            return grouped_items

        except Exception as ex:
            logging.exception("Exception in get_conversation_history. Error: %s", str(ex))


    async def get_conversation(self, user_id, conversation_id):
        try:
            query = f"SELECT c.history FROM c WHERE c.user_id = '{user_id}' AND c.conversation_id = '{conversation_id}'"
            
            # Fetch document from CosmosDB
            items = [item async for item in self.container.query_items(query = query)]
            document = items[0] if items else ""
            
            # Format the response for the frontend
            chat_app_responses = self.format_conversation_history(document)

            return json.dumps(chat_app_responses, indent=4)

        except Exception as ex:
            logging.exception("Exception in get_conversation. Error: %s", str(ex))


    async def generate_conversation_title(self,
                                          openai_client,
                                          gpt_deployment,
                                          question):
        try:
            messages = [
            {"role": "system", "content": "You are a helpful AI that generates conversation titles."},
            {"role": "user", "content": f"Generate a short (less than 10 words) conversation title for the following question or request: \"{question}\""},
        ]

            chat_completion = await openai_client.chat.completions.create(
                                    messages = messages,
                                    # Azure Open AI takes the deployment name as the model name
                                    model = gpt_deployment["deploymentName"],
                                    temperature = 0.4,
                                    max_tokens = 20,
                                    n = 1)
            
            if chat_completion.choices:
                first_choice = chat_completion.choices[0]
                title = first_choice.message.content.replace("\"", "")
                return title
            else:
                return "No title generated"

        except Exception as ex:
            logging.exception("Exception in generate_conversation_title. Error: %s", str(ex))


    def format_conversation_history(self, conversation) -> List[Dict[str, Any]]:
        formatted_history = []

        for history_item in conversation.get("history", {}):
            request = history_item.get("request", {})
            response = history_item.get("response", {})
            
            # Only include if there was an answer
            if response.get("answer", "").strip():
                item = {
                    'question': request["messages"][-1]["content"],
                    'response': {
                        'choices': [{
                            'index': 0,  
                            'message': {
                                'content': response.get("answer", ""),
                                'role': 'assistant'
                            },
                            'context': {
                                'thoughts': response.get("thoughts", None),
                                'data_points': response.get("data_points", []),
                                'followup_questions': response.get("followup_questions", None),
                                'citation_lookup': response.get("citation_lookup", {}),
                                'request_id': history_item["request_id"],
                                **({'error': response["error_message"]} if "error_message" in response else {})
                            },
                            'session_state': request.get("session_state", None)
                        }],
                        'request_id': history_item["request_id"]
                    }
                }
                
                formatted_history.append(item)

        # Include last settings (overrides) used in conversation
        return {
            "history": formatted_history,
            "gpt_deployment": history_item.get("gpt_deployment_name", None),
            "overrides": request.get("context", {}).get("overrides", {})
        }


    async def update_conversation(self, user_id, conversation_id, conversation_name):
        json_document = None
        try:
            document_id = self.encode_document_id(user_id, conversation_id)
            # Check if the log document exists in memory, otherwise fetch from Cosmos DB
            if document_id in self._log_document and self._log_document[document_id]:
                json_document = self._log_document[document_id]
            else:
                # Fetch the document from Cosmos DB
                cosmos_response = await self.container.read_item(item=document_id, partition_key=user_id)
                json_document = cosmos_response

            json_document["conversation_name"] = conversation_name            

        except exceptions.CosmosResourceNotFoundError:
            logging.debug("Document not found. This shouldn't happen...")

        except Exception as ex:
            logging.exception("Exception in update_conversation. Error: %s", str(ex))

        finally:
            self._log_document[document_id] = json_document
            await self.save_document(document_id)
