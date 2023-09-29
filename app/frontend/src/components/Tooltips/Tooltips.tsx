import styles from "./Tooltips.module.css"
import { Tooltip as ReactTooltip } from "react-tooltip"

export const Tooltips = () => {

  return (
    <>
    <ReactTooltip
      id="ResponseTempSlider-tooltip"
      className={`${styles.tooltip}`}
      place="left"
      variant="info" />
    <ReactTooltip
      id="ResponseLength-tooltip"
      className={`${styles.tooltip}`}
      place="left"
      variant="info" />
      <ReactTooltip
        id="PromptOverride-tooltip"
        className={`${styles.tooltip}`}
        place="left"
        variant="info" />
    </>
  );
};