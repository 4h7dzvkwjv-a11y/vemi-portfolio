import {
  AMV2_CANONICAL_METRIC_TYPES,
  CanonicalExerciseMetricMapError,
  resolveCanonicalExerciseMetric,
} from "./exercise-metric-map.mjs";
import {
  CanonicalExerciseCatalogError,
  resolveCanonicalExerciseCatalogItem,
} from "./exercise-catalog.mjs";

export const AMV2_SLICE_METRIC_TYPES = AMV2_CANONICAL_METRIC_TYPES;

export const AMV2_LIMITS = Object.freeze({
  exercisesPerWorkout: Object.freeze({ min: 1, max: 20 }),
  setsPerExercise: Object.freeze({ min: 1, max: 20 }),
  repetitions: Object.freeze({ min: 0, max: 100 }),
  weightKg: Object.freeze({ min: 0, max: 500 }),
  timePerSetSeconds: Object.freeze({ min: 0, max: 3_600 }),
  totalDurationSeconds: Object.freeze({ min: 0, max: 18_000 }),
  semanticSetRows: 400,
  semanticPayloadBytes: 512 * 1_024,
});

export class Amv2DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "Amv2DomainError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new Amv2DomainError(code, message);
};

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isIntegerWithin = (value, limits) => Number.isInteger(value)
  && value >= limits.min
  && value <= limits.max;
const isNumberWithin = (value, limits) => isFiniteNumber(value)
  && value >= limits.min
  && value <= limits.max;
const isPerSetMetric = (metricType) => metricType !== "total_duration";

export function getWorkoutExerciseIdentity(exercise) {
  if (exercise?.reference?.source === "canonical" && isText(exercise.reference.exerciseKey)) {
    return `canonical:${exercise.reference.exerciseKey}`;
  }
  if (exercise?.reference?.source === "personal" && isText(exercise.reference.personalExerciseId)) {
    return `personal:${exercise.reference.personalExerciseId}`;
  }
  return null;
}

export function getWorkoutExerciseTemplateKey(exercise) {
  if (exercise?.reference?.source === "canonical") return exercise.reference.exerciseKey;
  if (exercise?.reference?.source === "personal") return exercise.reference.templateExerciseKey;
  return null;
}

function assertStableId(value, label) {
  if (!isText(value)) fail("INVALID_ID", `${label} trebuie să aibă un identificator stabil.`);
}

function canonicalRow(exerciseKey) {
  try {
    return resolveCanonicalExerciseMetric(exerciseKey);
  } catch (error) {
    if (error instanceof CanonicalExerciseMetricMapError) {
      fail(error.code, error.message);
    }
    throw error;
  }
}

function canonicalCatalogItem(exerciseKey) {
  try {
    return resolveCanonicalExerciseCatalogItem(exerciseKey);
  } catch (error) {
    if (error instanceof CanonicalExerciseCatalogError) {
      fail(error.code, error.message);
    }
    throw error;
  }
}

function normalizeSetOrder(sets) {
  return sets.map((set, orderIndex) => ({ ...set, orderIndex }));
}

function normalizeExerciseOrder(exercises) {
  return exercises.map((exercise, orderIndex) => {
    const normalized = { ...exercise, orderIndex };
    if (Array.isArray(exercise.sets)) normalized.sets = normalizeSetOrder(exercise.sets);
    return normalized;
  });
}

export function createDefaultSet(exerciseKey, { id, orderIndex }) {
  const mapping = canonicalRow(exerciseKey);
  if (!isPerSetMetric(mapping.metric_type)) {
    fail("SET_ACTION_NOT_ALLOWED", "total_duration nu folosește serii artificiale.");
  }
  assertStableId(id, "Seria");
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    fail("INVALID_ORDER", "Ordinea seriei trebuie să fie un număr întreg pozitiv sau zero.");
  }

  if (mapping.metric_type === "repetitions_weight") {
    return {
      id,
      orderIndex,
      targetRepetitions: mapping.default_repetitions,
      targetWeightKg: mapping.default_weight_kg,
    };
  }
  if (mapping.metric_type === "repetitions_only") {
    return {
      id,
      orderIndex,
      targetRepetitions: mapping.default_repetitions,
    };
  }
  return {
    id,
    orderIndex,
    targetDurationSeconds: mapping.default_time_per_set_seconds,
  };
}

export function createWorkoutExercise(input) {
  if (!isRecord(input)) fail("INVALID_EXERCISE", "Exercițiul nou nu este un obiect valid.");
  if (Object.hasOwn(input, "metricType") || Object.hasOwn(input, "metric_type")) {
    fail(
      "CANONICAL_METRIC_OVERRIDE_FORBIDDEN",
      "Tipul metric este stabilit exclusiv de mappingul canonic exercise_key.",
    );
  }

  const {
    id,
    orderIndex,
    exerciseKey,
    displayName,
    category,
    setIds,
  } = input;
  assertStableId(id, "Exercițiul din antrenament");
  assertStableId(exerciseKey, "Exercițiul canonic");
  if (!isText(displayName)) fail("INVALID_NAME", "Exercițiul trebuie să aibă un nume afișat.");
  if (!isText(category)) fail("INVALID_CATEGORY", "Exercițiul trebuie să aibă o categorie.");
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    fail("INVALID_ORDER", "Ordinea exercițiului este invalidă.");
  }

  const mapping = canonicalRow(exerciseKey);
  const base = {
    id,
    orderIndex,
    reference: {
      source: "canonical",
      exerciseKey,
    },
    displayName,
    category,
    metricType: mapping.metric_type,
  };

  if (mapping.metric_type === "total_duration") {
    if (Object.hasOwn(input, "setIds")) {
      fail("SET_ACTION_NOT_ALLOWED", "total_duration nu acceptă identificatori de serii.");
    }
    return {
      ...base,
      targetTotalDurationSeconds: mapping.default_total_duration_seconds,
    };
  }

  if (!Array.isArray(setIds) || setIds.length !== 3 || new Set(setIds).size !== 3) {
    fail("INVALID_DEFAULT_SETS", "Un exercițiu per-serie trebuie să pornească exact cu trei serii stabile.");
  }
  return {
    ...base,
    sets: setIds.map((setId, index) => createDefaultSet(exerciseKey, {
      id: setId,
      orderIndex: index,
    })),
  };
}

export function createPersonalWorkoutExercise(input) {
  if (!isRecord(input)) fail("INVALID_EXERCISE", "Exercițiul personal din antrenament este invalid.");
  if (Object.hasOwn(input, "metricType") || Object.hasOwn(input, "metric_type")) {
    fail("PERSONAL_METRIC_OVERRIDE_FORBIDDEN", "Metrica este derivată exclusiv din șablonul canonic intern.");
  }
  const allowedFields = [
    "id",
    "orderIndex",
    "personalExerciseId",
    "templateExerciseKey",
    "displayName",
    "category",
    "setIds",
  ];
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
    fail("INVALID_EXERCISE_INPUT", "Exercițiul personal conține câmpuri neautorizate.");
  }
  assertStableId(input.personalExerciseId, "Exercițiul personal");
  if (!isText(input.category)) fail("INVALID_CATEGORY", "Exercițiul personal trebuie să aibă o categorie aprobată.");
  const canonical = createWorkoutExercise({
    id: input.id,
    orderIndex: input.orderIndex,
    exerciseKey: input.templateExerciseKey,
    displayName: input.displayName,
    category: input.category,
    ...(Object.hasOwn(input, "setIds") ? { setIds: input.setIds } : {}),
  });
  return {
    ...canonical,
    reference: {
      source: "personal",
      personalExerciseId: input.personalExerciseId,
      templateExerciseKey: input.templateExerciseKey,
    },
  };
}

export function createWorkoutDraft({ id, name, location, exercises, updatedAt }) {
  const draft = {
    id,
    name,
    location,
    exercises: normalizeExerciseOrder(exercises),
    revision: 0,
    updatedAt,
  };
  const validation = validateWorkoutDraft(draft);
  if (!validation.valid) fail("INVALID_DRAFT", validation.issues.join(" "));
  return draft;
}

export function getAddExercisesCapacityState(existingCount, pendingCount) {
  if (!Number.isInteger(existingCount)
    || !Number.isInteger(pendingCount)
    || existingCount < 0
    || pendingCount < 0) {
    fail("INVALID_CAPACITY", "Capacitatea Add Exercises necesită numere întregi pozitive sau zero.");
  }
  const total = existingCount + pendingCount;
  if (total > AMV2_LIMITS.exercisesPerWorkout.max) {
    fail("CAPACITY_EXCEEDED", "Un antrenament poate conține maximum 20 de exerciții.");
  }
  return Object.freeze({
    existingCount,
    pendingCount,
    total,
    remaining: AMV2_LIMITS.exercisesPerWorkout.max - total,
    status: total === AMV2_LIMITS.exercisesPerWorkout.max
      ? "full"
      : total >= 13
        ? "warning"
        : "normal",
  });
}

function assertUniqueCanonicalKeys(keys, label) {
  if (!Array.isArray(keys) || keys.some((key) => !isText(key))) {
    fail("INVALID_SELECTION", `${label} trebuie să conțină numai exercise_key valide.`);
  }
  if (new Set(keys).size !== keys.length) {
    fail("DUPLICATE_SOURCE", `${label} conține un exercise_key duplicat.`);
  }
}

export function togglePendingCanonicalExercise({
  pendingExerciseKeys,
  existingExerciseKeys,
  exerciseKey,
}) {
  assertUniqueCanonicalKeys(pendingExerciseKeys, "Selecția în așteptare");
  assertUniqueCanonicalKeys(existingExerciseKeys, "Exercițiile existente");
  canonicalCatalogItem(exerciseKey);

  if (existingExerciseKeys.includes(exerciseKey)) {
    fail("DUPLICATE_SOURCE", "Exercițiul există deja în antrenament.");
  }
  if (pendingExerciseKeys.includes(exerciseKey)) {
    return pendingExerciseKeys.filter((key) => key !== exerciseKey);
  }
  getAddExercisesCapacityState(existingExerciseKeys.length, pendingExerciseKeys.length + 1);
  return [...pendingExerciseKeys, exerciseKey];
}

function createCanonicalExerciseFromSelection(selection, orderIndex) {
  if (!isRecord(selection)) {
    fail("INVALID_SELECTION", "Selecția canonică trebuie să fie un obiect valid.");
  }
  if (Object.hasOwn(selection, "metricType") || Object.hasOwn(selection, "metric_type")) {
    fail(
      "CANONICAL_METRIC_OVERRIDE_FORBIDDEN",
      "Tipul metric este stabilit exclusiv de mappingul canonic exercise_key.",
    );
  }
  const fields = Object.keys(selection);
  if (fields.length !== 2 || !fields.includes("exerciseKey") || !fields.includes("exerciseId")) {
    fail("INVALID_SELECTION", "Selecția canonică acceptă numai exerciseKey și exerciseId.");
  }

  const { exerciseKey, exerciseId } = selection;
  assertStableId(exerciseId, "Exercițiul selectat");
  const catalogItem = canonicalCatalogItem(exerciseKey);
  const mapping = canonicalRow(exerciseKey);
  const input = {
    id: exerciseId,
    orderIndex,
    exerciseKey,
    displayName: catalogItem.displayName,
    category: catalogItem.category,
  };
  if (mapping.metric_type !== "total_duration") {
    input.setIds = [1, 2, 3].map((ordinal) => `${exerciseId}-set-${ordinal}`);
  }
  return createWorkoutExercise(input);
}

function validateSet(set, metricType, parentLabel) {
  const issues = [];
  if (!isRecord(set)) return [`${parentLabel}: seria nu este un obiect valid.`];
  if (!isText(set.id)) issues.push(`${parentLabel}: seria nu are ID stabil.`);
  if (!Number.isInteger(set.orderIndex) || set.orderIndex < 0) {
    issues.push(`${parentLabel}: orderIndex pentru serie este invalid.`);
  }
  if (Object.hasOwn(set, "targetTotalDurationSeconds")) {
    issues.push(`${parentLabel}: durata totală este interzisă într-o serie.`);
  }

  if (metricType === "repetitions_weight") {
    if (!isIntegerWithin(set.targetRepetitions, AMV2_LIMITS.repetitions)) {
      issues.push(`${parentLabel}: repetițiile trebuie să fie între 0 și 100.`);
    }
    if (!isNumberWithin(set.targetWeightKg, AMV2_LIMITS.weightKg)) {
      issues.push(`${parentLabel}: greutatea trebuie să fie între 0 și 500 kg.`);
    }
    if (Object.hasOwn(set, "targetDurationSeconds")) {
      issues.push(`${parentLabel}: durata este interzisă pentru repetitions_weight.`);
    }
  } else if (metricType === "repetitions_only") {
    if (!isIntegerWithin(set.targetRepetitions, AMV2_LIMITS.repetitions)) {
      issues.push(`${parentLabel}: repetițiile trebuie să fie între 0 și 100.`);
    }
    if (Object.hasOwn(set, "targetWeightKg") || Object.hasOwn(set, "targetDurationSeconds")) {
      issues.push(`${parentLabel}: greutatea și durata sunt interzise pentru repetitions_only.`);
    }
  } else if (metricType === "time_per_set") {
    if (!isIntegerWithin(set.targetDurationSeconds, AMV2_LIMITS.timePerSetSeconds)) {
      issues.push(`${parentLabel}: durata trebuie să fie între 0 și 3600 secunde.`);
    }
    if (Object.hasOwn(set, "targetRepetitions") || Object.hasOwn(set, "targetWeightKg")) {
      issues.push(`${parentLabel}: repetițiile și greutatea sunt interzise pentru time_per_set.`);
    }
  }
  return issues;
}

function validateCanonicalMetric(exercise, label, issues) {
  const exerciseKey = getWorkoutExerciseTemplateKey(exercise);
  if (!isText(exerciseKey)) return null;
  try {
    const mapping = resolveCanonicalExerciseMetric(exerciseKey);
    if (exercise.metricType !== mapping.metric_type) {
      issues.push(`${label}: metricType nu corespunde mappingului canonic exercise_key.`);
    }
    return mapping;
  } catch (error) {
    if (error instanceof CanonicalExerciseMetricMapError) {
      issues.push(`${label}: exercise_key necunoscut în mappingul canonic.`);
      return null;
    }
    throw error;
  }
}

export function validateWorkoutDraft(draft, options = {}) {
  const issues = [];
  const requireName = options.requireName !== false;
  if (!isRecord(draft)) return { valid: false, issues: ["Draftul nu este un obiect valid."] };
  if (!isText(draft.id)) issues.push("Draftul nu are ID stabil.");
  if (typeof draft.name !== "string" || (requireName && !draft.name.trim())) {
    issues.push("Numele antrenamentului este obligatoriu.");
  }
  if (draft.name?.length > 100) issues.push("Numele antrenamentului depășește 100 de caractere.");
  if (draft.location !== "home" && draft.location !== "gym") {
    issues.push("Locația trebuie să fie home sau gym.");
  }
  if (!Number.isInteger(draft.revision) || draft.revision < 0) issues.push("Revizia draftului este invalidă.");
  if (!isText(draft.updatedAt)) issues.push("Draftul nu are updatedAt.");
  if (!Array.isArray(draft.exercises)) {
    issues.push("Lista exercițiilor lipsește.");
    return { valid: false, issues };
  }
  if (draft.exercises.length < AMV2_LIMITS.exercisesPerWorkout.min
      || draft.exercises.length > AMV2_LIMITS.exercisesPerWorkout.max) {
    issues.push("Antrenamentul trebuie să conțină între 1 și 20 de exerciții.");
  }

  const exerciseIds = new Set();
  const exerciseIdentities = new Set();
  let setRows = 0;

  draft.exercises.forEach((exercise, exerciseIndex) => {
    const label = `Exercițiul ${exerciseIndex + 1}`;
    if (!isRecord(exercise)) {
      issues.push(`${label} nu este valid.`);
      return;
    }
    if (!isText(exercise.id) || exerciseIds.has(exercise.id)) issues.push(`${label}: ID invalid sau duplicat.`);
    else exerciseIds.add(exercise.id);
    if (exercise.orderIndex !== exerciseIndex) issues.push(`${label}: ordinea nu este normalizată.`);
    const reference = exercise.reference;
    const canonicalReference = isRecord(reference)
      && reference.source === "canonical"
      && isText(reference.exerciseKey)
      && Object.keys(reference).every((field) => ["source", "exerciseKey"].includes(field));
    const personalReference = isRecord(reference)
      && reference.source === "personal"
      && isText(reference.personalExerciseId)
      && isText(reference.templateExerciseKey)
      && Object.keys(reference).every((field) => ["source", "personalExerciseId", "templateExerciseKey"].includes(field));
    if (!canonicalReference && !personalReference) {
      issues.push(`${label}: referința exercițiului este invalidă.`);
    } else {
      const identity = getWorkoutExerciseIdentity(exercise);
      if (exerciseIdentities.has(identity)) {
        issues.push(`${label}: exercițiul ${reference.source === "canonical" ? "canonic" : "personal"} este duplicat.`);
      }
      else exerciseIdentities.add(identity);
    }
    if (!isText(exercise.displayName)) issues.push(`${label}: numele afișat lipsește.`);
    if (!isText(exercise.category)) issues.push(`${label}: categoria lipsește.`);

    const mapping = validateCanonicalMetric(exercise, label, issues);
    if (!mapping) return;
    if (exercise.metricType === "total_duration") {
      if (Object.hasOwn(exercise, "sets")) {
        issues.push(`${label}: total_duration nu poate conține serii artificiale.`);
      }
      if (Object.hasOwn(exercise, "targetRepetitions")
        || Object.hasOwn(exercise, "targetWeightKg")
        || Object.hasOwn(exercise, "targetDurationSeconds")) {
        issues.push(`${label}: câmpurile per-serie sunt interzise pentru total_duration.`);
      }
      if (!isIntegerWithin(exercise.targetTotalDurationSeconds, AMV2_LIMITS.totalDurationSeconds)) {
        issues.push(`${label}: durata totală trebuie să fie între 0 și 18000 secunde.`);
      }
      return;
    }
    if (Object.hasOwn(exercise, "targetRepetitions")
      || Object.hasOwn(exercise, "targetWeightKg")
      || Object.hasOwn(exercise, "targetDurationSeconds")
      || Object.hasOwn(exercise, "targetTotalDurationSeconds")) {
      issues.push(`${label}: țintele exercițiului trebuie păstrate în seriile metricului per-serie.`);
    }
    if (!Array.isArray(exercise.sets)
      || exercise.sets.length < AMV2_LIMITS.setsPerExercise.min
      || exercise.sets.length > AMV2_LIMITS.setsPerExercise.max) {
      issues.push(`${label}: sunt necesare între 1 și 20 de serii.`);
      return;
    }
    setRows += exercise.sets.length;
    const setIds = new Set();
    exercise.sets.forEach((set, setIndex) => {
      if (set?.orderIndex !== setIndex) issues.push(`${label}: ordinea seriilor nu este normalizată.`);
      if (isText(set?.id) && setIds.has(set.id)) issues.push(`${label}: ID de serie duplicat.`);
      else if (isText(set?.id)) setIds.add(set.id);
      issues.push(...validateSet(set, exercise.metricType, `${label}, seria ${setIndex + 1}`));
    });
  });

  if (setRows > AMV2_LIMITS.semanticSetRows) {
    issues.push("Payloadul depășește limita de 400 de serii.");
  }
  return { valid: issues.length === 0, issues };
}

function nextRevision(draft, updatedAt, exercises = draft.exercises, other = {}) {
  if (!isText(updatedAt)) fail("MISSING_TIMESTAMP", "Acțiunea trebuie să furnizeze updatedAt.");
  return {
    ...draft,
    ...other,
    exercises,
    revision: draft.revision + 1,
    updatedAt,
  };
}

function findExercise(draft, exerciseId) {
  const exerciseIndex = draft.exercises.findIndex((exercise) => exercise.id === exerciseId);
  if (exerciseIndex < 0) fail("EXERCISE_NOT_FOUND", "Exercițiul nu există în draft.");
  return { exerciseIndex, exercise: draft.exercises[exerciseIndex] };
}

function replaceExercise(draft, exerciseIndex, exercise, updatedAt) {
  const exercises = draft.exercises.map((candidate, index) => index === exerciseIndex ? exercise : candidate);
  const next = nextRevision(draft, updatedAt, normalizeExerciseOrder(exercises));
  const validation = validateWorkoutDraft(next, { requireName: false });
  if (!validation.valid) fail("INVALID_MUTATION", validation.issues.join(" "));
  return next;
}

function rejectSetActionForTotalDuration(exercise) {
  if (exercise.metricType === "total_duration") {
    fail("SET_ACTION_NOT_ALLOWED", "total_duration nu acceptă acțiuni asupra seriilor.");
  }
}

export function reduceWorkoutDraft(draft, action) {
  if (!isRecord(action) || !isText(action.type)) fail("INVALID_ACTION", "Acțiunea de draft este invalidă.");
  const currentValidation = validateWorkoutDraft(draft, { requireName: false });
  if (!currentValidation.valid) fail("INVALID_DRAFT", currentValidation.issues.join(" "));

  if (action.type === "rename") {
    if (typeof action.name !== "string" || action.name.length > 100) {
      fail("INVALID_NAME", "Numele trebuie să aibă maximum 100 de caractere.");
    }
    return nextRevision(draft, action.updatedAt, draft.exercises, { name: action.name });
  }

  if (action.type === "set_location") {
    if (action.location !== "home" && action.location !== "gym") {
      fail("INVALID_LOCATION", "Locația trebuie să fie home sau gym.");
    }
    return nextRevision(draft, action.updatedAt, draft.exercises, { location: action.location });
  }

  if (action.type === "add_exercises") {
    if (!Array.isArray(action.selections) || action.selections.length === 0) {
      fail("INVALID_SELECTION", "Confirmarea necesită cel puțin un exercițiu selectat.");
    }
    const existingExerciseKeys = draft.exercises
      .filter((exercise) => exercise.reference.source === "canonical")
      .map((exercise) => exercise.reference.exerciseKey);
    const pendingExerciseKeys = action.selections.map((selection) => selection?.exerciseKey);
    assertUniqueCanonicalKeys(pendingExerciseKeys, "Selecția confirmată");
    const existingKeySet = new Set(existingExerciseKeys);
    if (pendingExerciseKeys.some((exerciseKey) => existingKeySet.has(exerciseKey))) {
      fail("DUPLICATE_SOURCE", "Un exercițiu selectat există deja în antrenament.");
    }
    getAddExercisesCapacityState(draft.exercises.length, action.selections.length);

    const additions = action.selections.map((selection, index) => createCanonicalExerciseFromSelection(
      selection,
      draft.exercises.length + index,
    ));
    const exercises = normalizeExerciseOrder([...draft.exercises, ...additions]);
    const next = nextRevision(draft, action.updatedAt, exercises);
    const validation = validateWorkoutDraft(next, { requireName: false });
    if (!validation.valid) fail("INVALID_MUTATION", validation.issues.join(" "));
    return next;
  }

  const { exerciseIndex, exercise } = findExercise(draft, action.exerciseId);

  if (action.type === "update_total_duration_target") {
    if (exercise.metricType !== "total_duration") {
      fail("METRIC_FIELD_MISMATCH", "Durata totală este permisă numai pentru total_duration.");
    }
    if (!isIntegerWithin(action.targetTotalDurationSeconds, AMV2_LIMITS.totalDurationSeconds)) {
      fail("INVALID_TOTAL_DURATION", "Durata totală trebuie să fie un număr întreg între 0 și 18000 secunde.");
    }
    if (action.targetTotalDurationSeconds === exercise.targetTotalDurationSeconds) return draft;
    return replaceExercise(draft, exerciseIndex, {
      ...exercise,
      targetTotalDurationSeconds: action.targetTotalDurationSeconds,
    }, action.updatedAt);
  }

  if (action.type === "add_set") {
    rejectSetActionForTotalDuration(exercise);
    if (exercise.sets.length >= AMV2_LIMITS.setsPerExercise.max) {
      fail("SET_CAPACITY_REACHED", "Un exercițiu poate avea maximum 20 de serii.");
    }
    const set = createDefaultSet(getWorkoutExerciseTemplateKey(exercise), {
      id: action.setId,
      orderIndex: exercise.sets.length,
    });
    return replaceExercise(draft, exerciseIndex, {
      ...exercise,
      sets: [...exercise.sets, set],
    }, action.updatedAt);
  }

  if (["remove_set", "move_set", "update_set_targets"].includes(action.type)) {
    rejectSetActionForTotalDuration(exercise);
  }
  const setIndex = exercise.sets?.findIndex((set) => set.id === action.setId) ?? -1;
  if (setIndex < 0) fail("SET_NOT_FOUND", "Seria nu există în exercițiu.");

  if (action.type === "remove_set") {
    if (exercise.sets.length <= AMV2_LIMITS.setsPerExercise.min) {
      fail("MINIMUM_SET_REQUIRED", "Exercițiul trebuie să păstreze minimum o serie.");
    }
    return replaceExercise(draft, exerciseIndex, {
      ...exercise,
      sets: normalizeSetOrder(exercise.sets.filter((set) => set.id !== action.setId)),
    }, action.updatedAt);
  }

  if (action.type === "move_set") {
    if (!Number.isInteger(action.toIndex)
      || action.toIndex < 0
      || action.toIndex >= exercise.sets.length) {
      fail("INVALID_ORDER", "Poziția solicitată pentru serie este invalidă.");
    }
    if (setIndex === action.toIndex) return draft;
    const sets = [...exercise.sets];
    const [moved] = sets.splice(setIndex, 1);
    sets.splice(action.toIndex, 0, moved);
    return replaceExercise(draft, exerciseIndex, {
      ...exercise,
      sets: normalizeSetOrder(sets),
    }, action.updatedAt);
  }

  if (action.type === "update_set_targets") {
    const currentSet = exercise.sets[setIndex];
    let nextSet;
    if (exercise.metricType === "repetitions_weight") {
      if (Object.hasOwn(action, "targetDurationSeconds")
        || Object.hasOwn(action, "targetTotalDurationSeconds")) {
        fail("METRIC_FIELD_MISMATCH", "Durata este interzisă pentru repetitions_weight.");
      }
      if (!Object.hasOwn(action, "targetRepetitions")
        && !Object.hasOwn(action, "targetWeightKg")) {
        fail("INVALID_TARGET_PATCH", "Modificarea trebuie să conțină o valoare compatibilă cu metricul.");
      }
      const repetitions = Object.hasOwn(action, "targetRepetitions")
        ? action.targetRepetitions
        : currentSet.targetRepetitions;
      const weightKg = Object.hasOwn(action, "targetWeightKg")
        ? action.targetWeightKg
        : currentSet.targetWeightKg;
      if (!isIntegerWithin(repetitions, AMV2_LIMITS.repetitions)) {
        fail("INVALID_REPETITIONS", "Repetițiile trebuie să fie un număr întreg între 0 și 100.");
      }
      if (!isNumberWithin(weightKg, AMV2_LIMITS.weightKg)) {
        fail("INVALID_WEIGHT", "Greutatea trebuie să fie un număr finit între 0 și 500 kg.");
      }
      if (repetitions === currentSet.targetRepetitions
        && weightKg === currentSet.targetWeightKg) return draft;
      nextSet = {
        id: currentSet.id,
        orderIndex: currentSet.orderIndex,
        targetRepetitions: repetitions,
        targetWeightKg: weightKg,
      };
    } else if (exercise.metricType === "repetitions_only") {
      if (Object.hasOwn(action, "targetWeightKg")
        || Object.hasOwn(action, "targetDurationSeconds")
        || Object.hasOwn(action, "targetTotalDurationSeconds")) {
        fail("METRIC_FIELD_MISMATCH", "Greutatea și durata sunt interzise pentru repetitions_only.");
      }
      if (!Object.hasOwn(action, "targetRepetitions")) {
        fail("INVALID_TARGET_PATCH", "Modificarea trebuie să conțină repetițiile țintă.");
      }
      if (!isIntegerWithin(action.targetRepetitions, AMV2_LIMITS.repetitions)) {
        fail("INVALID_REPETITIONS", "Repetițiile trebuie să fie un număr întreg între 0 și 100.");
      }
      if (action.targetRepetitions === currentSet.targetRepetitions) return draft;
      nextSet = {
        id: currentSet.id,
        orderIndex: currentSet.orderIndex,
        targetRepetitions: action.targetRepetitions,
      };
    } else {
      if (Object.hasOwn(action, "targetRepetitions")
        || Object.hasOwn(action, "targetWeightKg")
        || Object.hasOwn(action, "targetTotalDurationSeconds")) {
        fail("METRIC_FIELD_MISMATCH", "Repetițiile și greutatea sunt interzise pentru time_per_set.");
      }
      if (!Object.hasOwn(action, "targetDurationSeconds")) {
        fail("INVALID_TARGET_PATCH", "Modificarea trebuie să conțină durata țintă.");
      }
      const durationSeconds = action.targetDurationSeconds;
      if (!isIntegerWithin(durationSeconds, AMV2_LIMITS.timePerSetSeconds)) {
        fail("INVALID_DURATION", "Durata trebuie să fie un număr întreg între 0 și 3600 secunde.");
      }
      if (durationSeconds === currentSet.targetDurationSeconds) return draft;
      nextSet = {
        id: currentSet.id,
        orderIndex: currentSet.orderIndex,
        targetDurationSeconds: durationSeconds,
      };
    }
    return replaceExercise(draft, exerciseIndex, {
      ...exercise,
      sets: exercise.sets.map((set, index) => index === setIndex ? nextSet : set),
    }, action.updatedAt);
  }

  fail("INVALID_ACTION", `Acțiunea ${action.type} nu este acceptată în CP215.`);
}

export function hasExecutedWork(actuals) {
  if (!isRecord(actuals)) return false;
  if (actuals.metricType === "repetitions_weight"
    || actuals.metricType === "repetitions_only") {
    return Array.isArray(actuals.sets)
      && actuals.sets.some((set) => isFiniteNumber(set?.actualRepetitions)
        && set.actualRepetitions > 0);
  }
  if (actuals.metricType === "time_per_set") {
    return Array.isArray(actuals.sets)
      && actuals.sets.some((set) => isFiniteNumber(set?.actualDurationSeconds)
        && set.actualDurationSeconds > 0);
  }
  if (actuals.metricType === "total_duration") {
    return isFiniteNumber(actuals.actualTotalDurationSeconds)
      && actuals.actualTotalDurationSeconds > 0;
  }
  return false;
}
