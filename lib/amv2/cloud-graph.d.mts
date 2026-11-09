import type { PersonalExercise } from "./personal-exercise-domain.mjs";
import type { Amv2DayTombstone } from "./sync-reconciliation.mjs";
import type { WorkoutDay } from "./workout-day-domain.mjs";
export class Amv2CloudGraphError extends Error { code: string }
export function serializeWorkoutDayForCloud(day: WorkoutDay): Record<string, unknown>;
export function serializePersonalExerciseForCloud(exercise: PersonalExercise): Record<string, unknown>;
export function hydrateCloudCalendarSnapshot(snapshot: unknown): {
  days: WorkoutDay[];
  personalExercises: PersonalExercise[];
  tombstones: Amv2DayTombstone[];
  dayRevisions: Record<string, number>;
};
