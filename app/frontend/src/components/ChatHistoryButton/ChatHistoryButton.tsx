// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Text } from "@fluentui/react";
import { History24Regular } from "@fluentui/react-icons";
import styles from "./ChatHistoryButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const ChatHistoryButton = ({ className, onClick, disabled }: Props) => {

    const handleClick = () => {
        if (!disabled) {
            onClick();
        }
    };

    return (
        <div
            id="chatHistoryButton"
            className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`}
            onClick={handleClick}>
            <History24Regular />
            <Text>{"History"}</Text>
        </div>
    );
};