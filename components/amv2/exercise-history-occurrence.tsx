import type {
  RepetitionsOnlySet,
  RepetitionsWeightSet,
  TimePerSet,
  WorkoutExercise,
} from "@/lib/amv2/draft-domain.mjs";
import styles from "./amv2.module.css";

const roDate = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" });

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function formatWorkoutHistoryDate(dateKey: string) {
  return roDate.format(dateFromKey(dateKey));
}

export function ExerciseHistoryOccurrence({ exercise }: { exercise: WorkoutExercise }) {
  if (exercise.metricType === "total_duration") {
    return (
      <div className={styles.historyTotalDuration}>
        <span>Durată totală</span>
        <strong>{exercise.targetTotalDurationSeconds} secunde</strong>
      </div>
    );
  }

  return (
    <div className={`${styles.historyMetricTable} ${exercise.metricType === "repetitions_weight" ? styles.historyMetricWeight : ""}`}>
      <div className={styles.historyMetricLabels} aria-hidden="true">
        <span>Seria</span>
        <span>{exercise.metricType === "time_per_set" ? "Timp" : "Repetări"}</span>
        {exercise.metricType === "repetitions_weight" ? <span>Greutate</span> : null}
      </div>
      {exercise.sets.map((set, index) => (
        <div className={styles.historyMetricRow} key={set.id}>
          <strong>{index + 1}</strong>
          {exercise.metricType === "repetitions_weight" ? (
            <>
              <span>{(set as RepetitionsWeightSet).targetRepetitions} repetări</span>
              <span>{(set as RepetitionsWeightSet).targetWeightKg} kg</span>
            </>
          ) : exercise.metricType === "repetitions_only" ? (
            <span>{(set as RepetitionsOnlySet).targetRepetitions} repetări</span>
          ) : (
            <span>{(set as TimePerSet).targetDurationSeconds} secunde</span>
          )}
        </div>
      ))}
    </div>
  );
}
