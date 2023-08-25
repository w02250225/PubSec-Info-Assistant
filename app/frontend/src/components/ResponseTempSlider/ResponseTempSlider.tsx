import { Label } from "@fluentui/react";
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
(e.g., 0.0) results in more focused and deterministic text.`

export const ResponseTempSlider = ({ className, onChange, value }: Props) => {

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <Label>Response Temperature: 
        <FiHelpCircle
          data-tooltip-id="ResponseTempSlider-tooltip"
          data-tooltip-html={tooltipHtml}>
        </FiHelpCircle>
      </Label>

      <Label className={`${styles.responseTempValue}`}>{value?.toFixed(2)}</Label>
      <input
        className={`${styles.tempSlider}`}
        type="range"
        value={value}
        step={0.05}
        min={0.00}
        max={1.00}
        onChange={(_ev) => onChange(+_ev.target.value)}
      />
    </div>
  );
};