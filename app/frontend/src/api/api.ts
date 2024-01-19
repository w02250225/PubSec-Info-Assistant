// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    ChatAppRequest, BlobClientUrlResponse, AllFilesUploadStatus, GetInfoResponse, ActiveCitation, GetWarningBanner, ExportRequest,
    StatusLogEntry, StatusLogResponse, ApplicationTitle, GetTagsResponse, GptDeployment, UserData, PromptTemplate, TermsOfUse, FileUploadBasicStatus
} from "./models";

async function fetchWithSessionCheck(url: string, options: RequestInit) {
    let response;

    try {
        response = await fetch(url, options);
    } catch (error) {
        console.error('Network error:', error);
        throw error;
    }

    if (response.status === 301 || response.status === 302) {
        const redirectUrl = response.headers.get('Location');

        if (redirectUrl) {
            window.location.href = redirectUrl;

        } else {
            const error_message = 'Redirect requested, but no Location header found'
            console.error(error_message);
            throw new Error(error_message)
        }
    }

    return response;
}

export async function chatApi(request: ChatAppRequest): Promise<Response> {
    return await fetchWithSessionCheck(`/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
    });
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
        const response = await fetchWithSessionCheck("/exportAnswer", {
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
    const response = await fetchWithSessionCheck("/getBlobClientUrl", {
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
    const response = await fetchWithSessionCheck("/getBlobUrl", {
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

export async function getAllUploadStatus(): Promise<AllFilesUploadStatus> {
    const response = await fetchWithSessionCheck("/getAllUploadStatus", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const parsedResponse: any = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    const results: AllFilesUploadStatus = { statuses: parsedResponse };
    return results;
}

export async function logStatus(status_log_entry: StatusLogEntry): Promise<StatusLogResponse> {
    var response = await fetchWithSessionCheck("/logStatus", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "path": status_log_entry.path,
            "status": status_log_entry.status,
            "status_classification": status_log_entry.status_classification,
            "state": status_log_entry.state,
            "tags": status_log_entry.tags
        })
    });

    var parsedResponse: StatusLogResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    var results: StatusLogResponse = { status: parsedResponse.status };
    return results;
}

export async function getInfoData(): Promise<GetInfoResponse> {
    const response = await fetchWithSessionCheck("/getInfoData", {
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
    const response = await fetchWithSessionCheck("/getWarningBanner", {
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
    const response = await fetchWithSessionCheck(`/getCitation`, {
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

export async function getApplicationTitle(): Promise<ApplicationTitle> {
    const response = await fetchWithSessionCheck("/getApplicationTitle", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const parsedResponse: ApplicationTitle = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    console.log(parsedResponse);
    return parsedResponse;
}

export async function getAllTags(): Promise<GetTagsResponse> {
    const response = await fetchWithSessionCheck("/getAllTags", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const parsedResponse: any = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    var results: GetTagsResponse = { tags: parsedResponse };
    return results;
}

export async function getGptDeployments(): Promise<GptDeployment[]> {
    const response = await fetchWithSessionCheck("/getGptDeployments", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.log(response);
        const errorResponse = await response.json();
        throw new Error(errorResponse.error || 'An unknown error occurred');
    }

    const parsedResponse: GptDeployment[] = await response.json();

    return parsedResponse;
}

export async function setGptDeployment(deployment: GptDeployment): Promise<void> {
    const response = await fetchWithSessionCheck("/setGptDeployment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(deployment)
    });
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
}

export async function logout() {
    const response = await fetchWithSessionCheck("/logout", { method: "GET" });

    if (response.status > 299 || !response.ok) {
        console.error(response);
        throw new Error(response.statusText || "Unknown error");
    }
}

export async function getUserData(): Promise<UserData> {
    const response = await fetchWithSessionCheck("/getUserData", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const parsedResponse: UserData = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
    const response = await fetchWithSessionCheck("/getPromptTemplates", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.log(response);
        const errorResponse = await response.json();
        throw new Error(errorResponse.error || 'An unknown error occurred');
    }

    const parsedResponse: PromptTemplate[] = await response.json();

    return parsedResponse;
}

export async function stopStream(): Promise<Response> {
    return await fetchWithSessionCheck(`/stopStream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    });
}

export async function getTermsOfUse(): Promise<TermsOfUse> {
    const response = await fetchWithSessionCheck(`/termsOfUse`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const parsedResponse: TermsOfUse = await response.json();
    if (response.status > 299 || !response.ok) {
        console.log(response);
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function acceptTermsOfUse(tou_version: string): Promise<Response> {
    return await fetchWithSessionCheck(`/termsOfUse`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "tou_version": tou_version
        })
    });
}

export async function deleteFile(file_path: string): Promise<Response> {
    return await fetchWithSessionCheck(`/deleteFile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "file_path": file_path
        })
    });
}

export async function updateFileTags(file_path: string, newTags: string[]): Promise<Response> {
    return await fetchWithSessionCheck(`/updateFileTags`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "file_path": file_path,
            "tags": newTags,
        })
    });
}
