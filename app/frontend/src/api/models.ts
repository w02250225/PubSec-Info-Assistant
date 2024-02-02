// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const enum RetrievalMode {
    Hybrid = "hybrid",
    Vectors = "vectors",
    Text = "text",
    None = "none"
}

export type ChatAppRequestOverrides = {
    retrieval_mode?: RetrievalMode;
    semantic_ranker?: boolean;
    semantic_captions?: boolean;
    exclude_category?: string;
    top?: number;
    temperature?: number;
    prompt_template?: string;
    prompt_template_prefix?: string;
    prompt_template_suffix?: string;
    suggest_followup_questions?: boolean;
    user_persona?: string;
    system_persona?: string;
    response_length?: number;
    top_p?: number;
    selected_folders?: string;
    selected_tags?: string;  
};

export type ResponseMessage = {
    content: string;
    role: string;
};

export type ResponseContext = {
    thoughts: string | null;
    data_points: string[];
    followup_questions: string[] | null;
    citation_lookup: { [key: string]: { citation: string; source_path: string; page_number: string } };
    request_id: string;
    error?: string;
};

export type ResponseChoice = {
    index: number;
    message: ResponseMessage;
    context: ResponseContext;
    session_state: any;
};

export type ChatAppResponseOrError = {
    choices?: ResponseChoice[];
    error?: string;
};

export type ChatAppResponse = {
    choices: ResponseChoice[];
    request_id: string;
};

export type ChatAppRequestContext = {
    overrides?: ChatAppRequestOverrides;
};

export type ChatAppRequest = {
    messages: ResponseMessage[];
    context?: ChatAppRequestContext;
    stream?: boolean;
    session_state: any;
};

export type AskResponse = {
    answer: string;
    thoughts: string | null;
    data_points: string[];
    citation_lookup: { [key: string]: { citation: string; source_path: string; page_number: string } };
    request_id: string;
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: string;
};

export type ExportRequest ={
    request_id: string;
    question: string;
    answer: string;
    citations: string;
}

export type ExportResponse = {
    link: string;
    error?: string;
};

export type BlobClientUrlResponse = {
    url: string;
    error?: string;
};

export type FileUploadBasicStatus = {
    id: string;
    file_path: string;
    file_name: string;
    folder_name: string;
    tags: string[];
    state: string;
    start_timestamp: string;
    state_description: string;
    state_timestamp: string;
}

export type AllFilesUploadStatus = {
    statuses: FileUploadBasicStatus[];
}

// These keys need to match case with the defined Enum in the
// shared code (functions/shared_code/status_log.py)
export const enum FileState {
    All = "ALL",
    Processing = "PROCESSING",
    Skipped = "SKIPPED",
    Queued = "QUEUED",
    Complete = "COMPLETE",
    Error = "ERROR"
}

export type UserData = {
    user_id: string;
    session_id: string;
    displayName: string;
    givenName: string;
    jobTitle: string;
    mail: string;
    mobilePhone: string;
    officeLocation: string;
    preferredLanguage: string;
    surname: string;
    userPrincipalName: string;
    base64_image?: string;
    is_admin: boolean;
    tou_accepted: boolean;
    error?: string;
};

export type GetInfoResponse = {
    AZURE_OPENAI_SERVICE: string;
    AZURE_OPENAI_CHATGPT_DEPLOYMENT: string;
    AZURE_OPENAI_CHATGPT_MODEL: string;
    AZURE_OPENAI_MODEL_NAME: string;
    AZURE_OPENAI_MODEL_VERSION: string;
    AZURE_SEARCH_SERVICE: string;
    AZURE_SEARCH_INDEX: string;
    TARGET_LANGUAGE: string;
    USE_AZURE_OPENAI_EMBEDDINGS: boolean;
    EMBEDDINGS_DEPLOYMENT: string;
    EMBEDDINGS_MODEL_NAME: string;
    EMBEDDINGS_MODEL_VERSION: string;
    error?: string;
};

export type ActiveCitation = {
    file_name: string;
    file_uri: string;
    processed_datetime: string;
    title: string;
    section: string;
    pages: number[];
    token_count: number;
    content: string;
    error?: string;
}

export type GetWarningBanner = {
    WARNING_BANNER_TEXT: string;
    error?: string;
};

// These keys need to match case with the defined Enum in the
// shared code (functions/shared_code/status_log.py)
export const enum StatusLogClassification {
    Debug = "Debug",
    Info = "Info",
    Error = "Error"
}

// These keys need to match case with the defined Enum in the
// shared code (functions/shared_code/status_log.py)
export const enum StatusLogState {
    Processing = "Processing",
    Skipped = "Skipped",
    Queued = "Queued",
    Complete = "Complete",
    Error = "Error",
    Throttled = "Throttled",
    Uploaded = "Uploaded",
    All = "All"
}

export type StatusLogEntry = {
    path: string;
    status: string;
    status_classification: StatusLogClassification;
    state: StatusLogState;
    tags: string[];
}

export type StatusLogResponse = {
    status: number;
    error?: string;
}

export type ApplicationTitle = {
    APPLICATION_TITLE: string;
    error?: string;
};

export type GetTagsResponse = {
    tags: string;
    error?: string;
}

export type GptDeployment = {
    deploymentName: string;
    modelName: string;
    modelVersion: string;
}

export type PromptTemplate = {
    displayName: string;
    deploymentName: string;
    promptOverride: string;
    response_length: number;
    temperature: number;
    top_p: number;
    retrievalMode: RetrievalMode;
}

export type TermsOfUse = {
    content: string;
    version: string;
    error?: string;
}

export type FaqContent = {
    content: string;
    questions: FaqQuestion[];
    version: string;
    error?: string;
}

export type FaqQuestion = {
    question: string;
    answer: string;
}