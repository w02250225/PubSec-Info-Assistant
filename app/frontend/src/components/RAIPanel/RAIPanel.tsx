// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Options16Filled, ArrowSync16Filled, ArrowExport16Filled } from "@fluentui/react-icons";

import styles from "./RAIPanel.module.css";

interface Props {
    onAdjustClick?: () => void;
    onRegenerateClick?: () => void;
    onExportClick?: () => void;
}

export const RAIPanel = ({ onAdjustClick, onRegenerateClick, onExportClick }: Props) => {

    return (
        <div className={styles.adjustInputContainer}>
            <div className={styles.adjustInput} onClick={onAdjustClick}>
                <Options16Filled primaryFill="rgba(133, 133, 133, 1)" />
                <span className={styles.adjustInputText}>Adjust</span>
            </div>
            <div className={styles.adjustInput} onClick={onRegenerateClick}>
                <ArrowSync16Filled primaryFill="rgba(133, 133, 133, 1)" />
                <span className={styles.adjustInputText}>Regenerate</span>
            </div>
            {onExportClick && (
                <div className={styles.adjustInput} onClick={onExportClick}>
                    <ArrowExport16Filled primaryFill="rgba(133, 133, 133, 1)" />
                    <span className={styles.adjustInputText}>Export</span>
                </div>
            )}
        </div>
    );
};