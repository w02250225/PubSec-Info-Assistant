import React, { useState, useEffect } from 'react';
import { Label, TextField } from "@fluentui/react";
import styles from "./ResponseTempSlider.module.css";
import { FiHelpCircle } from 'react-icons/fi'

interface Props {
  className?: string;
  onChange: (newValue: number) => void;
  value?: number;
}

const tooltipHtml = `
This parameter determines the creativity and diversity of the text generated by the GPT model.<br /><br />
A higher temperature value (e.g., 1.0) leads to more diverse and creative text, while a lower value
(e.g., 0.0) results in more focused and deterministic text.`;

export const ResponseTempSlider = ({ className, onChange, value }: Props) => {
  const [sliderValue, setSliderValue] = useState<number>(value || 0);
  const [inputValue, setInputValue] = useState<string>(value?.toFixed(2) || "0.00");

  const formatNumber = (num: number) => {
    return parseFloat(num.toFixed(4)).toString();
  };

  useEffect(() => {
    setInputValue(formatNumber(value || 0));
    setSliderValue(value || 0);
  }, [value]);

  const handleInputChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    setInputValue(newValue || "");
  };

  const handleInputBlur = (ev: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const regex = /^(\d+(\.\d{1,4})?)?$/;

    if (regex.test(inputValue)) {
      const newValue = parseFloat(inputValue);
      if (!isNaN(newValue) && newValue >= 0 && newValue <= 1) {
        setInputValue(formatNumber(newValue));
        setSliderValue(newValue);
        onChange(newValue);
      } else {
        setInputValue(formatNumber(sliderValue));
      }
    } else {
      setInputValue(formatNumber(sliderValue));
    }
  };

  const handleSliderChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(ev.target.value);
    setSliderValue(newValue);
    setInputValue(newValue.toFixed(2));  // slider produces 2 decimal place value
    onChange(newValue);
  };

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <Label>Response Temperature:&nbsp;
        <FiHelpCircle
          data-tooltip-id="ResponseTempSlider-tooltip"
          data-tooltip-html={tooltipHtml}
        />
      </Label>

      <TextField
        className={`${styles.responseTempValue}`}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />

      <input
        className={`${styles.tempSlider}`}
        type="range"
        value={sliderValue.toString()}
        step={0.01}
        min={0.00}
        max={1.00}
        onChange={handleSliderChange}
      />
    </div>
  );
};