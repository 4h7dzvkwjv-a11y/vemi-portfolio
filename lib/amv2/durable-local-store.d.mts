import type {
  Amv2AccountSyncEnvelope,
  Amv2OutboxOperation,
} from "./account-sync-local.mjs";
import type { PersonalExercise } from "./personal-exercise-domain.mjs";
import type { WorkoutCalendarEnvelope } from "./workout-calendar-local.mjs";
import type { WorkoutDay } from "./workout-day-domain.mjs";

export const AMV2_DURABLE_DATABASE_NAME: "vemi-amv2-local-v2";
export const AMV2_DURABLE_DATABASE_VERSION: 1;
export const AMV2_ANONYMOUS_INSTALLATION_KEY: "vemi-amv2-installation-v1";
export const AMV2_LEGACY_MIGRATION_ID: "legacy-global-v1";
export const AMV2_DURABLE_STORES: Readonly<{
  ownerMeta: "owner_meta";
  workoutDays: "workout_days";
  personalExercises: "personal_exercises";
  outbox: "outbox";
  conflicts: "conflicts";
  importBatches: "import_batches";
  localOnly: "local_only";
  migrations: "migrations";
  quarantine: "quarantine";
}>;

export type AuthenticatedOwnerScope = Readonly<{
  kind: "authenticated";
  ownerUserId: string;
  installationId: null;
  key: `user:${string}`;
}>;
export type AnonymousOwnerScope = Readonly<{
  kind: "anonymous";
  ownerUserId: null;
  installationId: string;
  key: `anon:${string}`;
}>;
export type Amv2OwnerScope = AuthenticatedOwnerScope | AnonymousOwnerScope;

export type LocalOnlyMarker = {
  scope: string;
  identity: string;
  reason: string;
  updatedAt: string;
};
export type DurableIntent =
  | { kind: "outbox"; operation: Amv2OutboxOperation }
  | { kind: "local_only"; reason: string };

export type DurableOwnerState = {
  calendar: WorkoutCalendarEnvelope;
  sync: Amv2AccountSyncEnvelope;
  syncRevision: number;
  localOnly: LocalOnlyMarker[];
  coverage: Record<string, unknown>;
  partial: boolean;
};

export class Amv2DurableLocalError extends Error {
  code: string;
}

export function createAuthenticatedOwnerScope(ownerUserId: string): AuthenticatedOwnerScope;
export function createAnonymousOwnerScope(installationId: string): AnonymousOwnerScope;
export function getOrCreateAnonymousInstallationId(
  storage: Pick<Storage, "getItem" | "setItem">,
  cryptoProvider?: Pick<Crypto, "randomUUID">,
): string;
export function canonicalLocalJson(value: unknown): string;

export type Amv2DurableBackendTransaction = {
  get(store: string, key: unknown): Promise<unknown>;
  put(store: string, value: unknown): Promise<void>;
  delete(store: string, key: unknown): Promise<void>;
  getAllByScope(store: string, scope: string): Promise<unknown[]>;
  getWorkoutDays(scope: string, startDate: string, endDate: string): Promise<unknown[]>;
  deleteByScope(store: string, scope: string): Promise<void>;
};
export type Amv2DurableBackend = {
  runTransaction<T>(
    storeNames: readonly string[],
    mode: "readonly" | "readwrite",
    callback: (transaction: Amv2DurableBackendTransaction) => Promise<T> | T,
  ): Promise<T>;
  close?(): void;
};

export type Amv2DurableStore = {
  readWorkoutDay(scope: Amv2OwnerScope, date: string): Promise<WorkoutDay | null>;
  readWorkoutDays(
    scope: Amv2OwnerScope,
    range?: { startDate?: string; endDate?: string },
  ): Promise<WorkoutDay[]>;
  loadWorkoutDaysRange(scope: Amv2OwnerScope, startDate: string, endDate: string): Promise<WorkoutDay[]>;
  readOwnerState(
    scope: Amv2OwnerScope,
    range?: { startDate: string; endDate: string },
  ): Promise<DurableOwnerState>;
  loadOwnerState(
    scope: Amv2OwnerScope,
    range?: { startDate: string; endDate: string },
  ): Promise<DurableOwnerState>;
  replaceOwnerSnapshot(scope: Amv2OwnerScope, snapshot: {
    calendar: WorkoutCalendarEnvelope;
    sync: Amv2AccountSyncEnvelope;
    coverage?: Record<string, unknown>;
    localOnly?: LocalOnlyMarker[];
  }): Promise<{ status: "saved"; syncRevision: number }>;
  commitOwnerSnapshot(scope: Amv2OwnerScope, snapshot: {
    calendar: WorkoutCalendarEnvelope;
    sync: Amv2AccountSyncEnvelope;
    coverage?: Record<string, unknown>;
    localOnly?: LocalOnlyMarker[];
  }): Promise<{ status: "saved"; syncRevision: number }>;
  commitOwnerTransition(scope: Amv2OwnerScope, transition: {
    dayChanges?: Array<{ date: string; day: WorkoutDay | null }>;
    localOnlyChanges?: Array<{ identity: string; reason: string; updatedAt: string }>;
    calendarRevision?: number;
    calendarUpdatedAt?: string;
    sync?: Amv2AccountSyncEnvelope;
    coverage?: Record<string, unknown>;
    expectedSyncRevision: number;
  }): Promise<{ status: "saved"; syncRevision: number }>;
  commitWorkoutDayMutation(scope: Amv2OwnerScope, mutation: {
    date: string;
    day?: WorkoutDay | null;
    nextCalendar?: WorkoutCalendarEnvelope;
    nextSyncEnvelope?: Amv2AccountSyncEnvelope;
    expectedCalendarRevision?: number;
    expectedSyncRevision: number;
    timestamp?: string;
    intent?: DurableIntent;
    localOnlyReason?: string;
  }): Promise<{ status: "saved" | "already_committed"; calendarRevision: number; syncRevision: number }>;
  commitPersonalExerciseMutation(scope: Amv2OwnerScope, mutation: {
    exercise?: PersonalExercise;
    nextPersonal?: PersonalExercise;
    nextSyncEnvelope?: Amv2AccountSyncEnvelope;
    timestamp?: string;
    expectedSyncRevision: number;
    intent?: DurableIntent;
    localOnlyReason?: string;
  }): Promise<{ status: "saved" | "already_committed"; syncRevision: number }>;
  commitPersonalMutation(scope: Amv2OwnerScope, mutation: {
    exercise?: PersonalExercise;
    nextPersonal?: PersonalExercise;
    nextSyncEnvelope?: Amv2AccountSyncEnvelope;
    timestamp?: string;
    expectedSyncRevision: number;
    intent?: DurableIntent;
    localOnlyReason?: string;
  }): Promise<{ status: "saved" | "already_committed"; syncRevision: number }>;
  commitSyncState(scope: Amv2OwnerScope, transition: {
    nextSyncEnvelope: Amv2AccountSyncEnvelope;
    dayChange?: { date: string; day: WorkoutDay | null };
    nextCalendar?: WorkoutCalendarEnvelope;
    coverage?: Record<string, unknown>;
    localOnlyChanges?: Array<{ identity: string; reason: string; updatedAt: string }>;
    expectedSyncRevision: number;
  }): Promise<{ status: "saved"; syncRevision: number }>;
  migrateLegacyLocalStorage(input: {
    legacyStorage: Pick<Storage, "getItem">;
    anonymousScope: AnonymousOwnerScope;
    verifiedOwnerUserId?: string | null;
    timestamp: string;
  }): Promise<{
    status: "migrated" | "already_migrated" | "quarantined" | "deferred";
    result: string;
    scopeKey: string | null;
    collisions?: string[];
  }>;
  close(): void;
};

export function createAmv2DurableStore(backend: Amv2DurableBackend): Amv2DurableStore;
export function openAmv2DurableStore(options?: {
  indexedDb?: IDBFactory;
  keyRange?: typeof IDBKeyRange;
  databaseName?: string;
}): Promise<Amv2DurableStore>;
