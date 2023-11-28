// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Button, ButtonGroup } from "react-bootstrap";
import { Label } from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi'

import styles from "./ResponseLengthButtonGroup.module.css";

interface Props {
    className?: string;
    onClick: (_ev: any) => void;
    defaultValue?: number;
}

const tooltipHtml = `
This parameter determines the approximate length of the response from the model.<br />
<b>Succinct</b> - 1024 tokens<br />
<b>Standard</b> - 2048 tokens<br />
<b>Thorough</b> - 3072 tokens`

export const ResponseLengthButtonGroup = ({ className, onClick, defaultValue }: Props) => {
    return (
        <div className={`${styles.container} ${className ?? ""}`}>
            <Label>Response length&nbsp;
                <FiHelpCircle
                    data-tooltip-id="ResponseLength-tooltip"
                    data-tooltip-html={tooltipHtml}>
                </FiHelpCircle>
            </Label>
            <ButtonGroup
                className={`${styles.buttongroup ?? ""}`}
                onClick={onClick}>
                <Button id="Succinct" className={`${defaultValue == 1024 ? styles.buttonleftactive : styles.buttonleft ?? ""}`} size="sm" value={1024} bsPrefix='ia'>{"Succinct"}</Button>
                <Button id="Standard" className={`${defaultValue == 2048 ? styles.buttonmiddleactive : styles.buttonmiddle ?? ""}`} size="sm" value={2048} bsPrefix='ia'>{"Standard"}</Button>
                <Button id="Thorough" className={`${defaultValue == 3072 ? styles.buttonrightactive : styles.buttonright ?? ""}`} size="sm" value={3072} bsPrefix='ia'>{"Thorough"}</Button>
            </ButtonGroup>
        </div>
    );
};
