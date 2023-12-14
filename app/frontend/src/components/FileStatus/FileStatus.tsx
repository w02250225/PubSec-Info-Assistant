// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useEffect, useState } from "react";
import { Dropdown, DropdownMenuItemType, IDropdownOption, IDropdownStyles } from '@fluentui/react/lib/Dropdown';
import { Stack } from "@fluentui/react";
import { DocumentsDetailList, IDocument } from "./DocumentsDetailList";
import { ArrowClockwise24Filled } from "@fluentui/react-icons";
import { animated, useSpring } from "@react-spring/web";
import { getAllUploadStatus, FileUploadBasicStatus, GetUploadStatusRequest, FileState } from "../../api";

import styles from "./FileStatus.module.css";

const dropdownTimespanStyles: Partial<IDropdownStyles> = { dropdown: { width: 150 } };
const dropdownFileStateStyles: Partial<IDropdownStyles> = { dropdown: { width: 200 } };

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
    { key: FileState.Skipped, text: 'Skipped'},
    { key: FileState.UPLOADED, text: 'Uploaded'},
    { key: FileState.THROTTLED, text: 'Throttled'},    
  ];

interface Props {
    className?: string;
}

export const FileStatus = ({ className }: Props) => {
    const [selectedTimeFrameItem, setSelectedTimeFrameItem] = useState<IDropdownOption>();
    const [selectedFileStateItem, setSelectedFileStateItem] = useState<IDropdownOption>();
    const [selectedFolderItem, setSelectedFolderItem] = useState<IDropdownOption>();

    const [dropdownFolderOptions, setDropdownFolderOptions] = useState<IDropdownOption[]>([]);
    
    const [files, setFiles] = useState<IDocument[]>();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const onTimeSpanChange = (event: React.FormEvent<HTMLDivElement>, item: IDropdownOption<any> | undefined): void => {
        setSelectedTimeFrameItem(item);
    };

    const onFileStateChange = (event: React.FormEvent<HTMLDivElement>, item: IDropdownOption<any> | undefined): void => {
        setSelectedFileStateItem(item);
    };

    const onFolderChange = (event: React.FormEvent<HTMLDivElement>, item: IDropdownOption<any> | undefined): void => {
        setSelectedFolderItem(item);
    };

    const onFilesSorted = (items: IDocument[]): void => {
        setFiles(items);
    };

    const onGetStatusClick = async () => {
        setIsLoading(true);
        var timeframe = 4;
        switch (selectedTimeFrameItem?.key as string) {
            case "4hours":
                timeframe = 4;
                break;
            case "12hours":
                timeframe = 12;
                break;
            case "24hours":
                timeframe = 24;
                break;
            case "7days":
                timeframe = 10080;
                break;
            case "30days":
                timeframe = 43200;
                break;
            default:
                timeframe = 4;
                break;
        }

        const request: GetUploadStatusRequest = {
            timeframe: timeframe,
            state: selectedFileStateItem?.key == undefined ? FileState.All : selectedFileStateItem?.key as FileState,
            folder_name: selectedFolderItem ? selectedFolderItem.key as string : "ALL"
        }
        const response = await getAllUploadStatus(request);
        const list = convertStatusToItems(response.statuses);
        
        // Filter out empty folder names and create dropdown options
        const folderDropdownOptions = list.reduce<IDropdownOption[]>((acc, item) => {
            // Check if folder_name is defined and is a string before trimming
            const folderName = item.folder_name && typeof item.folder_name === 'string' ? item.folder_name.trim() : '';
        
            if (folderName && !acc.some(option => option.key === folderName)) {
                acc.push({ key: folderName, text: folderName });
            }
            return acc;
        }, [{ key: 'ALL', text: 'All' }]); // Add an "All" option
        
        setDropdownFolderOptions(folderDropdownOptions);
        
        setIsLoading(false);
        setFiles(list);
    }

    function convertStatusToItems(fileList: FileUploadBasicStatus[]) {
        const items: IDocument[] = [];
        for (let i = 0; i < fileList.length; i++) {
            let fileExtension = fileList[i].file_name.split('.').pop();
            fileExtension = fileExtension == undefined ? 'Folder' : fileExtension.toUpperCase()
            const stateDescription = STATE_DESCRIPTION[fileList[i].state] || fileList[i].state;
            try {
                items.push({
                    key: fileList[i].id,
                    name: fileList[i].file_name,
                    file_path: fileList[i].file_path,
                    folder_name: fileList[i].folder_name,
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
    }

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

    // Refresh file list on filter change
    useEffect(() => {
        onGetStatusClick();
    }, [selectedTimeFrameItem, selectedFileStateItem, selectedFolderItem]);

    return (
        <div className={styles.container}>
            <div className={`${styles.options} ${className ?? ""}`} >
            <Dropdown
                    label="Uploaded in last:"
                    defaultSelectedKey='4hours'
                    onChange={onTimeSpanChange}
                    placeholder="Select a time range"
                    options={dropdownTimespanOptions}
                    styles={dropdownTimespanStyles}
                    aria-label="timespan options for file statuses to be displayed"
                />
            <Dropdown
                    label="File State:"
                    onChange={onFileStateChange}
                    placeholder="Select file states"
                    options={dropdownFileStateOptions}
                    styles={dropdownFileStateStyles}
                    aria-label="file state options for file statuses to be displayed"
                />
            <Dropdown
                        label="Folder:"
                        defaultSelectedKey={'ALL'}
                        selectedKey={selectedFolderItem ? selectedFolderItem.key : undefined}
                        onChange={onFolderChange}
                        placeholder="Select folder"
                        options={dropdownFolderOptions}
                        styles={dropdownFileStateStyles}
                        aria-label="folder name options for file statuses to be displayed"
                />
            <div className={styles.refresharea} onClick={onGetStatusClick} aria-label="Refresh displayed file statuses">
                <ArrowClockwise24Filled className={styles.refreshicon} />
                <span className={styles.refreshtext}>Refresh</span>
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
                    <DocumentsDetailList items={files == undefined ? [] : files} onFilesSorted={onFilesSorted}/>
                </div>
            )}
        </div>
    );
};