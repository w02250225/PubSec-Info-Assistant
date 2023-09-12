// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    { text: "What is the Queensland Women's Strategy 2022-27?", value: "What is the Queensland Women's Strategy 2022-27?" },
    { text: "Summarise the health services benefits for Queenslanders", value: "Summarise the health services benefits for Queenslanders" },
    { text: "What is the economic outlook for Queensland?", value: "What is the economic outlook for Queensland?" },
    { text: "What is the Queensland Government's plan to support women in leadership roles?", value: "What is the Queensland Government's plan to support women in leadership roles?" },
    { text: "Provide an overview of the Queensland State Budget for 2023-24", value: "Provide an overview of the Queensland State Budget for 2023-24" },
    { text: "What is the Empowered and Safe Communities project?", value: "What is the Empowered and Safe Communities project?" }
    
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {
    return (
        <ul className={styles.examplesNavList}>
            {EXAMPLES.map((x, i) => (
                <li className={styles.examplesNavListItem} key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};
