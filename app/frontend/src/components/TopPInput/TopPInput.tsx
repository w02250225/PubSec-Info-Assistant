import React, { useState, useEffect } from 'react';
import { Label } from "@fluentui/react";
import styles from "./TopPInput.module.css";
import { FiHelpCircle } from 'react-icons/fi'

interface Props {
  className?: string;
  onChange: (newValue: number) => void;
  value?: number;
}

const tooltipHtml = `
Top-p (nucleus): The cumulative probability cutoff for token selection.
Lower values mean sampling from a smaller, more top-weighted nucleus.`

export const TopPInput = ({ className, onChange, value }: Props) => {

  const [inputValue, setInputValue] = useState<string>(value?.toString() || "");

  useEffect(() => {
    setInputValue(value?.toString() || "");
  }, [value]);

  const handleInputChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = ev.target.value;
    setInputValue(newValue); // update local state on every keystroke

    const regex = /^0(\.\d{0,20})?$/;

    if (regex.test(newValue) || newValue === "") {
      onChange(parseFloat(newValue));
    }
  };

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <Label>Top P:&nbsp;
        <FiHelpCircle
          data-tooltip-id="TopPInput-tooltip"
          data-tooltip-html={tooltipHtml}>
        </FiHelpCircle>
      </Label>
      <input
        value={inputValue}
        onChange={handleInputChange}
      />
    </div>
  );
};