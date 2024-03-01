// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { BlobServiceClient, BlockBlobUploadOptions } from "@azure/storage-blob";
import { toast } from 'react-toastify';
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DropZone } from "./DropZone"
import styles from "./FilePicker.module.css";
import { FilesList } from "./FilesList";
import { getBlobClientUrl, logStatus, StatusLogClassification, StatusLogEntry, StatusLogState } from "../../api"
import { PrimaryButton } from "@fluentui/react";

interface Props {
  folderPath: string;
  tags: string[];
};

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
}

export const FilePicker = ({ folderPath, tags }: Props) => {
  const [files, setFiles] = useState<any>([]);
  const [progress, setProgress] = useState(0);
  const [uploadStarted, setUploadStarted] = useState(false);
  const folderName = folderPath;
  const tagList = tags;

  function handleError(error: any, message: string) {
    let errorMessage = message;
    // Determine the specific error message
    let specificErrorMessage = "An unexpected error occurred";
    if (typeof error === 'string') {
      specificErrorMessage = error;
    } else if (error instanceof Error) {
      specificErrorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      if (err.response && err.response.data) {
        specificErrorMessage = err.response.data.error || err.response.data.message || specificErrorMessage;
      }
    }
    // Display the error message as a toast notification
    errorMessage = `${errorMessage}: ${specificErrorMessage}`;
    toast.error(errorMessage);
  };

  // handler called when files are selected via the Dropzone component
  const handleOnChange = useCallback((files: any) => {
    let filesArray = Array.from(files);
    filesArray = filesArray.map((file) => ({
      id: nanoid(),
      file,
      status: 'pending',
      progress: 0,
    }));
    setFiles(filesArray as UploadFile[]);
    setProgress(0);
    setUploadStarted(false);
  }, []);

  // handle for removing files form the files list view
  const handleClearFile = useCallback((id: any) => {
    setFiles((prev: UploadFile[]) => prev.filter((file: any) => file.id !== id));
  }, []);

  // execute the upload operation
  const handleUpload = useCallback(async () => {
    try {
      setUploadStarted(true);

      const blobClientUrl = await getBlobClientUrl();
      const blobServiceClient = new BlobServiceClient(blobClientUrl);
      const containerClient = blobServiceClient.getContainerClient("upload");

      const uploadPromises = files.map(async (indexedFile: UploadFile, index: number) => {
        // Mark file as uploading
        setFiles((prevFiles: UploadFile[]) => prevFiles.map(f => f.id === indexedFile.id ? { ...f, status: 'uploading' } : f));

        const file = indexedFile.file;
        const filePath = folderName === "" ? file.name : `${folderName}/${file.name}`;
        const blobClient = containerClient.getBlockBlobClient(filePath);

        const options: BlockBlobUploadOptions = {
          blobHTTPHeaders: { blobContentType: file.type },
        };

        if (tagList.length > 0) {
          options.metadata = { tags: tagList.join(',') };
        };

        try {
          await blobClient.uploadData(file, options);

          // Log status
          const logEntry: StatusLogEntry = {
            path: "upload/" + filePath,
            status: "File uploaded from browser to Azure Blob Storage",
            status_classification: StatusLogClassification.Info,
            state: StatusLogState.Uploaded,
            tags: tags
          };
          await logStatus(logEntry);

          // Update the file status to 'success' and progress to 100 once upload is done
          setFiles((prevFiles: UploadFile[]) => prevFiles.map((f) => {
            if (f.id === indexedFile.id) {
              return { ...f, status: 'success', progress: 100 };
            }
            return f;
          }));
        } catch (error) {
          // Mark file as error
          // Update the file status to 'error' and leave progress as is
          setFiles((prevFiles: UploadFile[]) => prevFiles.map((f) => {
            if (f.id === indexedFile.id) {
              return { ...f, status: 'error' };
            }
            return f;
          }));
          handleError(error, `Upload failed for file: ${indexedFile.file.name}`,);
        }

      });

      await Promise.all(uploadPromises);
    } catch (error) {
      handleError(error, "An error occurred while uploading files");

      // Set all files to error if something fails before the upload loop
      setFiles((prevFiles: UploadFile[]) => prevFiles.map(file => ({
        ...file,
        status: 'error',
        progress: 0
      })));

    } finally {
      setUploadStarted(false);
    }

  }, [files, folderName, tagList]);

  const allowedFileTypes = [
    // Documents
    'application/pdf', '.pdf',
    'text/html', '.htm', '.html',
    'text/csv', '.csv',
    'application/msword', '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx',
    'message/rfc822', '.eml',
    'text/markdown', '.md',
    'application/vnd.ms-outlook', '.msg',
    'application/vnd.ms-powerpoint', '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx',
    'text/plain', '.txt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx',
    'application/xml', '.xml',
    'application/json', '.json',

    // Video
    'video/x-flv', '.flv',
    'application/mxf', '.mxf',
    '.gxf',
    'video/MP2T', '.ts',
    '.ps',
    'video/3gpp', '.3gp', '.3gpp',
    'video/mpeg', '.mpg',
    'video/x-ms-wmv', '.wmv',
    'video/x-ms-asf', '.asf',
    'video/x-msvideo', '.avi',
    'video/mp4', '.mp4', '.m4a', '.m4v',
    '.isma', '.ismv',
    '.dvr-ms',
    'video/x-matroska', '.mkv',

    // Audio
    'audio/wav', '.wav',
    'audio/x-m4a', '.m4a',
    'audio/mp4', '.m4a',
    'video/quicktime', '.mov',

    // Images
    'image/jpeg', '.jpg', '.jpeg',
    'image/png', '.png',
    'image/gif', '.gif',
    'image/bmp', '.bmp',
    'image/tiff', '.tif', '.tiff'
  ];

  const uploadComplete = useMemo(() => progress === 100, [progress]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.canvas_wrapper}>
        <DropZone
          onChange={handleOnChange}
          accept={allowedFileTypes}
        />
      </div>

      {files.length ? (
        <div className={styles.files_list_wrapper}>
          <FilesList
            files={files}
            onClear={handleClearFile}
          />
        </div>
      ) : null}

      {files.length ? (
        <PrimaryButton
          onClick={handleUpload}
          className={`${styles.upload_button} ${uploadComplete || uploadStarted ? styles.disabled : ''}`}
          aria-label="Upload Files"
          text={`Upload ${files.length} Files`}
        />
      ) : null}
    </div>
  );
};