"use client";

import { useMemo } from "react";
import type { WorkoutDay } from "@/lib/amv2/workout-day-domain.mjs";
import {
  createCalendarMonth,
  deriveWorkoutDayMuscleGroups,
  WORKOUT_DAY_LIMITS,
} from "@/lib/amv2/workout-day-domain.mjs";
import styles from "./amv2.module.css";

type MonthlyWorkoutCalendarProps = {
  monthKey: string;
  selectedDate: string;
  todayDate: string;
  days: readonly WorkoutDay[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (dateKey: string) => void;
};

const weekdays = ["L", "M", "M", "J", "V", "S", "D"];

export function MonthlyWorkoutCalendar({
  monthKey,
  selectedDate,
  todayDate,
  days,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}: MonthlyWorkoutCalendarProps) {
  const month = useMemo(() => createCalendarMonth(monthKey), [monthKey]);
  const dayMap = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);

  return (
    <section className={styles.calendarCard} aria-labelledby="amv2-calendar-month">
      <div className={styles.calendarHeader}>
        <button type="button" aria-label="Luna anterioară" onClick={onPreviousMonth}>‹</button>
        <div>
          <h1 id="amv2-calendar-month">{month.label}</h1>
          <button type="button" onClick={onToday}>Astăzi</button>
        </div>
        <button type="button" aria-label="Luna următoare" onClick={onNextMonth}>›</button>
      </div>

      <div className={styles.calendarWeekdays} aria-hidden="true">
        {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
      </div>

      <div className={styles.calendarGrid} role="grid" aria-label={`Calendar ${month.label}`}>
        {month.cells.map((cell) => {
          const day = dayMap.get(cell.dateKey) ?? null;
          const groups = day ? deriveWorkoutDayMuscleGroups(day) : [];
          const visible = groups.slice(0, WORKOUT_DAY_LIMITS.visibleCalendarMarkers);
          const overflow = groups.length - visible.length;
          const selected = cell.dateKey === selectedDate;
          const today = cell.dateKey === todayDate;
          return (
            <button
              key={cell.dateKey}
              className={styles.calendarDay}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-current={today ? "date" : undefined}
              data-outside-month={!cell.inCurrentMonth || undefined}
              data-has-workout={day ? "true" : undefined}
              onClick={() => onSelectDate(cell.dateKey)}
            >
              <span className={styles.calendarDateNumber}>{cell.dayOfMonth}</span>
              <span
                className={styles.calendarMarkers}
                aria-label={groups.length === 1 ? "1 grupă musculară" : `${groups.length} grupe musculare`}
              >
                {visible.map((group) => (
                  <i key={group.id} style={{ backgroundColor: group.color }} title={group.label} />
                ))}
                {overflow > 0 ? <b>+{overflow}</b> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
