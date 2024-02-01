# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.


from typing import Any, AsyncGenerator, Coroutine, Literal, Optional, Union, overload
from openai import AsyncOpenAI, AsyncStream
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionChunk
)
from approaches.approach import Approach
from core.modelhelper import get_token_limit

class ChatApproach(Approach):

     # Chat roles
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    
    NO_RESPONSE = "0"

    system_message_chat_conversation = """You are {systemPersona} who helps {userPersona} answer questions about a Government agency's data.
{response_length_prompt}
User persona is {userPersona}.
You will engage in conversational exchanges, providing informative, accurate, and engaging responses across a diverse array of user inquiries. 
Your role is to offer clear, concise, and contextually relevant responses, demonstrating a deep understanding and a broad knowledge base. 
Engage users in a friendly, approachable, and helpful manner, ensuring that you offer assistance, detailed explanations, or creative ideas as the situation demands. 
In your responses, balance factual accuracy with an engaging conversational tone, making complex topics accessible and interesting. Always remember to adhere to safety 
guidelines by steering clear of sensitive topics, avoiding personal advice, and maintaining a respectful tone. When responding, first seek to fully comprehend the user's query,
considering both the explicit question and any underlying context or intent. Your goal is to facilitate an informative, enjoyable, and constructive conversation, 
enriching the user's understanding while maintaining a positive and supportive interaction environment. Adapt your responses to suit the user's knowledge level and interest, 
and where appropriate, offer additional related insights or resources. Be prepared to handle a wide range of topics, from technical, scientific, and historical to cultural, 
philosophical, and hypothetical scenarios, showcasing your versatility and depth as an AI conversationalist.
Avoid generating speculative or generalized information, unless explicitly asked by the user.
{follow_up_questions_prompt}
{injected_prompt}"""

    follow_up_questions_prompt_content = """
Generate three very brief follow-up questions that the user would likely ask next about their agencies data.
Use triple angle brackets to reference the questions. Example:
<<<What are the key initiatives of the Queensland Budget?>>>
<<<What is the Empowered and Safe Communities project?>>>
Do no repeat questions that have already been asked.
Make sure the last question ends with ">>>"."""

    system_message_override = """You are {systemPersona} who helps {userPersona} answer questions about a Government agency's data.
{response_length_prompt}
Your goal is to provide accurate and relevant answers. Avoid generating speculative or generalized information, unless explicitly asked by the user.
Always remember to adhere to safety guidelines by steering clear of sensitive topics, avoiding personal advice, and maintaining a respectful tone.
{injected_prompt}
{follow_up_questions_prompt}"""

    def __init__(
        self,
        openai_client: AsyncOpenAI,
        gpt_deployment: Optional[str],
        gpt_model_name: Optional[str],
        gpt_model_version: Optional[str]
    ):
        self.openai_client = openai_client
        self.gpt_deployment = gpt_deployment
        self.gpt_model_name = gpt_model_name
        self.gpt_model_version = gpt_model_version
        self.chatgpt_token_limit = get_token_limit(gpt_model_name, gpt_model_version)

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
        user_persona = overrides.get("user_persona", "")
        system_persona = overrides.get("system_persona", "")
        response_length = int(overrides.get("response_length") or 1024)
        original_user_query = history[-1]["content"]

        prompt_override = ""
        prompt_tokens = 0

        try:
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

            # Generate a contextual and content-specific answer using the search results and chat history.
            messages_token_limit = self.chatgpt_token_limit - response_length
            messages, prompt_tokens = self.get_messages_from_history(
                system_prompt = system_message,
                model_id = self.gpt_model_name,
                history = history,
                user_content = original_user_query,
                max_tokens = messages_token_limit,
            )

            chat_coroutine = self.openai_client.chat.completions.create(
                messages = messages,
                # Azure Open AI takes the deployment name as the model name
                model = self.gpt_deployment if self.gpt_deployment else self.gpt_model_name,
                temperature = float(overrides.get("temperature") or 0.4),
                top_p = float(overrides.get("top_p") or 1.0),
                max_tokens = response_length,
                n = 1,
                stream = should_stream,
            )

            extra_info = {
                "generated_query" : "N/A",
                "citation_lookup": "N/A",
                "data_points": "N/A",
                "prompt_tokens": prompt_tokens,
                "thoughts": "N/A",
                "prompt_override": prompt_override,
                }

            return (extra_info, chat_coroutine)

        except Exception as error:
            # error_type = type(error).__name__
            error_code = "Unknown Code"
            error_message = str(error)

            # Check if error has an attribute named 'body'
            if hasattr(error, 'body') and isinstance(error.body, dict):
                error_body = error.body
                error_code = error_body.get('code', error_code)
                error_message = error_body.get('message', error_message)

            extra_info = {
                "error_message": error_message,
                "generated_query": "N/A",
                "data_points": "N/A",
                "thoughts": "N/A",
                "prompt_tokens": prompt_tokens,
                "citation_lookup": "N/A",
                "prompt_override": prompt_override,
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
            history, overrides, should_stream = True)

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
        self,
        messages: list[dict],
        stream: bool = False,
        session_state: Any = None,
        context: dict[str, Any] = {}
    ) -> Union[dict[str, Any], AsyncGenerator[dict[str, Any], None]]:
        overrides = context.get("overrides", {})
        if stream is False:
            return await self.run_without_streaming(messages, overrides, session_state)
        else:
            return self.run_with_streaming(messages, overrides, session_state)
