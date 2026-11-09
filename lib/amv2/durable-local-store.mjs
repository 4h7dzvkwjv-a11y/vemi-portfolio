import {
  AMV2_ACCOUNT_SYNC_STORAGE_KEY,
  createAccountSyncEnvelope,
  getAccountOperationRemoteIdentity,
  upgradeLegacyAccountSyncEnvelope,
  validateAccountSyncEnvelope,
} from "./account-sync-local.mjs";
import { validatePersonalExercise } from "./personal-exercise-domain.mjs";
import { validateHistoryCoverageState } from "./cloud-history-coverage.mjs";
import {
  AMV2_WORKOUT_CALENDAR_STORAGE_KEY,
  createWorkoutCalendarEnvelope,
  validateWorkoutCalendarEnvelope,
} from "./workout-calendar-local.mjs";
import { validateWorkoutDay } from "./workout-day-domain.mjs";

export const AMV2_DURABLE_DATABASE_NAME = "vemi-amv2-local-v2";
export const AMV2_DURABLE_DATABASE_VERSION = 1;
export const AMV2_ANONYMOUS_INSTALLATION_KEY = "vemi-amv2-installation-v1";
export const AMV2_LEGACY_MIGRATION_ID = "legacy-global-v1";

export const AMV2_DURABLE_STORES = Object.freeze({
  ownerMeta: "owner_meta",
  workoutDays: "workout_days",
  personalExercises: "personal_exercises",
  outbox: "outbox",
  conflicts: "conflicts",
  importBatches: "import_batches",
  localOnly: "local_only",
  migrations: "migrations",
  quarantine: "quarantine",
});

const OWNER_STORES = Object.freeze([
  AMV2_DURABLE_STORES.ownerMeta,
  AMV2_DURABLE_STORES.workoutDays,
  AMV2_DURABLE_STORES.personalExercises,
  AMV2_DURABLE_STORES.outbox,
  AMV2_DURABLE_STORES.conflicts,
  AMV2_DURABLE_STORES.importBatches,
  AMV2_DURABLE_STORES.localOnly,
]);
const SYNC_COLLECTION_STORES = Object.freeze([
  AMV2_DURABLE_STORES.personalExercises,
  AMV2_DURABLE_STORES.outbox,
  AMV2_DURABLE_STORES.conflicts,
  AMV2_DURABLE_STORES.importBatches,
]);
const EMPTY_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const OWNER_IDENTIFIER = /^[A-Za-z0-9_-]{3,128}$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const OPERATION_TYPES = new Set([
  "upsert_day",
  "delete_day",
  "upsert_personal",
  "archive_personal",
  "import_days",
]);

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const clone = (value) => structuredClone(value);

export class Amv2DurableLocalError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "Amv2DurableLocalError";
    this.code = code;
  }
}

const fail = (code, message, cause) => {
  throw new Amv2DurableLocalError(code, message, cause);
};

function assertIdentifier(value, label) {
  if (!OWNER_IDENTIFIER.test(value) || value.includes("@")) {
    fail("INVALID_OWNER_SCOPE", `${label} trebuie să fie un identificator opac, fără date personale.`);
  }
}

export function createAuthenticatedOwnerScope(ownerUserId) {
  assertIdentifier(ownerUserId, "Identitatea contului");
  return Object.freeze({ kind: "authenticated", ownerUserId, installationId: null, key: `user:${ownerUserId}` });
}

export function createAnonymousOwnerScope(installationId) {
  assertIdentifier(installationId, "Identitatea instalării anonime");
  return Object.freeze({ kind: "anonymous", ownerUserId: null, installationId, key: `anon:${installationId}` });
}

function assertScope(scope) {
  if (!isRecord(scope) || (scope.kind !== "authenticated" && scope.kind !== "anonymous")) {
    fail("INVALID_OWNER_SCOPE", "Partiția locală AMV2 este invalidă.");
  }
  const expected = scope.kind === "authenticated"
    ? createAuthenticatedOwnerScope(scope.ownerUserId)
    : createAnonymousOwnerScope(scope.installationId);
  if (scope.key !== expected.key) fail("INVALID_OWNER_SCOPE", "Cheia partiției locale AMV2 nu corespunde identității.");
}

export function getOrCreateAnonymousInstallationId(storage, cryptoProvider = globalThis.crypto) {
  const existing = storage.getItem(AMV2_ANONYMOUS_INSTALLATION_KEY);
  if (existing !== null) {
    assertIdentifier(existing, "Identitatea instalării anonime");
    return existing;
  }
  if (!cryptoProvider || typeof cryptoProvider.randomUUID !== "function") {
    fail("INSTALLATION_ID_UNAVAILABLE", "Browserul nu poate crea identitatea instalării anonime.");
  }
  const installationId = cryptoProvider.randomUUID();
  storage.setItem(AMV2_ANONYMOUS_INSTALLATION_KEY, installationId);
  return installationId;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalLocalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operația IndexedDB a eșuat."));
  });
}

function deleteCursorResults(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("Cursorul IndexedDB a eșuat."));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
  });
}

function createNativeTransaction(transaction, keyRange) {
  return Object.freeze({
    get: (store, key) => requestResult(transaction.objectStore(store).get(key)),
    put: (store, value) => requestResult(transaction.objectStore(store).put(value)),
    delete: (store, key) => requestResult(transaction.objectStore(store).delete(key)),
    getAllByScope: (store, scope) => requestResult(
      transaction.objectStore(store).index("by_scope").getAll(keyRange.only(scope)),
    ),
    getWorkoutDays: (scope, startDate, endDate) => requestResult(
      transaction.objectStore(AMV2_DURABLE_STORES.workoutDays).index("by_scope_date").getAll(
        keyRange.bound([scope, startDate], [scope, endDate]),
      ),
    ),
    deleteByScope: (store, scope) => deleteCursorResults(
      transaction.objectStore(store).index("by_scope").openCursor(keyRange.only(scope)),
    ),
  });
}

function createIndexedDbBackend(database, keyRange) {
  return Object.freeze({
    async runTransaction(storeNames, mode, callback) {
      const transaction = database.transaction(storeNames, mode);
      const completion = new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Tranzacția IndexedDB a eșuat."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Tranzacția IndexedDB a fost anulată."));
      });
      try {
        const result = await callback(createNativeTransaction(transaction, keyRange));
        await completion;
        return result;
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // The browser may already have aborted or completed the transaction.
        }
        await completion.catch(() => undefined);
        throw error;
      }
    },
    close() {
      database.close();
    },
  });
}

function createStore(database, name, keyPath, indexes = []) {
  const store = database.objectStoreNames.contains(name)
    ? null
    : database.createObjectStore(name, { keyPath });
  if (!store) return;
  indexes.forEach(([indexName, indexKeyPath]) => store.createIndex(indexName, indexKeyPath, { unique: false }));
}

function upgradeDatabase(database) {
  createStore(database, AMV2_DURABLE_STORES.ownerMeta, "scope", [["by_scope", "scope"]]);
  createStore(database, AMV2_DURABLE_STORES.workoutDays, ["scope", "date"], [
    ["by_scope", "scope"],
    ["by_scope_date", ["scope", "date"]],
  ]);
  createStore(database, AMV2_DURABLE_STORES.personalExercises, ["scope", "id"], [["by_scope", "scope"]]);
  createStore(database, AMV2_DURABLE_STORES.outbox, ["scope", "operationKey"], [["by_scope", "scope"]]);
  createStore(database, AMV2_DURABLE_STORES.conflicts, ["scope", "operationKey"], [["by_scope", "scope"]]);
  createStore(database, AMV2_DURABLE_STORES.importBatches, ["scope", "id"], [["by_scope", "scope"]]);
  createStore(database, AMV2_DURABLE_STORES.localOnly, ["scope", "identity"], [["by_scope", "scope"]]);
  createStore(database, AMV2_DURABLE_STORES.migrations, "id");
  createStore(database, AMV2_DURABLE_STORES.quarantine, "id");
}

export async function openAmv2DurableStore({
  indexedDb = globalThis.indexedDB,
  keyRange = globalThis.IDBKeyRange,
  databaseName = AMV2_DURABLE_DATABASE_NAME,
} = {}) {
  if (!indexedDb || typeof indexedDb.open !== "function" || !keyRange) {
    fail("INDEXED_DB_UNAVAILABLE", "IndexedDB nu este disponibil în acest mediu.");
  }
  const database = await new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, AMV2_DURABLE_DATABASE_VERSION);
    request.onupgradeneeded = () => upgradeDatabase(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Baza locală AMV2 nu poate fi deschisă."));
    request.onblocked = () => reject(new Error("Actualizarea bazei locale AMV2 este blocată de o filă veche."));
  });
  database.onversionchange = () => database.close();
  return createAmv2DurableStore(createIndexedDbBackend(database, keyRange));
}

function assertDate(date) {
  if (!DATE_KEY.test(date)) fail("INVALID_DATE", "Data AMV2 trebuie să aibă forma YYYY-MM-DD.");
}

function assertCalendar(calendar) {
  const validation = validateWorkoutCalendarEnvelope(calendar);
  if (!validation.valid) fail("INVALID_CALENDAR", validation.issues.join(" "));
}

function assertSync(sync, scope) {
  const validation = validateAccountSyncEnvelope(sync);
  if (!validation.valid) fail("INVALID_SYNC_STATE", validation.issues.join(" "));
  const expectedOwner = scope.kind === "authenticated" ? scope.ownerUserId : null;
  if (sync.ownerUserId !== expectedOwner) {
    fail("ACCOUNT_BOUNDARY", "Starea de sincronizare nu aparține partiției active.");
  }
  sync.outbox.forEach((operation) => {
    if (scope.kind !== "authenticated" || operation.ownerUserId !== scope.ownerUserId) {
      fail("ACCOUNT_BOUNDARY", "Outbox-ul conține o operație din altă partiție.");
    }
  });
}

function assertCoverage(coverage) {
  if (!isRecord(coverage)) fail("INVALID_COVERAGE", "Metadatele de acoperire AMV2 sunt invalide.");
  if (Object.hasOwn(coverage, "history") && !validateHistoryCoverageState(coverage.history)) {
    fail("INVALID_HISTORY_COVERAGE", "Metadatele de acoperire a istoricului AMV2 sunt invalide.");
  }
}

function assertOperation(operation, scope) {
  if (!isRecord(operation)
    || !isText(operation.operationKey)
    || !OPERATION_TYPES.has(operation.type)
    || !Number.isInteger(operation.expectedRevision)
    || operation.expectedRevision < 0
    || !isRecord(operation.payload)
    || !isTimestamp(operation.createdAt)
    || scope.kind !== "authenticated"
    || operation.ownerUserId !== scope.ownerUserId) {
    fail("INVALID_OUTBOX_OPERATION", "Operația durabilă AMV2 este invalidă sau nu corespunde contului activ.");
  }
}

function defaultMeta(scope) {
  return {
    scope: scope.key,
    kind: scope.kind,
    ownerUserId: scope.ownerUserId,
    calendarRevision: 0,
    calendarUpdatedAt: EMPTY_TIMESTAMP,
    remoteRevisions: {},
    syncUpdatedAt: EMPTY_TIMESTAMP,
    localSyncRevision: 0,
    coverage: {},
  };
}

function localSyncRevisionOf(meta) {
  return Number.isInteger(meta.localSyncRevision) && meta.localSyncRevision >= 0
    ? meta.localSyncRevision
    : 0;
}

function assertExpectedSyncRevision(meta, expectedSyncRevision) {
  if (!Number.isInteger(expectedSyncRevision) || expectedSyncRevision < 0) {
    fail("MISSING_SYNC_REVISION", "Modificarea durabilă necesită revizia locală de sincronizare a stării de bază.");
  }
  const currentRevision = localSyncRevisionOf(meta);
  if (currentRevision !== expectedSyncRevision) {
    fail("STALE_SYNC_REVISION", "Starea locală de sincronizare a fost modificată de o altă operație.");
  }
  return currentRevision;
}

function validateStoredScope(record, scope) {
  if (record && record.scope !== scope.key) fail("ACCOUNT_BOUNDARY", "Înregistrarea locală aparține altei partiții.");
}

function validateOwnerMeta(meta, scope) {
  validateStoredScope(meta, scope);
  if (meta.kind !== scope.kind || meta.ownerUserId !== scope.ownerUserId) {
    fail("ACCOUNT_BOUNDARY", "Metadatele locale nu corespund partiției active.");
  }
}

async function ownerRecords(tx, store, scope) {
  const records = await tx.getAllByScope(store, scope.key);
  records.forEach((record) => validateStoredScope(record, scope));
  return records;
}

function envelopeFromRecords(scope, meta, dayRecords, personalRecords, outboxRecords, conflictRecords, importRecords) {
  const calendar = {
    ...createWorkoutCalendarEnvelope(meta.calendarUpdatedAt),
    revision: meta.calendarRevision,
    days: dayRecords.map((record) => clone(record.day)).sort((left, right) => left.date.localeCompare(right.date, "en")),
  };
  const sync = {
    ...createAccountSyncEnvelope(meta.syncUpdatedAt),
    ownerUserId: scope.ownerUserId,
    personalExercises: personalRecords.map((record) => clone(record.exercise)),
    outbox: outboxRecords.map((record) => clone(record.operation))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt, "en") || left.operationKey.localeCompare(right.operationKey, "en")),
    remoteRevisions: clone(meta.remoteRevisions),
    conflicts: conflictRecords.map((record) => clone(record.conflict)),
    importBatches: importRecords.map((record) => clone(record.batch)),
  };
  assertCalendar(calendar);
  assertSync(sync, scope);
  return { calendar, sync };
}

async function replaceScopeRecords(tx, store, scope, records) {
  await tx.deleteByScope(store, scope.key);
  for (const record of records) await tx.put(store, record);
}

async function writeSyncCollections(tx, scope, sync) {
  await replaceScopeRecords(tx, AMV2_DURABLE_STORES.personalExercises, scope,
    sync.personalExercises.map((exercise) => ({ scope: scope.key, id: exercise.id, exercise: clone(exercise) })));
  await replaceScopeRecords(tx, AMV2_DURABLE_STORES.outbox, scope,
    sync.outbox.map((operation) => ({ scope: scope.key, operationKey: operation.operationKey, operation: clone(operation) })));
  await replaceScopeRecords(tx, AMV2_DURABLE_STORES.conflicts, scope,
    sync.conflicts.map((conflict) => ({ scope: scope.key, operationKey: conflict.operationKey, conflict: clone(conflict) })));
  await replaceScopeRecords(tx, AMV2_DURABLE_STORES.importBatches, scope,
    sync.importBatches.map((batch) => ({ scope: scope.key, id: batch.id, batch: clone(batch) })));
}

function metaFromEnvelopes(scope, calendar, sync, current = defaultMeta(scope)) {
  return {
    ...current,
    scope: scope.key,
    kind: scope.kind,
    ownerUserId: scope.ownerUserId,
    calendarRevision: calendar.revision,
    calendarUpdatedAt: calendar.updatedAt,
    remoteRevisions: clone(sync.remoteRevisions),
    syncUpdatedAt: sync.updatedAt,
    localSyncRevision: localSyncRevisionOf(current) + 1,
  };
}

function intentRecord(scope, identity, intent, timestamp) {
  if (scope.kind === "anonymous") return null;
  if (!isRecord(intent) || (intent.kind !== "outbox" && intent.kind !== "local_only")) {
    fail("MISSING_DURABLE_INTENT", "Modificarea locală autentificată necesită o intenție durabilă.");
  }
  if (intent.kind === "outbox") {
    assertOperation(intent.operation, scope);
    return { kind: "outbox", operation: intent.operation };
  }
  if (!isText(intent.reason)) fail("INVALID_LOCAL_ONLY_INTENT", "Motivul stării locale recuperabile lipsește.");
  return {
    kind: "local_only",
    marker: { scope: scope.key, identity, reason: intent.reason, updatedAt: timestamp },
  };
}

async function persistIntent(tx, scope, identity, normalizedIntent) {
  if (!normalizedIntent) return;
  if (normalizedIntent.kind === "local_only") {
    await tx.put(AMV2_DURABLE_STORES.localOnly, normalizedIntent.marker);
    return;
  }
  const operation = normalizedIntent.operation;
  const key = [scope.key, operation.operationKey];
  const existing = await tx.get(AMV2_DURABLE_STORES.outbox, key);
  if (existing) {
    if (canonicalLocalJson(existing.operation) !== canonicalLocalJson(operation)) {
      fail("IDEMPOTENCY_KEY_REUSED", "Cheia operației durabile este deja folosită pentru alt conținut.");
    }
    return;
  }
  await tx.put(AMV2_DURABLE_STORES.outbox, {
    scope: scope.key,
    operationKey: operation.operationKey,
    operation: clone(operation),
  });
  await tx.delete(AMV2_DURABLE_STORES.localOnly, [scope.key, identity]);
}

function sourceFingerprint(calendarRaw, syncRaw) {
  let hash = 2_166_136_261;
  const input = `${calendarRaw ?? "<missing>"}\u0000${syncRaw ?? "<missing>"}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseLegacy(raw, validator) {
  if (raw === null) return { status: "missing" };
  try {
    const value = JSON.parse(raw);
    const validation = validator(value);
    return validation.valid ? { status: "valid", value } : { status: "invalid", reason: validation.issues.join(" ") };
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "JSON invalid" };
  }
}

function parseLegacySync(raw) {
  if (raw === null) return { status: "missing" };
  try {
    const parsed = JSON.parse(raw);
    const upgraded = upgradeLegacyAccountSyncEnvelope(parsed);
    if (upgraded.status === "invalid") return { status: "invalid", reason: upgraded.error };
    return {
      status: "valid",
      value: upgraded.envelope,
      quarantinedConflicts: upgraded.quarantinedConflicts,
    };
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "JSON invalid" };
  }
}

function latestTimestamp(left, right) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

async function mergeLegacyIntoScope(tx, scope, calendar, sync, timestamp, fingerprint) {
  const currentMeta = await tx.get(AMV2_DURABLE_STORES.ownerMeta, scope.key) ?? defaultMeta(scope);
  validateOwnerMeta(currentMeta, scope);
  const collisions = [];
  const knownRemoteIdentities = new Set([
    ...Object.keys(currentMeta.remoteRevisions),
    ...Object.keys(sync.remoteRevisions),
  ]);
  const currentOutbox = await tx.getAllByScope(AMV2_DURABLE_STORES.outbox, scope.key);
  const queuedIdentities = new Set([
    ...currentOutbox.map((record) => getAccountOperationRemoteIdentity(record.operation)),
    ...sync.outbox.map(getAccountOperationRemoteIdentity),
  ].filter(Boolean));
  for (const day of calendar.days) {
    const existing = await tx.get(AMV2_DURABLE_STORES.workoutDays, [scope.key, day.date]);
    if (!existing) await tx.put(AMV2_DURABLE_STORES.workoutDays, { scope: scope.key, date: day.date, day: clone(day) });
    else if (canonicalLocalJson(existing.day) !== canonicalLocalJson(day)) collisions.push(`day:${day.date}`);
    const identity = `day:${day.date}`;
    if (scope.kind === "authenticated" && !knownRemoteIdentities.has(identity) && !queuedIdentities.has(identity)) {
      const markerKey = [scope.key, identity];
      if (!await tx.get(AMV2_DURABLE_STORES.localOnly, markerKey)) {
        await tx.put(AMV2_DURABLE_STORES.localOnly, {
          scope: scope.key,
          identity,
          reason: "legacy_explicit_import_required",
          updatedAt: timestamp,
        });
      }
    }
  }
  for (const exercise of sync.personalExercises) {
    const existing = await tx.get(AMV2_DURABLE_STORES.personalExercises, [scope.key, exercise.id]);
    if (!existing) await tx.put(AMV2_DURABLE_STORES.personalExercises, { scope: scope.key, id: exercise.id, exercise: clone(exercise) });
    else if (canonicalLocalJson(existing.exercise) !== canonicalLocalJson(exercise)) collisions.push(`personal:${exercise.id}`);
    const identity = `personal:${exercise.id}`;
    if (scope.kind === "authenticated" && !knownRemoteIdentities.has(identity) && !queuedIdentities.has(identity)) {
      const markerKey = [scope.key, identity];
      if (!await tx.get(AMV2_DURABLE_STORES.localOnly, markerKey)) {
        await tx.put(AMV2_DURABLE_STORES.localOnly, {
          scope: scope.key,
          identity,
          reason: "legacy_explicit_import_required",
          updatedAt: timestamp,
        });
      }
    }
  }
  for (const operation of sync.outbox) {
    const existing = await tx.get(AMV2_DURABLE_STORES.outbox, [scope.key, operation.operationKey]);
    if (!existing) {
      await tx.put(AMV2_DURABLE_STORES.outbox, {
        scope: scope.key,
        operationKey: operation.operationKey,
        operation: clone(operation),
      });
    } else if (canonicalLocalJson(existing.operation) !== canonicalLocalJson(operation)) collisions.push(`outbox:${operation.operationKey}`);
  }
  for (const conflict of sync.conflicts) {
    const existing = await tx.get(AMV2_DURABLE_STORES.conflicts, [scope.key, conflict.operationKey]);
    if (!existing) await tx.put(AMV2_DURABLE_STORES.conflicts, { scope: scope.key, operationKey: conflict.operationKey, conflict: clone(conflict) });
  }
  for (const batch of sync.importBatches) {
    const existing = await tx.get(AMV2_DURABLE_STORES.importBatches, [scope.key, batch.id]);
    if (!existing) await tx.put(AMV2_DURABLE_STORES.importBatches, { scope: scope.key, id: batch.id, batch: clone(batch) });
  }
  const nextMeta = {
    ...currentMeta,
    kind: scope.kind,
    ownerUserId: scope.ownerUserId,
    calendarRevision: Math.max(currentMeta.calendarRevision, calendar.revision),
    calendarUpdatedAt: latestTimestamp(currentMeta.calendarUpdatedAt, calendar.updatedAt),
    remoteRevisions: { ...sync.remoteRevisions, ...currentMeta.remoteRevisions },
    syncUpdatedAt: latestTimestamp(currentMeta.syncUpdatedAt, sync.updatedAt),
    localSyncRevision: localSyncRevisionOf(currentMeta) + 1,
  };
  await tx.put(AMV2_DURABLE_STORES.ownerMeta, nextMeta);
  if (collisions.length > 0) {
    await tx.put(AMV2_DURABLE_STORES.quarantine, {
      id: `${AMV2_LEGACY_MIGRATION_ID}:collision:${fingerprint}`,
      scope: null,
      sourceKey: "legacy-collision",
      reason: `Coliziuni păstrate separat: ${collisions.join(", ")}`,
      raw: null,
      createdAt: timestamp,
    });
  }
  return collisions;
}

export function createAmv2DurableStore(backend) {
  if (!backend || typeof backend.runTransaction !== "function") {
    fail("INVALID_STORAGE_BACKEND", "Backendul durabil AMV2 este invalid.");
  }

  const store = {
    async readWorkoutDay(scope, date) {
      assertScope(scope);
      assertDate(date);
      return backend.runTransaction([AMV2_DURABLE_STORES.workoutDays], "readonly", async (tx) => {
        const record = await tx.get(AMV2_DURABLE_STORES.workoutDays, [scope.key, date]);
        validateStoredScope(record, scope);
        return record ? clone(record.day) : null;
      });
    },

    async readWorkoutDays(scope, { startDate = "0000-01-01", endDate = "9999-12-31" } = {}) {
      assertScope(scope);
      assertDate(startDate);
      assertDate(endDate);
      if (startDate > endDate) fail("INVALID_DATE_RANGE", "Intervalul calendaristic local este invalid.");
      return backend.runTransaction([AMV2_DURABLE_STORES.workoutDays], "readonly", async (tx) => {
        const records = await tx.getWorkoutDays(scope.key, startDate, endDate);
        records.forEach((record) => validateStoredScope(record, scope));
        return records.map((record) => clone(record.day)).sort((left, right) => left.date.localeCompare(right.date, "en"));
      });
    },

    async readOwnerState(scope, range) {
      assertScope(scope);
      return backend.runTransaction(OWNER_STORES, "readonly", async (tx) => {
        const meta = await tx.get(AMV2_DURABLE_STORES.ownerMeta, scope.key) ?? defaultMeta(scope);
        validateOwnerMeta(meta, scope);
        const dayRecords = range
          ? await tx.getWorkoutDays(scope.key, range.startDate, range.endDate)
          : await ownerRecords(tx, AMV2_DURABLE_STORES.workoutDays, scope);
        const [personal, outbox, conflicts, batches, localOnly] = await Promise.all([
          ownerRecords(tx, AMV2_DURABLE_STORES.personalExercises, scope),
          ownerRecords(tx, AMV2_DURABLE_STORES.outbox, scope),
          ownerRecords(tx, AMV2_DURABLE_STORES.conflicts, scope),
          ownerRecords(tx, AMV2_DURABLE_STORES.importBatches, scope),
          ownerRecords(tx, AMV2_DURABLE_STORES.localOnly, scope),
        ]);
        const envelopes = envelopeFromRecords(scope, meta, dayRecords, personal, outbox, conflicts, batches);
        return {
          ...envelopes,
          syncRevision: localSyncRevisionOf(meta),
          localOnly: localOnly.map((record) => clone(record)),
          coverage: clone(meta.coverage),
          partial: Boolean(range),
        };
      });
    },

    async replaceOwnerSnapshot(scope, { calendar, sync, coverage = {}, localOnly = [] }) {
      assertScope(scope);
      assertCalendar(calendar);
      assertSync(sync, scope);
      assertCoverage(coverage);
      if (!Array.isArray(localOnly) || localOnly.some((marker) => !isRecord(marker)
        || marker.scope !== scope.key
        || !isText(marker.identity)
        || !isText(marker.reason)
        || !isTimestamp(marker.updatedAt))) {
        fail("INVALID_LOCAL_ONLY_INTENT", "Markerii locali recuperabili sunt invalizi.");
      }
      return backend.runTransaction(OWNER_STORES, "readwrite", async (tx) => {
        const currentMeta = await tx.get(AMV2_DURABLE_STORES.ownerMeta, scope.key) ?? defaultMeta(scope);
        validateOwnerMeta(currentMeta, scope);
        for (const storeName of OWNER_STORES.filter((name) => name !== AMV2_DURABLE_STORES.ownerMeta)) {
          await tx.deleteByScope(storeName, scope.key);
        }
        for (const day of calendar.days) {
          await tx.put(AMV2_DURABLE_STORES.workoutDays, { scope: scope.key, date: day.date, day: clone(day) });
        }
        await writeSyncCollections(tx, scope, sync);
        for (const marker of localOnly) await tx.put(AMV2_DURABLE_STORES.localOnly, clone(marker));
        await tx.put(AMV2_DURABLE_STORES.ownerMeta, {
          ...metaFromEnvelopes(scope, calendar, sync, currentMeta),
          coverage: clone(coverage),
        });
        return { status: "saved", syncRevision: localSyncRevisionOf(currentMeta) + 1 };
      });
    },

    async commitOwnerSnapshot(scope, snapshot) {
      return store.replaceOwnerSnapshot(scope, snapshot);
    },

    async commitOwnerTransition(scope, {
      dayChanges = [],
      localOnlyChanges = [],
      calendarRevision,
      calendarUpdatedAt,
      sync,
      coverage,
      expectedSyncRevision,
    }) {
      assertScope(scope);
      if (sync) assertSync(sync, scope);
      if (coverage) assertCoverage(coverage);
      dayChanges.forEach(({ date, day }) => {
        assertDate(date);
        if (day !== null) {
          const validation = validateWorkoutDay(day);
          if (!validation.valid || day.date !== date) fail("INVALID_WORKOUT_DAY", validation.issues.join(" "));
        }
      });
      localOnlyChanges.forEach((marker) => {
        if (!isRecord(marker)
          || !isText(marker.identity)
          || !isText(marker.reason)
          || !isTimestamp(marker.updatedAt)) {
          fail("INVALID_LOCAL_ONLY_INTENT", "Markerul local recuperabil este invalid.");
        }
      });
      return backend.runTransaction(OWNER_STORES, "readwrite", async (tx) => {
        const meta = await tx.get(AMV2_DURABLE_STORES.ownerMeta, scope.key) ?? defaultMeta(scope);
        validateOwnerMeta(meta, scope);
        const currentSyncRevision = assertExpectedSyncRevision(meta, expectedSyncRevision);
        for (const { date, day } of dayChanges) {
          if (day === null) await tx.delete(AMV2_DURABLE_STORES.workoutDays, [scope.key, date]);
          else await tx.put(AMV2_DURABLE_STORES.workoutDays, { scope: scope.key, date, day: clone(day) });
        }
        for (const marker of localOnlyChanges) {
          await tx.put(AMV2_DURABLE_STORES.localOnly, {
            scope: scope.key,
            identity: marker.identity,
            reason: marker.reason,
            updatedAt: marker.updatedAt,
          });
        }
        if (sync) await writeSyncCollections(tx, scope, sync);
        const nextMeta = {
          ...meta,
          ...(Number.isInteger(calendarRevision) ? { calendarRevision } : {}),
          ...(isTimestamp(calendarUpdatedAt) ? { calendarUpdatedAt } : {}),
          ...(sync ? { remoteRevisions: clone(sync.remoteRevisions), syncUpdatedAt: sync.updatedAt } : {}),
          ...(coverage ? { coverage: clone(coverage) } : {}),
          localSyncRevision: currentSyncRevision + 1,
        };
        await tx.put(AMV2_DURABLE_STORES.ownerMeta, nextMeta);
        return { status: "saved", syncRevision: nextMeta.localSyncRevision };
      });
    },

    async commitWorkoutDayMutation(scope, mutation) {
      assertScope(scope);
      const nextCalendar = mutation.nextCalendar;
      if (nextCalendar !== undefined) assertCalendar(nextCalendar);
      const date = mutation.date;
      const day = Object.hasOwn(mutation, "day")
        ? mutation.day
        : nextCalendar?.days.find((candidate) => candidate.date === date) ?? null;
      const expectedCalendarRevision = mutation.expectedCalendarRevision
        ?? (nextCalendar ? nextCalendar.revision - 1 : undefined);
      const expectedSyncRevision = mutation.expectedSyncRevision;
      const timestamp = mutation.timestamp ?? nextCalendar?.updatedAt;
      const sync = mutation.nextSyncEnvelope;
      if (sync !== undefined) assertSync(sync, scope);
      assertDate(date);
      if (!isTimestamp(timestamp)) fail("INVALID_TIMESTAMP", "Modificarea locală nu are timestamp valid.");
      if (day !== null) {
        const validation = validateWorkoutDay(day);
        if (!validation.valid || day.date !== date) fail("INVALID_WORKOUT_DAY", validation.issues.join(" "));
      }
      let suppliedIntent = mutation.intent;
      if (scope.kind === "authenticated" && suppliedIntent === undefined && sync) {
        const operation = sync.outbox.findLast((candidate) => (candidate.type === "upsert_day" || candidate.type === "delete_day")
          && candidate.payload.date === date);
        if (operation) suppliedIntent = { kind: "outbox", operation };
      }
      if (scope.kind === "authenticated" && suppliedIntent === undefined && isText(mutation.localOnlyReason)) {
        suppliedIntent = { kind: "local_only", reason: mutation.localOnlyReason };
      }
      const identity = `day:${date}`;
      const normalizedIntent = scope.kind === "authenticated" && day === null && suppliedIntent === undefined
        ? { kind: "existing_local_only_delete" }
        : intentRecord(scope, identity, suppliedIntent, timestamp);
      return backend.runTransaction([
        AMV2_DURABLE_STORES.ownerMeta,
        AMV2_DURABLE_STORES.workoutDays,
        ...SYNC_COLLECTION_STORES,
        AMV2_DURABLE_STORES.localOnly,
      ], "readwrite", async (tx) => {
        const meta = await tx.get(AMV2_DURABLE_STORES.ownerMeta, scope.key) ?? defaultMeta(scope);
        validateOwnerMeta(meta, scope);
        const existing = await tx.get(AMV2_DURABLE_STORES.workoutDays, [scope.key, date]);
        const sameDay = canonicalLocalJson(existing?.day ?? null) === canonicalLocalJson(day);
        const existingOperation = normalizedIntent?.kind === "outbox"
          ? await tx.get(AMV2_DURABLE_STORES.outbox, [scope.key, normalizedIntent.operation.operationKey])
          : null;
        if (existingOperation) {
          if (canonicalLocalJson(existingOperation.operation) !== canonicalLocalJson(normalizedIntent.operation)
            || !sameDay) {
            fail("IDEMPOTENCY_KEY_REUSED", "Cheia operației durabile este deja folosită pentru altă modificare locală.");
          }
          return {
            status: "already_committed",
            calendarRevision: meta.calendarRevision,
            syncRevision: localSyncRevisionOf(meta),
          };
        }
        const currentSyncRevision = assertExpectedSyncRevision(meta, expectedSyncRevision);
        if (expectedCalendarRevision !== undefined && meta.calendarRevision !== expectedCalendarRevision) {
          fail("STALE_LOCAL_REVISION", "Calendarul local a fost modificat într-o altă tranzacție.");
        }
        const deletesLocalOnly = scope.kind === "authenticated"
          && day === null
          && (normalizedIntent?.kind === "existing_local_only_delete" || normalizedIntent?.kind === "local_only");
        if (deletesLocalOnly && (meta.remoteRevisions[identity] ?? 0) > 0) {
          fail("REMOTE_DELETE_INTENT_REQUIRED", "Ziua existentă în cont trebuie ștearsă printr-o operație cloud durabilă.");
        }
        if (deletesLocalOnly && !await tx.get(AMV2_DURABLE_STORES.localOnly, [scope.key, identity])) {
          fail("MISSING_DURABLE_INTENT", "Ștergerea unei zile sincronizabile necesită o intenție durabilă.");
        }
        if (sync) await writeSyncCollections(tx, scope, sync);
        if (deletesLocalOnly) await tx.delete(AMV2_DURABLE_STORES.localOnly, [scope.key, identity]);
        else await persistIntent(tx, scope, identity, normalizedIntent);
        if (day === null) await tx.delete(AMV2_DURABLE_STORES.workoutDays, [scope.key, date]);
        else await tx.put(AMV2_DURABLE_STORES.workoutDays, { scope: scope.key, date, day: clone(day) });
        const nextMeta = {
          ...meta,
          calendarRevision: nextCalendar?.revision ?? meta.calendarRevision + 1,
          calendarUpdatedAt: timestamp,
          ...(sync ? { remoteRevisions: clone(sync.remoteRevisions), syncUpdatedAt: sync.updatedAt } : {}),
          localSyncRevision: currentSyncRevision + 1,
        };
        await tx.put(AMV2_DURABLE_STORES.ownerMeta, nextMeta);
        return {
          status: "saved",
          calendarRevision: nextMeta.calendarRevision,
          syncRevision: nextMeta.localSyncRevision,
        };
      });
    },

    async commitPersonalExerciseMutation(scope, mutation) {
      assertScope(scope);
      const exercise = mutation.exercise ?? mutation.nextPersonal;
      const sync = mutation.nextSyncEnvelope;
      if (sync !== undefined) assertSync(sync, scope);
      const timestamp = mutation.timestamp ?? sync?.updatedAt;
      if (!isTimestamp(timestamp)) fail("INVALID_TIMESTAMP", "Modificarea locală nu are timestamp valid.");
      const validation = validatePersonalExercise(exercise);
      if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
      let suppliedIntent = mutation.intent;
      if (scope.kind === "authenticated" && suppliedIntent === undefined && sync) {
        const operation = sync.outbox.findLast((candidate) => (candidate.type === "upsert_personal" || candidate.type === "archive_personal")
          && candidate.payload.id === exercise.id);
        if (operation) suppliedIntent = { kind: "outbox", operation };
      }
      if (scope.kind === "authenticated" && suppliedIntent === undefined && isText(mutation.localOnlyReason)) {
        suppliedIntent = { kind: "local_only", reason: mutation.localOnlyReason };
      }
      const identity = `personal:${exercise.id}`;
      const normalizedIntent = intentRecord(scope, identity, suppliedIntent, timestamp);
      return backend.runTransaction([
        AMV2_DURABLE_STORES.ownerMeta,
        ...SYNC_COLLECTION_STORES,
        AMV2_DURABLE_STORES.localOnly,
      ], "readwrite", async (tx) => {
        const meta = await tx.get(AMV2_DURABLE_STORES.ownerMeta, scope.key) ?? defaultMeta(scope);
        validateOwnerMeta(meta, scope);
        const existingExercise = await tx.get(AMV2_DURABLE_STORES.personalExercises, [scope.key, exercise.id]);
        const existingOperation = normalizedIntent?.kind === "outbox"
          ? await tx.get(AMV2_DURABLE_STORES.outbox, [scope.key, normalizedIntent.operation.operationKey])
          : null;
        if (existingOperation) {
          if (canonicalLocalJson(existingOperation.operation) !== canonicalLocalJson(normalizedIntent.operation)
            || canonicalLocalJson(existingExercise?.exercise ?? null) !== canonicalLocalJson(exercise)) {
            fail("IDEMPOTENCY_KEY_REUSED", "Cheia operației durabile este deja folosită pentru altă modificare Personal.");
          }
          return { status: "already_committed", syncRevision: localSyncRevisionOf(meta) };
        }
        const currentSyncRevision = assertExpectedSyncRevision(meta, mutation.expectedSyncRevision);
        if (sync) await writeSyncCollections(tx, scope, sync);
        if (normalizedIntent?.kind === "local_only" && exercise.archivedAt !== null) {
          await tx.delete(AMV2_DURABLE_STORES.localOnly, [scope.key, identity]);
        } else {
          await persistIntent(tx, scope, identity, normalizedIntent);
        }
        await tx.put(AMV2_DURABLE_STORES.personalExercises, {
          scope: scope.key,
          id: exercise.id,
          exercise: clone(exercise),
        });
        await tx.put(AMV2_DURABLE_STORES.ownerMeta, {
          ...meta,
          syncUpdatedAt: timestamp,
          ...(sync ? { remoteRevisions: clone(sync.remoteRevisions) } : {}),
          localSyncRevision: currentSyncRevision + 1,
        });
        return { status: "saved", syncRevision: currentSyncRevision + 1 };
      });
    },

    async commitPersonalMutation(scope, mutation) {
      return store.commitPersonalExerciseMutation(scope, mutation);
    },

    async commitSyncState(scope, {
      nextSyncEnvelope,
      dayChange,
      nextCalendar,
      coverage,
      localOnlyChanges,
      expectedSyncRevision,
    }) {
      return store.commitOwnerTransition(scope, {
        sync: nextSyncEnvelope,
        dayChanges: dayChange ? [dayChange] : [],
        calendarRevision: nextCalendar?.revision,
        calendarUpdatedAt: nextCalendar?.updatedAt,
        coverage,
        localOnlyChanges,
        expectedSyncRevision,
      });
    },

    async migrateLegacyLocalStorage({ legacyStorage, anonymousScope, verifiedOwnerUserId = null, timestamp }) {
      assertScope(anonymousScope);
      if (anonymousScope.kind !== "anonymous") fail("INVALID_OWNER_SCOPE", "Migrarea anonimă necesită partiția instalării.");
      if (!isTimestamp(timestamp)) fail("INVALID_TIMESTAMP", "Migrarea locală nu are timestamp valid.");
      if (verifiedOwnerUserId !== null) createAuthenticatedOwnerScope(verifiedOwnerUserId);
      const previous = await backend.runTransaction([AMV2_DURABLE_STORES.migrations], "readonly",
        (tx) => tx.get(AMV2_DURABLE_STORES.migrations, AMV2_LEGACY_MIGRATION_ID));
      if (previous?.status === "complete") return { status: "already_migrated", result: previous.result, scopeKey: previous.scopeKey };

      const calendarRaw = legacyStorage.getItem(AMV2_WORKOUT_CALENDAR_STORAGE_KEY);
      const syncRaw = legacyStorage.getItem(AMV2_ACCOUNT_SYNC_STORAGE_KEY);
      const fingerprint = sourceFingerprint(calendarRaw, syncRaw);
      const calendarResult = parseLegacy(calendarRaw, validateWorkoutCalendarEnvelope);
      const syncResult = parseLegacySync(syncRaw);

      if (calendarResult.status === "missing" && syncResult.status === "missing") {
        await backend.runTransaction([AMV2_DURABLE_STORES.migrations], "readwrite", (tx) => tx.put(
          AMV2_DURABLE_STORES.migrations,
          { id: AMV2_LEGACY_MIGRATION_ID, status: "complete", result: "no_data", scopeKey: null, fingerprint, updatedAt: timestamp },
        ));
        return { status: "migrated", result: "no_data", scopeKey: null };
      }

      const syncInvalid = syncResult.status === "invalid";
      const ownerAmbiguous = syncInvalid && calendarResult.status === "valid";
      let targetScope = anonymousScope;
      if (syncResult.status === "valid" && syncResult.value.ownerUserId !== null) {
        if (verifiedOwnerUserId !== syncResult.value.ownerUserId) {
          await backend.runTransaction([AMV2_DURABLE_STORES.migrations], "readwrite", (tx) => tx.put(
            AMV2_DURABLE_STORES.migrations,
            {
              id: AMV2_LEGACY_MIGRATION_ID,
              status: "pending_owner_verification",
              result: "deferred",
              scopeKey: null,
              fingerprint,
              updatedAt: timestamp,
            },
          ));
          return { status: "deferred", result: "owner_verification_required", scopeKey: null };
        }
        targetScope = createAuthenticatedOwnerScope(verifiedOwnerUserId);
      }

      if (syncInvalid || ownerAmbiguous || (calendarResult.status === "invalid" && syncResult.status !== "valid")) {
        await backend.runTransaction([AMV2_DURABLE_STORES.quarantine, AMV2_DURABLE_STORES.migrations], "readwrite", async (tx) => {
          for (const [sourceKey, raw, parsed] of [
            [AMV2_WORKOUT_CALENDAR_STORAGE_KEY, calendarRaw, calendarResult],
            [AMV2_ACCOUNT_SYNC_STORAGE_KEY, syncRaw, syncResult],
          ]) {
            if (raw !== null) await tx.put(AMV2_DURABLE_STORES.quarantine, {
              id: `${AMV2_LEGACY_MIGRATION_ID}:${sourceKey}:${fingerprint}`,
              scope: null,
              sourceKey,
              reason: parsed.status === "invalid" ? parsed.reason : "Proprietarul nu poate fi verificat fără ambiguitate.",
              raw,
              createdAt: timestamp,
            });
          }
          await tx.put(AMV2_DURABLE_STORES.migrations, {
            id: AMV2_LEGACY_MIGRATION_ID,
            status: "complete",
            result: "quarantined",
            scopeKey: null,
            fingerprint,
            updatedAt: timestamp,
          });
        });
        return { status: "quarantined", result: "ambiguous_or_malformed", scopeKey: null };
      }

      const calendar = calendarResult.status === "valid"
        ? calendarResult.value
        : createWorkoutCalendarEnvelope(timestamp);
      const sync = syncResult.status === "valid"
        ? syncResult.value
        : createAccountSyncEnvelope(timestamp);
      if (targetScope.kind === "authenticated" && sync.ownerUserId !== targetScope.ownerUserId) {
        fail("ACCOUNT_BOUNDARY", "Migrarea legacy a identificat proprietari incompatibili.");
      }
      if (targetScope.kind === "anonymous" && sync.ownerUserId !== null) {
        fail("ACCOUNT_BOUNDARY", "Datele autentificate nu pot intra în partiția anonimă.");
      }

      const transactionStores = [...OWNER_STORES, AMV2_DURABLE_STORES.migrations, AMV2_DURABLE_STORES.quarantine];
      const collisions = await backend.runTransaction(transactionStores, "readwrite", async (tx) => {
        const found = await mergeLegacyIntoScope(tx, targetScope, calendar, sync, timestamp, fingerprint);
        if (syncResult.status === "valid" && syncResult.quarantinedConflicts.length > 0) {
          await tx.put(AMV2_DURABLE_STORES.quarantine, {
            id: `${AMV2_LEGACY_MIGRATION_ID}:legacy-conflicts:${fingerprint}`,
            scope: targetScope.key,
            sourceKey: `${AMV2_ACCOUNT_SYNC_STORAGE_KEY}:conflicts`,
            reason: "Conflictele legacy nu conțin candidații necesari unei rezolvări sigure.",
            raw: JSON.stringify(syncResult.quarantinedConflicts),
            createdAt: timestamp,
          });
        }
        if (calendarResult.status === "invalid" && calendarRaw !== null) {
          await tx.put(AMV2_DURABLE_STORES.quarantine, {
            id: `${AMV2_LEGACY_MIGRATION_ID}:${AMV2_WORKOUT_CALENDAR_STORAGE_KEY}:${fingerprint}`,
            scope: null,
            sourceKey: AMV2_WORKOUT_CALENDAR_STORAGE_KEY,
            reason: calendarResult.reason,
            raw: calendarRaw,
            createdAt: timestamp,
          });
        }
        await tx.put(AMV2_DURABLE_STORES.migrations, {
          id: AMV2_LEGACY_MIGRATION_ID,
          status: "verifying",
          result: found.length > 0 ? "migrated_with_collisions" : "migrated",
          scopeKey: targetScope.key,
          fingerprint,
          updatedAt: timestamp,
        });
        return found;
      });

      const verified = await store.readOwnerState(targetScope);
      const expectedDates = new Set(calendar.days.map((day) => day.date));
      const storedDates = new Set(verified.calendar.days.map((day) => day.date));
      const missingDate = [...expectedDates].find((date) => !storedDates.has(date) && !collisions.includes(`day:${date}`));
      if (missingDate) fail("LEGACY_MIGRATION_VERIFY_FAILED", `Ziua ${missingDate} lipsește după migrare.`);

      const result = collisions.length > 0 ? "migrated_with_collisions" : "migrated";
      await backend.runTransaction([AMV2_DURABLE_STORES.migrations], "readwrite", (tx) => tx.put(
        AMV2_DURABLE_STORES.migrations,
        { id: AMV2_LEGACY_MIGRATION_ID, status: "complete", result, scopeKey: targetScope.key, fingerprint, updatedAt: timestamp },
      ));
      return { status: "migrated", result, scopeKey: targetScope.key, collisions };
    },

    close() {
      backend.close?.();
    },
  };
  store.loadOwnerState = store.readOwnerState;
  store.loadWorkoutDaysRange = (scope, startDate, endDate) => store.readWorkoutDays(scope, { startDate, endDate });
  return Object.freeze(store);
}
