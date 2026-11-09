import type { PersonalExercise } from "./personal-exercise-domain.mjs";
import type { Amv2SyncConflict } from "./sync-reconciliation.mjs";

export type Amv2OperationType = "upsert_day" | "delete_day" | "upsert_personal" | "archive_personal" | "import_days";
export type Amv2OutboxOperation = {
  ownerUserId: string;
  operationKey: string;
  type: Amv2OperationType;
  expectedRevision: number;
  payload: Record<string, unknown>;
  createdAt: string;
  delivery?: {
    status: "pending" | "retryable";
    attempts: number;
    lastCode: string | null;
    lastAttemptAt: string | null;
  };
};
export type Amv2AccountSyncEnvelope = {
  schema: "vemi-amv2-account-sync";
  version: 1;
  ownerUserId: string | null;
  personalExercises: PersonalExercise[];
  outbox: Amv2OutboxOperation[];
  remoteRevisions: Record<string, number>;
  conflicts: Amv2SyncConflict[];
  importBatches: Array<Record<string, unknown> & { id: string; source: string; status: string }>;
  updatedAt: string;
};

export const AMV2_ACCOUNT_SYNC_STORAGE_KEY: "vemi-amv2-account-sync-v1";
export const AMV2_ACCOUNT_SYNC_VERSION: 1;
export const AMV2_OUTBOX_LIMIT: 100;
export class Amv2AccountSyncError extends Error { code: string }
export function createAccountSyncEnvelope(updatedAt: string): Amv2AccountSyncEnvelope;
export function validateAccountSyncEnvelope(value: unknown): { valid: boolean; issues: string[] };
export function upgradeLegacyAccountSyncEnvelope(value: unknown):
  | { status: "valid" | "upgraded"; envelope: Amv2AccountSyncEnvelope; quarantinedConflicts: unknown[] }
  | { status: "invalid"; error: string };
export function readAccountSyncEnvelope(storage: Pick<Storage, "getItem">):
  | { status: "loaded"; envelope: Amv2AccountSyncEnvelope }
  | { status: "missing" }
  | { status: "invalid" | "read_error"; error: string };
export function writeAccountSyncEnvelope(storage: Pick<Storage, "setItem">, envelope: Amv2AccountSyncEnvelope):
  | { status: "saved_local"; bytes: number }
  | { status: "save_error"; error: string };
export function replacePersonalExerciseInSync(envelope: Amv2AccountSyncEnvelope, exercise: PersonalExercise, updatedAt: string): Amv2AccountSyncEnvelope;
export function bindAccountOwner(envelope: Amv2AccountSyncEnvelope, ownerUserId: string, updatedAt: string): Amv2AccountSyncEnvelope;
export function enqueueAccountOperation(envelope: Amv2AccountSyncEnvelope, operation: Amv2OutboxOperation, updatedAt: string): Amv2AccountSyncEnvelope;
export function getAccountOperationRemoteIdentity(operation: Amv2OutboxOperation): string;
export function getAccountOperationDependencies(operation: Amv2OutboxOperation): string[];
export function markAccountOperationRetry(
  envelope: Amv2AccountSyncEnvelope,
  operationKey: string,
  details: { code: string },
  updatedAt: string,
): Amv2AccountSyncEnvelope;
export function quarantineAccountOperation(
  envelope: Amv2AccountSyncEnvelope,
  operationKey: string,
  details: { code: string; message: string },
  updatedAt: string,
): Amv2AccountSyncEnvelope;
export function selectNextAccountOperation(
  envelope: Amv2AccountSyncEnvelope,
  ownerUserId: string,
): Amv2OutboxOperation | null;
export function confirmAccountOperation(envelope: Amv2AccountSyncEnvelope, operationKey: string, remoteIdentity: string, revision: number, updatedAt: string): Amv2AccountSyncEnvelope;
export function reconcileConfirmedAccountOperation(envelope: Amv2AccountSyncEnvelope, confirmation: {
  operationKey: string;
  remoteIdentity: string;
  revision: number;
  canonicalCandidate?: Record<string, unknown> | null;
  deleted?: boolean;
}, updatedAt: string): {
  envelope: Amv2AccountSyncEnvelope;
  remoteIdentity: string;
  revision: number;
  canonicalCandidate: Record<string, unknown> | null;
  deleted: boolean;
  hasAuthoritativeCandidate: boolean;
  alreadyAcknowledged: boolean;
};
export function recordAccountConflict(envelope: Amv2AccountSyncEnvelope, details: {
  operationKey: string;
  remoteIdentity: string;
  remoteRevision: number;
  remoteCandidate: Record<string, unknown> | null;
  remoteDeleted?: boolean;
  reason: string;
}, updatedAt: string): Amv2AccountSyncEnvelope;
export function resolveAccountConflictWithLocal(envelope: Amv2AccountSyncEnvelope, conflictId: string, updatedAt: string): Amv2AccountSyncEnvelope;
export function resolveAccountConflictWithRemote(envelope: Amv2AccountSyncEnvelope, conflictId: string, updatedAt: string): {
  envelope: Amv2AccountSyncEnvelope;
  remoteIdentity: string;
  revision: number;
  canonicalCandidate: Record<string, unknown> | null;
  deleted: boolean;
  supersededOperationKeys: string[];
};
export function recordImportBatch(envelope: Amv2AccountSyncEnvelope, batch: Record<string, unknown> & { id: string; source: string; status: string }, updatedAt: string): Amv2AccountSyncEnvelope;
