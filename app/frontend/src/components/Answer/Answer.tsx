// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw';

import styles from "./Answer.module.css";

import { CitationLink, ChatAppResponse, getCitationFilePath, ExportRequest, exportAnswer } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { RAIPanel } from "../RAIPanel";

interface Props {
    question?: string;
    answer: ChatAppResponse;
    isSelected?: boolean;
    isStreaming: boolean;
    onCitationClicked: (filePath: string, sourcePath: string, pageNumber: string) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    onAdjustClick?: () => void;
    onRegenerateClick?: () => void;
};

export const Answer = ({
    question,
    answer,
    isSelected,
    isStreaming,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    onAdjustClick,
    onRegenerateClick,
}: Props) => {
    const followupQuestions = answer.choices[0].context.followup_questions;
    const messageContent = answer.choices[0].message.content;
    const citation_lookup = answer.choices[0].context.citation_lookup;
    const request_id = answer.request_id;
    const parsedAnswer = useMemo(() => parseAnswerToHtml(messageContent, isStreaming, citation_lookup), [answer]);
    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);
    const [isCopied, setIsCopied] = useState(false);

    let citationLinks: CitationLink[] = [];
    if (parsedAnswer.citations.length > 0) {
        parsedAnswer.citations.forEach((x, i) => {
            const path = getCitationFilePath(x);
            const originalFile = x.split("/")[1];
            const pageNumbers = parsedAnswer.pageNumbers[x];
            const sourceFiles = parsedAnswer.sourceFiles[x];
            const linkName = `${originalFile} ${!isNaN(pageNumbers) ? `(Page ${pageNumbers})` : ''}`;

            citationLinks.push({
                key: i,
                sourceFile: sourceFiles,
                pageNumber: pageNumbers,
                title: originalFile,
                onClick: () => onCitationClicked(path, sourceFiles as any, pageNumbers as any),
                label: `${++i}. ${linkName}`,
            });
        });
    };
    const onExportClick = async () => {
        try {
            const request: ExportRequest = {
                request_id: request_id,
                question: question as string,
                answer: sanitizedAnswerHtml,
                citations: citationLinks,
            };
            return exportAnswer(request);
        } catch (e) {
            console.log(e);
        }
    };

    function removeHtmlTags(html: string) {
        return html.replace(/<a\b[^>]*>(.*?)<\/a>/gs, "");
    }; // remove the HTML from the answer for copy to clipboard

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const onCopyAnswerClick = async () => {
        try {
            const text = removeHtmlTags(sanitizedAnswerHtml)
            await handleCopyToClipboard(text);
        } catch (e) {
            console.log(e);
        }
    };

    const onCopyRequestIdClick = async (text: string) => {
        try {
            handleCopyToClipboard(text);

            setIsCopied(true);
            setTimeout(() => {
                setIsCopied(false);
            }, 2000); // Change back after 2 seconds

        } catch (e) {
            console.log(e);
        }
    };

    useEffect(() => {
        const handleLinkClick = (event: MouseEvent) => {
            event.preventDefault();
            const anchorElement = event.currentTarget as HTMLAnchorElement;

            const path = anchorElement.getAttribute('data-path');
            const sourcePath = anchorElement.getAttribute('data-source-path');
            const pageNumber = anchorElement.getAttribute('data-page-number');

            if (path && sourcePath && pageNumber) {
                onCitationClicked(path, sourcePath, pageNumber);
            }
        };

        const links = document.querySelectorAll('.supContainer');
        links.forEach(link => {
            link.addEventListener('click', handleLinkClick as EventListener);
        });

        // Clean up event listeners
        return () => {
            links.forEach(link => {
                link.removeEventListener('click', handleLinkClick as EventListener);
            });
        };
    }, []);


    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "Lightbulb" }}
                            title="Show thought process"
                            ariaLabel="Show thought process"
                            onClick={() => onThoughtProcessClicked()}
                            disabled={!answer.choices[0].context.thoughts?.length}
                        />
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "Documentation" }}
                            title="Show supporting content"
                            ariaLabel="Show supporting content"
                            onClick={() => onSupportingContentClicked()}
                            disabled={!answer.choices[0].context.data_points?.length}
                        />
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <Markdown
                    className={styles.answerText}
                    rehypePlugins={[rehypeRaw]}>
                    {sanitizedAnswerHtml}
                </Markdown>
            </Stack.Item>

            {!!citationLinks.length && (
                <Stack.Item>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>Citations:</span>
                        {citationLinks.map((link, i) => {
                            const { title, onClick, label } = link;
                            return (
                                <a key={i} className={styles.citation} title={title} onClick={onClick}>
                                    {label}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}

            {!!followupQuestions?.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <Stack.Item>
                    <Stack horizontal wrap className={`${!!followupQuestions.length ? styles.followupQuestionsList : ""}`} tokens={{ childrenGap: 6 }}>
                        <span className={styles.followupQuestionLearnMore}>Follow-up questions:</span>
                        {followupQuestions.map((x, i) => {
                            return (
                                <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                    {`${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}

            <Stack.Item>
                <div className={`${styles.answerTextRequestId} ${isCopied ? styles.disabled : ''}`}
                    onClick={() => onCopyRequestIdClick(`Request ID: ${request_id}`)}>
                    <IconButton
                        style={{ color: "black" }}
                        iconProps={{ iconName: "Copy" }}
                        title="Copy Request ID"
                        ariaLabel="Copy Request ID"
                    />
                    <span>
                        {isCopied ? 'Copied!' : 'Copy Request ID'}
                    </span>
                </div>
            </Stack.Item>

            <Stack.Item align="center">
                <RAIPanel onAdjustClick={onAdjustClick}
                    onRegenerateClick={onRegenerateClick}
                    onExportClick={onExportClick}
                    onCopyAnswerClick={onCopyAnswerClick}
                    isStreaming={isStreaming}
                />
            </Stack.Item>


        </Stack>
    );
};
