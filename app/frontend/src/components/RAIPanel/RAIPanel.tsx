// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState } from 'react';
import { Options16Filled, ArrowSync16Filled, ArrowExport16Filled, Clipboard16Filled } from "@fluentui/react-icons";

import styles from "./RAIPanel.module.css";

interface Props {
    onAdjustClick?: () => void;
    onRegenerateClick?: () => void;
    onExportClick?: () => void;
    onCopyAnswerClick?: () => void;
    isStreaming?: boolean;
}

export const RAIPanel = ({ onAdjustClick, onRegenerateClick, onExportClick, onCopyAnswerClick, isStreaming }: Props) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExportClick = async () => {
        if (isExporting) {
            // Return if already exporting
            return;
        };

        if (onExportClick) {
            setIsExporting(true);
            try {
                await onExportClick();
            } catch (error) {
                console.error("Error during export: ", error);
            }
            setIsExporting(false);
        }
    };

    const handleCopyClick = () => {
        if (onCopyAnswerClick) {
            onCopyAnswerClick();
        }

        setIsCopied(true);
        setTimeout(() => {
            setIsCopied(false);
        }, 2000); // Change back after 2 seconds
    };

    return (
        <div className={styles.adjustInputContainer}>
            <div className={`${styles.adjustInput} ${isStreaming ? styles.disabled : ''}`} onClick={onAdjustClick}>
                <Options16Filled primaryFill="rgba(133, 133, 133, 1)" />
                <span className={styles.adjustInputText}>Adjust</span>
            </div>
            <div className={`${styles.adjustInput} ${isStreaming ? styles.disabled : ''}`} onClick={onRegenerateClick}>
                <ArrowSync16Filled primaryFill="rgba(133, 133, 133, 1)" />
                <span className={styles.adjustInputText}>Regenerate</span>
            </div>
            {onExportClick ? (
                <div className={`${styles.adjustInput} ${isExporting || isStreaming ? styles.disabled : ''}`}
                    onClick={handleExportClick}>
                    <ArrowExport16Filled primaryFill="rgba(133, 133, 133, 1)" />
                    <span className={styles.adjustInputText}>
                        {isExporting ? 'Please wait...' : 'Export'}
                    </span>
                </div>
            ) : null}
            {onCopyAnswerClick ? (
                <div className={`${styles.adjustInput} ${isCopied || isStreaming ? styles.disabled : ''}`}
                    onClick={handleCopyClick}>
                    <Clipboard16Filled primaryFill="rgba(133, 133, 133, 1)" />
                    <span className={styles.adjustInputText}>
                        {isCopied ? 'Copied!' : 'Copy'}
                    </span>
                </div>
            ) : null}
        </div>
    );
}