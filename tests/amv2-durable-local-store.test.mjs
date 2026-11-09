import assert from "node:assert/strict";
import test from "node:test";
import {
  AMV2_ACCOUNT_SYNC_STORAGE_KEY,
  bindAccountOwner,
  confirmAccountOperation,
  createAccountSyncEnvelope,
  enqueueAccountOperation,
  recordAccountConflict,
  replacePersonalExerciseInSync,
} from "../lib/amv2/account-sync-local.mjs";
import {
  AMV2_DURABLE_STORES,
  Amv2DurableLocalError,
  canonicalLocalJson,
  createAmv2DurableStore,
  createAnonymousOwnerScope,
  createAuthenticatedOwnerScope,
  getOrCreateAnonymousInstallationId,
} from "../lib/amv2/durable-local-store.mjs";
import { archivePersonalExercise, createPersonalExercise } from "../lib/amv2/personal-exercise-domain.mjs";
import {
  AMV2_WORKOUT_CALENDAR_STORAGE_KEY,
  createWorkoutCalendarEnvelope,
  replaceWorkoutDayInCalendar,
} from "../lib/amv2/workout-calendar-local.mjs";
import {
  addExerciseToWorkoutDay,
  createWorkoutDay,
  createWorkoutDayExercise,
  reduceWorkoutDayExercise,
} from "../lib/amv2/workout-day-domain.mjs";
import { createAmv2DurableMemoryBackend } from "./helpers/amv2-durable-memory.mjs";

const NOW = "2026-08-22T10:00:00.000Z";
const LATER = "2026-08-22T11:00:00.000Z";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.reads = 0;
  }
  getItem(key) {
    this.reads += 1;
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) { this.values.set(key, value); }
}

function canonicalExercise(id = "exercise-abdomene") {
  return createWorkoutDayExercise({
    exerciseId: id,
    exerciseKey: "abdomene",
    setIds: [`${id}-1`, `${id}-2`, `${id}-3`],
  });
}

function workoutDay(date, suffix = date) {
  return createWorkoutDay({
    date,
    location: "gym",
    exercise: canonicalExercise(`exercise-${suffix}`),
    timestamp: NOW,
  });
}

const DENSE_EXERCISE_KEYS = [
  "ab-wheel-din-genunchi",
  "abdomene",
  "alergare-pe-loc",
  "aplecari-laterale-din-picioare",
  "atingeri-alternative-ale-piciorului-din-picioare",
  "burpees",
  "cobra-din-culcat",
  "crunch-cu-gantera",
  "crunch-cu-minge",
  "dead-bug",
];

function denseWorkoutDay(date, suffix) {
  let day = null;
  DENSE_EXERCISE_KEYS.forEach((exerciseKey, exerciseIndex) => {
    const exerciseId = `dense-${suffix}-${exerciseIndex}`;
    let exercise = createWorkoutDayExercise({
      exerciseId,
      exerciseKey,
      setIds: Array.from({ length: 3 }, (_, setIndex) => `${exerciseId}-set-${setIndex + 1}`),
    });
    for (let setIndex = 3; setIndex < 20; setIndex += 1) {
      exercise = reduceWorkoutDayExercise(exercise, {
        type: "add_set",
        setId: `${exerciseId}-set-${setIndex + 1}`,
      }, NOW);
    }
    day = addExerciseToWorkoutDay(day, { date, location: "gym", exercise, timestamp: NOW });
  });
  return day;
}

function calendarWithDays(days, timestamp = NOW) {
  return {
    ...createWorkoutCalendarEnvelope(timestamp),
    revision: days.length,
    days: [...days].sort((left, right) => left.date.localeCompare(right.date, "en")),
  };
}

function accountSync(ownerUserId, timestamp = NOW) {
  return bindAccountOwner(createAccountSyncEnvelope(timestamp), ownerUserId, timestamp);
}

function operation(ownerUserId, operationKey, date, payload = { date }) {
  return {
    ownerUserId,
    operationKey,
    type: "upsert_day",
    expectedRevision: 0,
    payload,
    createdAt: NOW,
  };
}

test("partițiile folosesc numai identificatori opaci și installation ID-ul anonim este stabil", () => {
  assert.equal(createAuthenticatedOwnerScope("d982e355-0327-4a3d-a275-1e863d9ed80f").key,
    "user:d982e355-0327-4a3d-a275-1e863d9ed80f");
  assert.equal(createAnonymousOwnerScope("install_123").key, "anon:install_123");
  assert.throws(() => createAuthenticatedOwnerScope("owner@example.com"), Amv2DurableLocalError);

  const storage = new MemoryStorage();
  const cryptoProvider = { randomUUID: () => "b15be495-aadc-475d-a668-5fd92b02ab69" };
  assert.equal(getOrCreateAnonymousInstallationId(storage, cryptoProvider), "b15be495-aadc-475d-a668-5fd92b02ab69");
  assert.equal(getOrCreateAnonymousInstallationId(storage, { randomUUID: () => "different" }),
    "b15be495-aadc-475d-a668-5fd92b02ab69");
});

test("A, anonim și B au calendare, Personal, outbox și conflicte complet independente", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const ownerA = createAuthenticatedOwnerScope("owner-a");
  const ownerB = createAuthenticatedOwnerScope("owner-b");
  const anonymous = createAnonymousOwnerScope("install-a");
  const personalA = createPersonalExercise({
    id: "personal-a", clientKey: "client-a", name: "Exercițiul A",
    category: "Piept", metricType: "repetitions_weight", timestamp: NOW,
  });
  let syncA = replacePersonalExerciseInSync(accountSync("owner-a"), personalA, NOW);
  syncA = enqueueAccountOperation(syncA, operation("owner-a", "op-a", "2026-08-22"), NOW);
  syncA = recordAccountConflict(syncA, {
    operationKey: "op-a",
    remoteIdentity: "day:2026-08-22",
    remoteRevision: 4,
    remoteCandidate: { date: "2026-08-22", remote: true },
    remoteDeleted: false,
    reason: "stale",
  }, LATER);
  syncA = {
    ...syncA,
    importBatches: [{ id: "batch-a", source: "v1_local", status: "completed" }],
  };

  await store.commitOwnerSnapshot(ownerA, {
    calendar: calendarWithDays([workoutDay("2026-08-22", "a")]),
    sync: syncA,
    coverage: { "2026-08": "complete" },
    localOnly: [{ scope: ownerA.key, identity: "day:2026-08-20", reason: "explicit_import", updatedAt: NOW }],
  });
  await store.commitOwnerSnapshot(ownerB, { calendar: calendarWithDays([workoutDay("2026-08-23", "b")]), sync: accountSync("owner-b") });
  await store.commitOwnerSnapshot(anonymous, {
    calendar: calendarWithDays([workoutDay("2026-08-24", "anon")]),
    sync: createAccountSyncEnvelope(NOW),
  });

  const [a, b, anon] = await Promise.all([
    store.loadOwnerState(ownerA),
    store.loadOwnerState(ownerB),
    store.loadOwnerState(anonymous),
  ]);
  assert.deepEqual(a.calendar.days.map((day) => day.date), ["2026-08-22"]);
  assert.deepEqual(b.calendar.days.map((day) => day.date), ["2026-08-23"]);
  assert.deepEqual(anon.calendar.days.map((day) => day.date), ["2026-08-24"]);
  assert.deepEqual(a.sync.personalExercises.map((exercise) => exercise.id), ["personal-a"]);
  assert.deepEqual(b.sync.personalExercises, []);
  assert.deepEqual(anon.sync.personalExercises, []);
  assert.deepEqual(a.sync.outbox.map((item) => item.operationKey), ["op-a"]);
  assert.equal(a.sync.conflicts.length, 1);
  assert.deepEqual(a.sync.importBatches.map((batch) => batch.id), ["batch-a"]);
  assert.deepEqual(a.localOnly.map((marker) => marker.identity), ["day:2026-08-20"]);
  assert.deepEqual(a.coverage, { "2026-08": "complete" });
  assert.equal(b.sync.outbox.length + b.sync.conflicts.length, 0);
  assert.deepEqual(b.sync.importBatches, []);
  assert.deepEqual(b.localOnly, []);
});

test("WorkoutDay și outbox se confirmă într-o singură tranzacție sau nu se confirmă deloc", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const scope = createAuthenticatedOwnerScope("owner-a");
  await store.commitOwnerSnapshot(scope, {
    calendar: createWorkoutCalendarEnvelope(NOW),
    sync: accountSync("owner-a"),
  });
  const day = workoutDay("2026-08-22");
  const outboxOperation = operation("owner-a", "op-atomic", day.date);
  backend.failNext(
    ({ action, store: storeName }) => action === "put" && storeName === AMV2_DURABLE_STORES.outbox,
    new DOMException("Quota exceeded", "QuotaExceededError"),
  );

  await assert.rejects(
    store.commitWorkoutDayMutation(scope, {
      date: day.date,
      day,
      expectedCalendarRevision: 0,
      expectedSyncRevision: 1,
      timestamp: NOW,
      intent: { kind: "outbox", operation: outboxOperation },
    }),
    /Quota exceeded/,
  );
  let loaded = await store.loadOwnerState(scope);
  assert.deepEqual(loaded.calendar.days, []);
  assert.deepEqual(loaded.sync.outbox, []);
  assert.equal(loaded.calendar.revision, 0);

  backend.failNext(
    ({ action, store: storeName }) => action === "put" && storeName === AMV2_DURABLE_STORES.workoutDays,
    new DOMException("Structured clone failed", "DataCloneError"),
  );
  await assert.rejects(store.commitWorkoutDayMutation(scope, {
    date: day.date,
    day,
    expectedCalendarRevision: 0,
    expectedSyncRevision: 1,
    timestamp: NOW,
    intent: { kind: "outbox", operation: outboxOperation },
  }), (error) => error instanceof DOMException && error.name === "DataCloneError");
  loaded = await store.loadOwnerState(scope);
  assert.deepEqual(loaded.calendar.days, []);
  assert.deepEqual(loaded.sync.outbox, [], "eșecul de serializare nu poate lăsa intenția fără graf sau invers");

  const nextCalendar = calendarWithDays([day]);
  const nextSyncEnvelope = enqueueAccountOperation(accountSync("owner-a"), outboxOperation, NOW);
  assert.deepEqual(await store.commitWorkoutDayMutation(scope, {
    date: day.date,
    nextCalendar,
    nextSyncEnvelope,
    expectedSyncRevision: 1,
  }), { status: "saved", calendarRevision: 1, syncRevision: 2 });
  loaded = await store.loadOwnerState(scope);
  assert.equal(loaded.calendar.days.length, 1);
  assert.deepEqual(loaded.sync.outbox.map((item) => item.operationKey), ["op-atomic"]);

  assert.deepEqual(await store.commitWorkoutDayMutation(scope, {
    date: day.date,
    nextCalendar,
    nextSyncEnvelope,
    expectedSyncRevision: 1,
  }), { status: "already_committed", calendarRevision: 1, syncRevision: 2 });
});

test("un cont autentificat nu poate persista o mutație fără outbox sau marker local recuperabil", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const scope = createAuthenticatedOwnerScope("owner-a");
  const day = workoutDay("2026-08-22");
  await assert.rejects(store.commitWorkoutDayMutation(scope, {
    date: day.date,
    day,
    expectedSyncRevision: 0,
    timestamp: NOW,
  }), (error) => error.code === "MISSING_DURABLE_INTENT");
  assert.deepEqual((await store.loadOwnerState(scope)).calendar.days, []);

  await store.commitWorkoutDayMutation(scope, {
    date: day.date,
    day,
    expectedSyncRevision: 0,
    timestamp: NOW,
    localOnlyReason: "explicit_account_import_required",
  });
  const state = await store.loadOwnerState(scope);
  assert.equal(state.calendar.days.length, 1);
  assert.deepEqual(state.localOnly.map((marker) => marker.identity), ["day:2026-08-22"]);
});

test("o zi local-only care are revizie cloud pozitivă nu poate fi ștearsă fără delete outbox", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const scope = createAuthenticatedOwnerScope("owner-a");
  const day = workoutDay("2026-08-22");
  const calendar = calendarWithDays([day]);
  const sync = {
    ...accountSync("owner-a"),
    remoteRevisions: { "day:2026-08-22": 2 },
  };
  await store.commitOwnerSnapshot(scope, {
    calendar,
    sync,
    localOnly: [{
      scope: scope.key,
      identity: "day:2026-08-22",
      reason: "explicit_import_required",
      updatedAt: NOW,
    }],
  });

  await assert.rejects(store.commitWorkoutDayMutation(scope, {
    date: day.date,
    day: null,
    nextCalendar: replaceWorkoutDayInCalendar(calendar, day.date, null, LATER),
    nextSyncEnvelope: sync,
    expectedCalendarRevision: calendar.revision,
    expectedSyncRevision: 1,
    timestamp: LATER,
    localOnlyReason: "explicit_import_required",
  }), (error) => error.code === "REMOTE_DELETE_INTENT_REQUIRED");

  const state = await store.loadOwnerState(scope);
  assert.deepEqual(state.calendar.days.map((item) => item.date), [day.date]);
  assert.deepEqual(state.localOnly.map((marker) => marker.identity), [`day:${day.date}`]);
  assert.equal(state.syncRevision, 1);
});

test("Personal și intenția sa cloud sunt atomice în aceeași tranzacție durabilă", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const scope = createAuthenticatedOwnerScope("owner-a");
  await store.commitOwnerSnapshot(scope, {
    calendar: createWorkoutCalendarEnvelope(NOW),
    sync: accountSync("owner-a"),
  });
  const personal = createPersonalExercise({
    id: "personal-atomic", clientKey: "client-atomic", name: "Atomic",
    category: "Spate", metricType: "repetitions_only", timestamp: NOW,
  });
  const cloudOperation = {
    ownerUserId: "owner-a",
    operationKey: "personal-op",
    type: "upsert_personal",
    expectedRevision: 0,
    payload: { id: personal.id, name: personal.name },
    createdAt: NOW,
  };
  const nextSyncEnvelope = enqueueAccountOperation(
    replacePersonalExerciseInSync(accountSync("owner-a"), personal, NOW),
    cloudOperation,
    NOW,
  );
  backend.failNext(({ action, store: storeName }) => action === "put" && storeName === AMV2_DURABLE_STORES.outbox);
  await assert.rejects(store.commitPersonalMutation(scope, {
    nextPersonal: personal,
    nextSyncEnvelope,
    expectedSyncRevision: 1,
  }));
  let state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.personalExercises, []);
  assert.deepEqual(state.sync.outbox, []);

  await store.commitPersonalMutation(scope, {
    nextPersonal: personal,
    nextSyncEnvelope,
    expectedSyncRevision: 1,
  });
  state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.personalExercises.map((item) => item.id), [personal.id]);
  assert.deepEqual(state.sync.outbox.map((item) => item.operationKey), [cloudOperation.operationKey]);
});

test("CAS-ul local respinge un snapshot Personal stale și permite retry pe starea reîncărcată", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const scope = createAuthenticatedOwnerScope("owner-a");
  const baseSync = accountSync("owner-a");
  await store.commitOwnerSnapshot(scope, {
    calendar: createWorkoutCalendarEnvelope(NOW),
    sync: baseSync,
  });
  const buildPersonalMutation = (id, currentSync, operationKey) => {
    const personal = createPersonalExercise({
      id,
      clientKey: `client-${id}`,
      name: id,
      category: "Piept",
      metricType: "repetitions_only",
      timestamp: NOW,
    });
    const cloudOperation = {
      ownerUserId: "owner-a",
      operationKey,
      type: "upsert_personal",
      expectedRevision: 0,
      payload: { id },
      createdAt: NOW,
    };
    return {
      personal,
      cloudOperation,
      nextSync: enqueueAccountOperation(
        replacePersonalExerciseInSync(currentSync, personal, NOW),
        cloudOperation,
        NOW,
      ),
    };
  };
  const first = buildPersonalMutation("personal-a", baseSync, "personal-op-a");
  const staleSecond = buildPersonalMutation("personal-b", baseSync, "personal-op-b");
  await store.commitPersonalMutation(scope, {
    nextPersonal: first.personal,
    nextSyncEnvelope: first.nextSync,
    expectedSyncRevision: 1,
    intent: { kind: "outbox", operation: first.cloudOperation },
  });
  await assert.rejects(store.commitPersonalMutation(scope, {
    nextPersonal: staleSecond.personal,
    nextSyncEnvelope: staleSecond.nextSync,
    expectedSyncRevision: 1,
    intent: { kind: "outbox", operation: staleSecond.cloudOperation },
  }), (error) => error.code === "STALE_SYNC_REVISION");
  let state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.personalExercises.map((item) => item.id), ["personal-a"]);
  assert.deepEqual(state.sync.outbox.map((item) => item.operationKey), ["personal-op-a"]);

  const retried = buildPersonalMutation("personal-b", state.sync, "personal-op-b");
  await store.commitPersonalMutation(scope, {
    nextPersonal: retried.personal,
    nextSyncEnvelope: retried.nextSync,
    expectedSyncRevision: state.syncRevision,
    intent: { kind: "outbox", operation: retried.cloudOperation },
  });
  state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.personalExercises.map((item) => item.id).sort(), ["personal-a", "personal-b"]);
  assert.deepEqual(state.sync.outbox.map((item) => item.operationKey), ["personal-op-a", "personal-op-b"]);
  assert.equal(state.syncRevision, 3);

  const duplicate = await store.commitPersonalMutation(scope, {
    nextPersonal: first.personal,
    nextSyncEnvelope: first.nextSync,
    expectedSyncRevision: 1,
    intent: { kind: "outbox", operation: first.cloudOperation },
  });
  assert.deepEqual(duplicate, { status: "already_committed", syncRevision: 3 });
  state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.personalExercises.map((item) => item.id).sort(), ["personal-a", "personal-b"],
    "retry-ul vechi trebuie urmat de reload, nu de publicarea envelope-ului furnizat");
  assert.deepEqual(state.sync.outbox.map((item) => item.operationKey), ["personal-op-a", "personal-op-b"]);
});

test("un ACK stale nu poate șterge o mutație ulterioară și retry-ul elimină numai operația confirmată", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const scope = createAuthenticatedOwnerScope("owner-a");
  const dayOperation = operation("owner-a", "day-op", "2026-08-22");
  const initialSync = enqueueAccountOperation(accountSync("owner-a"), dayOperation, NOW);
  await store.commitOwnerSnapshot(scope, {
    calendar: createWorkoutCalendarEnvelope(NOW),
    sync: initialSync,
  });
  const staleAck = confirmAccountOperation(initialSync, "day-op", "day:2026-08-22", 1, LATER);
  const personal = createPersonalExercise({
    id: "personal-after-send",
    clientKey: "client-after-send",
    name: "După trimitere",
    category: "Spate",
    metricType: "repetitions_only",
    timestamp: LATER,
  });
  const personalOperation = {
    ownerUserId: "owner-a",
    operationKey: "personal-after-send-op",
    type: "upsert_personal",
    expectedRevision: 0,
    payload: { id: personal.id },
    createdAt: LATER,
  };
  const afterSendSync = enqueueAccountOperation(
    replacePersonalExerciseInSync(initialSync, personal, LATER),
    personalOperation,
    LATER,
  );
  await store.commitPersonalMutation(scope, {
    nextPersonal: personal,
    nextSyncEnvelope: afterSendSync,
    expectedSyncRevision: 1,
    intent: { kind: "outbox", operation: personalOperation },
  });

  await assert.rejects(store.commitSyncState(scope, {
    nextSyncEnvelope: staleAck,
    expectedSyncRevision: 1,
  }), (error) => error.code === "STALE_SYNC_REVISION");
  let state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.outbox.map((item) => item.operationKey), ["day-op", "personal-after-send-op"]);

  const retriedAck = confirmAccountOperation(state.sync, "day-op", "day:2026-08-22", 1, LATER);
  await store.commitSyncState(scope, {
    nextSyncEnvelope: retriedAck,
    expectedSyncRevision: state.syncRevision,
  });
  state = await store.loadOwnerState(scope);
  assert.deepEqual(state.sync.outbox.map((item) => item.operationKey), ["personal-after-send-op"]);
  assert.equal(state.sync.remoteRevisions["day:2026-08-22"], 1);
  assert.equal(state.syncRevision, 3);
});

test("migrarea legacy autentificată folosește exact ownerul verificat, nu contul sau anonimul activ", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const ownerA = createAuthenticatedOwnerScope("owner-a");
  const anonymous = createAnonymousOwnerScope("install-a");
  const calendar = calendarWithDays([workoutDay("2026-08-22")]);
  const sync = accountSync("owner-a");
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendar),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(sync),
  });
  const migrated = await store.migrateLegacyLocalStorage({
    legacyStorage: legacy,
    anonymousScope: anonymous,
    verifiedOwnerUserId: "owner-a",
    timestamp: NOW,
  });
  assert.equal(migrated.scopeKey, ownerA.key);
  assert.equal((await store.loadOwnerState(ownerA)).calendar.days.length, 1);
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 0);
  assert.notEqual(legacy.getItem(AMV2_WORKOUT_CALENDAR_STORAGE_KEY), null, "sursa legacy rămâne până la verificare externă");
});

test("migrarea păstrează datele unui owner verificat și izolează numai conflictele legacy incomplete", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const ownerA = createAuthenticatedOwnerScope("owner-a");
  const anonymous = createAnonymousOwnerScope("install-a");
  const queued = operation("owner-a", "op-legacy", "2026-08-22");
  const legacySync = {
    ...enqueueAccountOperation(accountSync("owner-a"), queued, NOW),
    conflicts: [{
      operationKey: "op-legacy",
      remoteRevision: 3,
      message: "Conflict legacy fără snapshot remote",
      detectedAt: LATER,
    }],
    importBatches: [{ id: "legacy-batch", source: "v1_local", status: "completed" }],
  };
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([workoutDay("2026-08-22")])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(legacySync),
  });

  const result = await store.migrateLegacyLocalStorage({
    legacyStorage: legacy,
    anonymousScope: anonymous,
    verifiedOwnerUserId: "owner-a",
    timestamp: NOW,
  });

  assert.equal(result.status, "migrated");
  const migrated = await store.loadOwnerState(ownerA);
  assert.equal(migrated.calendar.days.length, 1);
  assert.deepEqual(migrated.sync.outbox.map((item) => item.operationKey), ["op-legacy"]);
  assert.deepEqual(migrated.sync.importBatches.map((batch) => batch.id), ["legacy-batch"]);
  assert.deepEqual(migrated.sync.conflicts, [], "un conflict fără candidați nu devine un conflict activ imposibil de rezolvat");
  const quarantine = backend.snapshot(AMV2_DURABLE_STORES.quarantine);
  assert.equal(quarantine.length, 1);
  assert.equal(quarantine[0].scope, ownerA.key);
  assert.match(quarantine[0].sourceKey, /conflicts$/);
  assert.match(quarantine[0].raw, /Conflict legacy fără snapshot remote/);
});

test("datele legacy autentificate fără revizie sau outbox devin local-only, iar ștergerea zilei elimină markerul", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const ownerA = createAuthenticatedOwnerScope("owner-a");
  const anonymous = createAnonymousOwnerScope("install-a");
  const personalLocal = createPersonalExercise({
    id: "personal-local", clientKey: "client-local", name: "Personal local",
    category: "Piept", metricType: "repetitions_weight", timestamp: NOW,
  });
  const personalRemote = createPersonalExercise({
    id: "personal-remote", clientKey: "client-remote", name: "Personal remote",
    category: "Spate", metricType: "repetitions_only", timestamp: NOW,
  });
  const personalQueued = createPersonalExercise({
    id: "personal-queued", clientKey: "client-queued", name: "Personal queued",
    category: "Umeri", metricType: "time_per_set", timestamp: NOW,
  });
  let sync = accountSync("owner-a");
  for (const exercise of [personalLocal, personalRemote, personalQueued]) {
    sync = replacePersonalExerciseInSync(sync, exercise, NOW);
  }
  sync = enqueueAccountOperation(sync, operation("owner-a", "queued-day", "2026-08-24"), NOW);
  sync = enqueueAccountOperation(sync, {
    ownerUserId: "owner-a",
    operationKey: "queued-personal",
    type: "upsert_personal",
    expectedRevision: 0,
    payload: { id: personalQueued.id },
    createdAt: NOW,
  }, NOW);
  sync = {
    ...sync,
    remoteRevisions: {
      "day:2026-08-23": 2,
      [`personal:${personalRemote.id}`]: 1,
    },
  };
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([
      workoutDay("2026-08-22", "local"),
      workoutDay("2026-08-23", "remote"),
      workoutDay("2026-08-24", "queued"),
    ])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(sync),
  });

  await store.migrateLegacyLocalStorage({
    legacyStorage: legacy,
    anonymousScope: anonymous,
    verifiedOwnerUserId: "owner-a",
    timestamp: NOW,
  });
  let state = await store.loadOwnerState(ownerA);
  assert.deepEqual(state.localOnly.map((marker) => marker.identity).sort(), [
    "day:2026-08-22",
    "personal:personal-local",
  ]);
  assert.ok(state.localOnly.every((marker) => marker.reason === "legacy_explicit_import_required"));

  await store.commitWorkoutDayMutation(ownerA, {
    date: "2026-08-22",
    day: null,
    expectedCalendarRevision: 3,
    expectedSyncRevision: state.syncRevision,
    timestamp: LATER,
    localOnlyReason: "legacy_explicit_import_required",
  });
  state = await store.loadOwnerState(ownerA);
  assert.deepEqual(state.calendar.days.map((day) => day.date), ["2026-08-23", "2026-08-24"]);
  assert.deepEqual(state.localOnly.map((marker) => marker.identity), ["personal:personal-local"]);

  const archivedLocal = archivePersonalExercise(personalLocal, LATER);
  const archivedSync = replacePersonalExerciseInSync(state.sync, archivedLocal, LATER);
  await store.commitPersonalMutation(ownerA, {
    nextPersonal: archivedLocal,
    nextSyncEnvelope: archivedSync,
    expectedSyncRevision: state.syncRevision,
    timestamp: LATER,
    localOnlyReason: "archived_local_definition",
  });
  state = await store.loadOwnerState(ownerA);
  assert.equal(state.sync.personalExercises.find((exercise) => exercise.id === personalLocal.id)?.archivedAt, LATER);
  assert.deepEqual(state.localOnly, []);
});

test("legacy-ul autentificat nu este expus altui cont și se reia când proprietarul verificat revine", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const anonymous = createAnonymousOwnerScope("install-a");
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([workoutDay("2026-08-22")])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(accountSync("owner-a")),
  });
  const deferred = await store.migrateLegacyLocalStorage({
    legacyStorage: legacy,
    anonymousScope: anonymous,
    verifiedOwnerUserId: "owner-b",
    timestamp: NOW,
  });
  assert.equal(deferred.status, "deferred");
  assert.equal((await store.loadOwnerState(createAuthenticatedOwnerScope("owner-b"))).calendar.days.length, 0);
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 0);

  const resumed = await store.migrateLegacyLocalStorage({
    legacyStorage: legacy,
    anonymousScope: anonymous,
    verifiedOwnerUserId: "owner-a",
    timestamp: LATER,
  });
  assert.equal(resumed.status, "migrated");
  assert.equal((await store.loadOwnerState(createAuthenticatedOwnerScope("owner-a"))).calendar.days.length, 1);
});

test("migrarea legacy anonimă nu revendică automat datele într-un cont", async () => {
  const store = createAmv2DurableStore(createAmv2DurableMemoryBackend());
  const anonymous = createAnonymousOwnerScope("install-a");
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([workoutDay("2026-08-22")])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(createAccountSyncEnvelope(NOW)),
  });
  const migrated = await store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: NOW });
  assert.equal(migrated.scopeKey, anonymous.key);
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 1);
  assert.equal((await store.loadOwnerState(createAuthenticatedOwnerScope("owner-a"))).calendar.days.length, 0);
});

test("ownership ambiguu sau envelope malformed sunt carantinate și nu sunt afișate", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const anonymous = createAnonymousOwnerScope("install-a");
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([workoutDay("2026-08-22")])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: "{malformed",
  });
  const result = await store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: NOW });
  assert.equal(result.status, "quarantined");
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 0);
  assert.equal(backend.snapshot(AMV2_DURABLE_STORES.quarantine).length, 2);
  assert.notEqual(legacy.getItem(AMV2_ACCOUNT_SYNC_STORAGE_KEY), null);
});

test("un envelope sync malformed fără calendar este păstrat numai în carantină", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const anonymous = createAnonymousOwnerScope("install-a");
  const legacy = new MemoryStorage({ [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: "{malformed" });
  const result = await store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: NOW });
  assert.equal(result.status, "quarantined");
  assert.equal((await store.loadOwnerState(anonymous)).sync.outbox.length, 0);
  assert.equal(backend.snapshot(AMV2_DURABLE_STORES.quarantine).length, 1);
});

test("migrarea legacy este restartabilă, idempotentă și nu recitește globalul după verificare", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const anonymous = createAnonymousOwnerScope("install-a");
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([workoutDay("2026-08-22")])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(createAccountSyncEnvelope(NOW)),
  });
  backend.failNext(({ action, store: storeName }) => action === "put" && storeName === AMV2_DURABLE_STORES.migrations);
  await assert.rejects(store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: NOW }));
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 0, "tranzacția întreruptă nu lasă date parțiale");

  const completed = await store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: LATER });
  assert.equal(completed.status, "migrated");
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 1);
  const readsAfterCompletion = legacy.reads;
  const repeated = await store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: LATER });
  assert.equal(repeated.status, "already_migrated");
  assert.equal(legacy.reads, readsAfterCompletion, "globalul legacy nu mai este citit după migrarea verificată");
  assert.equal((await store.loadOwnerState(anonymous)).calendar.days.length, 1);
});

test("legacy și store nou se îmbină fără duplicate și păstrează coliziunile în carantină", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const anonymous = createAnonymousOwnerScope("install-a");
  const existingDay = workoutDay("2026-08-22", "new");
  await store.commitOwnerSnapshot(anonymous, {
    calendar: calendarWithDays([existingDay]),
    sync: createAccountSyncEnvelope(NOW),
  });
  const conflictingLegacyDay = workoutDay("2026-08-22", "legacy");
  const additionalLegacyDay = workoutDay("2026-08-23", "legacy-second");
  const legacy = new MemoryStorage({
    [AMV2_WORKOUT_CALENDAR_STORAGE_KEY]: JSON.stringify(calendarWithDays([conflictingLegacyDay, additionalLegacyDay])),
    [AMV2_ACCOUNT_SYNC_STORAGE_KEY]: JSON.stringify(createAccountSyncEnvelope(NOW)),
  });
  const result = await store.migrateLegacyLocalStorage({ legacyStorage: legacy, anonymousScope: anonymous, timestamp: NOW });
  assert.equal(result.result, "migrated_with_collisions");
  const days = (await store.loadOwnerState(anonymous)).calendar.days;
  assert.deepEqual(days.map((day) => day.date), ["2026-08-22", "2026-08-23"]);
  assert.equal(days[0].exercises[0].id, existingDay.exercises[0].id, "datele noi câștigă fără a pierde legacy-ul brut");
  assert.equal(backend.snapshot(AMV2_DURABLE_STORES.quarantine).length, 1);
});

test("store-ul persistă cinci ani și peste 512 KiB, cu citire parțială pe interval", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const owner = createAuthenticatedOwnerScope("owner-capacity");
  const start = Date.UTC(2020, 0, 1);
  const days = Array.from({ length: 1_826 }, (_, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return index % 100 === 0 ? denseWorkoutDay(date, String(index)) : workoutDay(date, String(index));
  });
  const calendar = calendarWithDays(days, LATER);
  const serializedBytes = new TextEncoder().encode(JSON.stringify(calendar)).byteLength;
  assert.ok(serializedBytes > 512 * 1_024, `fixture-ul are ${serializedBytes} bytes`);
  let sync = accountSync("owner-capacity", LATER);
  for (let index = 0; index < 20; index += 1) {
    sync = replacePersonalExerciseInSync(sync, createPersonalExercise({
      id: `personal-capacity-${index}`,
      clientKey: `personal-capacity-client-${index}`,
      name: `Exercițiu capacitate ${index}`,
      category: "Piept",
      metricType: "repetitions_weight",
      timestamp: LATER,
    }), LATER);
  }
  for (let index = 0; index < 10; index += 1) {
    sync = enqueueAccountOperation(sync, operation(
      "owner-capacity",
      `capacity-op-${index}`,
      days[index].date,
    ), LATER);
  }
  await store.commitOwnerSnapshot(owner, { calendar, sync });

  const march = await store.loadWorkoutDaysRange(owner, "2024-03-01", "2024-03-31");
  assert.equal(march.length, 31);
  assert.equal(march[0].date, "2024-03-01");
  assert.equal(march.at(-1).date, "2024-03-31");
  const reloaded = await store.loadOwnerState(owner);
  assert.equal(reloaded.calendar.days.length, 1_826);
  assert.equal(reloaded.calendar.days[0].date, "2020-01-01");
  assert.equal(reloaded.calendar.days.at(-1).date, "2024-12-30");
  assert.equal(reloaded.calendar.days.filter((day) => day.exercises.length === 10).length, 19);
  assert.equal(reloaded.sync.personalExercises.length, 20);
  assert.equal(reloaded.sync.outbox.length, 10);
});

test("canonicalizarea locală este stabilă la ordinea cheilor și păstrează zero/null", () => {
  assert.equal(
    canonicalLocalJson({ z: 0, nested: { b: null, a: [2, 1] } }),
    canonicalLocalJson({ nested: { a: [2, 1], b: null }, z: 0 }),
  );
  assert.notEqual(canonicalLocalJson({ value: 0 }), canonicalLocalJson({ value: null }));
});

test("pagina cloud și cursorul de acoperire se confirmă atomic sau rămân ambele neschimbate", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const owner = createAuthenticatedOwnerScope("owner-history-page");
  await store.commitOwnerSnapshot(owner, {
    calendar: calendarWithDays([]),
    sync: accountSync("owner-history-page"),
    coverage: {},
  });
  const before = await store.loadOwnerState(owner);
  backend.failNext(({ action, store: storeName }) => action === "put" && storeName === AMV2_DURABLE_STORES.ownerMeta);
  await assert.rejects(store.commitOwnerTransition(owner, {
    dayChanges: [{ date: "2021-01-01", day: workoutDay("2021-01-01", "history-page") }],
    coverage: {
      history: {
        version: 1,
        status: "incomplete",
        snapshotRevision: 4,
        cursor: "2021-01-01",
        earliestDate: "2021-01-01",
        latestDate: "2021-01-01",
        lastDurablePageAt: LATER,
        errorCode: null,
      },
    },
    expectedSyncRevision: before.syncRevision,
  }), /Injected durable storage failure/);
  const after = await store.loadOwnerState(owner);
  assert.deepEqual(after.calendar.days, []);
  assert.deepEqual(after.coverage, {});
  assert.equal(after.syncRevision, before.syncRevision);
});

test("carantinarea cloud și markerul local-only se persistă atomic", async () => {
  const backend = createAmv2DurableMemoryBackend();
  const store = createAmv2DurableStore(backend);
  const owner = createAuthenticatedOwnerScope("owner-permanent-failure");
  const initialSync = enqueueAccountOperation(
    accountSync("owner-permanent-failure"),
    operation("owner-permanent-failure", "permanent-failure", "2026-08-22"),
    NOW,
  );
  await store.commitOwnerSnapshot(owner, { calendar: calendarWithDays([workoutDay("2026-08-22")]), sync: initialSync });
  const before = await store.loadOwnerState(owner);
  const quarantined = {
    ...initialSync,
    outbox: [],
    importBatches: [{
      id: "failed:permanent-failure",
      source: "cloud_operation",
      status: "permanently_failed",
      operationKey: "permanent-failure",
      code: "VALIDATION",
      message: "Invalid",
      dependencies: ["day:2026-08-22"],
      failedAt: LATER,
    }],
    updatedAt: LATER,
  };
  const localOnlyChanges = [{ identity: "day:2026-08-22", reason: "cloud_operation_permanently_failed", updatedAt: LATER }];

  backend.failNext(({ action, store: storeName }) => action === "put" && storeName === AMV2_DURABLE_STORES.localOnly);
  await assert.rejects(store.commitSyncState(owner, {
    nextSyncEnvelope: quarantined,
    localOnlyChanges,
    expectedSyncRevision: before.syncRevision,
  }), /Injected durable storage failure/);
  const failed = await store.loadOwnerState(owner);
  assert.deepEqual(failed.sync.outbox.map((item) => item.operationKey), ["permanent-failure"]);
  assert.deepEqual(failed.localOnly, []);

  await store.commitSyncState(owner, {
    nextSyncEnvelope: quarantined,
    localOnlyChanges,
    expectedSyncRevision: failed.syncRevision,
  });
  const committed = await store.loadOwnerState(owner);
  assert.deepEqual(committed.sync.outbox, []);
  assert.equal(committed.sync.importBatches[0].status, "permanently_failed");
  assert.deepEqual(committed.localOnly.map((marker) => marker.identity), ["day:2026-08-22"]);
});
