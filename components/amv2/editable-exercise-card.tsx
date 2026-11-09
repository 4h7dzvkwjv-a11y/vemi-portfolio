"use client";

import { useState } from "react";
import type {
  RepetitionsOnlySet,
  RepetitionsWeightSet,
  TimePerSet,
  WorkoutExercise,
} from "@/lib/amv2/draft-domain.mjs";
import { getWorkoutExerciseTemplateKey } from "@/lib/amv2/draft-domain.mjs";
import {
  reduceWorkoutDayExercise,
  WorkoutDayDomainError,
} from "@/lib/amv2/workout-day-domain.mjs";
import {
  ExerciseCategoryBadge,
  ExerciseHistoryButton,
  ExerciseMediaControl,
} from "./exercise-visual-controls";
import { ExerciseRecentHistory } from "./exercise-recent-history";
import { MetricNumberField } from "./metric-number-field";
import type { WorkoutExerciseOccurrence } from "@/lib/amv2/workout-statistics.mjs";
import styles from "./amv2.module.css";

type EditableExerciseCardProps = {
  exercise: WorkoutExercise;
  mode: "new" | "existing";
  onSave: (exercise: WorkoutExercise) => void;
  onCancel: () => void;
  recentOccurrences: readonly WorkoutExerciseOccurrence[];
  recentHistoryComplete?: boolean;
  onOpenHistory?: (exercise: WorkoutExercise) => void;
  playableExerciseKeys: ReadonlySet<string>;
};

function makeLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function EditableExerciseCard({
  exercise,
  mode,
  onSave,
  onCancel,
  recentOccurrences,
  recentHistoryComplete = true,
  onOpenHistory,
  playableExerciseKeys,
}: EditableExerciseCardProps) {
  const [working, setWorking] = useState<WorkoutExercise>(exercise);
  const [reorderSetId, setReorderSetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const templateKey = getWorkoutExerciseTemplateKey(working);
  const playable = working.reference.source === "canonical"
    && templateKey !== null
    && playableExerciseKeys.has(templateKey);

  const apply = (action: Parameters<typeof reduceWorkoutDayExercise>[1]) => {
    try {
      setWorking((current) => reduceWorkoutDayExercise(current, action, new Date().toISOString()));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof WorkoutDayDomainError ? error.message : "Valoarea nu a putut fi actualizată.");
    }
  };

  return (
    <section className={styles.exerciseEditorShell} aria-labelledby="amv2-exercise-editor-title">
      <header className={styles.exerciseEditorHeader}>
        <ExerciseMediaControl
          exerciseKey={templateKey ?? ""}
          exerciseName={working.displayName}
          playable={playable}
        />
        <div className={styles.exerciseEditorIdentity}>
          <h2 id="amv2-exercise-editor-title">{working.displayName}</h2>
          <ExerciseCategoryBadge category={working.category} />
        </div>
        <ExerciseHistoryButton onClick={onOpenHistory ? () => onOpenHistory(working) : undefined} />
      </header>

      <div className={styles.exerciseEditorPanel}>
        {working.metricType === "total_duration" ? (
          <div className={styles.totalDurationEditor} role="group" aria-label={`Durată totală pentru ${working.displayName}`}>
            <span className={styles.totalDurationLabel}>Durată totală</span>
            <MetricNumberField
              value={working.targetTotalDurationSeconds}
              min={0}
              max={18_000}
              step={1}
              suffix="sec"
              label={`Durată totală pentru ${working.displayName}`}
              onCommit={(targetTotalDurationSeconds) => apply({ type: "update_total_duration_target", targetTotalDurationSeconds })}
              onInvalid={setMessage}
            />
          </div>
        ) : (
          <>
            <div
              className={`${styles.setGrid} ${working.metricType === "repetitions_weight"
                ? styles.setGridWeight
                : styles.setGridSingle}`}
              role="group"
              aria-label={`Serii pentru ${working.displayName}`}
            >
              <div className={styles.setLabels} aria-hidden="true">
                <span>Seria</span>
                {working.metricType === "repetitions_weight" ? (
                  <><span>Repetări</span><span>Greutate</span></>
                ) : working.metricType === "repetitions_only" ? (
                  <span>Repetări</span>
                ) : (
                  <span>Timp</span>
                )}
                <span />
              </div>

              {working.sets.map((set, index) => (
                <div className={styles.setRow} key={set.id} data-set-id={set.id}>
                  <div className={styles.seriesControl}>
                    <button
                      type="button"
                      className={styles.seriesNumber}
                      aria-label={`Seria ${index + 1}. Deschide comenzile de reordonare.`}
                      aria-expanded={reorderSetId === set.id}
                      onClick={() => setReorderSetId((current) => current === set.id ? null : set.id)}
                    >
                      {index + 1}
                    </button>
                    {reorderSetId === set.id ? (
                      <span className={styles.reorderPopover}>
                        <button
                          type="button"
                          aria-label={`Mută seria ${index + 1} în sus`}
                          disabled={index === 0}
                          onClick={() => {
                            apply({ type: "move_set", setId: set.id, toIndex: index - 1 });
                            setReorderSetId(null);
                          }}
                        >↑</button>
                        <button
                          type="button"
                          aria-label={`Mută seria ${index + 1} în jos`}
                          disabled={index === working.sets.length - 1}
                          onClick={() => {
                            apply({ type: "move_set", setId: set.id, toIndex: index + 1 });
                            setReorderSetId(null);
                          }}
                        >↓</button>
                      </span>
                    ) : null}
                  </div>

                  {working.metricType === "repetitions_weight" ? (
                    <>
                      <MetricNumberField
                        value={(set as RepetitionsWeightSet).targetRepetitions}
                        min={0}
                        max={100}
                        step={1}
                        label={`Repetări, seria ${index + 1}`}
                        onCommit={(targetRepetitions) => apply({ type: "update_set_targets", setId: set.id, targetRepetitions })}
                        onInvalid={setMessage}
                      />
                      <MetricNumberField
                        value={(set as RepetitionsWeightSet).targetWeightKg}
                        min={0}
                        max={500}
                        step={0.5}
                        suffix="kg"
                        label={`Greutate, seria ${index + 1}`}
                        onCommit={(targetWeightKg) => apply({ type: "update_set_targets", setId: set.id, targetWeightKg })}
                        onInvalid={setMessage}
                      />
                    </>
                  ) : working.metricType === "repetitions_only" ? (
                    <MetricNumberField
                      value={(set as RepetitionsOnlySet).targetRepetitions}
                      min={0}
                      max={100}
                      step={1}
                      label={`Repetări, seria ${index + 1}`}
                      onCommit={(targetRepetitions) => apply({ type: "update_set_targets", setId: set.id, targetRepetitions })}
                      onInvalid={setMessage}
                    />
                  ) : (
                    <MetricNumberField
                      value={(set as TimePerSet).targetDurationSeconds}
                      min={0}
                      max={3_600}
                      step={1}
                      suffix="sec"
                      label={`Timp, seria ${index + 1}`}
                      onCommit={(targetDurationSeconds) => apply({ type: "update_set_targets", setId: set.id, targetDurationSeconds })}
                      onInvalid={setMessage}
                    />
                  )}

                  <button
                    className={styles.removeSet}
                    type="button"
                    aria-label={`Elimină seria ${index + 1}`}
                    disabled={working.sets.length === 1}
                    onClick={() => apply({ type: "remove_set", setId: set.id })}
                  >×</button>
                </div>
              ))}
            </div>

            <button
              className={styles.addSet}
              type="button"
              disabled={working.sets.length >= 20}
              onClick={() => apply({ type: "add_set", setId: makeLocalId("amv2-day-set") })}
            >
              <span aria-hidden="true">+</span> Adaugă serie
            </button>
          </>
        )}

        {message ? <p className={styles.inlineError} role="alert">{message}</p> : null}

        <div className={styles.exerciseEditorActions}>
          <button type="button" onClick={onCancel}>Anulează</button>
          <button type="button" onClick={() => onSave(working)}>
            <span aria-hidden="true">✓</span>
            {mode === "new" ? "Adaugă" : "Salvează modificările"}
          </button>
        </div>
      </div>

      <ExerciseRecentHistory
        metricType={working.metricType}
        occurrences={recentOccurrences}
        complete={recentHistoryComplete}
      />
    </section>
  );
}
