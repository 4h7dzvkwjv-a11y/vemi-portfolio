"use client";

import type { CSSProperties } from "react";
import type { WorkoutExercise } from "@/lib/amv2/draft-domain.mjs";
import type { WorkoutExerciseHistory } from "@/lib/amv2/workout-statistics.mjs";
import { ExerciseCategoryBadge } from "./exercise-visual-controls";
import {
  ExerciseHistoryOccurrence,
  formatWorkoutHistoryDate,
} from "./exercise-history-occurrence";
import { AnalyticsChevronLeft } from "./statistics-icons";
import styles from "./amv2.module.css";

const roShortDate = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short" });

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function formatShortDate(dateKey: string) {
  return roShortDate.format(dateFromKey(dateKey)).replace(/\.$/, ".");
}

function metricPresentation(metricType: WorkoutExercise["metricType"]) {
  if (metricType === "repetitions_weight") {
    return { latest: "Ultima greutate", best: "Record greutate", chart: "Evoluție greutate", suffix: "kg" };
  }
  if (metricType === "repetitions_only") {
    return { latest: "Ultime repetări", best: "Record repetări", chart: "Evoluție repetări", suffix: "rep." };
  }
  if (metricType === "time_per_set") {
    return { latest: "Ultimul timp", best: "Cel mai mare timp", chart: "Evoluție timp", suffix: "sec." };
  }
  return { latest: "Ultima durată", best: "Cea mai mare durată", chart: "Evoluție durată", suffix: "sec." };
}

function formatMetricValue(value: number, suffix: string) {
  return `${value} ${suffix}`;
}

function TrendChart({ history }: { history: WorkoutExerciseHistory }) {
  const points = history.trend;
  const max = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 150 : 12 + (index * 276) / (points.length - 1);
    const y = 68 - (point.value / max) * 52;
    return { ...point, x, y };
  });
  const grid = { gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(0, 1fr))` } as CSSProperties;

  return (
    <div className={styles.exerciseTrend}>
      <strong>{metricPresentation(history.metricType).chart}</strong>
      <svg viewBox="0 0 300 80" role="img" aria-label={`Evoluția pentru ${history.displayName}`}>
        {coordinates.length > 1 ? <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}
        {coordinates.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4" />)}
      </svg>
      <div className={styles.trendDates} style={grid}>
        {points.map((point) => <span key={point.date}>{formatShortDate(point.date)}</span>)}
      </div>
    </div>
  );
}

export function ExerciseHistoryView({
  history,
  complete = true,
  onBack,
}: {
  history: WorkoutExerciseHistory | null;
  complete?: boolean;
  onBack: () => void;
}) {
  const presentation = history ? metricPresentation(history.metricType) : null;

  return (
    <section className={styles.analyticsPage} aria-labelledby="amv2-history-title">
      <button className={styles.analyticsBack} type="button" onClick={onBack}>
        <AnalyticsChevronLeft /> Înapoi
      </button>
      {!complete || !history || !presentation ? (
        <>
          <h1 id="amv2-history-title">Istoric</h1>
          <section className={styles.analyticsSection} role="status" aria-live="polite">
            <p className={styles.analyticsEmpty}>{complete
              ? "Nu există încă istoric pentru acest exercițiu."
              : "Se sincronizează istoricul complet al exercițiului…"}</p>
          </section>
        </>
      ) : (
      <>
        <header className={styles.exerciseHistoryIdentity}>
          <h1 id="amv2-history-title">{history.displayName}</h1>
          <ExerciseCategoryBadge category={history.category} />
        </header>

        <div className={styles.exerciseHistorySummary}>
        <div><strong>{formatMetricValue(history.latestValue, presentation.suffix)}</strong><span>{presentation.latest}</span></div>
        <div><strong>{formatMetricValue(history.bestValue, presentation.suffix)}</strong><span>{presentation.best}</span></div>
        <div><strong>{formatShortDate(history.latestDate)}</strong><span>Ultima utilizare</span></div>
        </div>

        <TrendChart history={history} />

        <section className={styles.exerciseHistoryList} aria-labelledby="amv2-history-list-title">
        <h2 id="amv2-history-list-title">Istoric</h2>
        {history.occurrences.map((occurrence) => (
          <article key={occurrence.date}>
            <h3>{formatWorkoutHistoryDate(occurrence.date)}</h3>
            <ExerciseHistoryOccurrence exercise={occurrence.exercise} />
          </article>
        ))}
        </section>
      </>
      )}
    </section>
  );
}
