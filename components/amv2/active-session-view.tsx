"use client";

import { useState } from "react";
import type { SessionAction, WorkoutSession } from "@/lib/amv2/session-domain.mjs";
import { MetricNumberField } from "./metric-number-field";
import styles from "./amv2.module.css";

type SessionActionWithoutTimestamp = SessionAction extends infer Action
  ? Action extends SessionAction
    ? Omit<Action, "updatedAt">
    : never
  : never;

type ActiveSessionViewProps = {
  session: WorkoutSession;
  message: string | null;
  onUpdate: (action: SessionActionWithoutTimestamp) => void;
  onFinish: () => void;
  onAbandon: () => void;
  onBackToCreator: () => void;
  onInvalid: (message: string) => void;
};

const formatStartedAt = (value: string) => new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

export function ActiveSessionView({
  session,
  message,
  onUpdate,
  onFinish,
  onAbandon,
  onBackToCreator,
  onInvalid,
}: ActiveSessionViewProps) {
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false);

  return (
    <main className={styles.main} data-amv2-view="active-session">
      <section className={styles.sessionHero}>
        <span className={styles.eyebrow}>Antrenament activ</span>
        <h1>{session.workoutName}</h1>
        <p>Început {formatStartedAt(session.startedAt)} · valorile efective se salvează local.</p>
      </section>

      <section className={styles.sessionExerciseList} aria-label="Exercițiile sesiunii active">
        {session.exercises.map((exercise, exerciseIndex) => (
          <article
            className={styles.sessionExerciseCard}
            key={exercise.id}
            data-session-exercise={exercise.reference.exerciseKey}
            data-metric-type={exercise.metricType}
          >
            <header className={styles.sessionExerciseHeader}>
              <span>{String(exerciseIndex + 1).padStart(2, "0")}</span>
              <div>
                <h2>{exercise.displayName}</h2>
                <small>{exercise.category}</small>
              </div>
            </header>

            {exercise.metricType === "total_duration" ? (
              <div className={styles.sessionTotalDuration}>
                <div>
                  <strong>Durată totală</strong>
                  <small>Țintă: {exercise.targetTotalDurationSeconds} secunde</small>
                </div>
                <MetricNumberField
                  value={exercise.actualTotalDurationSeconds}
                  min={0}
                  max={18_000}
                  step={1}
                  suffix="secunde"
                  label={`Durată efectivă pentru ${exercise.displayName}`}
                  onCommit={(actualTotalDurationSeconds) => onUpdate({
                    type: "update_total_duration_actual",
                    exerciseId: exercise.id,
                    actualTotalDurationSeconds,
                  })}
                  onInvalid={onInvalid}
                />
              </div>
            ) : (
              <div
                className={`${styles.sessionSetGrid} ${exercise.metricType === "repetitions_weight"
                  ? styles.sessionSetGridWeight
                  : styles.sessionSetGridSingle}`}
              >
                <div className={styles.sessionSetLabels} aria-hidden="true">
                  <span>Seria</span>
                  {exercise.metricType === "repetitions_weight" ? (
                    <><span>Repetări</span><span>Greutate</span></>
                  ) : exercise.metricType === "repetitions_only" ? (
                    <span>Repetări</span>
                  ) : exercise.metricType === "time_per_set" ? (
                    <span>Timp</span>
                  ) : null}
                </div>
                {exercise.sets.map((set, setIndex) => (
                  <div className={styles.sessionSetRow} key={set.id}>
                    <strong>{setIndex + 1}</strong>
                    {exercise.metricType === "repetitions_weight" ? (
                      <>
                        <div className={styles.sessionActualField}>
                          <MetricNumberField
                            value={set.actualRepetitions}
                            min={0}
                            max={100}
                            step={1}
                            label={`Repetări efective, ${exercise.displayName}, seria ${setIndex + 1}`}
                            onCommit={(actualRepetitions) => onUpdate({
                              type: "update_set_actuals",
                              exerciseId: exercise.id,
                              setId: set.id,
                              actualRepetitions,
                            })}
                            onInvalid={onInvalid}
                          />
                          <small>Țintă {set.targetRepetitions}</small>
                        </div>
                        <div className={styles.sessionActualField}>
                          <MetricNumberField
                            value={set.actualWeightKg}
                            min={0}
                            max={500}
                            step={0.5}
                            suffix="kg"
                            label={`Greutate efectivă, ${exercise.displayName}, seria ${setIndex + 1}`}
                            onCommit={(actualWeightKg) => onUpdate({
                              type: "update_set_actuals",
                              exerciseId: exercise.id,
                              setId: set.id,
                              actualWeightKg,
                            })}
                            onInvalid={onInvalid}
                          />
                          <small>Țintă {set.targetWeightKg} kg</small>
                        </div>
                      </>
                    ) : exercise.metricType === "repetitions_only" ? (
                      <div className={styles.sessionActualField}>
                        <MetricNumberField
                          value={set.actualRepetitions}
                          min={0}
                          max={100}
                          step={1}
                          label={`Repetări efective, ${exercise.displayName}, seria ${setIndex + 1}`}
                          onCommit={(actualRepetitions) => onUpdate({
                            type: "update_set_actuals",
                            exerciseId: exercise.id,
                            setId: set.id,
                            actualRepetitions,
                          })}
                          onInvalid={onInvalid}
                        />
                        <small>Țintă {set.targetRepetitions}</small>
                      </div>
                    ) : exercise.metricType === "time_per_set" ? (
                      <div className={styles.sessionActualField}>
                        <MetricNumberField
                          value={set.actualDurationSeconds}
                          min={0}
                          max={3_600}
                          step={1}
                          suffix="secunde"
                          label={`Timp efectiv, ${exercise.displayName}, seria ${setIndex + 1}`}
                          onCommit={(actualDurationSeconds) => onUpdate({
                            type: "update_set_actuals",
                            exerciseId: exercise.id,
                            setId: set.id,
                            actualDurationSeconds,
                          })}
                          onInvalid={onInvalid}
                        />
                        <small>Țintă {set.targetDurationSeconds} sec</small>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <p className={`${styles.feedback} ${message ? styles.validationMessage : ""}`} aria-live="polite">
        {message ?? "Poți lăsa seriile neexecutate la zero. Cel puțin o execuție reală este necesară pentru finalizare."}
      </p>

      <button className={styles.finishWorkout} type="button" onClick={onFinish}>
        <span aria-hidden="true">✓</span> Încheie antrenamentul
      </button>
      <button className={styles.secondaryAction} type="button" onClick={onBackToCreator}>
        Înapoi la Creator
      </button>
      <button className={styles.abandonAction} type="button" onClick={() => setAbandonConfirmOpen(true)}>
        Abandonează antrenamentul
      </button>

      {abandonConfirmOpen ? (
        <section className={styles.confirmPanel} role="alertdialog" aria-labelledby="amv2-abandon-title">
          <h2 id="amv2-abandon-title">Abandonezi antrenamentul?</h2>
          <p>Progresul tehnic rămâne local, dar sesiunea nu va apărea în istoricul finalizat.</p>
          <div>
            <button type="button" onClick={() => setAbandonConfirmOpen(false)}>Continuă antrenamentul</button>
            <button type="button" onClick={onAbandon}>Da, abandonează</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
