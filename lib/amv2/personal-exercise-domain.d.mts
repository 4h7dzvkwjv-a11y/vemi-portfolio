import type { Amv2Location, Amv2SliceMetricType } from "./draft-domain.mjs";

export type PersonalExercise = {
  id: string;
  clientKey: string;
  name: string;
  templateExerciseKey: string;
  category: string;
  location: Amv2Location;
  metricType: Amv2SliceMetricType;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const PERSONAL_EXERCISE_LIMITS: Readonly<{ nameLength: 100; active: 100 }>;
export const PERSONAL_EXERCISE_CATEGORIES: readonly string[];
export const PERSONAL_EXERCISE_METRIC_TYPES: readonly ["repetitions_weight", "repetitions_only", "time_per_set"];

export class PersonalExerciseDomainError extends Error { code: string }

export function validatePersonalExercise(value: unknown): { valid: boolean; issues: string[] };
export function createPersonalExercise(input: {
  id: string;
  clientKey: string;
  name: string;
  category: string;
  metricType: "repetitions_weight" | "repetitions_only" | "time_per_set";
  timestamp: string;
}): PersonalExercise;
export function updatePersonalExercise(exercise: PersonalExercise, input: {
  name?: string;
  category?: string;
  metricType?: "repetitions_weight" | "repetitions_only" | "time_per_set";
  timestamp: string;
}): PersonalExercise;
export function archivePersonalExercise(exercise: PersonalExercise, timestamp: string): PersonalExercise;
export function listActivePersonalExercises(
  exercises: readonly PersonalExercise[],
  location?: Amv2Location | null,
): readonly Readonly<PersonalExercise>[];
