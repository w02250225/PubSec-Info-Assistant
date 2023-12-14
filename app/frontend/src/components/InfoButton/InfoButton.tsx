// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Text } from "@fluentui/react";
import { Info24Regular } from "@fluentui/react-icons";
import styles from "./InfoButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const InfoButton = ({ className, onClick, disabled }: Props) => {

    const handleClick = () => {
        if (!disabled) {
            onClick();
        }
    };

    return (
        <div className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`} onClick={handleClick}>
            <Info24Regular />
            <Text>{"Info"}</Text>
        </div>
    );
};
