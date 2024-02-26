// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useEffect, useState } from "react";
import { Label, Pivot, PivotItem, Separator, Spinner, SpinnerSize, Text } from "@fluentui/react";
import DOMPurify from "dompurify";

import styles from "./AnalysisPanel.module.css";

import { AnalysisPanelTabs } from "./AnalysisPanelTabs";
import { SupportingContent } from "../SupportingContent";
import { ChatAppResponse, ActiveCitation, getCitationObj, BlobUrlResponse, getBlobUrl } from "../../api";

interface Props {
    activeTab?: AnalysisPanelTabs;
    onActiveTabChanged: (tab: AnalysisPanelTabs) => void;
    activeCitation: string | undefined;
    sourceFile: string | undefined;
    pageNumber: string | undefined;
    answer: ChatAppResponse;
};

const pivotItemDisabledStyle = { disabled: true, style: { color: "grey" } };

export const AnalysisPanel = ({ answer, activeTab, activeCitation, sourceFile, pageNumber, onActiveTabChanged }: Props) => {
    const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [activeCitationObj, setActiveCitationObj] = useState<ActiveCitation>();
    const isDisabledThoughtProcessTab: boolean = !answer.choices[0].context.thoughts;
    const isDisabledSupportingContentTab: boolean = !answer.choices[0].context.data_points.length;
    const isDisabledCitationTab: boolean = !activeCitation;
    const sourceFileExt: any = sourceFile?.split(".").pop();
    const sanitizedThoughts = DOMPurify.sanitize(answer.choices[0].context.thoughts!);

    async function fetchActiveCitationObj() {
        if (activeCitation) {
            try {
                const citationObj = await getCitationObj(activeCitation as string);
                setActiveCitationObj(citationObj);
            } catch (error) {
                console.log(error);
            }
        }
    };

    async function fetchBlobUrl() {
        try {
            if (sourceFile) {
                const response: BlobUrlResponse = await getBlobUrl(sourceFile)
                if (response.error) {
                    setError(response.error);

                } else {
                    setBlobUrl(response.url);
                }
            }
        } catch (error) {
            setError("An unexpected error occurred while fetching the document.");
            console.log(error);
        }
    };

    useEffect(() => {
        fetchActiveCitationObj();
    }, [activeCitation]);

    useEffect(() => {
        fetchBlobUrl();
    }, [sourceFile]);

    return (
        <div>
            <Pivot
                selectedKey={activeTab}
                onLinkClick={pivotItem => pivotItem && onActiveTabChanged(pivotItem.props.itemKey! as AnalysisPanelTabs)}>
                <PivotItem
                    itemKey={AnalysisPanelTabs.ThoughtProcessTab}
                    headerText="Thought process"
                    headerButtonProps={isDisabledThoughtProcessTab ? pivotItemDisabledStyle : undefined}>
                    <div className={styles.thoughtProcess} dangerouslySetInnerHTML={{ __html: sanitizedThoughts }}></div>
                </PivotItem>
                <PivotItem
                    itemKey={AnalysisPanelTabs.SupportingContentTab}
                    headerText="Supporting content"
                    headerButtonProps={isDisabledSupportingContentTab ? pivotItemDisabledStyle : undefined}>
                    <SupportingContent supportingContent={answer.choices[0].context.data_points} />
                </PivotItem>
                <PivotItem
                    itemKey={AnalysisPanelTabs.CitationTab}
                    headerText="Citation"
                    headerButtonProps={isDisabledCitationTab ? pivotItemDisabledStyle : undefined}>
                    <Pivot>
                        <PivotItem itemKey="rawFile" headerText="Document">
                            {error ? (
                                <Text>{error}</Text>
                            ) : !blobUrl ? (
                                <Spinner size={SpinnerSize.large} label="Loading..." />
                            ) : sourceFileExt === "pdf" ? (
                                //use object tag for pdfs because iframe does not support page numbers
                                <object data={blobUrl + "#page=" + pageNumber} type="application/pdf" width="100%" height="760px" />
                            ) : (sourceFileExt === "docx" || sourceFileExt === "xlsx" ? (
                                <iframe title="Source File" src={'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(blobUrl as string) + "&action=embedview&wdStartOn=" + pageNumber} width="100%" height="760px" />
                            ) : (
                                <iframe title="Source File" src={blobUrl} width="100%" height="760px" />
                            ))}
                        </PivotItem>
                        <PivotItem itemKey="indexedFile" headerText="Document Section">
                            {activeCitationObj === undefined ? (
                                <Spinner size={SpinnerSize.large} label="Loading..." />
                            ) : (
                                <div>
                                    <Separator>Metadata</Separator>
                                    <Label>File Name</Label><Text>{activeCitationObj.file_name.split('/').slice(1).join('/')}</Text>
                                    <Label>Title</Label><Text>{activeCitationObj.title}</Text>
                                    <Label>Section</Label><Text>{activeCitationObj.section}</Text>
                                    <Label>Page Number(s)</Label><Text>{activeCitationObj.pages?.join(",")}</Text>
                                    <Label>Token Count</Label><Text>{activeCitationObj.token_count}</Text>
                                    <Separator>Content</Separator>
                                    <Label>Content</Label><Text>{activeCitationObj.content}</Text>
                                </div>
                            )}
                        </PivotItem>
                    </Pivot>
                </PivotItem>
            </Pivot>
        </div>
    );
};