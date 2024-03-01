// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { useCallback } from "react";
import { Checkmark20Filled, Dismiss20Filled, Delete20Filled } from '@fluentui/react-icons';
import styles from "./FilesList.module.css";

interface Props {
  name: string,
  id: string,
  onClear: any,
  status: 'pending' | 'uploading' | 'success' | 'error',
  progress: number
};

const FilesListItem = ({
  name,
  id,
  onClear,
  status,
  progress
}: Props) => {
  const handleClear = useCallback(() => {
    onClear(id);
  }, [id, onClear]);

  return (
    <li className={styles.files_list_item}>
      <span className={styles.files_list_item_name}>{name}</span>
      <div className={styles.fileStatusIcons}>
        {status === 'uploading' && (
          <div className={styles.progressBarBackground}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
        {status === 'success' && (
          <Checkmark20Filled
            className={`${styles.file_list_item_button} ${styles.file_list_item_success}`}
            aria-label="File uploaded successfully" />
        )}
        {status === 'error' && (
          <Delete20Filled
            className={`${styles.file_list_item_button} ${styles.file_list_item_delete}`}
            aria-label="File upload failed"
            onClick={handleClear} />
        )}
        {status === 'pending' && (
          <Dismiss20Filled
            className={`${styles.file_list_item_button} ${styles.files_list_item_clear}`}
            aria-label="Remove file"
            onClick={handleClear}
          />
        )}
      </div>
    </li>
  );
};

const FilesList = ({ files, onClear }: { files: any[], onClear: any }) => {
  return (
    <ul className={styles.files_list}>
      {files.map((file) => (
        <FilesListItem
          name={file.file.name}
          key={file.id}
          id={file.id}
          onClear={onClear}
          status={file.status}
          progress={file.progress}
        />
      ))}
    </ul>
  );
};

export { FilesList };
