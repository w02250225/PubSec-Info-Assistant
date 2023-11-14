import { Label, TextField } from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi'

import styles from "./PromptOverride.module.css";

interface Props {
    className?: string;
    onChange: (_ev: any) => void;
    defaultValue?: string;
}

const tooltipHtml = `You can inject additional instructions into the system prompt by adding >>> at the start of your prompt override.<br />
Alternatively, you can specify a new prompt that will completely override the system default.`

export const PromptOverride = ({ className, onChange, defaultValue }: Props) => {
    return (
        <div className={`${styles.container} ${className ?? ""}`}>
            <Label>Prompt Override:&nbsp;
                <FiHelpCircle
                    data-tooltip-id="PromptOverride-tooltip"
                    data-tooltip-html={tooltipHtml}>
                </FiHelpCircle>
            </Label>
            <TextField
                defaultValue={defaultValue}
                multiline
                autoAdjustHeight
                onChange={onChange}
                />
        </div>
    );
};