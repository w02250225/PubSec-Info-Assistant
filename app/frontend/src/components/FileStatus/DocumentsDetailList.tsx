// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState } from "react";
import { Link } from '@fluentui/react/lib/Link';
import {
    DetailsList, DetailsListLayoutMode, SelectionMode, IColumn, IconButton,
    ITag, DialogFooter, Dialog, DialogType, DefaultButton, PrimaryButton
} from "@fluentui/react";
import { TooltipHost } from '@fluentui/react';
import { TagPickerInline } from '../TagPicker'

import styles from "./DocumentsDetailList.module.css";

export interface IDocument {
    key: string;
    name: string;
    file_path: string;
    folder_name: string;
    tags: string[];
    value: string;
    iconName: string;
    fileType: string;
    state: string;
    state_description: string;
    upload_timestamp: string;
    modified_timestamp: string;
    can_edit: boolean;
}

interface Props {
    items: IDocument[];
    onFilesSorted: (items: IDocument[]) => void;
    onFileDelete: (item: IDocument) => void;
    onSaveTags: (item: IDocument) => void;
    isAdmin: boolean;
    isDeleting: boolean;
}

export const DocumentsDetailList = ({ items, onFilesSorted, onFileDelete, onSaveTags, isAdmin, isDeleting }: Props) => {

    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
    const [isEditTagsDialogVisible, setIsEditTagsDialogVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<IDocument | null>(null);
    const [itemToEdit, setItemToEdit] = useState<IDocument | null>(null);
    const [editedTags, setEditedTags] = useState<ITag[]>([]);
    const [canEditTags, setCanEditTags] = useState(false);

    const openDeleteDialog = (item: IDocument) => {
        setItemToDelete(item);
        setIsDeleteDialogVisible(true);
    };

    const handleDeleteFile = async (item: IDocument) => {
        try {
            onFileDelete(item);
        } catch (error) {
            console.error("Error deleting file: ", error);
        } finally {
            // Close the dialog
            setIsDeleteDialogVisible(false);
        }
    };

    const openEditTagsDialog = (item: IDocument) => {
        // Convert the tags from string[] to ITag[]
        const tagsAsITags = item.tags.map((tag) => ({ key: tag, name: tag }));
        setEditedTags(tagsAsITags);
        setItemToEdit(item);
        setCanEditTags(item.state === 'Complete' && item.can_edit);
        setIsEditTagsDialogVisible(true);
    };

    const handleSaveTags = async (item: IDocument) => {
        try {
            // Convert the tags from ITag[] back to string[]
            const newTags = editedTags.map(tag => tag.key as string);
            if (item.tags != newTags) {
                item.tags = newTags;
                onSaveTags(item);
            }
        } catch (error) {
            console.error("Error updating tags: ", error);
        } finally {
            setIsEditTagsDialogVisible(false);
        }
    };

    const onColumnClick = (ev: React.MouseEvent<HTMLElement>, column: IColumn): void => {
        const newColumns: IColumn[] = columns.slice();
        const currColumn: IColumn = newColumns.filter(currCol => column.key === currCol.key)[0];
        newColumns.forEach((newCol: IColumn) => {
            if (newCol === currColumn) {
                currColumn.isSortedDescending = !currColumn.isSortedDescending;
                currColumn.isSorted = true;
            } else {
                newCol.isSorted = false;
                newCol.isSortedDescending = true;
            }
        });

        const newItems: IDocument[] = copyAndSort(items, currColumn.fieldName!, currColumn.isSortedDescending);

        onFilesSorted(newItems);
        setColumns(newColumns);
    };

    function copyAndSort<T>(items: T[], columnKey: string, isSortedDescending?: boolean): T[] {
        const key = columnKey as keyof T;
        return items.slice(0).sort((a: T, b: T) => ((isSortedDescending ? a[key] < b[key] : a[key] > b[key]) ? 1 : -1));
    }

    function getKey(item: any, index?: number): string {
        return item.key;
    }

    function viewFile(item: any): string {
        return `${window.location.origin}/#/ViewDocument?documentName=${encodeURIComponent(item.folder_name)}/${encodeURIComponent(item.name)}`;
    }

    function renderTagsColumn(item: IDocument): JSX.Element {
        const tagsString = item.tags.join(",") || '';

        if (tagsString.length > 25) {
            // Display a truncated version of the tags with a tooltip for the full content
            const truncatedTags = tagsString.substring(0, 20) + "...";
            return (
                <div>
                    <IconButton
                        className={styles.tagIcon}
                        iconProps={{ iconName: 'Tag' }}
                        title="View/Edit Tags"
                        onClick={() => openEditTagsDialog(item)}
                    />
                    <TooltipHost content={tagsString}>
                        <span>{truncatedTags}</span>
                    </TooltipHost>
                </div>
            );
        } else {
            // If the text is not too long, display it without truncation or tooltip
            return (
                <div>
                    <IconButton
                        className={styles.tagIcon}
                        iconProps={{ iconName: 'Tag' }}
                        title="View/Edit Tags"
                        onClick={() => openEditTagsDialog(item)}
                    />
                    <span>{tagsString}</span>
                </div>
            );
        }
    };

    function renderDeleteColumn(item: IDocument): JSX.Element {
        const canDelete = item.can_edit && (item.state == "Complete" || item.state == "Error")

        return (
            <IconButton
                className={styles.fileIconImg}
                iconProps={{ iconName: 'Delete' }}
                title="Delete File"
                disabled={isDeleting || !canDelete}
                onClick={() => openDeleteDialog(item)}
                style={{ cursor: "pointer", marginLeft: "5px" }}
            />
        );
    };

    const [columns, setColumns] = useState<IColumn[]>([
        {
            key: 'column1',
            name: 'File Type',
            className: styles.fileIconCell,
            iconClassName: styles.fileIconHeaderIcon,
            ariaLabel: 'Column operations for File type, Press to sort on File type',
            iconName: 'Page',
            isIconOnly: true,
            fieldName: 'name',
            minWidth: 16,
            maxWidth: 16,
            onColumnClick: onColumnClick,
            onRender: (item: IDocument) => (
                <TooltipHost content={`${item.fileType} file`}>
                    <img src={"https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/item-types/16/" + item.iconName + ".svg"} className={styles.fileIconImg} alt={`${item.fileType} file icon`} />
                </TooltipHost>
            ),
        },
        {
            key: 'column2',
            name: 'Name',
            fieldName: 'name',
            minWidth: 250,
            maxWidth: 400,
            isRowHeader: true,
            isResizable: true,
            isSorted: false,
            isSortedDescending: false,
            ariaLabel: 'Click to sort by file name',
            sortAscendingAriaLabel: 'Sorted A to Z',
            sortDescendingAriaLabel: 'Sorted Z to A',
            onColumnClick: onColumnClick,
            data: 'string',
            onRender: (item: IDocument) => (
                <TooltipHost content="Click to view file">
                    <Link href={viewFile(item)} target="_blank">{item.name}</Link>
                </TooltipHost>
            ),
            isPadded: true,
        },
        {
            key: 'column3',
            name: 'Folder',
            fieldName: 'folder_name',
            minWidth: 50,
            maxWidth: 200,
            isRowHeader: true,
            isResizable: true,
            isSorted: false,
            isSortedDescending: false,
            ariaLabel: 'Click to sort by folder name',
            sortAscendingAriaLabel: 'Sorted A to Z',
            sortDescendingAriaLabel: 'Sorted Z to A',
            onColumnClick: onColumnClick,
            data: 'string',
            isPadded: true,
        },
        {
            key: 'column4',
            name: 'Tags',
            fieldName: 'tags',
            minWidth: 100,
            maxWidth: 200,
            isRowHeader: true,
            isResizable: true,
            isSorted: false,
            isSortedDescending: false,
            ariaLabel: 'Tags',
            data: 'string',
            onRender: renderTagsColumn,
            isPadded: true,
        },
        {
            key: 'column5',
            name: 'State',
            fieldName: 'state',
            minWidth: 70,
            maxWidth: 90,
            isResizable: true,
            isSorted: false,
            isSortedDescending: false,
            ariaLabel: 'Click to sort by state',
            onColumnClick: onColumnClick,
            data: 'string',
            onRender: (item: IDocument) => (
                <TooltipHost content={`${item.state_description} `}>
                    <span>{item.state}</span>
                </TooltipHost>
            ),
            isPadded: true,
        },
        {
            key: 'column6',
            name: 'Submitted On',
            fieldName: 'upload_timestamp',
            minWidth: 70,
            maxWidth: 120,
            isResizable: true,
            isSorted: false,
            isSortedDescending: false,
            isCollapsible: true,
            ariaLabel: 'Column operations for submitted on date, Press to sort by submitted date',
            data: 'string',
            onColumnClick: onColumnClick,
            onRender: (item: IDocument) => {
                return <span>{item.upload_timestamp}</span>;
            },
            isPadded: true,
        },
        {
            key: 'column7',
            name: 'Last Updated',
            fieldName: 'modified_timestamp',
            minWidth: 70,
            maxWidth: 120,
            isResizable: true,
            isSorted: true,
            isSortedDescending: true,
            sortAscendingAriaLabel: 'Sorted Oldest to Newest',
            sortDescendingAriaLabel: 'Sorted Newest to Oldest',
            isCollapsible: true,
            ariaLabel: 'Column operations for last updated on date, Press to sort by last updated date',
            data: 'number',
            onColumnClick: onColumnClick,
            onRender: (item: IDocument) => {
                return <span>{item.modified_timestamp}</span>;
            },
        },
        ...(isAdmin
            ? [
                {
                    key: 'columnDelete',
                    name: 'Delete',
                    fieldName: 'delete',
                    className: styles.fileIconCell,
                    iconClassName: styles.fileIconHeaderIcon,
                    minWidth: 50,
                    maxWidth: 50,
                    isRowHeader: true,
                    isResizable: true,
                    ariaLabel: 'Delete',
                    onRender: renderDeleteColumn,
                },
            ] : []),
    ]);

    return (
        <div>
            <span className={styles.footer}>{"(" + items.length as string + ") records."}</span>
            <DetailsList
                items={items}
                compact={true}
                columns={columns}
                selectionMode={SelectionMode.none}
                getKey={getKey}
                setKey="none"
                layoutMode={DetailsListLayoutMode.justified}
                isHeaderVisible={true}
            />
            <span className={styles.footer}>{"(" + items.length as string + ") records."}</span>

            <Dialog
                hidden={!isDeleteDialogVisible}
                onDismiss={() => setIsDeleteDialogVisible(false)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: "Confirm Deletion",
                    closeButtonAriaLabel: "Close",
                    subText: `Are you sure you want to delete ${itemToDelete?.name}?`,
                }}
                modalProps={{
                    isBlocking: true,
                    styles: { main: { maxWidth: 450 } },
                }}
            >
                <DialogFooter>
                    <PrimaryButton
                        onClick={() => itemToDelete && handleDeleteFile(itemToDelete)}
                        text="Delete"
                    />
                    <DefaultButton
                        onClick={() => setIsDeleteDialogVisible(false)}
                        text="Cancel"
                    />
                </DialogFooter>
            </Dialog>

            <Dialog
                hidden={!isEditTagsDialogVisible}
                onDismiss={() => setIsEditTagsDialogVisible(false)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: "Edit Tags",
                    closeButtonAriaLabel: "Close",
                }}
                modalProps={{
                    isBlocking: true,
                    styles: { main: { maxWidth: 450 } },
                }}
            >
                <TagPickerInline
                    allowNewTags={true}
                    preSelectedTags={editedTags}
                    onSelectedTagsChange={(newTags) => setEditedTags(newTags)}
                />
                <DialogFooter>
                    {canEditTags ? (
                        <PrimaryButton
                            onClick={() => itemToEdit && handleSaveTags(itemToEdit)}
                            text="Save"
                        />
                    ) : null}
                    <DefaultButton
                        onClick={() => setIsEditTagsDialogVisible(false)}
                        text="Close"
                    />
                </DialogFooter>
            </Dialog>
        </div>
    );
}