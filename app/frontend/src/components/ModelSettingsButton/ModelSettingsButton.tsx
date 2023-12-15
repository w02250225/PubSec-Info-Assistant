import { Text } from "@fluentui/react";
import { ChatSettings24Filled } from "@fluentui/react-icons";

import styles from "./ModelSettingsButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const ModelSettingsButton = ({ className, onClick, disabled }: Props) => {

    const handleClick = () => {
        if (!disabled) {
            onClick();
        }
    };

    return (
        <div className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`} onClick={handleClick}>
            <ChatSettings24Filled />
            <Text>{"Model Settings"}</Text>
        </div>
    );
};
