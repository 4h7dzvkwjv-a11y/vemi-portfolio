import { validatePersonalExercise } from "./personal-exercise-domain.mjs";
import { validateWorkoutDay } from "./workout-day-domain.mjs";

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isRevision = (value) => Number.isInteger(value) && value >= 0;
const isTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

function orderedObject(value) {
  if (Array.isArray(value)) return value.map(orderedObject);
  if (!isRecord(value)) return Object.is(value, -0) ? 0 : value;
  return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
    const child = value[key];
    return child === undefined ? [] : [[key, orderedObject(child)]];
  }));
}

function orderedByIndex(items) {
  return [...items]
    .sort((left, right) => left.orderIndex - right.orderIndex || String(left.id).localeCompare(String(right.id)))
    .map(orderedObject);
}

export function canonicalJsonStringify(value) {
  return JSON.stringify(orderedObject(value));
}

export function canonicalizeWorkoutDayForSync(day) {
  const validation = validateWorkoutDay(day);
  if (!validation.valid) throw new TypeError(validation.issues.join(" "));
  return orderedObject({
    date: day.date,
    clientKey: `workout-day:${day.date}`,
    location: day.location,
    exercises: orderedByIndex(day.exercises.map((exercise) => ({
      id: exercise.id,
      orderIndex: exercise.orderIndex,
      reference: exercise.reference,
      displayName: exercise.displayName,
      category: exercise.category,
      metricType: exercise.metricType,
      ...(exercise.metricType === "total_duration"
        ? { targetTotalDurationSeconds: exercise.targetTotalDurationSeconds }
        : { sets: orderedByIndex(exercise.sets) }),
    }))),
  });
}

export function canonicalizePersonalExerciseForSync(exercise) {
  const validation = validatePersonalExercise(exercise);
  if (!validation.valid) throw new TypeError(validation.issues.join(" "));
  return orderedObject({
    id: exercise.id,
    clientKey: exercise.clientKey,
    name: exercise.name,
    templateExerciseKey: exercise.templateExerciseKey,
    category: exercise.category,
    location: exercise.location,
    metricType: exercise.metricType,
    archived: exercise.archivedAt !== null,
  });
}

export function workoutDaysDomainEqual(left, right) {
  return canonicalJsonStringify(canonicalizeWorkoutDayForSync(left))
    === canonicalJsonStringify(canonicalizeWorkoutDayForSync(right));
}

export function personalExercisesDomainEqual(left, right) {
  return canonicalJsonStringify(canonicalizePersonalExerciseForSync(left))
    === canonicalJsonStringify(canonicalizePersonalExerciseForSync(right));
}

export function validateDayTombstone(value) {
  return isRecord(value)
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && Number.isInteger(value.revision)
    && value.revision > 0
    && isTimestamp(value.deletedAt);
}

export function validateSyncConflict(value) {
  if (!isRecord(value)
    || !isText(value.id)
    || !isText(value.ownerUserId)
    || !isText(value.operationKey)
    || !isText(value.remoteIdentity)
    || !["day", "personal"].includes(value.entityType)
    || !["upsert_day", "delete_day", "upsert_personal", "archive_personal"].includes(value.operationType)
    || !isRevision(value.baseRevision)
    || !isRevision(value.remoteRevision)
    || !isText(value.reason)
    || value.status !== "unresolved"
    || !isTimestamp(value.detectedAt)
    || typeof value.remoteDeleted !== "boolean") return false;
  if (value.localCandidate !== null && !isRecord(value.localCandidate)) return false;
  if (value.remoteCandidate !== null && !isRecord(value.remoteCandidate)) return false;
  if (value.remoteDeleted !== (value.remoteCandidate === null)) return false;
  if (value.entityType === "personal" && value.remoteDeleted) return false;
  return true;
}

export function createSyncConflict({
  ownerUserId,
  operation,
  remoteIdentity,
  remoteRevision,
  remoteCandidate,
  remoteDeleted = remoteCandidate === null,
  reason,
  detectedAt,
}) {
  if (!isRecord(operation)) throw new TypeError("Operația conflictului AMV2 este invalidă.");
  const entityType = remoteIdentity.startsWith("day:") ? "day"
    : remoteIdentity.startsWith("personal:") ? "personal" : null;
  const conflict = {
    id: `conflict:${operation.operationKey}`,
    ownerUserId,
    operationKey: operation.operationKey,
    remoteIdentity,
    entityType,
    operationType: operation.type,
    baseRevision: operation.expectedRevision,
    remoteRevision,
    localCandidate: operation.type === "delete_day" || operation.type === "archive_personal"
      ? null
      : orderedObject(operation.payload),
    remoteCandidate: remoteCandidate === null ? null : orderedObject(remoteCandidate),
    remoteDeleted,
    reason,
    status: "unresolved",
    detectedAt,
  };
  if (!validateSyncConflict(conflict)) throw new TypeError("Conflictul AMV2 nu conține candidații necesari rezolvării.");
  return conflict;
}

export function planRemoteDayReconciliation({
  localDay = null,
  remoteDay = null,
  tombstone = null,
  pendingOperation = null,
  knownRevision = 0,
}) {
  if (remoteDay !== null && tombstone !== null) throw new TypeError("Snapshotul cloud nu poate conține simultan zi și tombstone.");
  if (tombstone !== null && !validateDayTombstone(tombstone)) throw new TypeError("Tombstone-ul cloud este invalid.");
  if (remoteDay !== null && !validateWorkoutDay(remoteDay).valid) throw new TypeError("Ziua cloud este invalidă.");
  if (localDay !== null && !validateWorkoutDay(localDay).valid) throw new TypeError("Ziua locală este invalidă.");

  if (tombstone) {
    if (!pendingOperation) return { action: "adopt_remote_delete", revision: tombstone.revision };
    if (pendingOperation.type === "delete_day") {
      return { action: "acknowledge_equivalent_delete", revision: tombstone.revision };
    }
    return {
      action: "conflict",
      reason: "REMOTE_DELETED_WHILE_LOCAL_CHANGED",
      remoteRevision: tombstone.revision,
      remoteCandidate: null,
      remoteDeleted: true,
    };
  }

  if (remoteDay) {
    const remoteRevision = Number.isInteger(remoteDay.revision) ? remoteDay.revision : knownRevision;
    if (!pendingOperation) return { action: "adopt_remote", revision: remoteRevision, remoteCandidate: remoteDay };
    if (localDay && workoutDaysDomainEqual(localDay, remoteDay)) {
      return { action: "adopt_equivalent_remote", revision: remoteRevision, remoteCandidate: remoteDay };
    }
    if (remoteRevision > pendingOperation.expectedRevision) {
      return {
        action: "conflict",
        reason: pendingOperation.type === "delete_day" ? "REMOTE_CHANGED_WHILE_LOCAL_DELETED" : "CONCURRENT_DOMAIN_CHANGE",
        remoteRevision,
        remoteCandidate: remoteDay,
        remoteDeleted: false,
      };
    }
    return { action: "keep_pending", revision: remoteRevision };
  }

  if (pendingOperation) return { action: "keep_pending", revision: knownRevision };
  if (knownRevision > 0 && localDay) {
    return { action: "conflict", reason: "REMOTE_STATE_MISSING", remoteRevision: knownRevision, remoteCandidate: null, remoteDeleted: true };
  }
  return localDay ? { action: "keep_local_only", revision: 0 } : { action: "noop", revision: 0 };
}

export function planRemotePersonalReconciliation({
  localExercise = null,
  remoteExercise = null,
  pendingOperation = null,
  knownRevision = 0,
}) {
  if (remoteExercise !== null && !validatePersonalExercise(remoteExercise).valid) {
    throw new TypeError("Exercițiul personal cloud este invalid.");
  }
  if (localExercise !== null && !validatePersonalExercise(localExercise).valid) {
    throw new TypeError("Exercițiul personal local este invalid.");
  }
  if (remoteExercise) {
    const remoteRevision = remoteExercise.revision;
    if (!pendingOperation) return { action: "adopt_remote", revision: remoteRevision, remoteCandidate: remoteExercise };
    if (localExercise && personalExercisesDomainEqual(localExercise, remoteExercise)) {
      return { action: "adopt_equivalent_remote", revision: remoteRevision, remoteCandidate: remoteExercise };
    }
    if (remoteRevision > pendingOperation.expectedRevision) {
      return {
        action: "conflict",
        reason: "CONCURRENT_DOMAIN_CHANGE",
        remoteRevision,
        remoteCandidate: remoteExercise,
        remoteDeleted: false,
      };
    }
    return { action: "keep_pending", revision: remoteRevision };
  }
  if (pendingOperation) return { action: "keep_pending", revision: knownRevision };
  if (knownRevision > 0 && localExercise) {
    return { action: "conflict", reason: "REMOTE_STATE_MISSING", remoteRevision: knownRevision };
  }
  return localExercise ? { action: "keep_local_only", revision: 0 } : { action: "noop", revision: 0 };
}
