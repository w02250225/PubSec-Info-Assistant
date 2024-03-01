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
    ActionButton,
    Label,
    Dialog,
    DialogFooter,
    DialogType
} from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi';
import { ITextFieldStyleProps, ITextFieldStyles, TextField } from '@fluentui/react/lib/TextField';
import { ILabelStyles, ILabelStyleProps } from '@fluentui/react/lib/Label';
import { IIconProps } from '@fluentui/react';
import { DefaultButton, IButtonProps, PrimaryButton } from '@fluentui/react/lib/Button';
import { BlobServiceClient } from "@azure/storage-blob";

import { getBlobClientUrl, UserData } from "../../api";
import styles from "./FolderPicker.module.css";

var allowNewFolders = false;

interface Props {
    className?: string;
    allowFolderCreation?: boolean;
    onSelectedKeyChange: (selectedFolders: string[]) => void;
    selectedKeys: string[];
    userData: UserData;
}

export const FolderPicker = ({ className, allowFolderCreation, onSelectedKeyChange, selectedKeys, userData }: Props) => {

    allowNewFolders = allowFolderCreation as boolean;

    const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
    const [newFolderText, setNewFolderText] = useState('');
    const [comboBoxOptions, setComboBoxOptions] = useState<IComboBoxOption[]>([]);
    const selectableOptions = comboBoxOptions.filter(
        option =>
            (option.itemType === SelectableOptionMenuItemType.Normal || option.itemType === undefined) && !option.disabled,
    );
    const comboBoxStyles: Partial<IComboBoxStyles> = { root: { maxWidth: 300 }, input: { cursor: 'pointer' } };
    const addFolderIcon: IIconProps = { iconName: 'NewFolder' };
    const tooltipHtml = allowNewFolders ? "Select a folder to upload documents into" : "Select a folder to filter the search by"

    const onCreateFolder = () => {
        const newFolderValue = newFolderText.trim();
        if (!newFolderValue || newFolderValue === '') {
            alert('Please enter a folder name.');
        } else {
            // add the folder to the dropdown list and select it
            // This will be passed to the FilePicker component to determine the folder to upload to
            const currentOptions = comboBoxOptions;
            currentOptions.push({ key: newFolderValue, text: newFolderValue });
            setComboBoxOptions(currentOptions);
            onSelectedKeyChange([newFolderValue]);
            setIsNewFolderDialogOpen(false);
        }
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
            for await (const item of containerClient.listBlobsByHierarchy(delimiter, { prefix, })) {
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
                }
            }
            // Check if the user folder exists in newOptions
            const userFolderExists = newOptions.some(option => option.key === userData.userPrincipalName);

            // If it doesn't exist, add it to newOptions
            if (!userFolderExists) {
                newOptions.push({ key: userData.userPrincipalName, text: "My Data" });
            }

            setComboBoxOptions(newOptions);

            if (!allowNewFolders) {
                var filteredOptions = newOptions.filter(
                    option =>
                        (option.itemType === SelectableOptionMenuItemType.Normal || option.itemType === undefined) && !option.disabled,
                );

                if (selectedKeys !== undefined && selectedKeys.length > 0) {
                    onSelectedKeyChange(selectedKeys);
                } else {
                    onSelectedKeyChange(['selectAll', ...filteredOptions.map(o => o.key as string)]);
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        fetchBlobFolderData();
        onSelectedKeyChange([userData.userPrincipalName]);
    }, []);

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

    return (
        <div className={`${styles.folderArea} ${className ?? ""}`}>
            <div className={styles.folderSelection}>
                <Label>Folder Selection&nbsp;
                    <FiHelpCircle
                        data-tooltip-id="FolderSelection-tooltip"
                        data-tooltip-html={tooltipHtml}>
                    </FiHelpCircle>
                </Label>
                <ComboBox
                    id="folderPicker"
                    multiSelect={allowNewFolders ? false : true}
                    selectedKey={selectedKeys ? selectedKeys : undefined}
                    options={comboBoxOptions}
                    defaultSelectedKey={allowFolderCreation && !selectedKeys.length ? userData.userPrincipalName : undefined}
                    onChange={onChange}
                    styles={comboBoxStyles}
                    errorMessage={selectedKeys && selectedKeys.length == 0 ?
                        "Please select at least one folder"
                        : undefined}
                />
            </div>
            {allowNewFolders ? (
                <div className={styles.actionButton}>
                    <ActionButton
                        iconProps={addFolderIcon}
                        allowDisabledFocus
                        onClick={() => setIsNewFolderDialogOpen(true)}>
                        Create new folder
                    </ActionButton>
                    <Dialog
                        hidden={!isNewFolderDialogOpen}
                        onDismiss={() => setIsNewFolderDialogOpen(false)}
                        dialogContentProps={{
                            type: DialogType.normal,
                            title: 'Create New Folder',
                        }}
                        modalProps={{
                            isBlocking: true,
                            styles: {
                                main: {
                                    maxWidth: '500px !important',
                                    minWidth: '400px !important',
                                },
                            },
                        }}>
                        <TextField value={newFolderText} onChange={(e, newValue) => setNewFolderText(newValue || '')} />
                        <DialogFooter>
                            <PrimaryButton onClick={onCreateFolder} text="Create" />
                            <DefaultButton onClick={() => setIsNewFolderDialogOpen(false)} text="Cancel" />
                        </DialogFooter>
                    </Dialog>
                </div>) : ""}
        </div>
    );
};