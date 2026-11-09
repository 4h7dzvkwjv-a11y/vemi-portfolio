import { validatePersonalExercise } from "./personal-exercise-domain.mjs";
import {
  canonicalJsonStringify,
  createSyncConflict,
  validateSyncConflict,
} from "./sync-reconciliation.mjs";

export const AMV2_ACCOUNT_SYNC_STORAGE_KEY = "vemi-amv2-account-sync-v1";
export const AMV2_ACCOUNT_SYNC_VERSION = 1;
export const AMV2_OUTBOX_LIMIT = 100;

const MAX_BYTES = 512 * 1_024;
const OPERATION_TYPES = new Set([
  "upsert_day",
  "delete_day",
  "upsert_personal",
  "archive_personal",
  "import_days",
]);
const DELIVERY_STATUSES = new Set(["pending", "retryable"]);
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const stablePayload = canonicalJsonStringify;
const operationRemoteIdentity = (operation) => {
  if (operation.type === "upsert_day" || operation.type === "delete_day") return `day:${String(operation.payload.date ?? "")}`;
  if (operation.type === "upsert_personal" || operation.type === "archive_personal") return `personal:${String(operation.payload.id ?? "")}`;
  if (operation.type === "import_days") {
    const occurrenceIdentity = typeof operation.payload.sourceOccurrenceIdentity === "string"
      ? operation.payload.sourceOccurrenceIdentity
      : typeof operation.payload.sourceIdentity === "string"
        ? operation.payload.sourceIdentity
        : operation.payload.batchKey;
    return `import:${String(occurrenceIdentity ?? "")}`;
  }
  return "";
};

export function getAccountOperationRemoteIdentity(operation) {
  return isRecord(operation) ? operationRemoteIdentity(operation) : "";
}

export function getAccountOperationDependencies(operation) {
  if (!isRecord(operation)) return [];
  const dependencies = new Set([operationRemoteIdentity(operation)]);
  if (operation.type === "import_days" && Array.isArray(operation.payload?.days)) {
    for (const day of operation.payload.days) {
      if (isRecord(day) && typeof day.date === "string") dependencies.add(`day:${day.date}`);
    }
  }
  return [...dependencies].filter(isText).sort();
}

export class Amv2AccountSyncError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "Amv2AccountSyncError";
    this.code = code;
  }
}

const fail = (code, message) => { throw new Amv2AccountSyncError(code, message); };

export function createAccountSyncEnvelope(updatedAt) {
  return {
    schema: "vemi-amv2-account-sync",
    version: AMV2_ACCOUNT_SYNC_VERSION,
    ownerUserId: null,
    personalExercises: [],
    outbox: [],
    remoteRevisions: {},
    conflicts: [],
    importBatches: [],
    updatedAt,
  };
}

export function validateAccountSyncEnvelope(value) {
  const issues = [];
  if (!isRecord(value)) return { valid: false, issues: ["Starea de sincronizare AMV2 este invalidă."] };
  if (value.schema !== "vemi-amv2-account-sync" || value.version !== AMV2_ACCOUNT_SYNC_VERSION) {
    issues.push("Versiunea stării de sincronizare AMV2 este invalidă.");
  }
  if (value.ownerUserId !== null && !isText(value.ownerUserId)) issues.push("Identitatea contului AMV2 este invalidă.");
  if (!isTimestamp(value.updatedAt)) issues.push("Starea de sincronizare nu are updatedAt valid.");
  if (!Array.isArray(value.personalExercises)) issues.push("Lista exercițiilor personale lipsește.");
  else {
    const ids = new Set();
    value.personalExercises.forEach((exercise, index) => {
      const validation = validatePersonalExercise(exercise);
      validation.issues.forEach((issue) => issues.push(`Exercițiul personal ${index + 1}: ${issue}`));
      if (ids.has(exercise?.id)) issues.push("Lista exercițiilor personale conține ID-uri duplicate.");
      ids.add(exercise?.id);
    });
  }
  if (!Array.isArray(value.outbox) || value.outbox.length > AMV2_OUTBOX_LIMIT) {
    issues.push(`Outbox-ul AMV2 trebuie să conțină cel mult ${AMV2_OUTBOX_LIMIT} operații.`);
  } else {
    const keys = new Set();
    value.outbox.forEach((operation) => {
      if (!isRecord(operation)
        || !isText(operation.operationKey)
        || !isText(operation.ownerUserId)
        || !OPERATION_TYPES.has(operation.type)
        || !Number.isInteger(operation.expectedRevision)
        || operation.expectedRevision < 0
        || !isRecord(operation.payload)
        || !isTimestamp(operation.createdAt)
        || (operation.delivery !== undefined && (!isRecord(operation.delivery)
          || !DELIVERY_STATUSES.has(operation.delivery.status)
          || !Number.isInteger(operation.delivery.attempts)
          || operation.delivery.attempts < 0
          || !(operation.delivery.lastCode === null || isText(operation.delivery.lastCode))
          || !(operation.delivery.lastAttemptAt === null || isTimestamp(operation.delivery.lastAttemptAt))))) {
        issues.push("Outbox-ul conține o operație invalidă.");
      }
      if (keys.has(operation?.operationKey)) issues.push("Outbox-ul conține operation_key duplicat.");
      keys.add(operation?.operationKey);
    });
  }
  if (!isRecord(value.remoteRevisions)
    || Object.values(value.remoteRevisions).some((revision) => !Number.isInteger(revision) || revision < 0)) {
    issues.push("Reviziile cloud locale sunt invalide.");
  }
  if (!Array.isArray(value.conflicts)
    || value.conflicts.length > 50
    || value.conflicts.some((conflict) => !validateSyncConflict(conflict))) {
    issues.push("Lista conflictelor AMV2 este invalidă.");
  }
  if (!Array.isArray(value.importBatches)) issues.push("Lista batch-urilor de import este invalidă.");
  return { valid: issues.length === 0, issues };
}

export function upgradeLegacyAccountSyncEnvelope(value) {
  if (!isRecord(value) || !Array.isArray(value.conflicts)) {
    return { status: "invalid", error: "Starea legacy de sincronizare AMV2 este invalidă." };
  }
  const conflicts = value.conflicts.filter(validateSyncConflict);
  const quarantinedConflicts = value.conflicts.filter((conflict) => !validateSyncConflict(conflict));
  const envelope = { ...value, conflicts };
  const validation = validateAccountSyncEnvelope(envelope);
  if (!validation.valid) return { status: "invalid", error: validation.issues.join(" ") };
  return {
    status: quarantinedConflicts.length > 0 ? "upgraded" : "valid",
    envelope,
    quarantinedConflicts,
  };
}

function assertEnvelope(envelope) {
  const validation = validateAccountSyncEnvelope(envelope);
  if (!validation.valid) fail("INVALID_SYNC_STATE", validation.issues.join(" "));
}

export function readAccountSyncEnvelope(storage) {
  try {
    const raw = storage.getItem(AMV2_ACCOUNT_SYNC_STORAGE_KEY);
    if (raw === null) return { status: "missing" };
    if (byteLength(raw) > MAX_BYTES) return { status: "invalid", error: "Starea de sincronizare depășește 512 KiB." };
    const envelope = JSON.parse(raw);
    const validation = validateAccountSyncEnvelope(envelope);
    return validation.valid
      ? { status: "loaded", envelope }
      : { status: "invalid", error: validation.issues.join(" ") };
  } catch (error) {
    return { status: "read_error", error: error instanceof Error ? error.message : "Starea de sincronizare nu poate fi citită." };
  }
}

export function writeAccountSyncEnvelope(storage, envelope) {
  try {
    assertEnvelope(envelope);
    const serialized = JSON.stringify(envelope);
    if (byteLength(serialized) > MAX_BYTES) return { status: "save_error", error: "Starea de sincronizare depășește 512 KiB." };
    storage.setItem(AMV2_ACCOUNT_SYNC_STORAGE_KEY, serialized);
    return { status: "saved_local", bytes: byteLength(serialized) };
  } catch (error) {
    return { status: "save_error", error: error instanceof Error ? error.message : "Starea de sincronizare nu poate fi salvată." };
  }
}

export function replacePersonalExerciseInSync(envelope, exercise, updatedAt) {
  assertEnvelope(envelope);
  const validation = validatePersonalExercise(exercise);
  if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
  const exists = envelope.personalExercises.some((candidate) => candidate.id === exercise.id);
  const personalExercises = exists
    ? envelope.personalExercises.map((candidate) => candidate.id === exercise.id ? exercise : candidate)
    : [...envelope.personalExercises, exercise];
  const next = { ...envelope, personalExercises, updatedAt };
  assertEnvelope(next);
  return next;
}

export function bindAccountOwner(envelope, ownerUserId, updatedAt) {
  assertEnvelope(envelope);
  if (!isText(ownerUserId)) fail("INVALID_OWNER", "Identitatea contului AMV2 este invalidă.");
  if (envelope.ownerUserId !== null && envelope.ownerUserId !== ownerUserId) {
    fail("ACCOUNT_BOUNDARY", "Datele locale de sincronizare aparțin altui cont și nu au fost trimise.");
  }
  if (envelope.ownerUserId === ownerUserId) return envelope;
  const next = { ...envelope, ownerUserId, updatedAt };
  assertEnvelope(next);
  return next;
}

export function enqueueAccountOperation(envelope, operation, updatedAt) {
  assertEnvelope(envelope);
  if (!isRecord(operation)
    || !isText(operation.operationKey)
    || !isText(operation.ownerUserId)
    || !OPERATION_TYPES.has(operation.type)
    || !Number.isInteger(operation.expectedRevision)
    || operation.expectedRevision < 0
    || !isRecord(operation.payload)
    || !isTimestamp(operation.createdAt)) {
    fail("INVALID_OUTBOX_OPERATION", "Operația AMV2 pentru sincronizare este invalidă.");
  }
  if (envelope.ownerUserId !== operation.ownerUserId) {
    fail("ACCOUNT_BOUNDARY", "Operația AMV2 nu corespunde contului local activ.");
  }
  const existing = envelope.outbox.find((candidate) => candidate.operationKey === operation.operationKey);
  if (existing) {
    if (existing.type !== operation.type || stablePayload(existing.payload) !== stablePayload(operation.payload)) {
      fail("IDEMPOTENCY_KEY_REUSED", "Aceeași cheie de operație nu poate reprezenta un payload diferit.");
    }
    return envelope;
  }
  if (envelope.outbox.length >= AMV2_OUTBOX_LIMIT) {
    fail("OUTBOX_CAPACITY", `Outbox-ul AMV2 este limitat la ${AMV2_OUTBOX_LIMIT} operații.`);
  }
  const next = { ...envelope, outbox: [...envelope.outbox, operation], updatedAt };
  assertEnvelope(next);
  return next;
}

export function markAccountOperationRetry(envelope, operationKey, details, updatedAt) {
  assertEnvelope(envelope);
  if (!isText(operationKey) || !isRecord(details) || !isText(details.code) || !isTimestamp(updatedAt)) {
    fail("INVALID_RETRY_STATE", "Starea retry a operației AMV2 este invalidă.");
  }
  let found = false;
  const outbox = envelope.outbox.map((operation) => {
    if (operation.operationKey !== operationKey) return operation;
    found = true;
    return {
      ...operation,
      delivery: {
        status: "retryable",
        attempts: (operation.delivery?.attempts ?? 0) + 1,
        lastCode: details.code,
        lastAttemptAt: updatedAt,
      },
    };
  });
  if (!found) fail("OUTBOX_OPERATION_NOT_FOUND", "Operația retry nu mai există în outbox.");
  const next = { ...envelope, outbox, updatedAt };
  assertEnvelope(next);
  return next;
}

export function quarantineAccountOperation(envelope, operationKey, details, updatedAt) {
  assertEnvelope(envelope);
  if (!isText(operationKey)
    || !isRecord(details)
    || !isText(details.code)
    || !isText(details.message)
    || !isTimestamp(updatedAt)) {
    fail("INVALID_PERMANENT_FAILURE", "Evidența eșecului permanent AMV2 este invalidă.");
  }
  const operation = envelope.outbox.find((candidate) => candidate.operationKey === operationKey);
  if (!operation) fail("OUTBOX_OPERATION_NOT_FOUND", "Operația respinsă nu mai există în outbox.");
  const dependencies = getAccountOperationDependencies(operation);
  const dependencySet = new Set(dependencies);
  const blockedOperationKeys = envelope.outbox
    .filter((candidate) => candidate.operationKey !== operationKey
      && getAccountOperationDependencies(candidate).some((dependency) => dependencySet.has(dependency)))
    .map((candidate) => candidate.operationKey)
    .sort();
  const quarantinedOperationKeys = [operationKey, ...blockedOperationKeys];
  const quarantinedKeySet = new Set(quarantinedOperationKeys);
  const batchKey = operation.type === "import_days" && typeof operation.payload.batchKey === "string"
    ? operation.payload.batchKey
    : `failed:${operation.operationKey}`;
  const existingBatch = envelope.importBatches.find((batch) => batch.id === batchKey) ?? {};
  const failedBatch = {
    ...existingBatch,
    id: batchKey,
    source: operation.type === "import_days" && typeof operation.payload.source === "string"
      ? operation.payload.source
      : "cloud_operation",
    status: "permanently_failed",
    operationKey: operation.operationKey,
    code: details.code,
    message: details.message,
    dependencies,
    blockedOperationKeys,
    quarantinedOperationKeys,
    failedAt: updatedAt,
  };
  const importBatches = [
    ...envelope.importBatches.filter((batch) => batch.id !== batchKey),
    failedBatch,
  ];
  const next = {
    ...envelope,
    outbox: envelope.outbox.filter((candidate) => !quarantinedKeySet.has(candidate.operationKey)),
    conflicts: envelope.conflicts.filter((conflict) => !quarantinedKeySet.has(conflict.operationKey)),
    importBatches,
    updatedAt,
  };
  assertEnvelope(next);
  return next;
}

export function selectNextAccountOperation(envelope, ownerUserId) {
  assertEnvelope(envelope);
  if (envelope.ownerUserId !== ownerUserId) fail("ACCOUNT_BOUNDARY", "Outbox-ul nu corespunde contului activ.");
  const blockedOperationKeys = new Set(envelope.conflicts.map((conflict) => conflict.operationKey));
  const blockedDependencies = new Set();
  for (const operation of envelope.outbox) {
    if (!blockedOperationKeys.has(operation.operationKey)) continue;
    for (const dependency of getAccountOperationDependencies(operation)) blockedDependencies.add(dependency);
  }
  return envelope.outbox.find((operation) => !blockedOperationKeys.has(operation.operationKey)
    && getAccountOperationDependencies(operation).every((dependency) => !blockedDependencies.has(dependency))) ?? null;
}

export function confirmAccountOperation(envelope, operationKey, remoteIdentity, revision, updatedAt) {
  return reconcileConfirmedAccountOperation(envelope, {
    operationKey,
    remoteIdentity,
    revision,
  }, updatedAt).envelope;
}

export function reconcileConfirmedAccountOperation(envelope, confirmation, updatedAt) {
  assertEnvelope(envelope);
  if (!isRecord(confirmation)
    || !isText(confirmation.operationKey)
    || !isText(confirmation.remoteIdentity)
    || !Number.isInteger(confirmation.revision)
    || confirmation.revision < 0
    || (confirmation.canonicalCandidate !== undefined
      && confirmation.canonicalCandidate !== null
      && !isRecord(confirmation.canonicalCandidate))) {
    fail("INVALID_CLOUD_CONFIRMATION", "Confirmarea cloud AMV2 este invalidă.");
  }
  const operation = envelope.outbox.find((candidate) => candidate.operationKey === confirmation.operationKey);
  if (!operation) {
    if ((envelope.remoteRevisions[confirmation.remoteIdentity] ?? -1) >= confirmation.revision) {
      return {
        envelope,
        remoteIdentity: confirmation.remoteIdentity,
        revision: confirmation.revision,
        canonicalCandidate: confirmation.canonicalCandidate ?? null,
        deleted: confirmation.deleted === true,
        hasAuthoritativeCandidate: confirmation.canonicalCandidate !== undefined,
        alreadyAcknowledged: true,
      };
    }
    fail("OUTBOX_OPERATION_NOT_FOUND", "Operația confirmată nu mai există în outbox.");
  }
  if (operationRemoteIdentity(operation) !== confirmation.remoteIdentity) {
    fail("CLOUD_CONFIRMATION_IDENTITY_MISMATCH", "Confirmarea cloud nu corespunde operației locale.");
  }
  const remaining = envelope.outbox.filter((candidate) => candidate.operationKey !== confirmation.operationKey)
    .map((candidate) => operationRemoteIdentity(candidate) === confirmation.remoteIdentity
      ? { ...candidate, expectedRevision: confirmation.revision }
      : candidate);
  const next = {
    ...envelope,
    outbox: remaining,
    remoteRevisions: { ...envelope.remoteRevisions, [confirmation.remoteIdentity]: confirmation.revision },
    conflicts: envelope.conflicts.filter((conflict) => conflict.operationKey !== confirmation.operationKey),
    updatedAt,
  };
  assertEnvelope(next);
  return {
    envelope: next,
    remoteIdentity: confirmation.remoteIdentity,
    revision: confirmation.revision,
    canonicalCandidate: confirmation.canonicalCandidate ?? null,
    deleted: confirmation.deleted === true || operation.type === "delete_day",
    hasAuthoritativeCandidate: confirmation.canonicalCandidate !== undefined,
    alreadyAcknowledged: false,
  };
}

export function recordAccountConflict(envelope, details, updatedAt) {
  assertEnvelope(envelope);
  if (!isRecord(details) || !isText(details.operationKey)) {
    fail("INVALID_CONFLICT", "Conflictul AMV2 nu conține detalii complete.");
  }
  const operation = envelope.outbox.find((candidate) => candidate.operationKey === details.operationKey);
  if (!operation) fail("OUTBOX_OPERATION_NOT_FOUND", "Operația aflată în conflict nu mai există în outbox.");
  if (operation.ownerUserId !== envelope.ownerUserId) fail("ACCOUNT_BOUNDARY", "Conflictul nu corespunde contului local activ.");
  if (details.remoteIdentity !== operationRemoteIdentity(operation)) {
    fail("CONFLICT_IDENTITY_MISMATCH", "Conflictul cloud nu corespunde operației locale.");
  }
  let conflict;
  try {
    conflict = createSyncConflict({
      ownerUserId: envelope.ownerUserId,
      operation,
      remoteIdentity: details.remoteIdentity,
      remoteRevision: details.remoteRevision,
      remoteCandidate: details.remoteCandidate,
      remoteDeleted: details.remoteDeleted,
      reason: details.reason,
      detectedAt: updatedAt,
    });
  } catch (error) {
    fail("INVALID_CONFLICT", error instanceof Error ? error.message : "Conflictul AMV2 este invalid.");
  }
  const next = {
    ...envelope,
    conflicts: [...envelope.conflicts.filter((item) => item.id !== conflict.id), conflict].slice(-50),
    updatedAt,
  };
  assertEnvelope(next);
  return next;
}

export function resolveAccountConflictWithLocal(envelope, conflictId, updatedAt) {
  assertEnvelope(envelope);
  const conflict = envelope.conflicts.find((candidate) => candidate.id === conflictId || candidate.operationKey === conflictId);
  if (!conflict) fail("CONFLICT_NOT_FOUND", "Conflictul AMV2 nu mai există.");
  let found = false;
  let outbox = envelope.outbox.map((operation) => {
    if (operation.operationKey !== conflict.operationKey) return operation;
    found = true;
    return { ...operation, expectedRevision: conflict.remoteRevision };
  });
  if (!found) {
    let payload = conflict.localCandidate;
    if (payload === null && conflict.entityType === "day") payload = { date: conflict.remoteIdentity.slice("day:".length) };
    if (payload === null && conflict.entityType === "personal") payload = { id: conflict.remoteIdentity.slice("personal:".length) };
    outbox = [...outbox, {
      ownerUserId: envelope.ownerUserId,
      operationKey: conflict.operationKey,
      type: conflict.operationType,
      expectedRevision: conflict.remoteRevision,
      payload,
      createdAt: updatedAt,
    }];
  }
  const next = {
    ...envelope,
    outbox,
    remoteRevisions: { ...envelope.remoteRevisions, [conflict.remoteIdentity]: conflict.remoteRevision },
    conflicts: envelope.conflicts.filter((candidate) => candidate.id !== conflict.id),
    updatedAt,
  };
  assertEnvelope(next);
  return next;
}

export function resolveAccountConflictWithRemote(envelope, conflictId, updatedAt) {
  assertEnvelope(envelope);
  const conflict = envelope.conflicts.find((candidate) => candidate.id === conflictId || candidate.operationKey === conflictId);
  if (!conflict) fail("CONFLICT_NOT_FOUND", "Conflictul AMV2 nu mai există.");
  const supersededOperationKeys = envelope.outbox
    .filter((operation) => operationRemoteIdentity(operation) === conflict.remoteIdentity)
    .map((operation) => operation.operationKey);
  const next = {
    ...envelope,
    outbox: envelope.outbox.filter((operation) => operationRemoteIdentity(operation) !== conflict.remoteIdentity),
    remoteRevisions: { ...envelope.remoteRevisions, [conflict.remoteIdentity]: conflict.remoteRevision },
    conflicts: envelope.conflicts.filter((candidate) => candidate.remoteIdentity !== conflict.remoteIdentity),
    updatedAt,
  };
  assertEnvelope(next);
  return {
    envelope: next,
    remoteIdentity: conflict.remoteIdentity,
    revision: conflict.remoteRevision,
    canonicalCandidate: conflict.remoteCandidate,
    deleted: conflict.remoteDeleted,
    supersededOperationKeys,
  };
}

export function recordImportBatch(envelope, batch, updatedAt) {
  assertEnvelope(envelope);
  if (!isRecord(batch) || !isText(batch.id) || !isText(batch.source) || !isText(batch.status)) {
    fail("INVALID_IMPORT_BATCH", "Batch-ul de import AMV2 este invalid.");
  }
  const existing = envelope.importBatches.find((candidate) => candidate.id === batch.id);
  if (existing && stablePayload(existing) !== stablePayload(batch)) {
    fail("IMPORT_BATCH_REUSED", "Identitatea batch-ului de import nu poate fi reutilizată pentru alt conținut.");
  }
  if (existing) return envelope;
  const next = { ...envelope, importBatches: [...envelope.importBatches, batch], updatedAt };
  assertEnvelope(next);
  return next;
}
