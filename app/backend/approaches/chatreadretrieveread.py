# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import re
import json
import logging
import urllib.parse
from datetime import datetime, timedelta
from typing import Any, AsyncGenerator, Coroutine, Literal, Optional, Union, overload
from openai import AsyncOpenAI, AsyncStream
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionChunk,
    ChatCompletionMessageParam,
)

from approaches.approach import Approach
from azure.search.documents.aio import SearchClient
from azure.search.documents.models import QueryType, VectorizedQuery, VectorQuery
from azure.storage.blob.aio import BlobServiceClient
from azure.storage.blob import (
    AccountSasPermissions,
    ResourceTypes,
    generate_account_sas,
)
from text import nonewlines
import tiktoken
from core.messagebuilder import MessageBuilder
from core.modelhelper import get_token_limit
import requests

# Simple retrieve-then-read implementation, using the Cognitive Search and
# OpenAI APIs directly. It first retrieves top documents from search,
# then constructs a prompt with them, and then uses OpenAI to generate
# an completion (answer) with that prompt.

class ChatReadRetrieveReadApproach(Approach):

     # Chat roles
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    
    NO_RESPONSE = "0"

    system_message_chat_conversation = """You are {systemPersona} who helps {userPersona} answer questions about a Government agency's data.
{response_length_prompt}
User persona is {userPersona}.
Try to provide answer using the facts listed in the list of sources documents provided.
Your goal is to provide accurate and relevant answers based on the facts listed in the provided source documents.
Make sure to reference the above source documents if you use them and avoid making assumptions or adding personal opinions.
Emphasize the use of facts listed in the above provided source documents.
Instruct the model to use source name for each fact used in the response.
Avoid generating speculative or generalized information, unless explicitly asked by the user.
Each source has a file name followed by a pipe character and the actual information.
Use square brackets to reference the source, for example [info1.txt]. Don't combine sources, list each source separately, for example [info1.txt][info2.pdf].

Here is how you should answer every question:
- Look for relevant information in the above source documents to answer the question.
- If there is specific information related to question available in the above sources, provide an answer along with the appropriate citation.Do not forget to include the citation!
- Always include citation from sources listed above.
- If there is no specific information related to the question available in the source document, respond with "I\'m not sure" without providing any citation. Do not provide personal opinions or assumptions.
{follow_up_questions_prompt}
{injected_prompt}"""

    follow_up_questions_prompt_content = """
Generate three very brief follow-up questions that the user would likely ask next about their agencies data.
Use triple angle brackets to reference the questions. Example:
<<<What are the key initiatives of the Queensland Budget?>>>
<<<What is the Empowered and Safe Communities project?>>>

Do no repeat questions that have already been asked.
Make sure the last question ends with ">>>"."""

    query_prompt_template = """Below is a history of the conversation so far, and a new question asked by the user that needs to be answered by searching in source documents.
Generate a search query based on the conversation and the new question. Treat each search term as an individual keyword. Do not combine terms in quotes or brackets.
Do not include cited source filenames and document names (for example info.txt or doc.pdf) in the search query terms.
Do not include any text inside [] or <<<>>> in the search query terms.
Do not include any special characters like '+'.
If the question is not in {query_term_language}, translate the question to {query_term_language} before generating the search query.
If you cannot generate a search query, return just the number 0."""

    system_message_override = """You are {systemPersona} who helps {userPersona} answer questions about a Government agency's data.
{response_length_prompt}
You may use the information included in the source documents, each source has a file name followed by a pipe character and the actual information.
Always include citations if you reference the source documents. Use square brackets to reference the source, e.g. [info1.txt]. Don't combine sources, list each source separately, e.g. [info1.txt][info2.pdf].
{injected_prompt}
{follow_up_questions_prompt}"""

    #Few Shot prompting for Keyword Search Query
    query_prompt_few_shots = [
    {'role' : USER, 'content' : 'What are the future plans for public transportation development?' },
    {'role' : ASSISTANT, 'content' : 'Future plans for public transportation' },
    {'role' : USER, 'content' : 'how much renewable energy was generated last year?' },
    {'role' : ASSISTANT, 'content' : 'Renewable energy generation last year' }
    ]

    #Few Shot prompting for Response. This will feed into Chain of thought system message.
    response_prompt_few_shots = [
    {"role": USER ,'content': 'I am looking for information in source documents'},
    {'role': ASSISTANT, 'content': 'user is looking for information in source documents. Do not provide answers that are not in the source documents'},
    {'role': USER, 'content': 'What steps are being taken to promote energy conservation?'},
    {'role': ASSISTANT, 'content': 'Several steps are being taken to promote energy conservation including reducing energy consumption, increasing energy efficiency, and increasing the use of renewable energy sources.Citations[File0]'}
    ]

    def __init__(
        self,
        search_client: SearchClient,
        openai_client: AsyncOpenAI,
        blob_client: BlobServiceClient,
        gpt_deployment: Optional[str],
        gpt_model_name: Optional[str],
        source_file_field: str,
        content_field: str,
        page_number_field: str,
        chunk_file_field: str,
        content_storage_container: str,
        query_term_language: str,
        target_embedding_model: str,
        enrichment_appservice_name: str
    ):
        self.search_client = search_client
        self.openai_client = openai_client
        self.blob_client = blob_client
        self.gpt_deployment = gpt_deployment
        self.gpt_model_name = gpt_model_name
        self.source_file_field = source_file_field
        self.content_field = content_field
        self.page_number_field = page_number_field
        self.chunk_file_field = chunk_file_field
        self.content_storage_container = content_storage_container
        self.query_term_language = query_term_language
        self.chatgpt_token_limit = get_token_limit(gpt_model_name)
        self.escaped_target_model = re.sub(r'[^a-zA-Z0-9_\-.]', '_', target_embedding_model) #escape target embedding model name
        self.embedding_service_url = f'https://{enrichment_appservice_name}.azurewebsites.net'

    @overload
    async def run_until_final_call(
        self,
        history: list[dict[str, str]],
        overrides: dict[str, Any],
        should_stream: Literal[False],
    ) -> tuple[dict[str, Any], Coroutine[Any, Any, ChatCompletion]]:
        ...

    @overload
    async def run_until_final_call(
        self,
        history: list[dict[str, str]],
        overrides: dict[str, Any],
        should_stream: Literal[True],
    ) -> tuple[dict[str, Any], Coroutine[Any, Any, AsyncStream[ChatCompletionChunk]]]:
        ...

    async def run_until_final_call(
        self,
        history: list[dict[str, str]],
        overrides: dict[str, Any],
        should_stream: bool = False,
    ) -> tuple[dict[str, Any], Coroutine[Any, Any, Union[ChatCompletion, AsyncStream[ChatCompletionChunk]]]]:
        #TODO
        has_text = True #overrides.get("retrieval_mode") in ["text", "hybrid", None]
        has_vector = True #overrides.get("retrieval_mode") in ["vectors", "hybrid", None]
        use_semantic_captions = True if overrides.get("semantic_captions") else False
        top = overrides.get("top", 3)
        user_persona = overrides.get("user_persona", "")
        system_persona = overrides.get("system_persona", "")
        response_length = int(overrides.get("response_length") or 1024)
        folder_filter = overrides.get("selected_folders", "")
        tags_filter = overrides.get("selected_tags", "")
        original_user_query = history[-1]["content"]
        user_query_request = "Generate search query for: " + original_user_query

        functions = [
            {
                "name": "search_sources",
                "description": "Retrieve sources from the Azure AI Search index",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "search_query": {
                            "type": "string",
                            "description": "Query string to retrieve documents from Azure search eg: 'Queensland Budget Summary'",
                        }
                    },
                    "required": ["search_query"],
                },
            }
        ]
        
        generated_query = ""
        data_points = []
        thoughts = ""
        citation_lookup = {}

        query_prompt = self.query_prompt_template.format(query_term_language = self.query_term_language)

        try:
        # STEP 1: Generate an optimized keyword search query based on the chat history and the last question
            messages = self.get_messages_from_history(
                system_prompt = query_prompt,
                model_id=self.gpt_model_name,
                history = history,
                user_content = user_query_request,
                max_tokens = self.chatgpt_token_limit - len(user_query_request),
                few_shots = self.query_prompt_few_shots,
            )
            chat_completion: ChatCompletion = await self.openai_client.chat.completions.create(
                messages = messages,
                # Azure Open AI takes the deployment name as the model name
                model = self.gpt_deployment if self.gpt_deployment else self.gpt_model_name,
                temperature = 0.0,
                max_tokens = 100,  # Setting too low risks malformed JSON, setting too high may affect performance
                n = 1,
                functions = functions,
                function_call = "auto",
            )

            generated_query = self.get_search_query(chat_completion, original_user_query)

            # If retrieval mode includes vectors, compute an embedding for the query
            vectors: list[VectorQuery] = []

            if has_vector:
                # Generate embedding using REST API
                url = f'{self.embedding_service_url}/models/{self.escaped_target_model}/embed'
                data = [f'"{generated_query}"']
                headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    }

                response = requests.post(url, json=data, headers=headers, timeout=60)
                if response.status_code == 200:
                    response_data = response.json()
                    embedded_query_vector = response_data.get('data')
                    vectors.append(VectorizedQuery(vector = embedded_query_vector, k_nearest_neighbors = 50,  fields = "contentVector"))
                else:
                    logging.error(f"Error generating embedding: {response.text}")
                    raise Exception('Error generating embedding:', response.status_code)

            # Only keep the text query if the retrieval mode uses text, otherwise drop it
            if not has_text:
                query_text = None

            #Create a filter for the search query
            if (folder_filter != "") & (folder_filter != "All"):
                search_filter = f"search.in(folder, '{folder_filter}', ',')"
            else:
                search_filter = None
            if tags_filter != "" :
                quoted_tags_filter = tags_filter.replace(",","','")
                if search_filter is not None:
                    search_filter = search_filter + f" and tags/any(t: search.in(t, '{quoted_tags_filter}', ','))"
                else:
                    search_filter = f"tags/any(t: search.in(t, '{quoted_tags_filter}', ','))"
        
            if (overrides.get("semantic_ranker")):
                r = await self.search_client.search(
                        generated_query,
                        query_type = QueryType.SEMANTIC,
                        # query_language = self.query_term_language,
                        # query_speller = "lexicon",
                        semantic_configuration_name = "default",
                        top = top,
                        query_caption = "extractive|highlight-false" if use_semantic_captions else None,
                        vector_queries = vectors,
                        filter = search_filter
                )
            else:
                r = await self.search_client.search(
                        generated_query,
                        top = top,
                        vector_queries = vectors, 
                        filter = search_filter
                )

            citation_lookup = {}  # dict of "FileX" moniker to the actual file name
            results = []  # list of results to be used in the prompt
            data_points = []  # list of data points to be used in the response

            idx = 0
            async for doc in r:  # for each document in the search results
                # include the "FileX" moniker in the prompt, and the actual file name in the response
                results.append(
                    f"File{idx} " + "| " + nonewlines(doc[self.content_field])
                )
                data_points.append(
                "/".join(urllib.parse.unquote(doc[self.source_file_field]).split("/")[4:]
                    ) + "| " + nonewlines(doc[self.content_field])
                    )
                # uncomment to debug size of each search result content_field
                # print(f"File{idx}: ", self.num_tokens_from_string(f"File{idx} " + /
                #  "| " + nonewlines(doc[self.content_field]), "cl100k_base"))

                # add the "FileX" moniker and full file name to the citation lookup
                citation_lookup[f"File{idx}"] = {
                    "citation": urllib.parse.unquote("https://" + doc[self.source_file_field].split("/")[2] + f"/{self.content_storage_container}/" + doc[self.chunk_file_field]),
                    "source_path": self.get_source_file_with_sas(doc[self.source_file_field]),
                    "page_number": str(doc[self.page_number_field][0]) or "0",
                }

                idx += 1
            # End loop

            # create a single string of all the results to be used in the prompt
            results_text = "".join(results)
            if results_text == "":
                content = "\n NONE"
            else:
                content = "\n " + results_text

            # STEP 3: Generate the prompt to be sent to the GPT model
            follow_up_questions_prompt = (
                self.follow_up_questions_prompt_content if overrides.get("suggest_followup_questions") else ""
            )

            # Allow client to replace the entire prompt, or to inject into the existing prompt using >>>
            prompt_override = overrides.get("prompt_template")

            # Use default prompt
            if prompt_override is None:
                system_message = self.system_message_chat_conversation.format(
                    injected_prompt = "",
                    follow_up_questions_prompt = follow_up_questions_prompt,
                    response_length_prompt = self.get_response_length_prompt_text(
                        response_length
                    ),
                    userPersona = user_persona,
                    systemPersona = system_persona,
                )
            # Use default prompt with injected prompt
            elif prompt_override.startswith(">>>"):
                system_message = self.system_message_chat_conversation.format(
                    injected_prompt = prompt_override[3:] + "\n ",
                    follow_up_questions_prompt = follow_up_questions_prompt,
                    response_length_prompt = self.get_response_length_prompt_text(
                        response_length
                    ),
                    userPersona = user_persona,
                    systemPersona = system_persona,
                )
            # Overwrite prompt completely
            else:
                system_message = self.system_message_override.format(
                    injected_prompt = prompt_override,
                    follow_up_questions_prompt = follow_up_questions_prompt,
                    response_length_prompt = self.get_response_length_prompt_text(
                        response_length
                    ),
                    userPersona = user_persona,
                    systemPersona = system_persona,
                )

            # STEP 3: Generate a contextual and content-specific answer using the search results and chat history.
            messages_token_limit = self.chatgpt_token_limit - response_length
            messages = self.get_messages_from_history(
                system_prompt = system_message,
                model_id = self.gpt_model_name,
                history = history,
                user_content = original_user_query + "\n\nSources:\n" + content + "\n\n",
                max_tokens = messages_token_limit,
            )

            chat_coroutine = self.openai_client.chat.completions.create(
                # Azure Open AI takes the deployment name as the model name
                model = self.gpt_deployment if self.gpt_deployment else self.gpt_model_name,
                messages = messages,
                temperature = float(overrides.get("temperature") or 0.4),
                top_p = float(overrides.get("top_p") or 1.0),
                max_tokens = response_length,
                n = 1,
                stream = should_stream,
            )

            msg_to_display = "\n\n".join([str(message) for message in messages])
            extra_info = {
                "generated_query" : generated_query,
                "citation_lookup": citation_lookup,
                "data_points": data_points,
                "thoughts": f"Searched for:<br>{generated_query}<br><br>Conversations:<br>" + msg_to_display.replace('\n', '<br>'),
                }

            return (extra_info, chat_coroutine)

        except Exception as error:
            extra_info = {
                "error_message": str(error),
                "generated_query" : generated_query,
                "data_points": data_points,
                "thoughts":  thoughts,
                "citation_lookup": citation_lookup,
                }
        return (extra_info, None)


    async def run_without_streaming(
        self,
        history: list[dict[str, str]],
        overrides: dict[str, Any],
        session_state: Any = None,
    ) -> dict[str, Any]:
        extra_info, chat_coroutine = await self.run_until_final_call(
            history, overrides, should_stream=False
        )
        chat_completion_response: ChatCompletion = await chat_coroutine
        chat_resp = chat_completion_response.model_dump()  # Convert to dict to make it JSON serializable
        chat_resp["choices"][0]["context"] = extra_info
        if overrides.get("suggest_followup_questions"):
            content, followup_questions = self.extract_followup_questions(chat_resp["choices"][0]["message"]["content"])
            chat_resp["choices"][0]["message"]["content"] = content
            chat_resp["choices"][0]["context"]["followup_questions"] = followup_questions
        chat_resp["choices"][0]["session_state"] = session_state
        return chat_resp


    async def run_with_streaming(
        self,
        history: list[dict[str, str]],
        overrides: dict[str, Any],
        session_state: Any = None,
    ) -> AsyncGenerator[dict, None]:
        extra_info, chat_coroutine = await self.run_until_final_call(
            history, overrides, should_stream = True
        )

        if chat_coroutine is None:
            yield {
                "choices": [
                    {
                        "delta": {"role": self.ASSISTANT},
                        "context": extra_info,
                        "session_state": session_state,
                        "finish_reason": None,
                        "index": 0,
                    }
                ],
                "object": "chat.completion.chunk",
            }
            return

        yield {
            "choices": [
                {
                    "delta": {"role": self.ASSISTANT},
                    "context": extra_info,
                    "session_state": session_state,
                    "finish_reason": None,
                    "index": 0,
                }
            ],
            "object": "chat.completion.chunk",
        }

        followup_questions_started = False
        followup_content = ""
        async for event_chunk in await chat_coroutine:
            # "2023-07-01-preview" API version has a bug where first response has empty choices
            event = event_chunk.model_dump()  # Convert pydantic model to dict
            if event["choices"]:
                # if event contains << and not >>, it is start of follow-up question, truncate
                content = event["choices"][0]["delta"].get("content")
                content = content or ""  # content may either not exist in delta, or explicitly be None
                if overrides.get("suggest_followup_questions") and "<<<" in content:
                    followup_questions_started = True
                    earlier_content = content[: content.index("<<<")]
                    if earlier_content:
                        event["choices"][0]["delta"]["content"] = earlier_content
                        yield event
                    followup_content += content[content.index("<<<") :]
                elif followup_questions_started:
                    followup_content += content
                else:
                    yield event
        if followup_content:
            _, followup_questions = self.extract_followup_questions(followup_content)
            yield {
                "choices": [
                    {
                        "delta": {"role": self.ASSISTANT},
                        "context": {"followup_questions": followup_questions},
                        "finish_reason": None,
                        "index": 0,
                    }
                ],
                "object": "chat.completion.chunk",
            }

    async def run(
        self, messages: list[dict], stream: bool = False, session_state: Any = None, context: dict[str, Any] = {}
    ) -> Union[dict[str, Any], AsyncGenerator[dict[str, Any], None]]:
        overrides = context.get("overrides", {})
        if stream is False:
            return await self.run_without_streaming(messages, overrides, session_state)
        else:
            return self.run_with_streaming(messages, overrides, session_state)


    def get_messages_from_history(
        self,
        system_prompt: str,
        model_id: str,
        history: list[dict[str, str]],
        user_content: str,
        max_tokens: int = 4096,
        few_shots = [],
        ) -> list[ChatCompletionMessageParam]:
        """
        Construct a list of messages from the chat history and the user's question.
        """
        message_builder = MessageBuilder(system_prompt, model_id)

        # Few Shot prompting. Add examples to show the chat what responses we want. It will try to mimic any responses and make sure they match the rules laid out in the system message.
        for shot in reversed(few_shots):
            message_builder.insert_message(shot.get("role"), shot.get("content"))

        append_index = len(few_shots) + 1

        message_builder.insert_message(self.USER, user_content, index=append_index)
        total_token_count = message_builder.count_tokens_for_message(dict(message_builder.messages[-1]))  # type: ignore

        newest_to_oldest = list(reversed(history[:-1]))
        for message in newest_to_oldest:
            potential_message_count = message_builder.count_tokens_for_message(message)
            if (total_token_count + potential_message_count) > max_tokens:
                logging.debug("Reached max tokens of %d, history will be truncated", max_tokens)
                break
            message_builder.insert_message(message["role"], message["content"], index=append_index)
            total_token_count += potential_message_count
        return message_builder.messages

    def get_search_query(self, chat_completion: ChatCompletion, user_query: str):
        response_message = chat_completion.choices[0].message
        if function_call := response_message.function_call:
            if function_call.name == "search_sources":
                arg = json.loads(function_call.arguments)
                search_query = arg.get("search_query", self.NO_RESPONSE)
                if search_query != self.NO_RESPONSE:
                    return search_query
        elif query_text := response_message.content:
            if query_text.strip() != self.NO_RESPONSE:
                return query_text
        return user_query

    def extract_followup_questions(self, content: str):
        return content.split("<<<")[0], re.findall(r"<<<([^>>>]+)>>>", content)

    #Get the prompt text for the response length
    def get_response_length_prompt_text(self, response_length: int):
        """ Function to return the response length prompt text"""
        levels = {
            1024: "succinct",
            2048: "standard",
            3072: "thorough",
        }
        level = levels[response_length]
        return f"Please provide a {level} answer. This means that your answer should be no more than {response_length} tokens long."

    def num_tokens_from_string(self, string: str, encoding_name: str) -> int:
        """ Function to return the number of tokens in a text string"""
        encoding = tiktoken.get_encoding(encoding_name)
        num_tokens = len(encoding.encode(string))
        return num_tokens
    
    def token_count(self, input_text):
        """ Function to return the number of tokens in a text string"""
        # calc token count
        # For gpt-4, gpt-3.5-turbo, text-embedding-ada-002, you need to use cl100k_base
        encoding = "cl100k_base"
        token_count = self.num_tokens_from_string(input_text, encoding)
        return token_count

    def get_source_file_with_sas(self, source_file: str) -> str:
        """ Function to return the source file with a SAS token"""
        try:
            sas_token = generate_account_sas(
                self.blob_client.account_name,
                self.blob_client.credential.account_key,
                resource_types=ResourceTypes(object=True, service=True, container=True),
                permission=AccountSasPermissions(
                    read=True,
                    write=False,
                    list=True,
                    delete=False,
                    add=False,
                    create=False,
                    update=False,
                    process=False,
                ),
                expiry=datetime.utcnow() + timedelta(hours=1),
            )
            return source_file + "?" + sas_token
        except Exception as error:
            logging.error(f"Unable to parse source file name: {str(error)}")
            return ""

    def get_first_page_num_for_chunk(self, content: str) -> str:
        """
        Parse the search document content for the first page from the "pages" attribute

        Args:
            content: The search document content (JSON string)

        Returns:
            The first page number.
        """
        try:
            page_num = str(json.loads(content)["pages"][0])
            if page_num is None:
                return "0"
            return page_num
        except Exception as error:
            logging.exception("Unable to parse first page num: " + str(error) + "")
            return "0"
