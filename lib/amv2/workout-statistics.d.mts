import type { Amv2SliceMetricType, WorkoutExercise } from "./draft-domain.mjs";
import type { WorkoutDay } from "./workout-day-domain.mjs";

export type WorkoutExerciseOccurrence = Readonly<{
  date: string;
  exercise: WorkoutExercise;
}>;

export type WorkoutExerciseHistory = Readonly<{
  identity: string;
  displayName: string;
  category: string;
  metricType: Amv2SliceMetricType;
  latestDate: string;
  latestValue: number;
  bestValue: number;
  trend: readonly Readonly<{ date: string; value: number }>[];
  occurrences: readonly WorkoutExerciseOccurrence[];
}>;

export type WorkoutStatistics = Readonly<{
  activeDays: number;
  activeWeeks: number;
  averageWeeklyFrequency: number;
  recentWeeks: readonly Readonly<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    dayCount: number;
  }>[];
  groups: readonly Readonly<{ category: string; count: number; percentage: number }>[];
  recentExercises: readonly WorkoutExerciseHistory[];
  exerciseHistories: readonly WorkoutExerciseHistory[];
}>;

export function deriveWorkoutStatistics(days: readonly WorkoutDay[], todayDateKey: string): WorkoutStatistics;
export function findExerciseHistory(statistics: WorkoutStatistics, identity: string): WorkoutExerciseHistory | null;
export function selectRecentExerciseOccurrences(
  history: WorkoutExerciseHistory | null,
  beforeDate: string,
  limit?: number,
): readonly WorkoutExerciseOccurrence[];
