// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Text } from "@fluentui/react";
import { Options24Filled } from "@fluentui/react-icons";

import styles from "./SettingsButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const SettingsButton = ({ className, onClick, disabled }: Props) => {

    const handleClick = () => {
        if (!disabled) {
            onClick();
        }
    };

    return (
        <div
            id="settingsButton"
            className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`}
            onClick={handleClick}>
            <Options24Filled />
            <Text>{"Settings"}</Text>
        </div>
    );
};
