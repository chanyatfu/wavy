"use client";
import LaneGrids from "./LaneGrids";
import { defaultPianoRollTheme } from "@/store/pianoRollTheme";
import PianoRollThemeContext from "../contexts/piano-roll-theme-context";
import styles from "./index.module.scss";
import usePianoRollMouseHandlers from "../handlers/usePianoRollMouseHandlers";
import SelectionArea from "./SelectionMarquee";
import LanesBackground from "./LanesBackground";
import useStore from "../hooks/useStore";
import PianoKeyboard from "./PianoKeyboard";
import usePreventZoom from "../hooks/usePreventZoom";
import Ruler from "./Ruler";
import Notes from "./Notes";
import Playhead from "./Playhead";
import usePianoRollKeyboardHandlers from "../handlers/usePianoRollKeyboardHandlers";
import TempoInfo from "./TempoInfo";
import { usePianoRollDispatch } from "../hooks/usePianoRollDispatch";
import Selections from "./Selections";
import { CSSProperties, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TrackNoteEvent } from "@/types/TrackNoteEvent";
import VelocityEditor from "./VelocityEditor";
import SelectionBar from "./SelectionBar";

interface PianoRollProps {
  playheadPosition?: number;
  attachLyric?: boolean;
  initialScrollMiddleNote?: number;
  onSpace?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onNoteCreate?: (notes: TrackNoteEvent[]) => void;
  onNoteUpdate?: (notes: TrackNoteEvent[]) => void;
  onNoteSelect?: (notes: TrackNoteEvent[]) => void;
  staringTick?: number;
  endingTick?: number;
  style?: CSSProperties;
}
export default function PianoRoll({
  playheadPosition,
  attachLyric = false,
  initialScrollMiddleNote = 60,
  onSpace,
  style,
  staringTick = 200,
  endingTick = 480 * 4 * 8,
}: PianoRollProps) {
  const { pianoRollMouseHandlers, pianoRollMouseHandlersStates } = usePianoRollMouseHandlers();
  const pianoRollKeyboardHandlers = usePianoRollKeyboardHandlers();
  const { pianoRollStore } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect(() => {
  //   dispatch({ type: "SET_CLIP_SPAN", payload: { startingTick: staringTick, endingTick: endingTick } });
  // });

  usePreventZoom();
  const dispatch = usePianoRollDispatch();
  useScrollToNote(containerRef, initialScrollMiddleNote);

  // useEffect(() => {
  //   dispatch({ type: "SET_CLIP_SPAN", payload: { startingTick: staringTick, endingTick: endingTick } });
  // }, []);

  return (
    <PianoRollThemeContext.Provider value={defaultPianoRollTheme()}>
      <div
        className={styles["container"]}
        ref={containerRef}
        style={
          {
            "--canvas-width": `${pianoRollStore.laneLength * pianoRollStore.pianoLaneScaleX}px`,
            "--canvas-height": `${pianoRollStore.canvasHeight}px`,
            ...style,
          } as React.CSSProperties
        }
        tabIndex={0}
      >
        <div className={styles["upper-container"]} onClick={(event) => console.log(event.clientX)}>
          <TempoInfo />
          <div>
            <Ruler />
            <SelectionBar />
          </div>
        </div>
        <div className={styles["middle-container"]}>
          <PianoKeyboard />
          <div className={styles["lane-container"]}>
            <div
              className={styles["pianoroll-lane"]}
              {...pianoRollMouseHandlers}
              tabIndex={0}
              {...pianoRollKeyboardHandlers}
            >
              <LaneGrids />
              <Selections />
              <Notes attachLyric={attachLyric} />
              <SelectionArea mouseHandlersStates={pianoRollMouseHandlersStates} />
              {playheadPosition !== undefined && <Playhead playheadPosition={playheadPosition} />}
              <div
                style={{
                  position: "absolute",
                  inset: "0",
                  width: "100%",
                  height: "100%",
                }}
              />
              <LanesBackground />
            </div>
          </div>
        </div>
        <div className={styles["lower-container"]}>
          <VelocityEditor />
        </div>
      </div>
    </PianoRollThemeContext.Provider>
  );
}

function useScrollToNote(containerRef: React.RefObject<HTMLElement>, initialScrollMiddleNote: number) {
  if (initialScrollMiddleNote < 0 || initialScrollMiddleNote > 127) {
    initialScrollMiddleNote = 60;
  }
  const [scrolled, setScrolled] = useState(false);
  useLayoutEffect(() => {
    if (scrolled || !containerRef.current) {
      return;
    }
    const keyElement = document.querySelector(`[data-keynum="${initialScrollMiddleNote}"]`) as HTMLDivElement;
    const keyTop = keyElement.getBoundingClientRect().top;
    containerRef.current?.scrollBy(0, keyTop);
    setScrolled(true);
  }, [containerRef]);
}
