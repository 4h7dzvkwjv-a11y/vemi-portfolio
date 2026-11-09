"use client";

import { analyzeV1WorkoutDefinition } from "@/lib/amv2/v1-compatibility.mjs";
import styles from "./amv2.module.css";

type V1ImportPanelProps = {
  workouts: readonly unknown[];
  history: readonly Readonly<{
    id: string;
    workoutName: string;
    completedAt: string;
    exerciseCount: number;
    exercises: ReadonlyArray<Readonly<{ name: string; group: string; details: string }>>;
    source: "V1";
  }>[];
  destinationOccupied: boolean;
  onImport: (workout: unknown) => void;
  onCancel: () => void;
};

export function V1ImportPanel({ workouts, history, destinationOccupied, onImport, onCancel }: V1ImportPanelProps) {
  return (
    <section className={styles.v1ImportPanel} aria-labelledby="amv2-v1-import-title">
      <div className={styles.addExercisesHeader}>
        <div><h2 id="amv2-v1-import-title">Copiază din V1</h2><p>Sursa rămâne neschimbată.</p></div>
        <button type="button" aria-label="Închide importul V1" onClick={onCancel}>×</button>
      </div>
      {destinationOccupied ? <p className={styles.capacityFullNotice}>Ziua selectată conține deja exerciții. Importul nu o suprascrie.</p> : null}
      <div className={styles.v1ImportList}>
        {workouts.length === 0 ? <p className={styles.catalogEmpty}>Nu există definiții V1 locale disponibile.</p> : workouts.map((workout, index) => {
          const record = workout as { id?: string; name?: string };
          const analysis = analyzeV1WorkoutDefinition(workout);
          const supported = analysis.unsupported.length === 0 && analysis.supported.length > 0;
          return (
            <article key={record.id ?? index}>
              <div><strong>{record.name ?? "Antrenament V1"}</strong><small>{supported ? `${analysis.supported.length} exerciții compatibile` : analysis.unsupported[0]}</small></div>
              <button type="button" disabled={!supported || destinationOccupied} onClick={() => onImport(workout)}>Copiază aici</button>
            </article>
          );
        })}
      </div>
      {history.length > 0 ? (
        <details className={styles.v1HistoryReadOnly}>
          <summary>Istoric V1 disponibil doar pentru consultare ({history.length})</summary>
          {history.map((entry) => (
            <p key={entry.id}>
              <strong>{entry.workoutName}</strong>
              <span>{new Date(entry.completedAt).toLocaleDateString("ro-RO")} · {entry.exerciseCount} exerciții</span>
              {entry.exercises.map((exercise, index) => (
                <small key={`${entry.id}-${index}`}>{exercise.name} · {exercise.details}</small>
              ))}
            </p>
          ))}
        </details>
      ) : null}
      <div className={styles.catalogSingleAction}><button type="button" onClick={onCancel}>Anulează</button></div>
    </section>
  );
}
