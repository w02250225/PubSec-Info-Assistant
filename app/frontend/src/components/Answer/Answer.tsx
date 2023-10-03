// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useMemo } from "react";
import { Stack, IconButton } from "@fluentui/react";
import DOMPurify from "dompurify";

import styles from "./Answer.module.css";

import { AskResponse, getCitationFilePath, ExportRequest, exportAnswer } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { RAIPanel } from "../RAIPanel";

interface Props {
    question: string;
    answer: AskResponse;
    isSelected?: boolean;
    onCitationClicked: (filePath: string, sourcePath: string, pageNumber: string) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    onAdjustClick?: () => void;
    onRegenerateClick?: () => void;
}

export const Answer = ({
    question,
    answer,
    isSelected,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    onAdjustClick,
    onRegenerateClick
}: Props) => {
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer.answer, answer.citation_lookup, onCitationClicked), [answer]);

    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    interface CitationLink {
        key: number;
        href: string;
        title: string;
        onClick: () => void;
        label: string;
    }
    
    let citationLinks: CitationLink[] = [];
    if (parsedAnswer.citations.length > 0) {
        parsedAnswer.citations.forEach((x, i) => {
            const path = getCitationFilePath(x);
            const originalFile = x.split("/")[0];
            const pageNumbers = parsedAnswer.pageNumbers[x];
            const sourceFiles = parsedAnswer.sourceFiles[x];
            const href = `${window.location.origin}/#/ViewDocument?documentName=${encodeURIComponent(originalFile)}&pageNumber=${pageNumbers}`
            const linkName = `${originalFile} ${!isNaN(pageNumbers) ? `(Page ${pageNumbers})` : ''}`;
            
            // console.log('Answer')
            // console.log("Path: " + path);
            // console.log("sourcePath: " + sourceFiles);
            // console.log("pageNumber: " + pageNumbers);
    
            citationLinks.push({
                key: i,
                href: href,
                title: originalFile,
                onClick: () => onCitationClicked(path, sourceFiles as any, pageNumbers as any),
                label: `${++i}. ${linkName}`,
            });
        });
    };

    const concatenatedCitationLinks = citationLinks
    .map((link, i) => {
        return `<a href="${link.href}" title="${link.title}">${link.label}</a>\n`;
    })
    .join(''); // Join the HTML strings into a single string

    const onExportClick = async () => {
        try {
            const request: ExportRequest = {
                request_id: answer.request_id,
                question: question,
                answer: sanitizedAnswerHtml,
                citations: concatenatedCitationLinks,
            };
            await exportAnswer(request);
        } catch (e) {
            console.log(e);
        }
    };

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
                            disabled={!answer.thoughts}
                        />
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "ClipboardList" }}
                            title="Show supporting content"
                            ariaLabel="Show supporting content"
                            onClick={() => onSupportingContentClicked()}
                            disabled={!answer.data_points.length}
                        />
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <div className={styles.answerText} dangerouslySetInnerHTML={{ __html: sanitizedAnswerHtml }}></div>
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

            {!!parsedAnswer.followupQuestions.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <Stack.Item>
                    <Stack horizontal wrap className={`${!!parsedAnswer.followupQuestions.length ? styles.followupQuestionsList : ""}`} tokens={{ childrenGap: 6 }}>
                        <span className={styles.followupQuestionLearnMore}>Follow-up questions:</span>
                        {parsedAnswer.followupQuestions.map((x, i) => {
                            return (
                                <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                    {`${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}
            <Stack.Item grow>
                <div className={styles.answerTextRequestId}>Request ID: {answer.request_id}</div>
            </Stack.Item>
            <Stack.Item align="center">
                <RAIPanel   onAdjustClick={onAdjustClick} 
                            onRegenerateClick={onRegenerateClick}  
                            onExportClick={onExportClick}
                        />
            </Stack.Item>
        </Stack>
    );
};
