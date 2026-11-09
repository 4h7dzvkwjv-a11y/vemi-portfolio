import {
  getAccountOperationRemoteIdentity,
  reconcileConfirmedAccountOperation,
  recordAccountConflict,
  replacePersonalExerciseInSync,
  resolveAccountConflictWithRemote,
} from "./account-sync-local.mjs";
import {
  planRemoteDayReconciliation,
  planRemotePersonalReconciliation,
} from "./sync-reconciliation.mjs";
import { validatePersonalExercise } from "./personal-exercise-domain.mjs";
import { replaceWorkoutDayInCalendar } from "./workout-calendar-local.mjs";
import { validateWorkoutDay } from "./workout-day-domain.mjs";

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

function operationForIdentity(sync, identity) {
  return sync.outbox.find((operation) => getAccountOperationRemoteIdentity(operation) === identity) ?? null;
}

function withRemoteRevision(sync, identity, revision, timestamp) {
  if (!Number.isInteger(revision) || revision < 0) return sync;
  if (sync.remoteRevisions[identity] === revision) return sync;
  return {
    ...sync,
    remoteRevisions: { ...sync.remoteRevisions, [identity]: revision },
    updatedAt: timestamp,
  };
}

function assertHydratedSnapshot(remote) {
  if (!isRecord(remote)
    || !Array.isArray(remote.days)
    || !Array.isArray(remote.personalExercises)
    || !Array.isArray(remote.tombstones)
    || !isRecord(remote.dayRevisions)) {
    throw new TypeError("Snapshotul hidratat AMV2 este invalid.");
  }
}

export function reconcileRemoteOwnerProjection({
  calendar,
  sync,
  localOnly = [],
  remote,
  monthKey,
  timestamp,
}) {
  assertHydratedSnapshot(remote);
  const localOnlyIdentities = new Set(localOnly.map((marker) => marker.identity));
  const remoteDays = new Map(remote.days.map((day) => [day.date, day]));
  const tombstones = new Map(remote.tombstones.map((marker) => [marker.date, marker]));
  let nextCalendar = calendar;
  let nextSync = sync;
  const changedDates = new Set();

  for (const date of new Set([...remoteDays.keys(), ...tombstones.keys()])) {
    if (monthKey !== null && monthKey !== undefined && !date.startsWith(`${monthKey}-`)) continue;
    const identity = `day:${date}`;
    const remoteDay = remoteDays.get(date) ?? null;
    const tombstone = tombstones.get(date) ?? null;
    const revision = tombstone?.revision ?? remote.dayRevisions[date] ?? 0;
    nextSync = withRemoteRevision(nextSync, identity, revision, timestamp);
    const pendingOperation = operationForIdentity(nextSync, identity);
    if (localOnlyIdentities.has(identity) && !pendingOperation) continue;
    const localDay = nextCalendar.days.find((candidate) => candidate.date === date) ?? null;
    const plan = planRemoteDayReconciliation({
      localDay,
      remoteDay,
      tombstone,
      pendingOperation,
      knownRevision: revision,
    });
    if (plan.action === "adopt_remote") {
      if (JSON.stringify(localDay) !== JSON.stringify(remoteDay)) {
        nextCalendar = replaceWorkoutDayInCalendar(nextCalendar, date, remoteDay, timestamp);
        changedDates.add(date);
      }
    } else if (plan.action === "adopt_equivalent_remote") {
      const acknowledged = reconcileConfirmedOwnerProjection({
        calendar: nextCalendar,
        sync: nextSync,
        operationKey: pendingOperation.operationKey,
        remoteIdentity: identity,
        revision: plan.revision,
        canonicalCandidate: remoteDay,
        deleted: false,
        timestamp,
      });
      nextCalendar = acknowledged.calendar;
      nextSync = acknowledged.sync;
      if (acknowledged.dayChange) changedDates.add(acknowledged.dayChange.date);
    } else if (plan.action === "acknowledge_equivalent_delete") {
      const acknowledged = reconcileConfirmedOwnerProjection({
        calendar: nextCalendar,
        sync: nextSync,
        operationKey: pendingOperation.operationKey,
        remoteIdentity: identity,
        revision: plan.revision,
        canonicalCandidate: null,
        deleted: true,
        timestamp,
      });
      nextCalendar = acknowledged.calendar;
      nextSync = acknowledged.sync;
      if (acknowledged.dayChange) changedDates.add(acknowledged.dayChange.date);
    } else if (plan.action === "adopt_remote_delete") {
      if (localDay) {
        nextCalendar = replaceWorkoutDayInCalendar(nextCalendar, date, null, timestamp);
        changedDates.add(date);
      }
    } else if (plan.action === "conflict") {
      if (!pendingOperation) throw new TypeError("Conflictul cloud nu are operație locală durabilă.");
      nextSync = recordAccountConflict(nextSync, {
        operationKey: pendingOperation.operationKey,
        remoteIdentity: identity,
        remoteRevision: plan.remoteRevision,
        remoteCandidate: plan.remoteCandidate,
        remoteDeleted: plan.remoteDeleted,
        reason: plan.reason,
      }, timestamp);
    }
  }

  for (const remoteExercise of remote.personalExercises) {
    const identity = `personal:${remoteExercise.id}`;
    nextSync = withRemoteRevision(nextSync, identity, remoteExercise.revision, timestamp);
    const pendingOperation = operationForIdentity(nextSync, identity);
    if (localOnlyIdentities.has(identity) && !pendingOperation) continue;
    const localExercise = nextSync.personalExercises.find((candidate) => candidate.id === remoteExercise.id) ?? null;
    const plan = planRemotePersonalReconciliation({
      localExercise,
      remoteExercise,
      pendingOperation,
      knownRevision: sync.remoteRevisions[identity] ?? 0,
    });
    if (plan.action === "adopt_remote") {
      if (JSON.stringify(localExercise) !== JSON.stringify(remoteExercise)) {
        nextSync = replacePersonalExerciseInSync(nextSync, remoteExercise, timestamp);
      }
    } else if (plan.action === "adopt_equivalent_remote") {
      const acknowledged = reconcileConfirmedOwnerProjection({
        calendar: nextCalendar,
        sync: nextSync,
        operationKey: pendingOperation.operationKey,
        remoteIdentity: identity,
        revision: plan.revision,
        canonicalCandidate: remoteExercise,
        deleted: false,
        timestamp,
      });
      nextCalendar = acknowledged.calendar;
      nextSync = acknowledged.sync;
    } else if (plan.action === "conflict") {
      if (!pendingOperation) throw new TypeError("Conflictul Personal cloud nu are operație locală durabilă.");
      nextSync = recordAccountConflict(nextSync, {
        operationKey: pendingOperation.operationKey,
        remoteIdentity: identity,
        remoteRevision: plan.remoteRevision,
        remoteCandidate: plan.remoteCandidate,
        remoteDeleted: false,
        reason: plan.reason,
      }, timestamp);
    }
  }

  return {
    calendar: nextCalendar,
    sync: nextSync,
    dayChanges: [...changedDates].map((date) => ({
      date,
      day: nextCalendar.days.find((candidate) => candidate.date === date) ?? null,
    })),
    hasConflict: nextSync.conflicts.length > 0,
  };
}

export function reconcileRemoteOwnerHistoryPage(input) {
  return reconcileRemoteOwnerProjection({ ...input, monthKey: null });
}

function applyAuthoritativeCandidate({ calendar, sync, remoteIdentity, candidate, deleted, timestamp }) {
  if (remoteIdentity.startsWith("day:")) {
    const date = remoteIdentity.slice("day:".length);
    if (!deleted) {
      const validation = validateWorkoutDay(candidate);
      if (!validation.valid || candidate.date !== date) {
        throw new TypeError("Confirmarea cloud nu conține ziua canonică așteptată.");
      }
    }
    const nextCalendar = replaceWorkoutDayInCalendar(calendar, date, deleted ? null : candidate, timestamp);
    return { calendar: nextCalendar, sync, dayChange: { date, day: deleted ? null : candidate } };
  }
  if (remoteIdentity.startsWith("personal:")) {
    if (deleted) throw new TypeError("Exercițiul Personal confirmat nu poate fi șters fizic.");
    const validation = validatePersonalExercise(candidate);
    if (!validation.valid || `personal:${candidate.id}` !== remoteIdentity) {
      throw new TypeError("Confirmarea cloud nu conține exercițiul Personal canonic așteptat.");
    }
    return { calendar, sync: replacePersonalExerciseInSync(sync, candidate, timestamp), dayChange: null };
  }
  return { calendar, sync, dayChange: null };
}

export function reconcileConfirmedOwnerProjection({
  calendar,
  sync,
  operationKey,
  remoteIdentity,
  revision,
  canonicalCandidate,
  deleted = false,
  timestamp,
}) {
  const operation = sync.outbox.find((candidate) => candidate.operationKey === operationKey);
  const result = reconcileConfirmedAccountOperation(sync, {
    operationKey,
    remoteIdentity,
    revision,
    canonicalCandidate,
    deleted,
  }, timestamp);
  const hasLaterCandidate = result.envelope.outbox.some(
    (candidate) => getAccountOperationRemoteIdentity(candidate) === remoteIdentity,
  );
  if (!operation || operation.type === "import_days" || hasLaterCandidate) {
    return { calendar, sync: result.envelope, dayChange: null };
  }
  if (!result.hasAuthoritativeCandidate) {
    throw new TypeError("Confirmarea cloud nu conține snapshotul autoritativ.");
  }
  return applyAuthoritativeCandidate({
    calendar,
    sync: result.envelope,
    remoteIdentity,
    candidate: result.canonicalCandidate,
    deleted: result.deleted,
    timestamp,
  });
}

export function reconcileCloudConflictOwnerProjection({
  calendar,
  sync,
  operationKey,
  remoteIdentity,
  remoteRevision,
  remoteCandidate,
  remoteDeleted,
  reason,
  timestamp,
}) {
  const operation = sync.outbox.find((candidate) => candidate.operationKey === operationKey);
  if (!operation) throw new TypeError("Operația aflată în conflict nu mai există în outbox.");
  if (getAccountOperationRemoteIdentity(operation) !== remoteIdentity) {
    throw new TypeError("Conflictul cloud nu corespunde operației locale.");
  }
  if (!Number.isInteger(remoteRevision)
    || remoteRevision < 1
    || typeof remoteDeleted !== "boolean"
    || (remoteCandidate !== null && !isRecord(remoteCandidate))
    || remoteDeleted !== (remoteCandidate === null)) {
    throw new TypeError("Conflictul cloud nu conține un snapshot autoritativ coerent.");
  }

  let plan;
  if (remoteIdentity.startsWith("day:")) {
    const date = remoteIdentity.slice("day:".length);
    const localDay = calendar.days.find((candidate) => candidate.date === date) ?? null;
    plan = planRemoteDayReconciliation({
      localDay,
      remoteDay: remoteDeleted ? null : remoteCandidate,
      tombstone: remoteDeleted ? { date, revision: remoteRevision, deletedAt: timestamp } : null,
      pendingOperation: operation,
      knownRevision: remoteRevision,
    });
  } else if (remoteIdentity.startsWith("personal:")) {
    if (remoteDeleted || remoteCandidate === null) {
      throw new TypeError("Conflictul Personal nu poate reprezenta o ștergere fizică.");
    }
    const personalId = remoteIdentity.slice("personal:".length);
    const localExercise = sync.personalExercises.find((candidate) => candidate.id === personalId) ?? null;
    plan = planRemotePersonalReconciliation({
      localExercise,
      remoteExercise: remoteCandidate,
      pendingOperation: operation,
      knownRevision: remoteRevision,
    });
  } else {
    throw new TypeError("Tipul conflictului cloud nu poate fi reconciliat automat.");
  }

  if (plan.action === "adopt_equivalent_remote" || plan.action === "acknowledge_equivalent_delete") {
    const acknowledged = reconcileConfirmedOwnerProjection({
      calendar,
      sync,
      operationKey,
      remoteIdentity,
      revision: remoteRevision,
      canonicalCandidate: remoteDeleted ? null : remoteCandidate,
      deleted: remoteDeleted,
      timestamp,
    });
    return {
      ...acknowledged,
      resolution: "acknowledged_equivalent",
      hasConflict: acknowledged.sync.conflicts.length > 0,
    };
  }

  const conflicted = recordAccountConflict(sync, {
    operationKey,
    remoteIdentity,
    remoteRevision,
    remoteCandidate,
    remoteDeleted,
    reason,
  }, timestamp);
  return {
    calendar,
    sync: conflicted,
    dayChange: null,
    resolution: "conflict",
    hasConflict: true,
  };
}

export function adoptRemoteConflictProjection({ calendar, sync, conflictId, timestamp }) {
  const resolution = resolveAccountConflictWithRemote(sync, conflictId, timestamp);
  const applied = applyAuthoritativeCandidate({
    calendar,
    sync: resolution.envelope,
    remoteIdentity: resolution.remoteIdentity,
    candidate: resolution.canonicalCandidate,
    deleted: resolution.deleted,
    timestamp,
  });
  return { ...applied, supersededOperationKeys: resolution.supersededOperationKeys };
}
