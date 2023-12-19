// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState } from "react";
import { Link } from '@fluentui/react/lib/Link';
import { DetailsList, DetailsListLayoutMode, SelectionMode, IColumn } from "@fluentui/react";
import { TooltipHost } from '@fluentui/react';

import styles from "./DocumentsDetailList.module.css";

export interface IDocument {
    key: string;
    name: string;
    file_path: string;
    folder_name: string;
    tags: string;
    value: string;
    iconName: string;
    fileType: string;
    state: string;
    state_description: string;
    upload_timestamp: string;
    modified_timestamp: string;
}

interface Props {
    items: IDocument[];
    onFilesSorted: (items: IDocument[]) => void;
}

export const DocumentsDetailList = ({ items, onFilesSorted }: Props) => {

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
        const tags = item.tags;
    
        if (tags.length > 20) { // Adjust the threshold as needed
            // Display a truncated version of the tags with a tooltip for the full content
            const truncatedTags = tags.substring(0, 20) + '...';
            return (
                <TooltipHost content={tags}>
                    <span>{truncatedTags}</span>
                </TooltipHost>
            );
        } else {
            // If the text is not too long, display it without truncation or tooltip
            return <span>{tags}</span>;
        }
    }

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
        </div>
    );
}