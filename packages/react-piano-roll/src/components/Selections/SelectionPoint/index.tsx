import useStore from "@/hooks/useStore";
import styles from "./index.module.scss";
import { basePixelsPerTick } from "@/constants";
import { baseCanvasHeight } from "@/helpers/conversion";
import { useConfig } from "@/contexts/PianoRollConfigProvider";

export default function SelectionPoint() {
  const { pianoRollStore } = useStore();
  const { numOfKeys } = useConfig().pitchRange;
  const x = pianoRollStore.selectionTicks * basePixelsPerTick * pianoRollStore.pianoLaneScaleX;

  return (
    <svg
      className={styles["selection--point"]}
      aria-label="pianoroll-grids"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <line x1={x} y1={0} x2={x} y2={baseCanvasHeight(numOfKeys)} stroke="#ffffff22" strokeWidth="1" />
    </svg>
  );
}
