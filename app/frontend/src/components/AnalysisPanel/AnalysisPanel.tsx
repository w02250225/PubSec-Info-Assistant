// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Pivot, PivotItem } from "@fluentui/react";
import DOMPurify from "dompurify";

import styles from "./AnalysisPanel.module.css";

import { SupportingContent } from "../SupportingContent";
import { AskResponse } from "../../api";
import { AnalysisPanelTabs } from "./AnalysisPanelTabs";

interface Props {
    className: string;
    activeTab: AnalysisPanelTabs;
    onActiveTabChanged: (tab: AnalysisPanelTabs) => void;
    activeCitation: string | undefined;
    sourceFile: string | undefined;
    pageNumber: string | undefined;
    citationHeight: string;
    answer: AskResponse;
}

const pivotItemDisabledStyle = { disabled: true, style: { color: "grey" } };

export const AnalysisPanel = ({ answer, activeTab, activeCitation, sourceFile, pageNumber, citationHeight, className, onActiveTabChanged }: Props) => {
    const isDisabledThoughtProcessTab: boolean = !answer.thoughts;
    const isDisabledSupportingContentTab: boolean = !answer.data_points.length;
    const isDisabledCitationTab: boolean = !activeCitation;
    // the first split on ? separates the file from the sas token, then the second split on . separates the file extension
    const sourceFileExt: any = sourceFile?.split("?")[0].split(".").pop();
    
    const sanitizedThoughts = DOMPurify.sanitize(answer.thoughts!);
    
    // console.log(sourceFile?.split("?")[0].split(".").pop())

    return (
        <Pivot
            className={className}
            selectedKey={activeTab}
            onLinkClick={pivotItem => pivotItem && onActiveTabChanged(pivotItem.props.itemKey! as AnalysisPanelTabs)}
        >
            <PivotItem
                itemKey={AnalysisPanelTabs.ThoughtProcessTab}
                headerText="Thought process"
                headerButtonProps={isDisabledThoughtProcessTab ? pivotItemDisabledStyle : undefined}
            >
                <div className={styles.thoughtProcess} dangerouslySetInnerHTML={{ __html: sanitizedThoughts }}></div>
            </PivotItem>
            <PivotItem
                itemKey={AnalysisPanelTabs.SupportingContentTab}
                headerText="Supporting content"
                headerButtonProps={isDisabledSupportingContentTab ? pivotItemDisabledStyle : undefined}
            >
                <SupportingContent supportingContent={answer.data_points} />
            </PivotItem>
            <PivotItem
                itemKey={AnalysisPanelTabs.CitationTab}
                headerText="Citation"
                headerButtonProps={isDisabledCitationTab ? pivotItemDisabledStyle : undefined}
            >
                <Pivot className={className}>
                    <PivotItem itemKey="rawFile" headerText="Document">
                        { sourceFileExt === "pdf" ? (
                            //use object tag for pdfs because iframe does not support page numbers
                            <object data={sourceFile + "#page=" + pageNumber} type="application/pdf" width="100%" height={citationHeight} />
                        ) : ( sourceFileExt === "docx" || sourceFileExt === "xlsx" ? (
                            <iframe title="Source File" src={'https://view.officeapps.live.com/op/view.aspx?src='+encodeURIComponent(sourceFile as string)+"&action=embedview&wdStartOn="+pageNumber} width="100%" height={citationHeight} />
                        ) : (
                            <iframe title="Source File" src={sourceFile} width="100%" height={citationHeight} />
                        )) }
                    </PivotItem>
                    <PivotItem itemKey="indexedFile" headerText="Document Section">
                        <iframe title="Document Section" src={activeCitation} width="100%" height={citationHeight} />
                    </PivotItem>
                </Pivot>
            </PivotItem>
        </Pivot>
    );
};
