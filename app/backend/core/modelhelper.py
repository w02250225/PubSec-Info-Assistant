import tiktoken

#Values from https://platform.openai.com/docs/models/overview

MODELS_2_TOKEN_LIMITS = {
    "gpt-3.5-turbo": {
        "default": 4096,
    },
    "gpt-3.5-turbo-16k": {
        "default": 16385,
    },
    "gpt-4": {
        "default": 8192,
        "1106-preview": 128000,
        "vision-preview": 128000
    },
    "gpt-4-32k": {
        "default": 32768,
    },
}

AOAI_2_OAI = {
    "gpt-35-turbo": "gpt-3.5-turbo",
    "gpt-35-turbo-16k": "gpt-3.5-turbo-16k"
}


def get_token_limit(model_id: str, model_version: str = "default") -> int:
    model = get_oai_chatmodel_tiktok(model_id)

    if model not in MODELS_2_TOKEN_LIMITS:
        raise ValueError("Expected model gpt-35-turbo and above. Got: " + model_id)
    
    model_data = MODELS_2_TOKEN_LIMITS[model]
    
    # Use "default" version if the specified version is not found
    token_limit = model_data.get(model_version.lower(), model_data.get("default"))
    
    return token_limit


def num_tokens_from_messages(message: dict[str, str], model: str) -> int:
    """
    Calculate the number of tokens required to encode a message.
    Args:
        message (dict): The message to encode, represented as a dictionary.
        model (str): The name of the model to use for encoding.
    Returns:
        int: The total number of tokens required to encode the message.
    Example:
        message = {'role': 'user', 'content': 'Hello, how are you?'}
        model = 'gpt-3.5-turbo'
        num_tokens_from_messages(message, model)
        output: 11
    """
    encoding = tiktoken.encoding_for_model(get_oai_chatmodel_tiktok(model))
    num_tokens = 4  # For "role" and "content" keys
    for key, value in message.items():
        num_tokens += len(encoding.encode(value))
    return num_tokens


def get_oai_chatmodel_tiktok(aoaimodel: str) -> str:
    message = "Expected Azure OpenAI ChatGPT model name"
    if aoaimodel == "" or aoaimodel is None:
        raise ValueError(message)
    if aoaimodel not in AOAI_2_OAI and aoaimodel not in MODELS_2_TOKEN_LIMITS:
        raise ValueError(message)
    return AOAI_2_OAI.get(aoaimodel) or aoaimodel