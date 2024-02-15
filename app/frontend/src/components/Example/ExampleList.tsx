// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Example } from "./Example";

import styles from "./Example.module.css";

const examples: string[] = [
    "What is the Queensland Women's Strategy 2022-27?",
    "Summarise the health services benefits for Queenslanders",
    "What is the economic outlook for Queensland?",
    "What is the Queensland Government's plan to support women in leadership roles?",
    "Provide an overview of the Queensland State Budget for 2023-24",
    "What is the Empowered and Safe Communities project?"
];

interface Props {
    onExampleClicked: (value: string) => void;
};

export const ExampleList = ({ onExampleClicked }: Props) => {
    return (
        <ul className={styles.examplesNavList}>
            {examples.map((x, i) => (
                <li className={styles.examplesNavListItem} key={i}>
                    <Example text={x} onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};
