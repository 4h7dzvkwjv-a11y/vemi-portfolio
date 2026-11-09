import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bindAccountOwner,
  createAccountSyncEnvelope,
  enqueueAccountOperation,
  readAccountSyncEnvelope,
  reconcileConfirmedAccountOperation,
  recordAccountConflict,
  resolveAccountConflictWithLocal,
  resolveAccountConflictWithRemote,
  upgradeLegacyAccountSyncEnvelope,
  writeAccountSyncEnvelope,
} from "../lib/amv2/account-sync-local.mjs";
import { hydrateCloudCalendarSnapshot, serializeWorkoutDayForCloud } from "../lib/amv2/cloud-graph.mjs";
import {
  canonicalJsonStringify,
  canonicalizeWorkoutDayForSync,
  personalExercisesDomainEqual,
  planRemoteDayReconciliation,
  planRemotePersonalReconciliation,
  workoutDaysDomainEqual,
} from "../lib/amv2/sync-reconciliation.mjs";
import { createPersonalExercise } from "../lib/amv2/personal-exercise-domain.mjs";
import { createWorkoutDay, createWorkoutDayExercise } from "../lib/amv2/workout-day-domain.mjs";

const NOW = "2026-08-21T10:00:00.000Z";
const LATER = "2026-08-21T13:00:00+03:00";
const OWNER = "owner-a";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function day({ date = "2026-08-21", timestamp = NOW, repetitions = 8 } = {}) {
  const exercise = createWorkoutDayExercise({
    exerciseId: `exercise-${date}`,
    exerciseKey: "abdomene",
    setIds: [`set-${date}-1`, `set-${date}-2`, `set-${date}-3`],
  });
  exercise.sets = exercise.sets.map((set) => ({ ...set, targetRepetitions: repetitions }));
  return createWorkoutDay({ date, location: "gym", exercise, timestamp });
}

function operationFor(sourceDay, operationKey = "op-day", expectedRevision = 1) {
  return {
    ownerUserId: OWNER,
    operationKey,
    type: "upsert_day",
    expectedRevision,
    payload: serializeWorkoutDayForCloud(sourceDay),
    createdAt: NOW,
  };
}

test("egalitatea canonică ignoră timestampuri volatile și ordinea cheilor, dar păstrează valorile de domeniu", () => {
  const left = day();
  const right = {
    updatedAt: LATER,
    exercises: left.exercises.map((exercise) => ({
      metricType: exercise.metricType,
      category: exercise.category,
      displayName: exercise.displayName,
      reference: { exerciseKey: exercise.reference.exerciseKey, source: exercise.reference.source },
      orderIndex: exercise.orderIndex,
      id: exercise.id,
      sets: exercise.sets.map((set) => ({
        targetRepetitions: set.targetRepetitions,
        orderIndex: set.orderIndex,
        id: set.id,
      })),
    })),
    location: left.location,
    date: left.date,
    createdAt: "2026-08-20T22:00:00-02:00",
  };
  assert.equal(workoutDaysDomainEqual(left, right), true);
  assert.equal(canonicalJsonStringify({ z: 0, a: null }), canonicalJsonStringify({ a: null, z: -0 }));
  assert.deepEqual(canonicalizeWorkoutDayForSync(left), canonicalizeWorkoutDayForSync(right));
  assert.equal(workoutDaysDomainEqual(left, day({ repetitions: 9 })), false);
});

test("operation key tratează payloaduri cu ordine diferită drept aceeași intenție", () => {
  let envelope = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  const operation = operationFor(day(), "stable-order", 0);
  envelope = enqueueAccountOperation(envelope, operation, NOW);
  const reorderedPayload = {
    exercises: operation.payload.exercises,
    location: operation.payload.location,
    clientKey: operation.payload.clientKey,
    date: operation.payload.date,
  };
  assert.equal(enqueueAccountOperation(envelope, { ...operation, payload: reorderedPayload }, LATER), envelope);
});

test("upgrade-ul legacy păstrează owner/outbox și izolează numai conflictele vechi nerezolvabile", () => {
  let legacy = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  legacy = enqueueAccountOperation(legacy, operationFor(day(), "legacy-op"), NOW);
  legacy = {
    ...legacy,
    conflicts: [{ operationKey: "legacy-op", remoteRevision: 2, message: "stale", detectedAt: LATER }],
  };
  const upgraded = upgradeLegacyAccountSyncEnvelope(legacy);
  assert.equal(upgraded.status, "upgraded");
  assert.equal(upgraded.envelope.ownerUserId, OWNER);
  assert.equal(upgraded.envelope.outbox.length, 1);
  assert.equal(upgraded.envelope.conflicts.length, 0);
  assert.equal(upgraded.quarantinedConflicts.length, 1);
});

test("egalitatea Personal ignoră revision/timestamp, dar păstrează identitatea, valorile și starea archive", () => {
  const personal = createPersonalExercise({
    id: "personal-one", clientKey: "client-one", name: "Exercițiul meu",
    category: "Piept", metricType: "repetitions_weight", timestamp: NOW,
  });
  assert.equal(personalExercisesDomainEqual(personal, {
    ...personal, revision: 9, createdAt: LATER, updatedAt: LATER,
  }), true);
  assert.equal(personalExercisesDomainEqual(personal, {
    ...personal, revision: 9, archivedAt: LATER, updatedAt: LATER,
  }), false);
  assert.equal(personalExercisesDomainEqual(personal, {
    ...personal, revision: 9, name: "Alt nume", updatedAt: LATER,
  }), false);

  const pending = {
    ownerUserId: OWNER, operationKey: "personal-op", type: "upsert_personal", expectedRevision: 0,
    payload: { id: personal.id }, createdAt: NOW,
  };
  assert.equal(planRemotePersonalReconciliation({
    localExercise: personal,
    remoteExercise: { ...personal, revision: 1, createdAt: LATER, updatedAt: LATER },
    pendingOperation: pending,
  }).action, "adopt_equivalent_remote");
  assert.equal(planRemotePersonalReconciliation({
    localExercise: personal,
    remoteExercise: { ...personal, revision: 1, name: "Alt nume", updatedAt: LATER },
    pendingOperation: pending,
  }).action, "conflict");
});

test("conflictul complet supraviețuiește reload și keep-local produce o intenție retryabilă", () => {
  const localDay = day({ repetitions: 8 });
  const remoteDay = { ...day({ repetitions: 12 }), createdAt: LATER, updatedAt: LATER };
  let envelope = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  envelope = enqueueAccountOperation(envelope, operationFor(localDay), NOW);
  envelope = recordAccountConflict(envelope, {
    operationKey: "op-day",
    remoteIdentity: "day:2026-08-21",
    remoteRevision: 4,
    remoteCandidate: remoteDay,
    remoteDeleted: false,
    reason: "CONCURRENT_DOMAIN_CHANGE",
  }, LATER);

  const storage = memoryStorage();
  assert.equal(writeAccountSyncEnvelope(storage, envelope).status, "saved_local");
  const loaded = readAccountSyncEnvelope(storage);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.envelope.conflicts[0].remoteCandidate, remoteDay);
  assert.deepEqual(loaded.envelope.conflicts[0].localCandidate, serializeWorkoutDayForCloud(localDay));

  const resolved = resolveAccountConflictWithLocal(loaded.envelope, loaded.envelope.conflicts[0].id, LATER);
  assert.equal(resolved.conflicts.length, 0);
  assert.equal(resolved.outbox[0].expectedRevision, 4);
  assert.deepEqual(resolved.outbox[0].payload, serializeWorkoutDayForCloud(localDay));
});

test("adopt-remote înlocuiește candidatul și elimină numai operațiile aceleiași identități", () => {
  const localDay = day({ repetitions: 8 });
  const remoteDay = { ...day({ repetitions: 12 }), createdAt: LATER, updatedAt: LATER };
  let envelope = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  envelope = enqueueAccountOperation(envelope, operationFor(localDay, "first"), NOW);
  envelope = enqueueAccountOperation(envelope, operationFor(localDay, "later"), NOW);
  envelope = enqueueAccountOperation(envelope, {
    ownerUserId: OWNER, operationKey: "unrelated", type: "delete_day", expectedRevision: 1,
    payload: { date: "2026-08-22" }, createdAt: NOW,
  }, NOW);
  envelope = recordAccountConflict(envelope, {
    operationKey: "first", remoteIdentity: "day:2026-08-21", remoteRevision: 5,
    remoteCandidate: remoteDay, reason: "CONCURRENT_DOMAIN_CHANGE",
  }, LATER);
  const resolution = resolveAccountConflictWithRemote(envelope, "conflict:first", LATER);
  assert.deepEqual(resolution.supersededOperationKeys, ["first", "later"]);
  assert.deepEqual(resolution.canonicalCandidate, remoteDay);
  assert.equal(resolution.envelope.outbox.length, 1);
  assert.equal(resolution.envelope.outbox[0].operationKey, "unrelated");
  assert.equal(resolution.envelope.remoteRevisions["day:2026-08-21"], 5);
});

test("rezolvarea rămâne posibilă dacă operația lipsește la reload și adopt-remote poate confirma delete", () => {
  const localDay = day();
  let envelope = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  envelope = enqueueAccountOperation(envelope, operationFor(localDay, "rebuild-op"), NOW);
  envelope = recordAccountConflict(envelope, {
    operationKey: "rebuild-op", remoteIdentity: "day:2026-08-21", remoteRevision: 2,
    remoteCandidate: null, remoteDeleted: true, reason: "REMOTE_DELETED_WHILE_LOCAL_CHANGED",
  }, LATER);
  const withoutOperation = { ...envelope, outbox: [] };
  const keepLocal = resolveAccountConflictWithLocal(withoutOperation, "conflict:rebuild-op", LATER);
  assert.equal(keepLocal.outbox.length, 1);
  assert.equal(keepLocal.outbox[0].expectedRevision, 2);
  assert.deepEqual(keepLocal.outbox[0].payload, serializeWorkoutDayForCloud(localDay));

  const adoptRemote = resolveAccountConflictWithRemote(withoutOperation, "conflict:rebuild-op", LATER);
  assert.equal(adoptRemote.deleted, true);
  assert.equal(adoptRemote.canonicalCandidate, null);
  assert.equal(adoptRemote.envelope.conflicts.length, 0);
  assert.equal(adoptRemote.envelope.remoteRevisions["day:2026-08-21"], 2);
});

test("confirmarea autoritativă scoate numai operația confirmată și propagă revizia către cele ulterioare", () => {
  const source = day();
  let envelope = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  envelope = enqueueAccountOperation(envelope, operationFor(source, "first", 0), NOW);
  envelope = enqueueAccountOperation(envelope, operationFor(source, "second", 0), NOW);
  const confirmation = reconcileConfirmedAccountOperation(envelope, {
    operationKey: "first",
    remoteIdentity: "day:2026-08-21",
    revision: 1,
    canonicalCandidate: { ...source, updatedAt: LATER },
  }, LATER);
  assert.equal(confirmation.envelope.outbox.length, 1);
  assert.equal(confirmation.envelope.outbox[0].operationKey, "second");
  assert.equal(confirmation.envelope.outbox[0].expectedRevision, 1);
  assert.equal(confirmation.hasAuthoritativeCandidate, true);
  assert.equal(workoutDaysDomainEqual(source, confirmation.canonicalCandidate), true);
  const duplicateResponse = reconcileConfirmedAccountOperation(confirmation.envelope, {
    operationKey: "first", remoteIdentity: "day:2026-08-21", revision: 1,
  }, LATER);
  assert.equal(duplicateResponse.alreadyAcknowledged, true);
  assert.equal(duplicateResponse.envelope, confirmation.envelope);
});

test("plannerul reconciliază timestampuri echivalente și diferențe reale fără conflict fals", () => {
  const localDay = day();
  const equivalentRemote = { ...localDay, createdAt: LATER, updatedAt: LATER, revision: 2 };
  const pending = operationFor(localDay, "pending", 1);
  assert.equal(planRemoteDayReconciliation({
    localDay, remoteDay: equivalentRemote, pendingOperation: pending, knownRevision: 2,
  }).action, "adopt_equivalent_remote");

  const changed = { ...day({ repetitions: 12 }), revision: 2 };
  const conflict = planRemoteDayReconciliation({
    localDay, remoteDay: changed, pendingOperation: pending, knownRevision: 2,
  });
  assert.equal(conflict.action, "conflict");
  assert.equal(conflict.reason, "CONCURRENT_DOMAIN_CHANGE");
});

test("plannerul tratează ștergerea remote ca stare revizionată și nu ca absență", () => {
  const localDay = day();
  const tombstone = { date: localDay.date, revision: 2, deletedAt: LATER };
  assert.deepEqual(planRemoteDayReconciliation({ localDay, tombstone }), {
    action: "adopt_remote_delete", revision: 2,
  });
  const changed = planRemoteDayReconciliation({
    localDay, tombstone, pendingOperation: operationFor(localDay, "stale-edit", 1),
  });
  assert.equal(changed.action, "conflict");
  assert.equal(changed.remoteDeleted, true);
  assert.equal(changed.remoteRevision, 2);
  const deleting = planRemoteDayReconciliation({
    localDay, tombstone,
    pendingOperation: { ...operationFor(localDay, "delete", 1), type: "delete_day", payload: { date: localDay.date } },
  });
  assert.equal(deleting.action, "acknowledge_equivalent_delete");
});

test("hidratarea cloud livrează tombstone-urile și reviziile separat de graful activ", () => {
  const snapshot = hydrateCloudCalendarSnapshot({
    days: [], exercises: [], sets: [], personalExercises: [],
    tombstones: [{ workout_date: "2026-08-21", revision: 3, deleted_at: LATER }],
  });
  assert.deepEqual(snapshot.days, []);
  assert.deepEqual(snapshot.dayRevisions, {});
  assert.deepEqual(snapshot.tombstones, [{ date: "2026-08-21", revision: 3, deletedAt: LATER }]);
  assert.throws(() => hydrateCloudCalendarSnapshot({
    days: [], exercises: [], sets: [], personalExercises: [],
    tombstones: [null],
  }), /marker de ștergere invalid/);
});
