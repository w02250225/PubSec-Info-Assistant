import { useEffect, useState } from "react";
import { Dropdown, IDropdownOption, Label, TextField } from "@fluentui/react";
import { FiHelpCircle } from "react-icons/fi"
import { getPromptTemplates, PromptTemplate } from "../../api"

import styles from "./PromptTemplatePicker.module.css";

interface Props {
  className?: string;
  promptTemplates: PromptTemplate[];
  selectedTemplate?: string | null;
  onChange: (promptTemplate: string) => void;
}

const tooltipHtml = `Pick from one of our pre-created prompt templates`

export const PromptTemplatePicker = ({ className, promptTemplates, selectedTemplate, onChange }: Props) => {
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null);

  const onTemplateChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    // Clear any existing timeout to prevent multiple updates
    if (updateTimeout) clearTimeout(updateTimeout);

    // Set a timeout to wait before calling onGptDeploymentChange
    const newTimeout = setTimeout(() => {
      if (option) {
        const templateName = option.key as string;
        onChange(templateName);
      }
    }, 100); // Wait 100ms before updating

    setUpdateTimeout(newTimeout);
  };

  const dropdownOptions: IDropdownOption[] = promptTemplates.map((t, index) => ({
    key: t.displayName,
    text: t.displayName,
    data: t,
    index: index,
  }));

  useEffect(() => {
    return () => {
      if (updateTimeout) clearTimeout(updateTimeout);
    };
  }, [updateTimeout]);

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <Label>Prompt Template:&nbsp;
        <FiHelpCircle
          data-tooltip-id="PromptTemplate-tooltip"
          data-tooltip-html={tooltipHtml}>
        </FiHelpCircle>
      </Label>
      <Dropdown
        placeholder="Select a Template"
        options={dropdownOptions}
        selectedKey={selectedTemplate}
        onChange={onTemplateChange}
      />
    </div>
  );
};