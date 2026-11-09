import type { WorkoutDay } from "./workout-day-domain.mjs";

export const AMV2_WORKOUT_CALENDAR_STORAGE_KEY: "vemi-amv2-workout-calendar-v1";
export const AMV2_WORKOUT_CALENDAR_SCHEMA_VERSION: 1;
export const AMV2_LEGACY_LOCAL_STORAGE_KEY: "vemi-amv2-local-v3";

export type WorkoutCalendarEnvelope = {
  schema: "vemi-amv2-workout-calendar";
  version: 1;
  revision: number;
  days: WorkoutDay[];
  updatedAt: string;
};

export class WorkoutCalendarLocalError extends Error {
  code: string;
}

export function createWorkoutCalendarEnvelope(updatedAt: string): WorkoutCalendarEnvelope;
export function validateWorkoutCalendarEnvelope(value: unknown): { valid: boolean; issues: string[] };
export function findWorkoutDay(envelope: WorkoutCalendarEnvelope, date: string): WorkoutDay | null;
export function replaceWorkoutDayInCalendar(
  envelope: WorkoutCalendarEnvelope,
  date: string,
  day: WorkoutDay | null,
  updatedAt: string,
): WorkoutCalendarEnvelope;

export type WorkoutCalendarReadResult =
  | { status: "loaded"; envelope: WorkoutCalendarEnvelope }
  | { status: "missing" }
  | { status: "invalid" | "read_error"; error: string };

export function readWorkoutCalendar(storage: Pick<Storage, "getItem">): WorkoutCalendarReadResult;
export function writeWorkoutCalendar(
  storage: Pick<Storage, "setItem">,
  envelope: WorkoutCalendarEnvelope,
): { status: "saved_local"; bytes: number } | { status: "save_error"; error: string };
