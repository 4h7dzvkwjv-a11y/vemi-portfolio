import type { Amv2Location, WorkoutExercise } from "./draft-domain.mjs";

export type WorkoutDay = {
  date: string;
  location: Amv2Location;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
};

export type CalendarMonthCell = Readonly<{
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
}>;

export type CalendarMonth = Readonly<{
  monthKey: string;
  label: string;
  cells: readonly CalendarMonthCell[];
}>;

export type WorkoutDayExerciseAction =
  | { type: "add_set"; setId: string }
  | { type: "remove_set"; setId: string }
  | { type: "move_set"; setId: string; toIndex: number }
  | {
      type: "update_set_targets";
      setId: string;
      targetRepetitions?: number;
      targetWeightKg?: number;
      targetDurationSeconds?: number;
    }
  | { type: "update_total_duration_target"; targetTotalDurationSeconds: number };

export const WORKOUT_DAY_LIMITS: Readonly<{
  exercises: Readonly<{ min: 1; max: 10 }>;
  visibleCalendarMarkers: 4;
}>;

export const AMV2_CATEGORY_COLORS: Readonly<Record<string, string>>;

export class WorkoutDayDomainError extends Error {
  code: string;
}

export function toLocalDateKey(date?: Date): string;
export function monthKeyFromDateKey(dateKey: string): string;
export function shiftMonthKey(monthKey: string, delta: number): string;
export function createCalendarMonth(monthKey: string): CalendarMonth;

export function createWorkoutDayExercise(input: {
  exerciseId: string;
  exerciseKey: string;
  setIds?: readonly string[];
}): WorkoutExercise;

export function createPersonalWorkoutDayExercise(input: {
  exerciseId: string;
  personalExerciseId: string;
  templateExerciseKey: string;
  displayName: string;
  category: string;
  setIds?: readonly string[];
}): WorkoutExercise;

export function validateWorkoutDay(day: unknown): { valid: boolean; issues: string[] };

export function createWorkoutDay(input: {
  date: string;
  location: Amv2Location;
  exercise: WorkoutExercise;
  timestamp: string;
}): WorkoutDay;

export function addExerciseToWorkoutDay(
  day: WorkoutDay | null,
  input: {
    date: string;
    location: Amv2Location;
    exercise: WorkoutExercise;
    timestamp: string;
  },
): WorkoutDay;

export function updateWorkoutDayExercise(
  day: WorkoutDay,
  exercise: WorkoutExercise,
  timestamp: string,
): WorkoutDay;

export function removeExerciseFromWorkoutDay(
  day: WorkoutDay,
  exerciseIdentity: string,
  timestamp: string,
): WorkoutDay | null;

export function updateWorkoutDayLocation(
  day: WorkoutDay,
  location: Amv2Location,
  timestamp: string,
): WorkoutDay;

export function reduceWorkoutDayExercise(
  exercise: WorkoutExercise,
  action: WorkoutDayExerciseAction,
  updatedAt: string,
): WorkoutExercise;

export function deriveWorkoutDayMuscleGroups(day: WorkoutDay): ReadonlyArray<Readonly<{
  id: string;
  label: string;
  color: string;
}>>;
