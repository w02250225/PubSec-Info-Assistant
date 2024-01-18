// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useEffect, useState } from "react";
import { ComboBox, DefaultButton, Dialog, DialogFooter, DialogType, IComboBox, IComboBoxOption, IComboBoxStyles, ITag, PrimaryButton, SelectableOptionMenuItemType, Stack } from "@fluentui/react";
import { DocumentsDetailList, IDocument } from "./DocumentsDetailList";
import { ArrowClockwise24Filled, FilterDismiss24Filled } from "@fluentui/react-icons";
import { animated, useSpring } from "@react-spring/web";
import { getAllUploadStatus, FileUploadBasicStatus, deleteFile, updateFileTags, UserData } from "../../api";

import styles from "./FileStatus.module.css";

interface Props {
    className?: string;
    userData: UserData;
}

const comboBoxStyles: Partial<IComboBoxStyles> = { root: { maxWidth: 300 }, input: { cursor: 'pointer' } };

export const FileStatus = ({ className, userData }: Props) => {
    const [selectedFileStates, setSelectedFileStates] = useState<string[]>([]);
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
    const [selectableFolderOptions, setSelectableFolderOptions] = useState<IComboBoxOption[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectableTagOptions, setSelectableTagOptions] = useState<IComboBoxOption[]>([]);

    const [allFiles, setAllFiles] = useState<IDocument[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<IDocument[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const selectableFileStateOptions: IComboBoxOption[] = [
        { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll },
        { key: 'Complete', text: 'Complete' },
        { key: 'Deleted', text: 'Deleted' },
        { key: 'Error', text: 'Error' },
        { key: 'Processing', text: 'Processing' },
        { key: 'Indexing', text: 'Indexing' },
        { key: 'Queued', text: 'Queued' },
        { key: 'Skipped', text: 'Skipped' },
        { key: 'Uploaded', text: 'Uploaded' },
        { key: 'Throttled', text: 'Throttled' },
    ];

    const FILE_ICONS: { [id: string]: string } = {
        "csv": 'csv',
        "doc": 'docx',
        "docx": 'docx',
        "pdf": 'pdf',
        "pptx": 'pptx',
        "txt": 'txt',
        "htm": 'html',
        "html": 'html',
        "xls": 'xlsx',
        "xlsx": 'xlsx'
    };

    const STATE_DESCRIPTION: { [id: string]: string } = {
        "Processing": "File is being processed, please check back later",
        "Skipped": "File processing was skipped",
        "Queued": "File is queued for processing, please check back later",
        "Complete": "File processing is complete",
        "Error": "There was an unexected error processing the file"
    };

    const onFilesSorted = (items: IDocument[]): void => {
        setFilteredFiles(items);
    };

    const onFileDelete = async (item: IDocument) => {
        try {
            setIsDeleting(true);
            await deleteFile(item.file_path)
            setFilteredFiles((filteredFiles) =>
                filteredFiles.map((i) =>
                    i === item ? { ...i, state: "Deleted" } : i
                )
            );
        } catch (error) {
            console.error("Ereror deleting item: ", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const onSaveTags = async (item: IDocument) => {
        try {
            await updateFileTags(item.file_path, item.tags);
            setFilteredFiles((filteredFiles) =>
                filteredFiles.map((i) =>
                    i === item ? { ...i, tags: item.tags } : i
                )
            );

        } catch (error) {
            console.error("Error updating tags: ", error);
        }
    };

    const onRefreshClicked = () => {
        fetchAllData();
    };

    const onClearFiltersClicked = () => {
        setSelectedFileStates([]);
        setSelectedFolders([]);
        setSelectedTags([]);
    };

    const fetchAllData = async () => {
        setIsLoading(true);

        const response = await getAllUploadStatus();
        const list = convertStatusToItems(response.statuses);

        // Filter out empty folder names and create dropdown options
        let uniqueTags: string[] = [];

        const folderDropdownOptions: IComboBoxOption[] = [
            { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll }];

        const tagDropdownOptions: IComboBoxOption[] = [
            { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll }
        ];

        list.forEach(item => {
            // Folder names
            const folderName = item.folder_name && typeof item.folder_name === 'string' ? item.folder_name.trim() : '';

            if (folderName && !folderDropdownOptions.some(o => o.key === folderName)) {
                folderDropdownOptions.push({ key: folderName, text: folderName, itemType: SelectableOptionMenuItemType.Normal });
            }

            // Tags
            if (item.tags) {
                const tagsArray = item.tags.map(tag => tag.trim());
                tagsArray.forEach(tag => {
                    if (tag && !uniqueTags.includes(tag)) {
                        uniqueTags.push(tag);
                    }
                });
            }
        });

        uniqueTags.forEach(tag => {
            tagDropdownOptions.push({ key: tag, text: tag, itemType: SelectableOptionMenuItemType.Normal });
        });

        folderDropdownOptions.sort((a, b) => {
            if (a.itemType === SelectableOptionMenuItemType.Normal && b.itemType === SelectableOptionMenuItemType.Normal) {
                return a.text.localeCompare(b.text);
            }
            return 0;
        });
        
        tagDropdownOptions.sort((a, b) => {
            if (a.itemType === SelectableOptionMenuItemType.Normal && b.itemType === SelectableOptionMenuItemType.Normal) {
                return a.text.localeCompare(b.text);
            }
            return 0;
        });

        setSelectableFolderOptions(folderDropdownOptions);
        setSelectableTagOptions(tagDropdownOptions);

        if (selectedFileStates.length === 0) {
            setSelectedFileStates(selectableFileStateOptions
                // Exclude "Deleted" and "Select All" from default selection
                .filter(option => option.key !== 'Deleted' && option.key !== 'selectAll') 
                .map(option => option.key.toString())
            );
        };
        if (selectedFolders.length === 0) {
            setSelectedFolders(folderDropdownOptions.map(o => o.key.toString()));
        }
        if (selectedTags.length === 0) {
            setSelectedTags(tagDropdownOptions.map(o => o.key.toString()));
        }

        setAllFiles(list);
        // filterData();
        setIsLoading(false);
    };

    function convertStatusToItems(fileList: FileUploadBasicStatus[]) {
        const items: IDocument[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const folderName = fileList[i].folder_name;

            let fileExtension = fileList[i].file_name.split('.').pop();
            fileExtension = fileExtension == undefined ? 'Folder' : fileExtension.toUpperCase()
            const stateDescription = STATE_DESCRIPTION[fileList[i].state] || fileList[i].state;
            try {
                items.push({
                    key: fileList[i].id,
                    name: fileList[i].file_name,
                    file_path: fileList[i].file_path,
                    folder_name: folderName === userData.userPrincipalName ? 'My Data' : fileList[i].folder_name,
                    tags: fileList[i].tags,
                    iconName: FILE_ICONS[fileExtension.toLowerCase() || 'txt'],
                    fileType: fileExtension,
                    state: fileList[i].state,
                    state_description: fileList[i].state_description || stateDescription,
                    upload_timestamp: fileList[i].start_timestamp,
                    modified_timestamp: fileList[i].state_timestamp,
                    value: fileList[i].id,
                    can_edit: folderName === userData.userPrincipalName || userData.is_admin,
                });
            }
            catch (e) {
                console.log(e);
            }
        }
        return items;
    };

    const filterData = () => {
        let filtered = allFiles;

        if (selectedFileStates.length > 0 && !selectedFileStates.includes('selectAll')) {
            filtered = filtered.filter(file => selectedFileStates.includes(file.state));
        }

        if (selectedFolders.length > 0 && !selectedFolders.includes('selectAll')) {
            filtered = filtered.filter(file => selectedFolders.includes(file.folder_name));
        }

        if (selectedTags.length > 0 && !selectedTags.includes('selectAll')) {
            filtered = filtered.filter(file => selectedTags.some(tag => file.tags.includes(tag)));
        }

        setFilteredFiles(filtered);
    };

    const handleSelectionChange = (
        selectedItems: string[],
        setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>,
        selectableOptions: IComboBoxOption[],
        option?: IComboBoxOption
    ): void => {
        const selected = option?.selected;
        const currentSelectedOptionKeys = selectedItems?.filter(key => key !== 'selectAll');
        const selectableOptionsFiltered = selectableOptions.filter(
            option =>
            (option.itemType === SelectableOptionMenuItemType.Normal ||
                option.itemType === undefined),
        );
        const selectAllState = currentSelectedOptionKeys?.length === selectableOptionsFiltered.length;

        if (option) {
            if (option.itemType === SelectableOptionMenuItemType.SelectAll) {
                if (selectAllState) {
                    // Deselect all items, including "Select All"
                    setSelectedItems([]);
                } else {
                    // Select all items, including "Select All"
                    const updatedKeys = ['selectAll', ...selectableOptionsFiltered.map(o => o.key as string)];
                    setSelectedItems(updatedKeys);
                }
            } else {
                const updatedKeys = selected
                    ? [...currentSelectedOptionKeys, option!.key as string]
                    : currentSelectedOptionKeys.filter(k => k !== option.key);
                if (updatedKeys.length === selectableOptionsFiltered.length) {
                    updatedKeys.push('selectAll');
                }
                setSelectedItems(updatedKeys);
            }
        }
    };

    const onSelectedFileStateChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {
        handleSelectionChange(selectedFileStates, setSelectedFileStates, selectableFileStateOptions, option);
    };

    const onSelectedFoldersChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {
        handleSelectionChange(selectedFolders, setSelectedFolders, selectableFolderOptions, option);
    };

    const onSelectedTagsChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {
        handleSelectionChange(selectedTags, setSelectedTags, selectableTagOptions, option);
    };

    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    // Refresh file list from API on mount
    // Set default filters
    useEffect(() => {
        fetchAllData();
    }, []);

    // Filter locally if any other filter changes
    useEffect(() => {
        filterData();
    }, [selectedFileStates, selectedFolders, selectedTags]);

    return (
        <div className={styles.container}>
            <div className={`${styles.options} ${className ?? ""}`} >
                <ComboBox
                    label="File State:"
                    multiSelect
                    placeholder="Select file state(s)"
                    selectedKey={selectedFileStates ? selectedFileStates : undefined}
                    options={selectableFileStateOptions}
                    onChange={onSelectedFileStateChange}
                    styles={comboBoxStyles}
                    aria-label="file state options for file statuses to be displayed"
                />
                <ComboBox
                    label="Folder:"
                    multiSelect
                    placeholder="Select folder(s)"
                    selectedKey={selectedFolders ? selectedFolders : undefined}
                    options={selectableFolderOptions}
                    onChange={onSelectedFoldersChange}
                    styles={comboBoxStyles}
                    aria-label="folder name options for file statuses to be displayed"
                />
                <ComboBox
                    label="Tags:"
                    multiSelect
                    placeholder="Select file tag(s)"
                    selectedKey={selectedTags ? selectedTags : undefined}
                    options={selectableTagOptions}
                    onChange={onSelectedTagsChange}
                    styles={comboBoxStyles}
                    aria-label="tag options for file statuses to be displayed"
                />
                <div className={styles.buttonArea}>
                    <div className={styles.button} onClick={onRefreshClicked} aria-label="Refresh displayed file statuses">
                        <ArrowClockwise24Filled className={styles.buttonIcon} />
                        <span className={styles.buttonText}>Refresh</span>
                    </div>
                    <div className={styles.button} onClick={onClearFiltersClicked} aria-label="Clear filters">
                        <FilterDismiss24Filled className={styles.buttonIcon} />
                        <span className={styles.buttonText}>Clear Filters</span>
                    </div>
                </div>
            </div>
            {isLoading ? (
                <animated.div style={{ ...animatedStyles }}>
                    <Stack className={styles.loadingContainer} verticalAlign="space-between">
                        <Stack.Item grow>
                            <p className={styles.loadingText}>
                                Getting file statuses
                                <span className={styles.loadingdots} />
                            </p>
                        </Stack.Item>
                    </Stack>
                </animated.div>
            ) : (filteredFiles && filteredFiles.length > 0 ? (
                <div className={styles.resultspanel}>
                    <DocumentsDetailList
                        items={filteredFiles == undefined ? [] : filteredFiles}
                        onFilesSorted={onFilesSorted}
                        onFileDelete={onFileDelete}
                        onSaveTags={onSaveTags}
                        isAdmin={userData.is_admin}
                        isDeleting={isDeleting}
                    />
                </div>
            ) : (
                <Stack className={styles.loadingContainer} verticalAlign="space-between">
                    <Stack.Item grow>
                        <p className={styles.loadingText}>
                            No data available with the provided filters.
                        </p>
                    </Stack.Item>
                </Stack>
            ))}
        </div>
    );
};