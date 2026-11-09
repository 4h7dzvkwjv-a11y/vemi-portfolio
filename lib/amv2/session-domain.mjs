import {
  AMV2_LIMITS,
  Amv2DomainError,
  hasExecutedWork,
  validateWorkoutDraft,
} from "./draft-domain.mjs";
import {
  CanonicalExerciseMetricMapError,
  resolveCanonicalExerciseMetric,
} from "./exercise-metric-map.mjs";

export const AMV2_SESSION_STATUSES = Object.freeze([
  "in_progress",
  "completed",
  "abandoned",
]);

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isTimestamp = (value) => isText(value) && Number.isFinite(Date.parse(value));
const isIntegerWithin = (value, limits) => Number.isInteger(value)
  && value >= limits.min
  && value <= limits.max;
const isNumberWithin = (value, limits) => typeof value === "number"
  && Number.isFinite(value)
  && value >= limits.min
  && value <= limits.max;

const fail = (code, message) => {
  throw new Amv2DomainError(code, message);
};

const clone = (value) => structuredClone(value);

function definitionAsDraft(definition) {
  return {
    id: definition.sourceDraftId,
    name: definition.name,
    location: definition.location,
    exercises: definition.exercises,
    revision: definition.sourceDraftRevision,
    updatedAt: definition.savedAt,
  };
}

export function createWorkoutDefinitionSnapshot(draft, savedAt) {
  const validation = validateWorkoutDraft(draft);
  if (!validation.valid) fail("INVALID_DEFINITION", validation.issues.join(" "));
  if (!isTimestamp(savedAt)) fail("MISSING_TIMESTAMP", "Definiția salvată necesită un timestamp valid.");

  return {
    id: `definition:${draft.id}`,
    sourceDraftId: draft.id,
    sourceDraftRevision: draft.revision,
    name: draft.name,
    location: draft.location,
    exercises: clone(draft.exercises),
    savedAt,
  };
}

export function validateWorkoutDefinition(definition) {
  const issues = [];
  if (!isRecord(definition)) return { valid: false, issues: ["Definiția nu este un obiect valid."] };
  if (!isText(definition.id)) issues.push("Definiția nu are ID stabil.");
  if (!isText(definition.sourceDraftId)) issues.push("Definiția nu păstrează identitatea draftului.");
  if (!Number.isInteger(definition.sourceDraftRevision) || definition.sourceDraftRevision < 0) {
    issues.push("Revizia sursă a definiției este invalidă.");
  }
  if (!isTimestamp(definition.savedAt)) issues.push("Timestampul definiției este invalid.");
  if (issues.length === 0) {
    const draftValidation = validateWorkoutDraft(definitionAsDraft(definition));
    issues.push(...draftValidation.issues.map((issue) => `Definiție: ${issue}`));
  }
  return { valid: issues.length === 0, issues };
}

function createSessionExercise(exercise) {
  const base = {
    id: exercise.id,
    orderIndex: exercise.orderIndex,
    reference: clone(exercise.reference),
    displayName: exercise.displayName,
    category: exercise.category,
    metricType: exercise.metricType,
  };

  if (exercise.metricType === "total_duration") {
    return {
      ...base,
      targetTotalDurationSeconds: exercise.targetTotalDurationSeconds,
      actualTotalDurationSeconds: exercise.targetTotalDurationSeconds,
    };
  }

  const sets = exercise.sets.map((set) => {
    const setBase = { id: set.id, orderIndex: set.orderIndex };
    if (exercise.metricType === "repetitions_weight") {
      return {
        ...setBase,
        targetRepetitions: set.targetRepetitions,
        targetWeightKg: set.targetWeightKg,
        actualRepetitions: set.targetRepetitions,
        actualWeightKg: set.targetWeightKg,
      };
    }
    if (exercise.metricType === "repetitions_only") {
      return {
        ...setBase,
        targetRepetitions: set.targetRepetitions,
        actualRepetitions: set.targetRepetitions,
      };
    }
    return {
      ...setBase,
      targetDurationSeconds: set.targetDurationSeconds,
      actualDurationSeconds: set.targetDurationSeconds,
    };
  });
  return { ...base, sets };
}

export function createWorkoutSession({ id, definition, startedAt }) {
  const definitionValidation = validateWorkoutDefinition(definition);
  if (!definitionValidation.valid) fail("INVALID_DEFINITION", definitionValidation.issues.join(" "));
  if (!isText(id)) fail("INVALID_SESSION_ID", "Sesiunea necesită un ID local stabil.");
  if (!isTimestamp(startedAt)) fail("MISSING_TIMESTAMP", "Pornirea sesiunii necesită un timestamp valid.");

  return {
    id,
    status: "in_progress",
    definitionId: definition.id,
    definitionRevision: definition.sourceDraftRevision,
    workoutName: definition.name,
    location: definition.location,
    startedAt,
    lastUpdatedAt: startedAt,
    completedAt: null,
    abandonedAt: null,
    exercises: definition.exercises.map(createSessionExercise),
  };
}

function validateSessionSet(set, metricType, label) {
  const issues = [];
  if (!isRecord(set)) return [`${label}: seria nu este un obiect valid.`];
  if (!isText(set.id)) issues.push(`${label}: seria nu are ID stabil.`);
  if (!Number.isInteger(set.orderIndex) || set.orderIndex < 0) issues.push(`${label}: ordinea seriei este invalidă.`);

  if (metricType === "repetitions_weight") {
    if (!isIntegerWithin(set.targetRepetitions, AMV2_LIMITS.repetitions)
      || !isIntegerWithin(set.actualRepetitions, AMV2_LIMITS.repetitions)) {
      issues.push(`${label}: repetițiile țintă și efective trebuie să fie între 0 și 100.`);
    }
    if (!isNumberWithin(set.targetWeightKg, AMV2_LIMITS.weightKg)
      || !isNumberWithin(set.actualWeightKg, AMV2_LIMITS.weightKg)) {
      issues.push(`${label}: greutatea țintă și efectivă trebuie să fie între 0 și 500 kg.`);
    }
    if (Object.hasOwn(set, "targetDurationSeconds") || Object.hasOwn(set, "actualDurationSeconds")) {
      issues.push(`${label}: durata este incompatibilă cu repetitions_weight.`);
    }
  } else if (metricType === "repetitions_only") {
    if (!isIntegerWithin(set.targetRepetitions, AMV2_LIMITS.repetitions)
      || !isIntegerWithin(set.actualRepetitions, AMV2_LIMITS.repetitions)) {
      issues.push(`${label}: repetițiile țintă și efective trebuie să fie între 0 și 100.`);
    }
    if (Object.hasOwn(set, "targetWeightKg") || Object.hasOwn(set, "actualWeightKg")
      || Object.hasOwn(set, "targetDurationSeconds") || Object.hasOwn(set, "actualDurationSeconds")) {
      issues.push(`${label}: greutatea și durata sunt incompatibile cu repetitions_only.`);
    }
  } else if (metricType === "time_per_set") {
    if (!isIntegerWithin(set.targetDurationSeconds, AMV2_LIMITS.timePerSetSeconds)
      || !isIntegerWithin(set.actualDurationSeconds, AMV2_LIMITS.timePerSetSeconds)) {
      issues.push(`${label}: durata țintă și efectivă trebuie să fie între 0 și 3600 secunde.`);
    }
    if (Object.hasOwn(set, "targetRepetitions") || Object.hasOwn(set, "actualRepetitions")
      || Object.hasOwn(set, "targetWeightKg") || Object.hasOwn(set, "actualWeightKg")) {
      issues.push(`${label}: repetițiile și greutatea sunt incompatibile cu time_per_set.`);
    }
  }
  return issues;
}

function exerciseActuals(exercise) {
  if (exercise.metricType === "repetitions_weight") {
    return {
      metricType: exercise.metricType,
      sets: exercise.sets.map((set) => ({
        actualRepetitions: set.actualRepetitions,
        actualWeightKg: set.actualWeightKg,
      })),
    };
  }
  if (exercise.metricType === "repetitions_only") {
    return {
      metricType: exercise.metricType,
      sets: exercise.sets.map((set) => ({ actualRepetitions: set.actualRepetitions })),
    };
  }
  if (exercise.metricType === "time_per_set") {
    return {
      metricType: exercise.metricType,
      sets: exercise.sets.map((set) => ({ actualDurationSeconds: set.actualDurationSeconds })),
    };
  }
  return {
    metricType: exercise.metricType,
    actualTotalDurationSeconds: exercise.actualTotalDurationSeconds,
  };
}

export function sessionHasExecutedWork(session) {
  return isRecord(session)
    && Array.isArray(session.exercises)
    && session.exercises.some((exercise) => hasExecutedWork(exerciseActuals(exercise)));
}

export function validateWorkoutSession(session) {
  const issues = [];
  if (!isRecord(session)) return { valid: false, issues: ["Sesiunea nu este un obiect valid."] };
  if (!isText(session.id)) issues.push("Sesiunea nu are ID stabil.");
  if (!AMV2_SESSION_STATUSES.includes(session.status)) issues.push("Statusul sesiunii este invalid.");
  if (!isText(session.definitionId) || !Number.isInteger(session.definitionRevision)
    || session.definitionRevision < 0) issues.push("Identitatea definiției sursă este invalidă.");
  if (!isText(session.workoutName) || session.workoutName.length > 100) issues.push("Numele sesiunii este invalid.");
  if (session.location !== "home" && session.location !== "gym") issues.push("Locația sesiunii este invalidă.");
  if (!isTimestamp(session.startedAt) || !isTimestamp(session.lastUpdatedAt)) issues.push("Timestampurile sesiunii sunt invalide.");
  if (!Array.isArray(session.exercises)
    || session.exercises.length < AMV2_LIMITS.exercisesPerWorkout.min
    || session.exercises.length > AMV2_LIMITS.exercisesPerWorkout.max) {
    issues.push("Sesiunea trebuie să conțină între 1 și 20 de exerciții.");
    return { valid: false, issues };
  }

  const exerciseIds = new Set();
  session.exercises.forEach((exercise, exerciseIndex) => {
    const label = `Sesiune, exercițiul ${exerciseIndex + 1}`;
    if (!isRecord(exercise)) {
      issues.push(`${label}: exercițiul nu este valid.`);
      return;
    }
    if (!isText(exercise.id) || exerciseIds.has(exercise.id)) issues.push(`${label}: ID invalid sau duplicat.`);
    else exerciseIds.add(exercise.id);
    if (exercise.orderIndex !== exerciseIndex) issues.push(`${label}: ordinea nu este normalizată.`);
    if (!isText(exercise.displayName) || !isText(exercise.category)) issues.push(`${label}: informațiile afișate lipsesc.`);
    const exerciseKey = exercise.reference?.exerciseKey;
    try {
      const mapping = resolveCanonicalExerciseMetric(exerciseKey);
      if (mapping.metric_type !== exercise.metricType) issues.push(`${label}: metrica nu corespunde mappingului canonic.`);
    } catch (error) {
      if (error instanceof CanonicalExerciseMetricMapError) issues.push(`${label}: exercise_key este necunoscut.`);
      else throw error;
    }

    if (exercise.metricType === "total_duration") {
      if (Object.hasOwn(exercise, "sets")) issues.push(`${label}: total_duration nu poate avea serii.`);
      if (!isIntegerWithin(exercise.targetTotalDurationSeconds, AMV2_LIMITS.totalDurationSeconds)
        || !isIntegerWithin(exercise.actualTotalDurationSeconds, AMV2_LIMITS.totalDurationSeconds)) {
        issues.push(`${label}: durata totală țintă și efectivă trebuie să fie între 0 și 18000 secunde.`);
      }
      return;
    }

    if (!Array.isArray(exercise.sets)
      || exercise.sets.length < AMV2_LIMITS.setsPerExercise.min
      || exercise.sets.length > AMV2_LIMITS.setsPerExercise.max) {
      issues.push(`${label}: sunt necesare între 1 și 20 de serii.`);
      return;
    }
    const setIds = new Set();
    exercise.sets.forEach((set, setIndex) => {
      if (set?.orderIndex !== setIndex) issues.push(`${label}: ordinea seriilor nu este normalizată.`);
      if (isText(set?.id) && setIds.has(set.id)) issues.push(`${label}: ID de serie duplicat.`);
      else if (isText(set?.id)) setIds.add(set.id);
      issues.push(...validateSessionSet(set, exercise.metricType, `${label}, seria ${setIndex + 1}`));
    });
  });

  if (session.status === "in_progress") {
    if (session.completedAt !== null || session.abandonedAt !== null) {
      issues.push("Sesiunea activă nu poate avea timestamp terminal.");
    }
  } else if (session.status === "completed") {
    if (!isTimestamp(session.completedAt) || session.abandonedAt !== null) {
      issues.push("Sesiunea completată necesită exclusiv completedAt.");
    }
    if (!sessionHasExecutedWork(session)) issues.push("Sesiunea completată trebuie să conțină execuție reală.");
  } else if (session.status === "abandoned") {
    if (!isTimestamp(session.abandonedAt) || session.completedAt !== null) {
      issues.push("Sesiunea abandonată necesită exclusiv abandonedAt.");
    }
  }
  return { valid: issues.length === 0, issues };
}

function findSessionExercise(session, exerciseId) {
  const exerciseIndex = session.exercises.findIndex((exercise) => exercise.id === exerciseId);
  if (exerciseIndex < 0) fail("SESSION_EXERCISE_NOT_FOUND", "Exercițiul nu există în sesiunea activă.");
  return { exerciseIndex, exercise: session.exercises[exerciseIndex] };
}

function nextSession(session, exerciseIndex, exercise, updatedAt) {
  if (!isTimestamp(updatedAt)) fail("MISSING_TIMESTAMP", "Actualizarea sesiunii necesită un timestamp valid.");
  const next = {
    ...session,
    lastUpdatedAt: updatedAt,
    exercises: session.exercises.map((candidate, index) => index === exerciseIndex ? exercise : candidate),
  };
  const validation = validateWorkoutSession(next);
  if (!validation.valid) fail("INVALID_SESSION_MUTATION", validation.issues.join(" "));
  return next;
}

export function reduceWorkoutSession(session, action) {
  const validation = validateWorkoutSession(session);
  if (!validation.valid) fail("INVALID_SESSION", validation.issues.join(" "));
  if (session.status !== "in_progress") fail("SESSION_TERMINAL", "O sesiune încheiată nu mai poate fi editată.");
  if (!isRecord(action) || !isText(action.type)) fail("INVALID_SESSION_ACTION", "Acțiunea sesiunii este invalidă.");
  const { exerciseIndex, exercise } = findSessionExercise(session, action.exerciseId);

  if (action.type === "update_total_duration_actual") {
    if (exercise.metricType !== "total_duration") {
      fail("SESSION_METRIC_FIELD_MISMATCH", "Durata totală este permisă numai pentru total_duration.");
    }
    if (!isIntegerWithin(action.actualTotalDurationSeconds, AMV2_LIMITS.totalDurationSeconds)) {
      fail("INVALID_ACTUAL_TOTAL_DURATION", "Durata efectivă trebuie să fie între 0 și 18000 secunde.");
    }
    if (action.actualTotalDurationSeconds === exercise.actualTotalDurationSeconds) return session;
    return nextSession(session, exerciseIndex, {
      ...exercise,
      actualTotalDurationSeconds: action.actualTotalDurationSeconds,
    }, action.updatedAt);
  }

  if (action.type !== "update_set_actuals") fail("INVALID_SESSION_ACTION", `Acțiunea ${action.type} nu este acceptată.`);
  if (exercise.metricType === "total_duration") {
    fail("SESSION_SET_ACTION_NOT_ALLOWED", "total_duration nu acceptă acțiuni asupra seriilor.");
  }
  const setIndex = exercise.sets.findIndex((set) => set.id === action.setId);
  if (setIndex < 0) fail("SESSION_SET_NOT_FOUND", "Seria nu există în sesiunea activă.");
  const currentSet = exercise.sets[setIndex];
  let nextSet;

  if (exercise.metricType === "repetitions_weight") {
    if (Object.hasOwn(action, "actualDurationSeconds") || Object.hasOwn(action, "actualTotalDurationSeconds")) {
      fail("SESSION_METRIC_FIELD_MISMATCH", "Durata este incompatibilă cu repetitions_weight.");
    }
    if (!Object.hasOwn(action, "actualRepetitions") && !Object.hasOwn(action, "actualWeightKg")) {
      fail("INVALID_ACTUAL_PATCH", "Actualizarea trebuie să conțină repetiții sau greutate.");
    }
    const actualRepetitions = Object.hasOwn(action, "actualRepetitions")
      ? action.actualRepetitions
      : currentSet.actualRepetitions;
    const actualWeightKg = Object.hasOwn(action, "actualWeightKg")
      ? action.actualWeightKg
      : currentSet.actualWeightKg;
    if (!isIntegerWithin(actualRepetitions, AMV2_LIMITS.repetitions)
      || !isNumberWithin(actualWeightKg, AMV2_LIMITS.weightKg)) {
      fail("INVALID_ACTUAL_VALUE", "Valorile efective sunt în afara limitelor metricii.");
    }
    if (actualRepetitions === currentSet.actualRepetitions && actualWeightKg === currentSet.actualWeightKg) return session;
    nextSet = { ...currentSet, actualRepetitions, actualWeightKg };
  } else if (exercise.metricType === "repetitions_only") {
    if (!Object.hasOwn(action, "actualRepetitions")
      || Object.hasOwn(action, "actualWeightKg")
      || Object.hasOwn(action, "actualDurationSeconds")) {
      fail("SESSION_METRIC_FIELD_MISMATCH", "repetitions_only acceptă exclusiv repetiții efective.");
    }
    if (!isIntegerWithin(action.actualRepetitions, AMV2_LIMITS.repetitions)) {
      fail("INVALID_ACTUAL_VALUE", "Repetițiile efective trebuie să fie între 0 și 100.");
    }
    if (action.actualRepetitions === currentSet.actualRepetitions) return session;
    nextSet = { ...currentSet, actualRepetitions: action.actualRepetitions };
  } else {
    if (!Object.hasOwn(action, "actualDurationSeconds")
      || Object.hasOwn(action, "actualRepetitions")
      || Object.hasOwn(action, "actualWeightKg")) {
      fail("SESSION_METRIC_FIELD_MISMATCH", "time_per_set acceptă exclusiv durata efectivă.");
    }
    if (!isIntegerWithin(action.actualDurationSeconds, AMV2_LIMITS.timePerSetSeconds)) {
      fail("INVALID_ACTUAL_VALUE", "Durata efectivă trebuie să fie între 0 și 3600 secunde.");
    }
    if (action.actualDurationSeconds === currentSet.actualDurationSeconds) return session;
    nextSet = { ...currentSet, actualDurationSeconds: action.actualDurationSeconds };
  }

  return nextSession(session, exerciseIndex, {
    ...exercise,
    sets: exercise.sets.map((set, index) => index === setIndex ? nextSet : set),
  }, action.updatedAt);
}

export function completeWorkoutSession(session, completedAt) {
  const validation = validateWorkoutSession(session);
  if (!validation.valid) fail("INVALID_SESSION", validation.issues.join(" "));
  if (session.status === "completed") return session;
  if (session.status !== "in_progress") fail("SESSION_TERMINAL", "O sesiune abandonată nu poate fi completată.");
  if (!sessionHasExecutedWork(session)) {
    fail("SESSION_EXECUTION_REQUIRED", "Adaugă cel puțin o execuție reală înainte de a încheia antrenamentul.");
  }
  if (!isTimestamp(completedAt)) fail("MISSING_TIMESTAMP", "Finalizarea necesită un timestamp valid.");
  const completed = {
    ...clone(session),
    status: "completed",
    lastUpdatedAt: completedAt,
    completedAt,
    abandonedAt: null,
  };
  const completedValidation = validateWorkoutSession(completed);
  if (!completedValidation.valid) fail("INVALID_SESSION_TRANSITION", completedValidation.issues.join(" "));
  return completed;
}

export function abandonWorkoutSession(session, abandonedAt) {
  const validation = validateWorkoutSession(session);
  if (!validation.valid) fail("INVALID_SESSION", validation.issues.join(" "));
  if (session.status === "abandoned") return session;
  if (session.status !== "in_progress") fail("SESSION_TERMINAL", "O sesiune completată nu poate fi abandonată.");
  if (!isTimestamp(abandonedAt)) fail("MISSING_TIMESTAMP", "Abandonarea necesită un timestamp valid.");
  const abandoned = {
    ...clone(session),
    status: "abandoned",
    lastUpdatedAt: abandonedAt,
    completedAt: null,
    abandonedAt,
  };
  const abandonedValidation = validateWorkoutSession(abandoned);
  if (!abandonedValidation.valid) fail("INVALID_SESSION_TRANSITION", abandonedValidation.issues.join(" "));
  return abandoned;
}

export function getSessionElapsedSeconds(session) {
  const end = session.completedAt ?? session.abandonedAt ?? session.lastUpdatedAt;
  if (!isTimestamp(session.startedAt) || !isTimestamp(end)) return 0;
  return Math.max(0, Math.floor((Date.parse(end) - Date.parse(session.startedAt)) / 1000));
}
