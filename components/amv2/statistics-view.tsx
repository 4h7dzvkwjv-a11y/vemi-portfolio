"use client";

import type { CSSProperties } from "react";
import type { WorkoutStatistics } from "@/lib/amv2/workout-statistics.mjs";
import { getAmv2CategoryPresentation } from "@/lib/amv2/category-presentation.mjs";
import { ExerciseCategoryBadge } from "./exercise-visual-controls";
import { AnalyticsChevronLeft, AnalyticsChevronRight } from "./statistics-icons";
import styles from "./amv2.module.css";

function formatFrequency(value: number) {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(value);
}

export function StatisticsView({
  statistics,
  complete = true,
  onBack,
  onOpenExercise,
}: {
  statistics: WorkoutStatistics;
  complete?: boolean;
  onBack: () => void;
  onOpenExercise: (identity: string) => void;
}) {
  const maxWeek = Math.max(1, ...statistics.recentWeeks.map((week) => week.dayCount));

  return (
    <section className={styles.analyticsPage} aria-labelledby="amv2-statistics-title">
      <button className={styles.analyticsBack} type="button" onClick={onBack}>
        <AnalyticsChevronLeft /> Înapoi
      </button>
      <h1 id="amv2-statistics-title">Statistici</h1>

      {!complete ? (
        <section className={styles.analyticsSection} role="status" aria-live="polite">
          <p className={styles.analyticsEmpty}>Se sincronizează istoricul complet al contului…</p>
        </section>
      ) : (
      <>

      <section className={styles.analyticsSection} aria-labelledby="amv2-summary-title">
        <h2 id="amv2-summary-title">Rezumat</h2>
        <div className={styles.statisticsSummary}>
          <div><strong>{statistics.activeDays}</strong><span>Zile active</span></div>
          <div><strong>{formatFrequency(statistics.averageWeeklyFrequency)}×</strong><span>Pe săptămână</span></div>
          <div><strong>{statistics.activeWeeks}</strong><span>Săptămâni active</span></div>
        </div>
      </section>

      <section className={styles.analyticsSection} aria-labelledby="amv2-activity-title">
        <h2 id="amv2-activity-title">Activitate</h2>
        <div className={styles.activityChart} aria-label="Zile active în ultimele patru săptămâni">
          {statistics.recentWeeks.map((week) => (
            <div className={styles.activityColumn} key={week.id} title={`${week.dayCount} zile active`}>
              <span style={{ height: `${Math.max(4, (week.dayCount / maxWeek) * 80)}px` }} />
              <small>{week.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.analyticsSection} aria-labelledby="amv2-groups-title">
        <h2 id="amv2-groups-title">Grupe lucrate</h2>
        <div className={styles.workedGroups}>
          {statistics.groups.length > 0 ? statistics.groups.map((group) => {
            const theme = getAmv2CategoryPresentation(group.category);
            const variables = {
              "--amv2-group-color": theme.dot,
              "--amv2-group-surface": theme.surface,
              "--amv2-group-width": `${group.percentage}%`,
            } as CSSProperties;
            return (
              <div className={styles.workedGroup} key={group.category} style={variables}>
                <div><ExerciseCategoryBadge category={group.category} /><strong>{group.percentage}%</strong></div>
                <span aria-hidden="true"><i /></span>
              </div>
            );
          }) : <p className={styles.analyticsEmpty}>Adaugă exerciții în calendar pentru a vedea distribuția grupelor.</p>}
        </div>
      </section>

      <section className={styles.analyticsSection} aria-labelledby="amv2-exercise-history-title">
        <header className={styles.exerciseHistorySectionHeader}>
          <h2 id="amv2-exercise-history-title">Istoric exerciții</h2>
          <p>Vezi evoluția fiecărui exercițiu</p>
        </header>
        <div className={styles.statisticsExerciseList}>
          {statistics.recentExercises.length > 0 ? statistics.recentExercises.map((exercise) => (
            <button type="button" key={exercise.identity} onClick={() => onOpenExercise(exercise.identity)}>
              <strong>{exercise.displayName}</strong>
              <span><ExerciseCategoryBadge category={exercise.category} /><AnalyticsChevronRight /></span>
            </button>
          )) : <p className={styles.analyticsEmpty}>Istoricul va apărea după prima zi cu exerciții.</p>}
        </div>
      </section>
      </>
      )}
    </section>
  );
}
