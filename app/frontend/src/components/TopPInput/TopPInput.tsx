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
Similar to temperature, this controls randomness but uses a different method.<br />
Lowering Top P will narrow the model's token selection to likelier tokens.<br />
Increasing Top P will let the model choose from tokens with both high and low likelihood.<br />
Try adjusting temperature or Top P but not both.`

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