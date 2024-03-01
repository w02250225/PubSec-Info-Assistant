import React, { useState, useEffect } from 'react';
import { Label, TextField } from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi'
import styles from "./TopPSlider.module.css";

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

export const TopPSlider = ({ className, onChange, value = 0 }: Props) => {
  const [sliderValue, setSliderValue] = useState<number>(value);
  const [displayValue, setDisplayValue] = useState<string>(value.toFixed(2));


  useEffect(() => {
    setSliderValue(value);
    setDisplayValue(value.toString()); // Keep the full precision when value is set from outside
  }, [value]);

  const updateValue = (newValue: number, fromSlider: boolean = false) => {
    const boundedValue = Math.max(0, Math.min(newValue, 1));
    setSliderValue(boundedValue);
    // If the update comes from the slider, round to 2 decimal places
    setDisplayValue(fromSlider ? boundedValue.toFixed(2) : newValue.toString());
    onChange(boundedValue);
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    updateValue(newValue, true);
  };

  const handleInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    if (newValue !== undefined) {
      setDisplayValue(newValue); // Just update the display value, do not round
    }
  };

  const handleInputBlur = () => {
    // When the input field loses focus, validate and potentially round the number
    let numericValue = parseFloat(displayValue);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 1) {
      numericValue = sliderValue; // Revert to the last valid value from the slider
    }
    updateValue(numericValue); // Do not round to 2 decimal places here
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
        id="topPSlider"
        className={`${styles.topPValue}`}
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />
      <input
        className={`${styles.topPSlider}`}
        type="range"
        value={sliderValue.toString()} // Convert to string for the input element
        step={0.01}
        min={0.00}
        max={1.00}
        onChange={handleSliderChange}
      />
    </div>
  );
};