// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AskRequest, AskResponse, ChatRequest, BlobClientUrlResponse, AllFilesUploadStatus, GetUploadStatusRequest, GetInfoResponse, ActiveCitation, GetWarningBanner, ExportRequest, StatusLogEntry, StatusLogResponse } from "./models";

export async function askApi(options: AskRequest): Promise<AskResponse> {
    const response = await fetch("/ask", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            question: options.question,
            approach: options.approach,
            overrides: {
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                user_persona: options.overrides?.userPersona,
                system_persona: options.overrides?.systemPersona,
                ai_persona: options.overrides?.aiPersona,
            }
        })
    });

    const parsedResponse: AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function chatApi(options: ChatRequest): Promise<AskResponse> {
    const response = await fetch("/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            overrides: {
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                suggest_followup_questions: options.overrides?.suggestFollowupQuestions,
                user_persona: options.overrides?.userPersona,
                system_persona: options.overrides?.systemPersona,
                ai_persona: options.overrides?.aiPersona,
                response_length: options.overrides?.responseLength,
                response_temp: options.overrides?.responseTemp,
                top_p: options.overrides?.topP
            }
        })
    });

    const parsedResponse: AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function downloadFileFromResponse(response: Response): Promise<void> {
    try {
        if (response.status > 299 || !response.ok) {
            const errorData = await response.json();
            throw Error(errorData.error || "Unknown error");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const contentDisposition = response.headers.get("Content-Disposition");
        const fileNameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);

        if (fileNameMatch && fileNameMatch.length >= 2) {
            a.download = fileNameMatch[1];
        }

        a.click();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error downloading file", error);
    }
}

export async function exportAnswer(request: ExportRequest): Promise<void> {
    try {
        const response = await fetch("/exportAnswer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });

        await downloadFileFromResponse(response);
    } catch (error) {
        console.error("Error exporting answer", error);
    }
}

export function getCitationFilePath(citation: string): string {
    return `${encodeURIComponent(citation)}`;
}

export async function getBlobClientUrl(): Promise<string> {
    const response = await fetch("/getblobclienturl", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const parsedResponse: BlobClientUrlResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse.url;
}

export async function getBlobUrl(filename: string): Promise<string> {
    const response = await fetch("/getBlobUrl", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            file_name: filename
        })
    });

    const parsedResponse: BlobClientUrlResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse.url;
}

export async function getAllUploadStatus(options: GetUploadStatusRequest): Promise<AllFilesUploadStatus> {
    const response = await fetch("/getalluploadstatus", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            timeframe: options.timeframe,
            state: options.state as string
        })
    });

    const parsedResponse: any = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    const results: AllFilesUploadStatus = { statuses: parsedResponse };
    return results;
}

export async function logStatus(status_log_entry: StatusLogEntry): Promise<StatusLogResponse> {
    var response = await fetch("/logstatus", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "path": status_log_entry.path,
            "status": status_log_entry.status,
            "status_classification": status_log_entry.status_classification,
            "state": status_log_entry.state
            })
    });

    var parsedResponse: StatusLogResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    var results: StatusLogResponse = {status: parsedResponse.status};
    return results;
}

export async function getInfoData(): Promise<GetInfoResponse> {
    const response = await fetch("/getInfoData", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const parsedResponse: GetInfoResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function getWarningBanner(): Promise<GetWarningBanner> {
    const response = await fetch("/getWarningBanner", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const parsedResponse: GetWarningBanner = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function getCitationObj(citation: string): Promise<ActiveCitation> {
    const response = await fetch(`/getcitation`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            citation: citation
        })
    });
    const parsedResponse: ActiveCitation = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}