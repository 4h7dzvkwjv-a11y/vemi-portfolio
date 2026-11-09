import type { WorkoutExercise } from "@/lib/amv2/draft-domain.mjs";
import type { WorkoutExerciseOccurrence } from "@/lib/amv2/workout-statistics.mjs";
import {
  ExerciseHistoryOccurrence,
  formatWorkoutHistoryDate,
} from "./exercise-history-occurrence";
import styles from "./amv2.module.css";

export function ExerciseRecentHistory({
  metricType,
  occurrences,
  complete = true,
}: {
  metricType: WorkoutExercise["metricType"];
  occurrences: readonly WorkoutExerciseOccurrence[];
  complete?: boolean;
}) {
  if (metricType === "total_duration") return null;

  return (
    <section className={styles.exerciseRecentHistory} aria-labelledby="amv2-recent-history-title">
      <header className={styles.exerciseRecentHistoryHeading}>
        <h3 id="amv2-recent-history-title">Ultimele 2 sesiuni</h3>
        <p>Istoricul recent al exercițiului</p>
      </header>

      {!complete ? (
        <p className={styles.exerciseRecentHistoryEmpty} role="status">Se sincronizează istoricul complet…</p>
      ) : occurrences.length > 0 ? (
        <div className={styles.exerciseRecentHistoryList}>
          {occurrences.map((occurrence) => (
            <article key={occurrence.date}>
              <h4>{formatWorkoutHistoryDate(occurrence.date)}</h4>
              <ExerciseHistoryOccurrence exercise={occurrence.exercise} />
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.exerciseRecentHistoryEmpty}>Nu există încă istoric pentru acest exercițiu.</p>
      )}
    </section>
  );
}
