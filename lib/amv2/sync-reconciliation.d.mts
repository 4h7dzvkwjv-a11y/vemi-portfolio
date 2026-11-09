import type { PersonalExercise } from "./personal-exercise-domain.mjs";
import type { WorkoutDay } from "./workout-day-domain.mjs";
import type { Amv2OutboxOperation } from "./account-sync-local.mjs";

export type Amv2DayTombstone = { date: string; revision: number; deletedAt: string };
export type Amv2SyncConflict = {
  id: string;
  ownerUserId: string;
  operationKey: string;
  remoteIdentity: string;
  entityType: "day" | "personal";
  operationType: Exclude<Amv2OutboxOperation["type"], "import_days">;
  baseRevision: number;
  remoteRevision: number;
  localCandidate: Record<string, unknown> | null;
  remoteCandidate: Record<string, unknown> | null;
  remoteDeleted: boolean;
  reason: string;
  status: "unresolved";
  detectedAt: string;
};

export function canonicalJsonStringify(value: unknown): string;
export function canonicalizeWorkoutDayForSync(day: WorkoutDay): Record<string, unknown>;
export function canonicalizePersonalExerciseForSync(exercise: PersonalExercise): Record<string, unknown>;
export function workoutDaysDomainEqual(left: WorkoutDay, right: WorkoutDay): boolean;
export function personalExercisesDomainEqual(left: PersonalExercise, right: PersonalExercise): boolean;
export function validateDayTombstone(value: unknown): value is Amv2DayTombstone;
export function validateSyncConflict(value: unknown): value is Amv2SyncConflict;
export function createSyncConflict(input: {
  ownerUserId: string;
  operation: Amv2OutboxOperation;
  remoteIdentity: string;
  remoteRevision: number;
  remoteCandidate: Record<string, unknown> | null;
  remoteDeleted?: boolean;
  reason: string;
  detectedAt: string;
}): Amv2SyncConflict;
export function planRemoteDayReconciliation(input: {
  localDay?: WorkoutDay | null;
  remoteDay?: (WorkoutDay & { revision?: number }) | null;
  tombstone?: Amv2DayTombstone | null;
  pendingOperation?: Amv2OutboxOperation | null;
  knownRevision?: number;
}): Record<string, unknown>;
export function planRemotePersonalReconciliation(input: {
  localExercise?: PersonalExercise | null;
  remoteExercise?: PersonalExercise | null;
  pendingOperation?: Amv2OutboxOperation | null;
  knownRevision?: number;
}): Record<string, unknown>;
