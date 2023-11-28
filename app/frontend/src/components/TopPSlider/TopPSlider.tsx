import React, { useState, useEffect } from 'react';
import { Label, TextField } from "@fluentui/react";
import styles from "./TopPSlider.module.css";
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

export const TopPSlider = ({ className, onChange, value }: Props) => {
  const [sliderValue, setSliderValue] = useState<number>(value || 0);
  const [inputValue, setInputValue] = useState<string>(value?.toFixed(2) || "0.00");

  const formatNumber = (num: number) => {
    return parseFloat(num.toFixed(20)).toString();
  };

  useEffect(() => {
    setInputValue(formatNumber(value || 0));
    setSliderValue(value || 0);
  }, [value]);

  const handleInputChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    setInputValue(newValue || "");
  };

  const handleInputBlur = (ev: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const regex = /^(\d+(\.\d{1,20})?)?$/;

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
      <Label>Top P&nbsp;
        <FiHelpCircle
          data-tooltip-id="TopPSlider-tooltip"
          data-tooltip-html={tooltipHtml}
        />
      </Label>

      <TextField
        className={`${styles.topPValue}`}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />

      <input
        className={`${styles.topPSlider}`}
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