import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bindAccountOwner,
  createAccountSyncEnvelope,
  enqueueAccountOperation,
  replacePersonalExerciseInSync,
} from "../lib/amv2/account-sync-local.mjs";
import { serializePersonalExerciseForCloud, serializeWorkoutDayForCloud } from "../lib/amv2/cloud-graph.mjs";
import {
  adoptRemoteConflictProjection,
  reconcileCloudConflictOwnerProjection,
  reconcileConfirmedOwnerProjection,
  reconcileRemoteOwnerHistoryPage,
  reconcileRemoteOwnerProjection,
} from "../lib/amv2/owner-sync-projection.mjs";
import { createPersonalExercise } from "../lib/amv2/personal-exercise-domain.mjs";
import { createWorkoutCalendarEnvelope, replaceWorkoutDayInCalendar } from "../lib/amv2/workout-calendar-local.mjs";
import { deriveWorkoutStatistics } from "../lib/amv2/workout-statistics.mjs";
import { createWorkoutDay, createWorkoutDayExercise } from "../lib/amv2/workout-day-domain.mjs";

const NOW = "2026-08-22T08:00:00.000Z";
const LATER = "2026-08-22T10:00:00.000Z";
const OWNER = "owner-r1";

function makeDay(repetitions = 8, timestamp = NOW) {
  const exercise = createWorkoutDayExercise({
    exerciseId: "exercise-one",
    exerciseKey: "abdomene",
    setIds: ["set-1", "set-2", "set-3"],
  });
  exercise.sets = exercise.sets.map((set) => ({ ...set, targetRepetitions: repetitions }));
  return createWorkoutDay({ date: "2026-08-21", location: "gym", exercise, timestamp });
}

function baseProjection(sourceDay = makeDay()) {
  const calendar = replaceWorkoutDayInCalendar(createWorkoutCalendarEnvelope(NOW), sourceDay.date, sourceDay, NOW);
  const sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  return { calendar, sync };
}

function operation(sourceDay, operationKey = "op-one", expectedRevision = 0) {
  return {
    ownerUserId: OWNER,
    operationKey,
    type: "upsert_day",
    expectedRevision,
    payload: serializeWorkoutDayForCloud(sourceDay),
    createdAt: NOW,
  };
}

test("snapshoturile echivalente cu timestampuri diferite nu creează conflict și confirmarea adoptă serverul", () => {
  const source = makeDay();
  const projection = baseProjection(source);
  const pending = operation(source);
  const sync = enqueueAccountOperation(projection.sync, pending, NOW);
  const remote = { ...source, createdAt: LATER, updatedAt: LATER };
  const merged = reconcileRemoteOwnerProjection({
    calendar: projection.calendar,
    sync,
    remote: {
      days: [remote],
      personalExercises: [],
      tombstones: [],
      dayRevisions: { [source.date]: 1 },
    },
    monthKey: "2026-08",
    timestamp: LATER,
  });
  assert.equal(merged.hasConflict, false);
  assert.equal(merged.sync.conflicts.length, 0);
  assert.equal(merged.sync.outbox.length, 0);
  assert.equal(merged.sync.remoteRevisions[`day:${source.date}`], 1);
  assert.equal(merged.calendar.days[0].updatedAt, LATER);

  const confirmed = reconcileConfirmedOwnerProjection({
    calendar: merged.calendar,
    sync: merged.sync,
    operationKey: pending.operationKey,
    remoteIdentity: `day:${source.date}`,
    revision: 1,
    canonicalCandidate: remote,
    deleted: false,
    timestamp: LATER,
  });
  assert.equal(confirmed.sync.outbox.length, 0);
  assert.equal(confirmed.sync.remoteRevisions[`day:${source.date}`], 1);
  assert.equal(confirmed.calendar.days[0].updatedAt, LATER);
});

test("revizia hidratată reală detectează modificarea concurentă chiar dacă ziua nu poartă câmp revision", () => {
  const local = makeDay(8);
  const remote = makeDay(12, LATER);
  const projection = baseProjection(local);
  projection.sync.remoteRevisions[`day:${local.date}`] = 1;
  const sync = enqueueAccountOperation(projection.sync, operation(local, "stale-edit", 1), NOW);
  const merged = reconcileRemoteOwnerProjection({
    calendar: projection.calendar,
    sync,
    remote: {
      days: [remote],
      personalExercises: [],
      tombstones: [],
      dayRevisions: { [local.date]: 2 },
    },
    monthKey: "2026-08",
    timestamp: LATER,
  });
  assert.equal(merged.hasConflict, true);
  assert.equal(merged.sync.conflicts[0].remoteRevision, 2);
  assert.equal(merged.sync.conflicts[0].reason, "CONCURRENT_DOMAIN_CHANGE");
});

test("snapshotul Personal echivalent confirmă intenția fără retry sau conflict fals", () => {
  const personal = createPersonalExercise({
    id: "personal-one",
    clientKey: "personal-client-one",
    name: "Împins personal",
    category: "Piept",
    metricType: "repetitions_weight",
    timestamp: NOW,
  });
  const projection = baseProjection();
  let sync = replacePersonalExerciseInSync(projection.sync, personal, NOW);
  sync = enqueueAccountOperation(sync, {
    ownerUserId: OWNER,
    operationKey: "personal-equivalent",
    type: "upsert_personal",
    expectedRevision: 0,
    payload: serializePersonalExerciseForCloud(personal),
    createdAt: NOW,
  }, NOW);
  const remote = { ...personal, revision: 1, createdAt: LATER, updatedAt: LATER };
  const merged = reconcileRemoteOwnerProjection({
    calendar: projection.calendar,
    sync,
    remote: { days: [], personalExercises: [remote], tombstones: [], dayRevisions: {} },
    monthKey: "2026-08",
    timestamp: LATER,
  });
  assert.equal(merged.hasConflict, false);
  assert.equal(merged.sync.outbox.length, 0);
  assert.equal(merged.sync.remoteRevisions[`personal:${personal.id}`], 1);
  assert.equal(merged.sync.personalExercises[0].revision, 1);
});

test("tombstone-ul remote elimină ziua cache-uită și împiedică resurrection", () => {
  const source = makeDay();
  const projection = baseProjection(source);
  projection.sync.remoteRevisions[`day:${source.date}`] = 1;
  const merged = reconcileRemoteOwnerProjection({
    ...projection,
    remote: {
      days: [],
      personalExercises: [],
      tombstones: [{ date: source.date, revision: 2, deletedAt: LATER }],
      dayRevisions: {},
    },
    monthKey: "2026-08",
    timestamp: LATER,
  });
  assert.equal(merged.calendar.days.length, 0);
  assert.deepEqual(merged.dayChanges, [{ date: source.date, day: null }]);
  assert.equal(merged.sync.remoteRevisions[`day:${source.date}`], 2);
  const statistics = deriveWorkoutStatistics(merged.calendar.days, "2026-08-22");
  assert.equal(statistics.activeDays, 0);
  assert.deepEqual(statistics.exerciseHistories, []);
});

test("o pagină de acoperire istorică reconciliază date din luni diferite fără a pierde overlay-ul local", () => {
  const august = makeDay();
  const january = { ...makeDay(9, LATER), date: "2022-01-10" };
  const pendingSeptember = { ...makeDay(13, LATER), date: "2025-09-03" };
  let calendar = replaceWorkoutDayInCalendar(createWorkoutCalendarEnvelope(NOW), pendingSeptember.date, pendingSeptember, NOW);
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  sync = enqueueAccountOperation(sync, operation(pendingSeptember, "pending-page", 0), NOW);
  const merged = reconcileRemoteOwnerHistoryPage({
    calendar,
    sync,
    localOnly: [],
    remote: {
      days: [august, january],
      personalExercises: [],
      tombstones: [],
      dayRevisions: { [august.date]: 1, [january.date]: 2 },
    },
    timestamp: LATER,
  });
  assert.deepEqual(merged.calendar.days.map((day) => day.date), ["2022-01-10", "2025-09-03", "2026-08-21"]);
  assert.equal(merged.sync.outbox[0].operationKey, "pending-page");
  assert.deepEqual(merged.dayChanges.map((change) => change.date).sort(), ["2022-01-10", "2026-08-21"]);
});

test("delete-ul repetat este recunoscut din tombstone și nu rămâne blocat în outbox", () => {
  const source = makeDay();
  const projection = baseProjection(source);
  const deletedCalendar = replaceWorkoutDayInCalendar(projection.calendar, source.date, null, LATER);
  const pendingDelete = {
    ownerUserId: OWNER,
    operationKey: "delete-again",
    type: "delete_day",
    expectedRevision: 1,
    payload: { date: source.date },
    createdAt: LATER,
  };
  const sync = enqueueAccountOperation(projection.sync, pendingDelete, LATER);
  const merged = reconcileRemoteOwnerProjection({
    calendar: deletedCalendar,
    sync,
    remote: {
      days: [],
      personalExercises: [],
      tombstones: [{ date: source.date, revision: 2, deletedAt: LATER }],
      dayRevisions: {},
    },
    monthKey: "2026-08",
    timestamp: LATER,
  });
  assert.equal(merged.calendar.days.length, 0);
  assert.equal(merged.sync.outbox.length, 0);
  assert.equal(merged.sync.remoteRevisions[`day:${source.date}`], 2);
});

test("editarea concurentă versus delete produce conflict complet și adopt-remote rămâne executabil", () => {
  const source = makeDay(12);
  const projection = baseProjection(source);
  const pending = operation(source, "concurrent-edit", 1);
  const sync = enqueueAccountOperation(projection.sync, pending, NOW);
  const merged = reconcileRemoteOwnerProjection({
    calendar: projection.calendar,
    sync,
    remote: {
      days: [],
      personalExercises: [],
      tombstones: [{ date: source.date, revision: 2, deletedAt: LATER }],
      dayRevisions: {},
    },
    monthKey: "2026-08",
    timestamp: LATER,
  });
  assert.equal(merged.hasConflict, true);
  assert.equal(merged.sync.conflicts[0].remoteDeleted, true);
  assert.deepEqual(merged.sync.conflicts[0].localCandidate, serializeWorkoutDayForCloud(source));

  const adopted = adoptRemoteConflictProjection({
    calendar: merged.calendar,
    sync: merged.sync,
    conflictId: merged.sync.conflicts[0].id,
    timestamp: LATER,
  });
  assert.equal(adopted.calendar.days.length, 0);
  assert.equal(adopted.sync.conflicts.length, 0);
  assert.equal(adopted.sync.outbox.length, 0);
});

test("confirmarea unei operații vechi păstrează candidatul local al operației ulterioare", () => {
  const first = makeDay(8);
  const latest = makeDay(15, LATER);
  let projection = baseProjection(latest);
  const firstOperation = operation(first, "first", 0);
  const laterOperation = operation(latest, "later", 0);
  projection = {
    ...projection,
    sync: enqueueAccountOperation(
      enqueueAccountOperation(projection.sync, firstOperation, NOW),
      laterOperation,
      LATER,
    ),
  };
  const confirmed = reconcileConfirmedOwnerProjection({
    ...projection,
    operationKey: firstOperation.operationKey,
    remoteIdentity: "day:2026-08-21",
    revision: 1,
    canonicalCandidate: first,
    deleted: false,
    timestamp: LATER,
  });
  assert.equal(confirmed.calendar.days[0].exercises[0].sets[0].targetRepetitions, 15);
  assert.equal(confirmed.sync.outbox.length, 1);
  assert.equal(confirmed.sync.outbox[0].operationKey, "later");
  assert.equal(confirmed.sync.outbox[0].expectedRevision, 1);
});

test("răspunsul 409 echivalent confirmă domeniul, iar diferența reală persistă conflict complet", () => {
  const source = makeDay(8);
  const projection = baseProjection(source);
  const pending = operation(source, "equivalent-409", 1);
  const sync = enqueueAccountOperation(projection.sync, pending, NOW);
  const equivalent = reconcileCloudConflictOwnerProjection({
    calendar: projection.calendar,
    sync,
    operationKey: pending.operationKey,
    remoteIdentity: `day:${source.date}`,
    remoteRevision: 2,
    remoteCandidate: { ...source, createdAt: LATER, updatedAt: LATER },
    remoteDeleted: false,
    reason: "AMV2_REVISION_CONFLICT",
    timestamp: LATER,
  });
  assert.equal(equivalent.resolution, "acknowledged_equivalent");
  assert.equal(equivalent.hasConflict, false);
  assert.equal(equivalent.sync.outbox.length, 0);
  assert.equal(equivalent.sync.remoteRevisions[`day:${source.date}`], 2);

  const changedSync = enqueueAccountOperation(projection.sync, operation(source, "changed-409", 1), NOW);
  const changed = reconcileCloudConflictOwnerProjection({
    calendar: projection.calendar,
    sync: changedSync,
    operationKey: "changed-409",
    remoteIdentity: `day:${source.date}`,
    remoteRevision: 2,
    remoteCandidate: makeDay(12, LATER),
    remoteDeleted: false,
    reason: "AMV2_REVISION_CONFLICT",
    timestamp: LATER,
  });
  assert.equal(changed.resolution, "conflict");
  assert.equal(changed.hasConflict, true);
  assert.equal(changed.sync.conflicts[0].remoteRevision, 2);
  assert.equal(changed.sync.conflicts[0].localCandidate.exercises[0].sets[0].targetRepetitions, 8);
  assert.equal(changed.sync.conflicts[0].remoteCandidate.exercises[0].sets[0].targetRepetitions, 12);
  assert.throws(() => reconcileCloudConflictOwnerProjection({
    calendar: projection.calendar,
    sync,
    operationKey: pending.operationKey,
    remoteIdentity: `day:${source.date}`,
    remoteRevision: 2,
    remoteCandidate: source,
    remoteDeleted: true,
    reason: "AMV2_REVISION_CONFLICT",
    timestamp: LATER,
  }), /snapshot autoritativ coerent/);
});

test("răspunsul 409 cu tombstone confirmă delete-ul deja satisfăcut fără conflict fals", () => {
  const source = makeDay();
  const projection = baseProjection(source);
  const deletedCalendar = replaceWorkoutDayInCalendar(projection.calendar, source.date, null, LATER);
  const pendingDelete = {
    ownerUserId: OWNER,
    operationKey: "delete-409",
    type: "delete_day",
    expectedRevision: 1,
    payload: { date: source.date },
    createdAt: NOW,
  };
  const sync = enqueueAccountOperation(projection.sync, pendingDelete, NOW);
  const result = reconcileCloudConflictOwnerProjection({
    calendar: deletedCalendar,
    sync,
    operationKey: pendingDelete.operationKey,
    remoteIdentity: `day:${source.date}`,
    remoteRevision: 2,
    remoteCandidate: null,
    remoteDeleted: true,
    reason: "AMV2_REVISION_CONFLICT",
    timestamp: LATER,
  });
  assert.equal(result.resolution, "acknowledged_equivalent");
  assert.equal(result.hasConflict, false);
  assert.equal(result.sync.outbox.length, 0);
  assert.equal(result.calendar.days.length, 0);
  assert.equal(result.sync.remoteRevisions[`day:${source.date}`], 2);
});
