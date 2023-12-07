// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState } from 'react';
import { Options16Filled, ArrowSync16Filled, ArrowExport16Filled, Clipboard16Filled, Stop16Filled } from "@fluentui/react-icons";

import styles from "./RAIPanel.module.css";

interface Props {
    onAdjustClick?: () => void;
    onRegenerateClick?: () => void;
    onExportClick?: () => void;
    onCopyAnswerClick?: () => void;
    onStopClick?: () => void;
    isStreaming?: boolean;
}

export const RAIPanel = ({ onAdjustClick, onRegenerateClick, onExportClick, onCopyAnswerClick, onStopClick, isStreaming }: Props) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);

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

    const handleStopClick = async () => {
        if (isStopping) {
            return;
        };

        if (onStopClick) {
            setIsStopping(true);
            try {
                await onStopClick();
            } catch (error) {
                console.error("Error stopping stream: ", error);
            }
            setTimeout(() => {
                setIsStopping(false);
            }, 2000); // Change back after 2 seconds
        }
    };

    return (
        <div className={styles.adjustInputContainer}>
            {!isStreaming ? (
                <>
                    <div className={styles.adjustInput} onClick={onAdjustClick}>
                        <Options16Filled primaryFill="rgba(133, 133, 133, 1)" />
                        <span className={styles.adjustInputText}>Adjust</span>
                    </div>
                    <div className={styles.adjustInput} onClick={onRegenerateClick}>
                        <ArrowSync16Filled primaryFill="rgba(133, 133, 133, 1)" />
                        <span className={styles.adjustInputText}>Regenerate</span>
                    </div>
                    {onExportClick ? (
                        <div className={`${styles.adjustInput} ${isExporting ? styles.disabled : ''}`}
                            onClick={handleExportClick}>
                            <ArrowExport16Filled primaryFill="rgba(133, 133, 133, 1)" />
                            <span className={styles.adjustInputText}>
                                {isExporting ? 'Please wait...' : 'Export'}
                            </span>
                        </div>
                    ) : null}
                    {onCopyAnswerClick ? (
                        <div className={`${styles.adjustInput} ${isCopied ? styles.disabled : ''}`}
                            onClick={handleCopyClick}>
                            <Clipboard16Filled primaryFill="rgba(133, 133, 133, 1)" />
                            <span className={styles.adjustInputText}>
                                {isCopied ? 'Copied!' : 'Copy'}
                            </span>
                        </div>
                    ) : null}
                </>
            ) : (
                onStopClick ? (
                    <div className={`${styles.adjustInput} ${isStopping ? styles.disabled : ''}`}
                        onClick={handleStopClick}>
                        <Stop16Filled primaryFill="rgba(133, 133, 133, 1)" />
                        <span className={styles.adjustInputText}>
                            {isStopping ? 'Stopping...' : 'Stop'}
                        </span>
                    </div>
                ) : null
            )}
        </div>
    );
}