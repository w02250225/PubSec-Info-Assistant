import { useState, useEffect } from 'react';
import { Dropdown, IDropdownOption, Label } from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi';

import { GptDeployment } from "../../api";
import styles from "./ModelPicker.module.css";

interface Props {
    className?: string;
    deployments: GptDeployment[];
    selectedGptDeployment?: string;
    onGptDeploymentChange: (deployment: string) => void;
}

const tooltipHtml = `Choose a specific GPT Model:<br />
<b>GPT-3.5 Turbo</b> This model is known for its versatility and can handle a wide range of tasks.<br />
<b>GPT-3.5 Turbo 16K</b> This model is based on GPT-3.5 Turbo but optimized for larger-scale tasks and in-depth content generation.<br />
<b>GPT-4</b> This model offers improved performance and more advanced capabilities.<br />
<b>GPT-4 32K</b> This model is based on GPT-4 but optimized for larger-scale tasks and in-depth content generation.`;

export const ModelPicker = ({ className, deployments, selectedGptDeployment, onGptDeploymentChange }: Props) => {
    const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);

    const onDeploymentChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
        // Clear any existing timeout to prevent multiple updates
        if (updateTimeout) clearTimeout(updateTimeout);

        // Set a timeout to wait before calling onGptDeploymentChange
        const newTimeout = setTimeout(() => {
            if (option) {
                const deploymentName = option.key as string;
                onGptDeploymentChange(deploymentName);
            }
        }, 100); // Wait 100ms before updating

        setUpdateTimeout(newTimeout);
    };

    const modelNamesMap = {
        "gpt-35-turbo": "GPT-3.5 Turbo",
        "gpt-35-turbo-16k": "GPT-3.5 Turbo 16K",
        "gpt-4": "GPT-4",
        "gpt-4-32k": "GPT-4 32K",
    };

    const getPrettyModelName = (internalName: string) => {
        return modelNamesMap[internalName as keyof typeof modelNamesMap] || internalName;
    };

    const dropdownOptions: IDropdownOption[] = deployments.map((d, index) => ({
        key: d.deploymentName,
        text: getPrettyModelName(d.modelName),
        index: index,
    }));

    useEffect(() => {
        return () => {
            if (updateTimeout) clearTimeout(updateTimeout);
        };
    }, [updateTimeout]);

    return (
        <div className={`${styles.container} ${className ?? ""}`}>
            <Label>Model Selection&nbsp;
                <FiHelpCircle
                    data-tooltip-id="ModelPicker-tooltip"
                    data-tooltip-html={tooltipHtml}>
                </FiHelpCircle>
            </Label>
            <Dropdown
                placeholder="Loading..."
                options={dropdownOptions}
                selectedKey={selectedGptDeployment}
                onChange={onDeploymentChange}
            />
        </div>
    );
};