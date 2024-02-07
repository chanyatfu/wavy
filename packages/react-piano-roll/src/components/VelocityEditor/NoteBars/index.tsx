import useVelocityEditorMouseHandlers from "@/handlers/useVelocityEditorMouseHandlers";
import styles from "./index.module.scss";
import { useStore } from "@/index";
import { getOffsetXFromTick } from "@/helpers/conversion";
import { useScaleX } from "@/contexts/ScaleXProvider";
import useTheme from "@/hooks/useTheme";

type Props = {
  isDragging: boolean;
};
const NoteBars: React.FC<Props> = ({ isDragging }) => {
  const mouseHandlers = useVelocityEditorMouseHandlers();
  const { pianoRollStore } = useStore();
  const { notes } = pianoRollStore;
  const { scaleX } = useScaleX();
  const theme = useTheme();

  return (
    <div className={styles["note-bar-container"]} {...mouseHandlers}>
      {notes.map((note) => (
        <div
          key={note.id}
          className={styles["marker-container"]}
          style={
            {
              "--marker-left": `${getOffsetXFromTick(scaleX, note.tick)}px`,
              "--marker-top": `${1 - note.velocity / 128}`,
              "--marker-width": `${getOffsetXFromTick(scaleX, note.duration)}px`,
              "--marker-color": note.isSelected ? theme.note.noteBackgroundColor : theme.note.noteBackgroundColor,
              "--cursor": isDragging ? "grabbing" : "grab",
            } as React.CSSProperties
          }
          data-id={note.id}
          data-velocity={note.velocity}
        >
          <div className={styles["velocity-marker"]} />
          <div
            className={styles["length-marker"]}
            style={{
              outline: note.isSelected ? `3px solid #ffffff33` : "none",
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default NoteBars;
