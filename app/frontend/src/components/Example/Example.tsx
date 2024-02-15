// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import styles from "./Example.module.css";

interface Props {
    text: string;
    onClick: (value: string) => void;
}

export const Example = ({ text, onClick }: Props) => {
    return (
        <div className={styles.example} onClick={() => onClick(text)}>
            <p className={styles.exampleText}>{text}</p>
        </div>
    );
};
