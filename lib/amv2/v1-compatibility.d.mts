import type { WorkoutDay } from "./workout-day-domain.mjs";

export class Amv2V1CompatibilityError extends Error { code: string }
export function analyzeV1WorkoutDefinition(workout: unknown): {
  supported: readonly unknown[];
  unsupported: readonly string[];
};
export function copyV1WorkoutIntoDate(input: {
  workout: unknown;
  existingDay: WorkoutDay | null;
  date: string;
  timestamp: string;
  idFactory: (kind: "exercise" | "set") => string;
}): WorkoutDay;
export function listReliableV1History(logs: unknown): ReadonlyArray<Readonly<{
  id: string;
  workoutName: string;
  completedAt: string;
  exerciseCount: number;
  exercises: ReadonlyArray<Readonly<{ name: string; group: string; details: string }>>;
  source: "V1";
}>>;
export function readV1CompatibilitySource(storage: Pick<Storage, "getItem">): {
  workouts: readonly unknown[];
  history: ReturnType<typeof listReliableV1History>;
};
