import { useRef, useState } from "react";
import { PianoRollNote } from "@/types/PianoRollNote";
import _ from "lodash";
import { getGridOffsetOfTick, getNearestAnchor, getNearestGridTick, getTickInGrid } from "@/helpers/grid";
import {
  getNoteNumFromOffsetY,
  getTickFromOffsetX,
  isNoteLeftMarginClicked,
  isNoteRightMarginClicked,
} from "@/helpers/conversion";
import { useConfig } from "@/contexts/PianoRollConfigProvider";
import { useScaleX } from "@/contexts/ScaleXProvider";
import { getNoteObjectFromEvent, getRelativeX, getRelativeY } from "@/helpers/event";
import { useAtomValue, useSetAtom } from "jotai";
import { modifyingNotesAtom, notesAtom } from "@/store/note";
import {
  noteModificationBufferAtom,
  setNoteModificationBufferWithAllNotesAtom,
  setNoteModificationBufferWithSelectedNotesAtom,
} from "@/store/note-modification-buffer";
import { selectionTicksAtom } from "@/store/selection-ticks";
import { lastModifiedDurationAtom } from "@/store/last-modified";
import { useEventListener } from "@/hooks/useEventListener";

export enum PianoRollLanesMouseHandlerMode {
  DragAndDrop,
  MarqueeSelection,
  NotesTrimming,
  NotesExtending,
  Vibrato,
  Velocity,
  None,
}

export enum DraggingGuardMode {
  UnderThreshold,
  FineTune,
  SnapToGrid,
}

export type PianoRollMouseHandlersStates = {
  mouseHandlerMode: PianoRollLanesMouseHandlerMode;
  startingPosition: { x: number; y: number };
  ongoingPosition: { x: number; y: number };
};

export type NotesModificationBuffer = {
  notesSelected: PianoRollNote[];
  initY: number;
  initX: number;
};

export function useNoteCreationAndModificationGesture(ref: React.RefObject<HTMLElement>) {
  const notes = useAtomValue(notesAtom);
  const noteModificationBuffer = useAtomValue(noteModificationBufferAtom);

  const setSelectionTicks = useSetAtom(selectionTicksAtom);
  const setNoteModificationBufferWithSelectedNotes = useSetAtom(setNoteModificationBufferWithSelectedNotesAtom);
  const setNoteModificationBufferWithAllNotes = useSetAtom(setNoteModificationBufferWithAllNotesAtom);
  const setLastModifiedDuration = useSetAtom(lastModifiedDurationAtom);
  const modifyingNotes = useSetAtom(modifyingNotesAtom);

  const { scaleX } = useScaleX();
  const { numOfKeys } = useConfig().pitchRange;

  const [mouseHandlerMode, setMouseHandlerMode] = useState(PianoRollLanesMouseHandlerMode.None);
  const guardActive = useRef(DraggingGuardMode.UnderThreshold);

  const currentPointerPos = useRef({ clientX: 0, clientY: 0 });

  useEventListener(ref, "pointerdown", (event: PointerEvent) => {
    guardActive.current = DraggingGuardMode.UnderThreshold;
    const relativeX = getRelativeX(event);
    const relativeY = getRelativeY(event);

    const noteClicked = getNoteObjectFromEvent(notes, event);
    if (noteClicked) {
      setSelectionTicks(noteClicked.tick);
      setMouseHandlerModeForNote(event, noteClicked);
      setNoteModificationBufferWithSelectedNotes({ initX: relativeX, initY: relativeY });
    } else {
      const selectionTicks = getTickFromOffsetX(scaleX, relativeX);
      const snappedSelection = getNearestGridTick(scaleX, selectionTicks);
      setSelectionTicks(snappedSelection);
      setNoteModificationBufferWithAllNotes({ initX: relativeX, initY: relativeY });
    }
  });

  useEventListener(ref, "pointermove", (event: PointerEvent) => {
    const relativeX = getRelativeX(event);
    const relativeY = getRelativeY(event);
    const bufferedNotes = noteModificationBuffer.notesSelected;
    const deltaY = relativeY - noteModificationBuffer.initY;
    const deltaX = relativeX - noteModificationBuffer.initX;
    const deltaTicks = getTickFromOffsetX(scaleX, deltaX);
    const deltaPitch =
      getNoteNumFromOffsetY(numOfKeys, relativeY) - getNoteNumFromOffsetY(numOfKeys, noteModificationBuffer.initY);

    currentPointerPos.current = { clientX: event.clientX, clientY: event.clientY };
    if (Math.abs(deltaTicks) > getTickInGrid(scaleX)) {
      guardActive.current = DraggingGuardMode.SnapToGrid;
    } else if (Math.abs(deltaTicks) > 96 && guardActive.current < DraggingGuardMode.FineTune) {
      guardActive.current = DraggingGuardMode.FineTune;
    }

    const noteClicked = _.last(bufferedNotes);
    switch (mouseHandlerMode) {
      case PianoRollLanesMouseHandlerMode.NotesTrimming: {
        let newNotes;
        if (guardActive.current === DraggingGuardMode.SnapToGrid) {
          const anchor = getNearestAnchor(
            Math.min(noteClicked!.tick + noteClicked!.duration - 1, noteClicked!.tick + deltaTicks),
            scaleX,
            getGridOffsetOfTick(noteClicked!.tick, scaleX),
          );
          if (anchor.proximity) {
            newNotes = bufferedNotes.map((bufferedNote) => ({
              ...bufferedNote,
              tick: anchor.anchor - _.last(bufferedNotes)!.tick + bufferedNote.tick,
              duration:
                bufferedNote.duration +
                (bufferedNote.tick - (anchor.anchor - _.last(bufferedNotes)!.tick + bufferedNote.tick)),
            }));
            setLastModifiedDuration(
              _.last(bufferedNotes)!.duration +
                (_.last(bufferedNotes)!.tick -
                  (anchor.anchor - _.last(bufferedNotes)!.tick + _.last(bufferedNotes)!.tick)),
            );
          } else {
            return;
          }
        } else if (guardActive.current === DraggingGuardMode.FineTune) {
          newNotes = bufferedNotes.map((bufferedNote) => ({
            ...bufferedNote,
            tick: Math.min(bufferedNote.tick + bufferedNote.duration - 1, bufferedNote.tick + deltaTicks),
            duration: bufferedNote.duration - deltaTicks,
          }));
          setLastModifiedDuration(_.last(bufferedNotes)!.duration - deltaTicks);
        } else {
          newNotes = bufferedNotes;
        }
        if (guardActive.current) {
          setSelectionTicks(_.last(newNotes)!.tick);
        }
        modifyingNotes(newNotes);
        break;
      }
      case PianoRollLanesMouseHandlerMode.NotesExtending: {
        let newNotes;
        if (guardActive.current === DraggingGuardMode.SnapToGrid) {
          const anchor = getNearestAnchor(
            noteClicked!.tick + noteClicked!.duration + deltaTicks,
            scaleX,
            getGridOffsetOfTick(noteClicked!.tick + noteClicked!.duration, scaleX),
          );
          if (anchor.proximity) {
            newNotes = bufferedNotes.map((bufferedNote) => ({
              ...bufferedNote,
              duration:
                anchor.anchor - _.last(bufferedNotes)!.tick - _.last(bufferedNotes)!.duration + bufferedNote.duration,
            }));
            setLastModifiedDuration(
              anchor.anchor -
                _.last(bufferedNotes)!.tick -
                _.last(bufferedNotes)!.duration +
                _.last(bufferedNotes)!.duration,
            );
          } else {
            return;
          }
        } else if (guardActive.current === DraggingGuardMode.FineTune) {
          newNotes = bufferedNotes.map((bufferedNote) => ({
            ...bufferedNote,
            duration: bufferedNote.duration + deltaTicks,
          }));
          setLastModifiedDuration(_.last(bufferedNotes)!.duration + deltaTicks);
        } else {
          newNotes = bufferedNotes;
          setLastModifiedDuration(_.last(bufferedNotes)!.duration);
        }
        if (guardActive.current) {
          setSelectionTicks(Math.max(_.last(newNotes)!.tick + _.last(newNotes)!.duration, _.last(newNotes)!.tick));
        }
        modifyingNotes(newNotes);
        break;
      }
      case PianoRollLanesMouseHandlerMode.DragAndDrop:
        {
          let newNotes;
          if (guardActive.current === DraggingGuardMode.SnapToGrid) {
            const anchor = getNearestAnchor(
              noteClicked!.tick + deltaTicks,
              scaleX,
              getGridOffsetOfTick(noteClicked!.tick, scaleX),
            );
            if (anchor.proximity) {
              newNotes = bufferedNotes.map((bufferedNote) => ({
                ...bufferedNote,
                noteNumber: bufferedNote.noteNumber + deltaPitch,
                tick: anchor.anchor - _.last(bufferedNotes)!.tick + bufferedNote.tick,
              }));
            } else {
              return;
            }
          } else if (guardActive.current === DraggingGuardMode.FineTune) {
            newNotes = bufferedNotes.map((bufferedNote) => ({
              ...bufferedNote,
              noteNumber: bufferedNote.noteNumber + deltaPitch,
              tick: bufferedNote.tick + deltaTicks,
            }));
          } else {
            newNotes = bufferedNotes.map((bufferedNote) => ({
              ...bufferedNote,
              noteNumber: bufferedNote.noteNumber + deltaPitch,
            }));
          }
          if (guardActive.current) {
            setSelectionTicks(_.last(newNotes)!.tick);
          }
          modifyingNotes(newNotes);
          break;
        }
        break;
    }
  });

  useEventListener(ref, "pointerup", () => {
    setMouseHandlerMode(PianoRollLanesMouseHandlerMode.None);
  });

  const setMouseHandlerModeForNote = (event: PointerEvent, noteClicked: PianoRollNote) => {
    const relativeX = getRelativeX(event);
    const relativeY = getRelativeY(event);
    if (isNoteRightMarginClicked(numOfKeys, scaleX, noteClicked!, [relativeX, relativeY])) {
      setSelectionTicks(noteClicked.tick + noteClicked.duration);
      // dispatch({ type: "SET_SELECTION_TICKS", payload: { ticks: noteClicked.tick + noteClicked.duration } });
      setMouseHandlerMode(PianoRollLanesMouseHandlerMode.NotesExtending);
    } else if (
      isNoteLeftMarginClicked(numOfKeys, scaleX, noteClicked!, {
        x: relativeX,
        y: relativeY,
      })
    ) {
      setMouseHandlerMode(PianoRollLanesMouseHandlerMode.NotesTrimming);
    } else if (event.altKey) {
      setMouseHandlerMode(PianoRollLanesMouseHandlerMode.Vibrato);
    } else if (event.metaKey) {
      setMouseHandlerMode(PianoRollLanesMouseHandlerMode.Velocity);
    } else {
      setMouseHandlerMode(PianoRollLanesMouseHandlerMode.DragAndDrop);
    }
  };
}
