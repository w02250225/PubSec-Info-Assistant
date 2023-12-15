// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useState, useContext } from 'react';
import { Pivot, PivotItem } from "@fluentui/react";
import { ITag } from '@fluentui/react/lib/Pickers';
import { FilePicker } from "../../components/FilePicker/FilePicker";
import { FileStatus } from "../../components/FileStatus/FileStatus";
import { TagPickerInline } from "../../components/TagPicker/TagPicker"
import { FolderPicker } from '../../components/FolderPicker/FolderPicker';
import { UserData } from "../../api";
import { UserContext } from "../../components/UserContext";

import styles from "./Content.module.css";

const Content = () => {
    const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
    const [selectedTags, setSelectedTags] = useState<string[] | undefined>(undefined);
    const userContext = useContext(UserContext);
    const userData = userContext?.userData as UserData;

    const onSelectedKeyChanged = (selectedFolder: string[]) => {
        setSelectedKey(selectedFolder[0]);
    };

    const onSelectedTagsChanged = (selectedTags: ITag[]) => {
        setSelectedTags(selectedTags.map((tag) => tag.name));
    }

    const handleLinkClick = (item?: PivotItem) => {
        setSelectedKey(undefined);
    };    

    return (
        <div className={styles.contentArea} >
            <Pivot aria-label="Upload Files Section" className={styles.topPivot} onLinkClick={handleLinkClick}>
                <PivotItem headerText="Upload Files" aria-label="Upload Files Tab">
                    <div className={styles.App} >
                        {/* Only allow admins to pick folders for upload     */}
                        {userData.is_admin ? (
                        <FolderPicker allowFolderCreation={true} onSelectedKeyChange={onSelectedKeyChanged} selectedKeys={[selectedKey || ""]} userData={userData}/>
                        ) : null }
                        <TagPickerInline allowNewTags={true} onSelectedTagsChange={onSelectedTagsChanged}/>
                        <FilePicker folderPath={selectedKey || userData.userPrincipalName} tags={selectedTags || []}/>
                    </div>
                </PivotItem>
                <PivotItem headerText="Upload Status" aria-label="Upload Status Tab">
                    <FileStatus className="" userData={userData}/>
                </PivotItem>
            </Pivot>
        </div>
    );
};
    
export default Content;