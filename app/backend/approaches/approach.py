# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
import json
import re
import logging
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionMessageParam,
)
from typing import Any

from core.messagebuilder import MessageBuilder

class Approach:
    """
    An approach is a method for answering a question from a query and a set of
    documents.
    """

     # Chat roles
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    
    NO_RESPONSE = "0"

    follow_up_questions_prompt_content = """
Generate three very brief follow-up questions that the user would likely ask next about their agencies data.
Use triple angle brackets to reference the questions. Example:
<<<What are the key initiatives of the Queensland Budget?>>>
<<<What is the Empowered and Safe Communities project?>>>
Do no repeat questions that have already been asked.
Make sure the last question ends with ">>>"."""

    async def run(
        self,
        messages: list[dict],
        stream: bool = False,
        session_state: Any = None,
        context: dict[str, Any] = {}
    ) -> any:
        """
        Run the approach on the query and documents. Not implemented.

        Args:
            history: The chat history. (e.g. [{"user": "hello", "bot": "hi"}])
            overrides: Overrides for the approach. (e.g. temperature, etc.)
        """
        raise NotImplementedError


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
    

    def get_messages_from_history(
        self,
        system_prompt: str,
        model_id: str,
        history: list[dict[str, str]],
        user_content: str,
        max_tokens: int = 4096,
        few_shots = [],
        ) -> (list[ChatCompletionMessageParam], int):
        """
        Construct a list of messages from the chat history and the user's question.
        """
        message_builder = MessageBuilder(system_prompt, model_id)

        # Few Shot prompting. Add examples to show the chat what responses we want. 
        # It will try to mimic any responses and make sure they match the rules laid out in the system message.
        for shot in reversed(few_shots):
            message_builder.insert_message(shot.get("role"), shot.get("content"))

        append_index = len(few_shots) + 1

        message_builder.insert_message(self.USER, user_content, index=append_index)
        total_token_count = message_builder.count_tokens_for_message(dict(message_builder.messages[-1]))  # type: ignore

        newest_to_oldest = list(reversed(history[:-1]))
        for message in newest_to_oldest:
            potential_message_count = message_builder.count_tokens_for_message(message)
            if (total_token_count + potential_message_count) >= max_tokens:
                logging.debug("Reached max tokens of %d, history will be truncated", max_tokens)
                break
            message_builder.insert_message(message["role"], message["content"], index=append_index)
            total_token_count += potential_message_count
        return message_builder.messages, total_token_count


    def extract_followup_questions(self, content: str):
        return content.split("<<<")[0], re.findall(r"<<<([^>>>]+)>>>", content)


    def get_response_length_prompt_text(self, response_length: int):
        """ Function to return the response length prompt text"""
        levels = {
            1024: "succinct",
            2048: "standard",
            3072: "thorough",
        }
        level = levels[response_length]
        return f"Please provide a {level} answer. This means that your answer should be no more than {response_length} tokens long."
    

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
