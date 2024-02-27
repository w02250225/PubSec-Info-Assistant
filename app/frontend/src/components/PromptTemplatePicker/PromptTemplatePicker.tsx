import { useEffect, useMemo, useState } from "react";
import { ComboBox, DropdownMenuItemType, IComboBox, IComboBoxOption, IDropdownOption, Label } from "@fluentui/react";
import { FiHelpCircle } from "react-icons/fi"
import { PromptTemplate, UserData } from "../../api"

import styles from "./PromptTemplatePicker.module.css";

interface Props {
  className?: string;
  promptTemplates: PromptTemplate[];
  selectedTemplate?: PromptTemplate | null;
  onChange: (template: PromptTemplate) => void;
  userData: UserData;
};

export const PromptTemplatePicker = ({ className, promptTemplates, selectedTemplate, onChange, userData }: Props) => {
  const [filteredOptions, setFilteredOptions] = useState<IComboBoxOption[]>([]);

  const handleComboBoxChange = (
    event: React.FormEvent<IComboBox>,
    option?: IComboBoxOption,
    index?: number,
    value?: string
  ) => {
    if (option) {
      onChange(option.data as PromptTemplate);
    };
  };

  const handleInputValueChange = (newInputValue: string) => {
    // Filter options based on the input value
    const lowerInput = newInputValue.toLowerCase();
    const filtered = comboBoxOptions.filter(option =>
      option.text.toLowerCase().includes(lowerInput)
    );
    setFilteredOptions(filtered);
  };

  const handleComboBoxFocus = () => {
    // Reset to full options when ComboBox is focused
    setFilteredOptions(comboBoxOptions);
  };

  const comboBoxOptions = useMemo(() => {
    type GroupedTemplates = {
      [key: string]: IDropdownOption[];
    };

    // Create headers for each user_id in the list
    const grouped = promptTemplates.reduce<GroupedTemplates>((acc, template) => {
      const groupName = template.user_id === userData.userPrincipalName ? "My Prompts" : template.user_id;
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push({
        key: template.id!,
        text: template.display_name,
        data: template,
      });
      return acc;
    }, {});

    // Sort group names, ensuring "System" is first
    const sortedGroupNames = Object.keys(grouped).sort((a, b) => {
      if (a === "System") return -1;
      if (b === "System") return 1;
      return a.localeCompare(b); // Sort other groups alphabetically
    });

    const options: IDropdownOption[] = sortedGroupNames.flatMap(groupName => {
      // Add group header
      const headerOption: IDropdownOption = {
        key: `header-${groupName}`,
        text: groupName,
        itemType: DropdownMenuItemType.Header,
      };
      // Add items under the group
      const groupOptions = grouped[groupName];
      return [headerOption, ...groupOptions];
    });

    return options;
  }, [promptTemplates]);

  useEffect(() => {
    // Initially display all options
    setFilteredOptions(comboBoxOptions);
  }, [comboBoxOptions]);

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <Label>Prompt Template</Label>
      <ComboBox
        placeholder="Select a Template"
        options={filteredOptions}
        selectedKey={selectedTemplate?.id || null}
        onChange={handleComboBoxChange}
        onFocus={handleComboBoxFocus}
        onInputValueChange={handleInputValueChange}
        autoComplete="on"
        allowFreeform={true}
      />
    </div>
  );
};