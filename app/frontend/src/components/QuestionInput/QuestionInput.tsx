// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState } from "react";
import { Stack, TextField } from "@fluentui/react";
import { Send28Filled, Broom28Filled, RecordStop28Filled } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    onInfoClick?: () => void;
    clearChatDisabled?: boolean;
    onClearClick?: () => void;
    onStopClick?: () => void;
    isStreaming: boolean;
}

export const QuestionInput = ({
    onSend,
    disabled,
    placeholder,
    clearOnSend,
    clearChatDisabled,
    onClearClick,
    onStopClick,
    isStreaming
}: Props) => {
    const [question, setQuestion] = useState<string>("");
    const [isStopping, setIsStopping] = useState(false);

    const sendQuestion = () => {
        if (disabled || !question.trim()) {
            return;
        }

        onSend(question);

        if (clearOnSend) {
            setQuestion("");
        }
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        if (!newValue) {
            setQuestion("");
        } else {
            setQuestion(newValue);
        }
    };

    const sendQuestionDisabled = disabled || !question.trim() || isStreaming;

    const [clearChatTextEnabled, setClearChatTextEnable] = useState<boolean>(true);

    const onMouseEnter = () => {
        setClearChatTextEnable(false);
    }

    const onMouseLeave = () => {
        setClearChatTextEnable(true);
    }

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
        <Stack>
            <Stack.Item>
                <Stack horizontal className={styles.questionInputContainer}>
                    <div className={styles.questionClearButtonsContainer}>
                        <div
                            className={`${styles.questionClearChatButton} ${clearChatDisabled ? styles.disablePointer : ''}`}
                            aria-label="Clear chat button"
                            onClick={clearChatDisabled ? undefined : onClearClick}
                            onMouseEnter={clearChatDisabled ? undefined : onMouseEnter}
                            onMouseLeave={clearChatDisabled ? undefined : onMouseLeave}>
                            <Broom28Filled primaryFill="rgba(255, 255, 255, 1)" />
                            <span hidden={clearChatDisabled || clearChatTextEnabled}>Clear Chat</span>
                        </div>
                    </div>
                    <TextField
                        className={styles.questionInputTextArea}
                        placeholder={placeholder}
                        multiline
                        resizable={false}
                        borderless
                        value={question}
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                    />
                    <div className={styles.questionInputButtonsContainer}>
                        {/* {isStreaming ? (
                            <div className={`${styles.questionInputSendButton} ${isStopping ? styles.questionInputSendButtonDisabled : ''}`}
                                onClick={handleStopClick}>
                                <RecordStop28Filled primaryFill="0058a6" />
                            </div>
                        ) : ( */}
                            <div
                                className={`${styles.questionInputSendButton} ${sendQuestionDisabled ? styles.questionInputSendButtonDisabled : ""}`}
                                aria-label="Ask question button"
                                onClick={sendQuestion}>
                                <Send28Filled primaryFill="#0058a6" />
                            </div>
                        {/* )} */}
                    </div>
                </Stack>
            </Stack.Item>
        </Stack>
    );
};
