// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Stack, PrimaryButton, IIconProps} from "@fluentui/react";
import { ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./Answer.module.css";

interface Props {
    error: string;
    onRetry: () => void;
};

const getIconProps = (iconName: string): IIconProps => {
    return { iconName };
};

export const AnswerError = ({ error, onRetry }: Props) => {
    return (
        <Stack className={styles.answerContainer} verticalAlign="space-between">
            <ErrorCircle24Regular aria-hidden="true" aria-label="Error icon" primaryFill="red" />

            <Stack.Item grow>
                <p className={styles.answerText}>{error}</p>
            </Stack.Item>

            <PrimaryButton iconProps={getIconProps('Refresh')} className={styles.retryButton} onClick={onRetry} text="Retry" />
        </Stack>
    );
};
