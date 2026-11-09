"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import type {
  RepetitionsOnlySet,
  RepetitionsWeightSet,
  TimePerSet,
  WorkoutExercise,
} from "@/lib/amv2/draft-domain.mjs";
import {
  getWorkoutExerciseIdentity,
  getWorkoutExerciseTemplateKey,
} from "@/lib/amv2/draft-domain.mjs";
import { getAmv2CategoryPresentation } from "@/lib/amv2/category-presentation.mjs";
import {
  ExerciseCategoryBadge,
  ExerciseHistoryButton,
  ExerciseMediaControl,
} from "./exercise-visual-controls";
import styles from "./amv2.module.css";

type WorkoutDayExerciseCardProps = {
  exercise: WorkoutExercise;
  onEdit: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
  playableExerciseKeys: ReadonlySet<string>;
};

const repetitionsCopy = (value: number) => value === 1 ? "1 repetare" : `${value} repetări`;

export function WorkoutDayExerciseCard({
  exercise,
  onEdit,
  onDelete,
  onOpenHistory,
  playableExerciseKeys,
}: WorkoutDayExerciseCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const templateKey = getWorkoutExerciseTemplateKey(exercise);
  const categoryTheme = getAmv2CategoryPresentation(exercise.category);
  const accent = { "--amv2-card-accent": categoryTheme.dot } as CSSProperties;
  const playable = exercise.reference.source === "canonical"
    && templateKey !== null
    && playableExerciseKeys.has(templateKey);

  return (
    <article
      className={styles.loggedExerciseCard}
      data-exercise-key={getWorkoutExerciseIdentity(exercise) ?? undefined}
      style={accent}
    >
      <i className={styles.loggedExerciseAccent} aria-hidden="true" />
      <header className={styles.loggedExerciseHeader}>
        <ExerciseMediaControl
          exerciseKey={templateKey ?? ""}
          exerciseName={exercise.displayName}
          playable={playable}
        />
        <div className={styles.loggedExerciseIdentity}>
          <strong>{exercise.displayName}</strong>
          <ExerciseCategoryBadge category={exercise.category} />
        </div>
        <ExerciseHistoryButton onClick={onOpenHistory} />
      </header>

      {exercise.metricType === "total_duration" ? (
        <div className={styles.loggedTotalDuration}>
          <span>Durată totală</span>
          <strong>{exercise.targetTotalDurationSeconds} secunde</strong>
        </div>
      ) : (
        <div className={`${styles.loggedValues} ${exercise.metricType === "repetitions_weight" ? styles.loggedValuesWeight : ""}`}>
          <div className={styles.loggedValueLabels} aria-hidden="true">
            <span>Seria</span>
            <span>{exercise.metricType === "time_per_set" ? "Timp" : "Repetări"}</span>
            {exercise.metricType === "repetitions_weight" ? <span>Greutate</span> : null}
          </div>
          {exercise.sets.map((set, index) => (
            <div className={styles.loggedValueRow} key={set.id}>
              <strong>{index + 1}</strong>
              {exercise.metricType === "repetitions_weight" ? (
                <>
                  <span>{repetitionsCopy((set as RepetitionsWeightSet).targetRepetitions)}</span>
                  <span>{(set as RepetitionsWeightSet).targetWeightKg} kg</span>
                </>
              ) : exercise.metricType === "repetitions_only" ? (
                <span>{repetitionsCopy((set as RepetitionsOnlySet).targetRepetitions)}</span>
              ) : (
                <span>{(set as TimePerSet).targetDurationSeconds} secunde</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.loggedExerciseFooter}>
        {confirmDelete ? (
          <div className={styles.deleteConfirmation} role="group" aria-label={`Confirmă ștergerea ${exercise.displayName}`}>
            <span>Elimini exercițiul din această zi?</span>
            <button type="button" onClick={() => setConfirmDelete(false)}>Anulează</button>
            <button type="button" onClick={onDelete}>Confirmă</button>
          </div>
        ) : (
          <>
            <button className={styles.editExercise} type="button" onClick={onEdit}>
              <span aria-hidden="true">✎</span> Modifică
            </button>
            <button className={styles.deleteExercise} type="button" onClick={() => setConfirmDelete(true)}>Șterge</button>
          </>
        )}
      </div>
    </article>
  );
}
