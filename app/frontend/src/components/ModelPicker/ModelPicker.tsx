import { useState, useEffect } from 'react';
import { Dropdown, IDropdownOption, Label } from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi';

import { GptDeployment, GetInfoResponse, getGptDeployments, setGptDeployment, getInfoData } from "../../api";
import styles from "./ModelPicker.module.css";

interface Props {
    className?: string;
}

const tooltipHtml = `Choose a specific GPT Model:<br />
<b>GPT-3.5 Turbo</b> This model is known for its versatility and can handle a wide range of tasks.<br />
<b>GPT-3.5 Turbo 16K</b> This model is based on GPT-3.5 Turbo but optimized for larger-scale tasks and in-depth content generation.<br />
<b>GPT-4</b> This model offers improved performance and more advanced capabilities.<br />
<b>GPT-4 32K</b> This model is based on GPT-4 but optimized for larger-scale tasks and in-depth content generation.`;

export const ModelPicker = ({ className }: Props) => {
    const [deployments, setDeployments] = useState<GptDeployment[]>([]);
    const [selectedDeploymentName, setSelectedDeploymentName] = useState<string | undefined>(undefined);
    const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);

    const onDeploymentChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
        // Clear any existing timeout to prevent multiple updates
        if (updateTimeout) clearTimeout(updateTimeout);

        // Set a timeout to wait before calling setGptDeployment
        const newTimeout = setTimeout(() => {
            if (option) {
                const deploymentName = option.key as string;
                setSelectedDeploymentName(deploymentName); // Update the selected deployment name state

                const deploymentToUpdate = deployments.find(d => d.deploymentName === deploymentName);
                if (deploymentToUpdate) {
                    setGptDeployment(deploymentToUpdate)
                        .then(() => {
                            // Handle the successful update
                            console.log('Deployment updated successfully');
                        })
                        .catch((err) => {
                            // Handle any errors during the update
                            console.error('Failed to update deployment:', err);
                        });
                }
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

    // Update the getPrettyModelName function to use the exported modelNamesMap
    const getPrettyModelName = (internalName: string) => {
        return modelNamesMap[internalName as keyof typeof modelNamesMap] || internalName;
    };

    const dropdownOptions: IDropdownOption[] = deployments.map((d, index) => ({
        key: d.deploymentName,
        text: getPrettyModelName(d.modelName),
        index: index,
    }));

    useEffect(() => {
        getInfoData()
          .then((response: GetInfoResponse) => {
            setSelectedDeploymentName(response.AZURE_OPENAI_CHATGPT_DEPLOYMENT);
          })
          .catch(err => console.log(err.message));

        getGptDeployments()
            .then(setDeployments)
            .catch(err => console.log(err.message));
    }, []);

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
                selectedKey={selectedDeploymentName}
                onChange={onDeploymentChange}
            />
        </div>
    );
};