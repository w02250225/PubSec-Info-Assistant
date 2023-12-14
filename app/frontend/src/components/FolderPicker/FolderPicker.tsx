// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState, useEffect } from 'react';
import { useId, useBoolean } from '@fluentui/react-hooks';
import {
    ComboBox,
    IComboBox,
    IComboBoxOption,
    IComboBoxStyles,
    SelectableOptionMenuItemType,
    TooltipHost,
    ITooltipHostStyles,
    ActionButton,
    Label,
    DirectionalHint
} from "@fluentui/react";
import { TeachingBubble, ITeachingBubbleStyles } from '@fluentui/react/lib/TeachingBubble';
import { FiHelpCircle } from 'react-icons/fi';
import { ITextFieldStyleProps, ITextFieldStyles, TextField } from '@fluentui/react/lib/TextField';
import { ILabelStyles, ILabelStyleProps } from '@fluentui/react/lib/Label';
import { IIconProps } from '@fluentui/react';
import { IButtonProps } from '@fluentui/react/lib/Button';
import { BlobServiceClient } from "@azure/storage-blob";

import { getBlobClientUrl, UserData } from "../../api";
import styles from "./FolderPicker.module.css";

var allowNewFolders = false;

interface Props {
    allowFolderCreation?: boolean;
    onSelectedKeyChange: (selectedFolders: string[]) => void;
    selectedKeys: string[];
    userData: UserData;
}

export const FolderPicker = ({ allowFolderCreation, onSelectedKeyChange, selectedKeys, userData }: Props) => {

    const buttonId = useId('targetButton');
    const tooltipId = useId('folderpicker-tooltip');
    const textFieldId = useId('textField');

    const [atLeastOneOptionSelected, setAtLeastOneOptionSelected] = useState(false);
    const [teachingBubbleVisible, { toggle: toggleTeachingBubbleVisible }] = useBoolean(false);
    const [options, setOptions] = useState<IComboBoxOption[]>([]);
    const selectableOptions = options.filter(
        option =>
            (option.itemType === SelectableOptionMenuItemType.Normal || option.itemType === undefined) && !option.disabled,
    );
    const comboBoxStyles: Partial<IComboBoxStyles> = { root: { maxWidth: 300 }, input: { cursor: 'pointer' } };
    const hostStyles: Partial<ITooltipHostStyles> = { root: { display: 'inline-block' } };
    const addFolderIcon: IIconProps = { iconName: 'Add' };

    allowNewFolders = allowFolderCreation as boolean;

    const teachingBubbleStyles: Partial<ITeachingBubbleStyles> = {
        content: {
            background: "#d3d3d3",
            borderColor: "#696969"
        },
        headline: {
            color: "#696969"
        },
    }

    const teachingBubblePrimaryButtonClick = () => {
        const textField = document.getElementById(textFieldId) as HTMLInputElement;
        if (!textField.defaultValue || textField.defaultValue.trim() === '') {
            alert('Please enter a folder name.');
        } else {
            // add the folder to the dropdown list and select it
            // This will be passed to the file-picker component to determine the folder to upload to
            const trimVal = textField.defaultValue.trim()
            const currentOptions = options;
            currentOptions.push({ key: trimVal, text: trimVal });
            setOptions(currentOptions);
            // setSelectedKeys([trimVal]);
            onSelectedKeyChange([trimVal]);
            toggleTeachingBubbleVisible();
        }
    };

    const examplePrimaryButtonProps: IButtonProps = {
        children: 'Create folder',
        onClick: teachingBubblePrimaryButtonClick,
    };

    async function fetchBlobFolderData() {
        try {
            const blobClientUrl = await getBlobClientUrl();
            const blobServiceClient = new BlobServiceClient(blobClientUrl);
            var containerClient = blobServiceClient.getContainerClient("upload");
            const delimiter = "/";
            const prefix = "";
            var newOptions: IComboBoxOption[] = allowNewFolders ? [] : [
                { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll },
                { key: 'FolderHeader', text: 'Folders', itemType: SelectableOptionMenuItemType.Header }];
            for await (const item of containerClient.listBlobsByHierarchy(delimiter, {
                prefix,
            })) {
                // Check if the item is a folder
                if (item.kind === "prefix") {
                    // Get the folder name and add to the dropdown list
                    var folderName = item.name.slice(0, -1);
                    const userFolderPattern = /^[^@]+@[^@]+\.[^@]+$/;
                    const isUserFolder = userFolderPattern.test(folderName);

                    // Only show folders if 
                    // - User is Admin
                    // - The folder is not a user folder (e.g. "Public") 
                    // - The folder belongs to them
                    if (userData.is_admin || !isUserFolder || folderName === userData.userPrincipalName) {
                        const textValue = folderName === userData.userPrincipalName ? "My Data" : folderName;
                        newOptions.push({ key: folderName, text: textValue });
                    }
                    setOptions(newOptions);
                }
            }
            if (!allowNewFolders) {
                var filteredOptions = newOptions.filter(
                    option =>
                        (option.itemType === SelectableOptionMenuItemType.Normal || option.itemType === undefined) && !option.disabled,
                );
                if (selectedKeys !== undefined && selectedKeys.length > 0) {
                    onSelectedKeyChange(selectedKeys);
                }
                else {
                    onSelectedKeyChange(['selectAll', ...filteredOptions.map(o => o.key as string)]);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        fetchBlobFolderData();
    }, []);

    useEffect(() => {
        // This effect runs once on component mount and whenever allowFolderCreation changes.
        // Set the default selected key based on allowFolderCreation.
        if (allowFolderCreation) {
            // Default selection the user's data folder
            onSelectedKeyChange([userData.userPrincipalName]);
        } else if (selectedKeys && selectedKeys.length > 0) {
            onSelectedKeyChange(selectedKeys);
        }
    }, [allowFolderCreation, selectedKeys]);

    useEffect(() => {
        // Check if at least one option is selected whenever selectedKeys change
        if (selectedKeys && selectedKeys.length > 0) {
            setAtLeastOneOptionSelected(true);
        } else {
            setAtLeastOneOptionSelected(false);
        }
    }, [selectedKeys]);

    function getStyles(props: ITextFieldStyleProps): Partial<ITextFieldStyles> {
        const { required } = props;
        return {
            fieldGroup: [
                { width: 300 },
                required && {
                    borderColor: "#F8f8ff",
                },
            ],
            subComponentStyles: {
                label: getLabelStyles,
            },
        };
    }

    function getLabelStyles(props: ILabelStyleProps): ILabelStyles {
        const { required } = props;
        return {
            root: required && {
                color: "#696969",
            },
        };
    }

    const onChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {

        const selected = option?.selected;
        const currentSelectedOptionKeys = selectedKeys?.filter(key => key !== 'selectAll');
        const selectAllState = currentSelectedOptionKeys?.length === selectableOptions.length;

        if (!allowNewFolders) {
            if (option) {
                if (option.itemType === SelectableOptionMenuItemType.SelectAll) {
                    if (selectAllState) {
                        // Deselect all items, including "Select All"
                        onSelectedKeyChange([]);
                    } else {
                        // Select all items, including "Select All"
                        const updatedKeys = ['selectAll', ...selectableOptions.map(o => o.key as string)];
                        onSelectedKeyChange(updatedKeys);
                    }

                } else {
                    const updatedKeys = selected
                        ? [...currentSelectedOptionKeys, option!.key as string]
                        : currentSelectedOptionKeys.filter(k => k !== option.key);
                    if (updatedKeys.length === selectableOptions.length) {
                        updatedKeys.push('selectAll');
                    }
                    onSelectedKeyChange(updatedKeys);
                }
            }
        } else {
            onSelectedKeyChange([option!.key as string]);
        }
    };

    const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
        // Prevent the ComboBox from closing if no option is selected
        if (!atLeastOneOptionSelected) {
            event.preventDefault();
            event.stopPropagation();
        }
    };


    return (
        <div className={styles.folderArea}>
            <div className={styles.folderSelection}>
                <Label>Folder Selection&nbsp;
                    <TooltipHost content={allowNewFolders ? "Select a folder to upload documents into" : "Select a folder to filter the search by"}
                        styles={hostStyles}
                        id={tooltipId}>
                        <FiHelpCircle></FiHelpCircle>
                    </TooltipHost>
                </Label>
                <ComboBox
                    multiSelect={allowNewFolders ? false : true}
                    selectedKey={selectedKeys ? selectedKeys : undefined}
                    options={options}
                    defaultSelectedKey={allowFolderCreation && !selectedKeys.length ? userData.userPrincipalName : undefined}
                    onChange={onChange}
                    styles={comboBoxStyles}
                />
            </div>
            {allowNewFolders ? (
                <div className={styles.actionButton}>
                    <ActionButton
                        iconProps={addFolderIcon}
                        allowDisabledFocus
                        onClick={toggleTeachingBubbleVisible}
                        id={buttonId}>
                        Create new folder
                    </ActionButton>
                    {teachingBubbleVisible && (
                        <TeachingBubble
                            target={`#${buttonId}`}
                            primaryButtonProps={examplePrimaryButtonProps}
                            onDismiss={toggleTeachingBubbleVisible}
                            headline="Create new folder"
                            calloutProps={{ directionalHint: DirectionalHint.topCenter }}
                            styles={teachingBubbleStyles}
                            hasCloseButton={true}
                        >
                            <TextField id={textFieldId} label='Folder Name:' required={true} styles={getStyles} />
                        </TeachingBubble>
                    )}
                </div>) : ""}
        </div>
    );
};