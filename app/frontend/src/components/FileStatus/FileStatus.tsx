// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useEffect, useState } from "react";
import { Dropdown, DropdownMenuItemType, IDropdownOption, IDropdownStyles } from '@fluentui/react/lib/Dropdown';
import { ComboBox, IComboBox, IComboBoxOption, IComboBoxStyles, SelectableOptionMenuItemType, Stack } from "@fluentui/react";
import { DocumentsDetailList, IDocument } from "./DocumentsDetailList";
import { ArrowClockwise24Filled, FilterDismiss24Filled } from "@fluentui/react-icons";
import { animated, useSpring } from "@react-spring/web";
import { getAllUploadStatus, FileUploadBasicStatus, FileState } from "../../api";

import styles from "./FileStatus.module.css";

import { UserData } from '../../api'

const dropdownTimespanStyles: Partial<IDropdownStyles> = { dropdown: { width: 150 } };
const dropdownFileStateStyles: Partial<IDropdownStyles> = { dropdown: { width: 200 } };
const comboBoxStyles: Partial<IComboBoxStyles> = { root: { maxWidth: 300 }, input: { cursor: 'pointer' } };

const dropdownTimespanOptions = [
    { key: 'Time Range', text: 'End time range', itemType: DropdownMenuItemType.Header },
    { key: '4hours', text: '4 hours' },
    { key: '12hours', text: '12 hours' },
    { key: '24hours', text: '24 hours' },
    { key: '7days', text: '7 days' },
    { key: '30days', text: '30 days' },
];

const dropdownFileStateOptions = [
    { key: 'FileStates', text: 'File States', itemType: DropdownMenuItemType.Header },
    { key: FileState.All, text: 'All' },
    { key: FileState.Complete, text: 'Completed' },
    { key: FileState.Error, text: 'Error' },
    { key: FileState.Processing, text: 'Processing' },
    { key: FileState.Indexing, text: 'Indexing' },
    { key: FileState.Queued, text: 'Queued' },
    { key: FileState.Skipped, text: 'Skipped' },
    { key: FileState.UPLOADED, text: 'Uploaded' },
    { key: FileState.THROTTLED, text: 'Throttled' },
];

interface Props {
    className?: string;
    userData: UserData;
}

export const FileStatus = ({ className, userData }: Props) => {
    const [selectedTimeFrameItem, setSelectedTimeFrameItem] = useState<IDropdownOption>();
    const [selectedFileStates, setSelectedFileStates] = useState<string[]>([]);
    const [selectableFileStateOptions, setSelectableFileStateOptions] = useState<IComboBoxOption[]>([]);
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
    const [selectableFolderOptions, setSelectableFolderOptions] = useState<IComboBoxOption[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectableTagOptions, setSelectableTagOptions] = useState<IComboBoxOption[]>([]);

    const [allFiles, setAllFiles] = useState<IDocument[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<IDocument[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const onTimeSpanChange = (event: React.FormEvent<HTMLDivElement>, item: IDropdownOption<any> | undefined): void => {
        setSelectedTimeFrameItem(item);
    };

    const onFilesSorted = (items: IDocument[]): void => {
        setFilteredFiles(items);
    };

    const onRefreshClicked = () => {
        fetchAllData();
    };

    const onClearFiltersClicked = () => {
        setSelectedFileStates([]);
        setSelectedFolders([]);
        setSelectedTags([]);
        // setSelectedTags(selectableTagOptions.map(option => option.key.toString()));
        // fetchAllData();
    };

    const fetchAllData = async () => {
        setIsLoading(true);

        const response = await getAllUploadStatus();
        const list = convertStatusToItems(response.statuses);

        // Filter out empty folder names and create dropdown options
        let uniqueTags: string[] = [];

        const fileStateDropdownOptions: IComboBoxOption[] = [
            { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll }];

        const folderDropdownOptions: IComboBoxOption[] = [
            { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll }];

        const tagDropdownOptions: IComboBoxOption[] = [
            { key: 'selectAll', text: 'Select All', itemType: SelectableOptionMenuItemType.SelectAll }
        ];

        list.forEach(item => {
            // File state
            const fileState = item.state && typeof item.state === 'string' ? item.folder_name.trim() : '';

            if (fileState && !fileStateDropdownOptions.some(o => o.key === fileState)) {
                fileStateDropdownOptions.push({ key: fileState, text: fileState });
            }

            // Folder names
            const folderName = item.folder_name && typeof item.folder_name === 'string' ? item.folder_name.trim() : '';

            if (folderName && !folderDropdownOptions.some(o => o.key === folderName)) {
                folderDropdownOptions.push({ key: folderName, text: folderName });
            }

            // Tags
            if (item.tags) {
                const tagsArray = item.tags.split(',').map(tag => tag.trim());
                tagsArray.forEach(tag => {
                    if (tag && !uniqueTags.includes(tag)) {
                        uniqueTags.push(tag);
                    }
                });
            }
        });

        uniqueTags.forEach(tag => {
            tagDropdownOptions.push({ key: tag, text: tag });
        });

        setSelectableFileStateOptions(fileStateDropdownOptions);
        setSelectableFolderOptions(folderDropdownOptions);
        setSelectableTagOptions(tagDropdownOptions);
        setAllFiles(list);
        setFilteredFiles(list);
        setIsLoading(false);
    };

    function convertStatusToItems(fileList: FileUploadBasicStatus[]) {
        const items: IDocument[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const folderName = fileList[i].folder_name;

            let fileExtension = fileList[i].file_name.split('.').pop();
            fileExtension = fileExtension == undefined ? 'Folder' : fileExtension.toUpperCase()
            const stateDescription = STATE_DESCRIPTION[fileList[i].state] || fileList[i].state;
            const tagsString = fileList[i].tags.join(",") || '';
            try {
                items.push({
                    key: fileList[i].id,
                    name: fileList[i].file_name,
                    file_path: fileList[i].file_path,
                    folder_name: folderName === userData.userPrincipalName ? 'My Data' : fileList[i].folder_name,
                    tags: tagsString,
                    iconName: FILE_ICONS[fileExtension.toLowerCase() || 'txt'],
                    fileType: fileExtension,
                    state: fileList[i].state,
                    state_description: fileList[i].state_description || stateDescription,
                    upload_timestamp: fileList[i].start_timestamp,
                    modified_timestamp: fileList[i].state_timestamp,
                    value: fileList[i].id,
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

    const onSelectedFileStateChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {

        const selected = option?.selected;
        const currentSelectedOptionKeys = selectedFileStates?.filter(key => key !== 'selectAll');
        const selectAllState = currentSelectedOptionKeys?.length === selectableFileStateOptions.length;

        if (option) {
            if (option.itemType === SelectableOptionMenuItemType.SelectAll) {
                if (selectAllState) {
                    // Deselect all items, including "Select All"
                    setSelectedFileStates([]);
                } else {
                    // Select all items, including "Select All"
                    const updatedKeys = ['selectAll', ...selectableFileStateOptions.map(o => o.key as string)];
                    setSelectedFileStates(updatedKeys);
                }

            } else {
                const updatedKeys = selected
                    ? [...currentSelectedOptionKeys, option!.key as string]
                    : currentSelectedOptionKeys.filter(k => k !== option.key);
                if (updatedKeys.length === selectableFileStateOptions.length) {
                    updatedKeys.push('selectAll');
                }
                setSelectedFileStates(updatedKeys);
            }
        }
    };

    const onSelectedFoldersChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {

        const selected = option?.selected;
        const currentSelectedOptionKeys = selectedFolders?.filter(key => key !== 'selectAll');
        const selectAllState = currentSelectedOptionKeys?.length === selectableFolderOptions.length;

        if (option) {
            if (option.itemType === SelectableOptionMenuItemType.SelectAll) {
                if (selectAllState) {
                    // Deselect all items, including "Select All"
                    setSelectedFolders([]);
                } else {
                    // Select all items, including "Select All"
                    const updatedKeys = ['selectAll', ...selectableFolderOptions.map(o => o.key as string)];
                    setSelectedFolders(updatedKeys);
                }

            } else {
                const updatedKeys = selected
                    ? [...currentSelectedOptionKeys, option!.key as string]
                    : currentSelectedOptionKeys.filter(k => k !== option.key);
                if (updatedKeys.length === selectableFolderOptions.length) {
                    updatedKeys.push('selectAll');
                }
                setSelectedFolders(updatedKeys);
            }
        }
    };

    const onSelectedTagsChange = (
        event: React.FormEvent<IComboBox>,
        option?: IComboBoxOption,
        index?: number,
        value?: string,
    ): void => {

        const selected = option?.selected;
        const currentSelectedOptionKeys = selectedTags?.filter(key => key !== 'selectAll');
        const selectAllState = currentSelectedOptionKeys?.length === selectableTagOptions.length;

        if (option) {
            if (option.itemType === SelectableOptionMenuItemType.SelectAll) {
                if (selectAllState) {
                    // Deselect all items, including "Select All"
                    setSelectedTags([]);
                } else {
                    // Select all items, including "Select All"
                    const updatedKeys = ['selectAll', ...selectableTagOptions.map(o => o.key as string)];
                    setSelectedTags(updatedKeys);
                }

            } else {
                const updatedKeys = selected
                    ? [...currentSelectedOptionKeys, option!.key as string]
                    : currentSelectedOptionKeys.filter(k => k !== option.key);
                if (updatedKeys.length === selectableTagOptions.length) {
                    updatedKeys.push('selectAll');
                }
                setSelectedTags(updatedKeys);
            }
        }
    };

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

    const animatedStyles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 }
    });

    // Refresh file list from API on mount
    // or when time frame filter changes
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
                {/* <Dropdown
                    label="Uploaded in last:"
                    defaultSelectedKey='4hours'
                    onChange={onTimeSpanChange}
                    placeholder="Select a time range"
                    options={dropdownTimespanOptions}
                    styles={dropdownTimespanStyles}
                    aria-label="timespan options for file statuses to be displayed"
                /> */}
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
            ) : (
                <div className={styles.resultspanel}>
                    <DocumentsDetailList items={filteredFiles == undefined ? [] : filteredFiles} onFilesSorted={onFilesSorted} />
                </div>
            )}
        </div>
    );
};