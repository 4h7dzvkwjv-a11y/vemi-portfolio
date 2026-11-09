"use client";

import type { WorkoutStatistics } from "@/lib/amv2/workout-statistics.mjs";
import { AnalyticsChevronRight, StatisticsBarsIcon } from "./statistics-icons";
import styles from "./amv2.module.css";

function formatFrequency(value: number) {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(value);
}

export function StatisticsLauncher({
  statistics,
  complete = true,
  onOpen,
}: {
  statistics: WorkoutStatistics;
  complete?: boolean;
  onOpen: () => void;
}) {
  const dayCopy = statistics.activeDays === 1 ? "1 zi activă" : `${statistics.activeDays} zile active`;

  return (
    <button className={styles.statisticsLauncher} type="button" onClick={onOpen}>
      <span className={styles.statisticsLauncherIcon} aria-hidden="true">
        <StatisticsBarsIcon />
      </span>
      <span className={styles.statisticsLauncherCopy}>
        <strong>Statistici</strong>
        <small>{complete
          ? `${dayCopy} · ${formatFrequency(statistics.averageWeeklyFrequency)}× / săptămână`
          : "Se sincronizează istoricul complet…"}</small>
      </span>
      <AnalyticsChevronRight className={styles.analyticsChevron} />
    </button>
  );
}
