import type { Amv2AccountSyncEnvelope } from "./account-sync-local.mjs";
import type { LocalOnlyMarker } from "./durable-local-store.mjs";
import type { PersonalExercise } from "./personal-exercise-domain.mjs";
import type { Amv2DayTombstone } from "./sync-reconciliation.mjs";
import type { WorkoutCalendarEnvelope } from "./workout-calendar-local.mjs";
import type { WorkoutDay } from "./workout-day-domain.mjs";

type OwnerProjection = {
  calendar: WorkoutCalendarEnvelope;
  sync: Amv2AccountSyncEnvelope;
};

export function reconcileRemoteOwnerProjection(input: OwnerProjection & {
  localOnly?: LocalOnlyMarker[];
  remote: {
    days: WorkoutDay[];
    personalExercises: PersonalExercise[];
    tombstones: Amv2DayTombstone[];
    dayRevisions: Record<string, number>;
  };
  monthKey: string;
  timestamp: string;
}): OwnerProjection & {
  dayChanges: Array<{ date: string; day: WorkoutDay | null }>;
  hasConflict: boolean;
};

export function reconcileRemoteOwnerHistoryPage(input: OwnerProjection & {
  localOnly?: LocalOnlyMarker[];
  remote: {
    days: WorkoutDay[];
    personalExercises: PersonalExercise[];
    tombstones: Amv2DayTombstone[];
    dayRevisions: Record<string, number>;
  };
  timestamp: string;
}): OwnerProjection & {
  dayChanges: Array<{ date: string; day: WorkoutDay | null }>;
  hasConflict: boolean;
};

export function reconcileConfirmedOwnerProjection(input: OwnerProjection & {
  operationKey: string;
  remoteIdentity: string;
  revision: number;
  canonicalCandidate?: Record<string, unknown> | null;
  deleted?: boolean;
  timestamp: string;
}): OwnerProjection & { dayChange: { date: string; day: WorkoutDay | null } | null };

export function reconcileCloudConflictOwnerProjection(input: OwnerProjection & {
  operationKey: string;
  remoteIdentity: string;
  remoteRevision: number;
  remoteCandidate: Record<string, unknown> | null;
  remoteDeleted: boolean;
  reason: string;
  timestamp: string;
}): OwnerProjection & {
  dayChange: { date: string; day: WorkoutDay | null } | null;
  resolution: "acknowledged_equivalent" | "conflict";
  hasConflict: boolean;
};

export function adoptRemoteConflictProjection(input: OwnerProjection & {
  conflictId: string;
  timestamp: string;
}): OwnerProjection & {
  dayChange: { date: string; day: WorkoutDay | null } | null;
  supersededOperationKeys: string[];
};
