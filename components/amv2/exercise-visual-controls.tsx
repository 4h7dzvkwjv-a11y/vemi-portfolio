import type { CSSProperties } from "react";
import { ExerciseVideo } from "@/components/exercise-video";
import { getAmv2CategoryPresentation } from "@/lib/amv2/category-presentation.mjs";
import styles from "./amv2.module.css";

type ExerciseMediaControlProps = {
  exerciseKey: string;
  exerciseName: string;
  playable: boolean;
};

export function ExerciseMediaControl({ exerciseKey, exerciseName, playable }: ExerciseMediaControlProps) {
  if (playable) {
    return (
      <ExerciseVideo
        exerciseKey={exerciseKey}
        exerciseName={exerciseName}
        className={styles.exerciseMediaPlay}
      />
    );
  }

  return (
    <span className={styles.exerciseMediaGeneric} aria-hidden="true">
      <svg className={styles.movementGlyph} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="4.5" r="2.25" fill="currentColor" />
        <path d="M12 8v5.2m0-3.3L7.7 12m4.3-2.1 4.3 2.1M12 13.2l-3.3 6M12 13.2l3.8 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ExerciseHistoryButton({ onClick }: { onClick?: () => void }) {
  const disabled = typeof onClick !== "function";
  return (
    <button
      className={styles.historyPlaceholder}
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
    >
      <svg className={styles.historyIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8V4m0 4h4" />
        <path d="M4.9 7.1A8 8 0 1 1 4 14" />
        <path d="M12 7.5V12l3 1.8" />
      </svg>
      Istoric
    </button>
  );
}

export function ExerciseCategoryBadge({ category }: { category: string }) {
  const theme = getAmv2CategoryPresentation(category);
  const variables = {
    "--amv2-category-surface": theme.surface,
    "--amv2-category-ink": theme.ink,
  } as CSSProperties;
  return <span className={styles.exerciseCategoryBadge} style={variables}>{category}</span>;
}
