// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { array, func } from "prop-types";
import React, { useState } from "react";
import styles from "./DropZone.module.css";

const Banner = ({ onClick, onDrop }: { onClick: any, onDrop: any }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (ev: any) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragEnter = (ev: any) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (ev: any) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (ev: any) => {
    ev.preventDefault();
    ev.stopPropagation();
    setIsDragging(false);
    onDrop(ev.dataTransfer.files);
  };

  return (
    <div
      className={`${styles.banner} ${isDragging ? styles.dragOver : ''}`}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className={styles.banner_text}>Click to Add files</span>
      <span className={styles.banner_text}>Or</span>
      <span className={styles.banner_text}>Drag and Drop files here</span>
    </div>
  );
};

export const DropZone = ({ onChange, accept = ["*"] }: { onChange: any, accept: string[] }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (ev: any) => {
    onChange(ev.target.files);
  };

  const handleDrop = (files: any) => {
    onChange(files);
  };

  return (
    <div className={styles.wrapper}>
      <Banner onClick={handleClick} onDrop={handleDrop} />
      <input
        type="file"
        aria-label="Upload Files"
        className={styles.input}
        ref={inputRef}
        multiple={true}
        onChange={handleChange}
        accept={accept.join(",")}
      />
    </div>
  );
};

DropZone.propTypes = {
  accept: array,
  onChange: func,
};