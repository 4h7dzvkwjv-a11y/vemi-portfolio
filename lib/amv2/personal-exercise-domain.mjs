import { resolveCanonicalExerciseCatalogItem } from "./exercise-catalog.mjs";
import { resolveCanonicalExerciseMetric } from "./exercise-metric-map.mjs";
import { AMV2_CATEGORY_ORDER } from "./category-presentation.mjs";

export const PERSONAL_EXERCISE_LIMITS = Object.freeze({
  nameLength: 100,
  active: 100,
});

export const PERSONAL_EXERCISE_CATEGORIES = AMV2_CATEGORY_ORDER;
export const PERSONAL_EXERCISE_METRIC_TYPES = Object.freeze([
  "repetitions_weight",
  "repetitions_only",
  "time_per_set",
]);

const PERSONAL_TEMPLATE_BY_METRIC = Object.freeze({
  repetitions_weight: "flexii-gantere",
  repetitions_only: "abdomene",
  time_per_set: "plank",
});
const personalCategorySet = new Set(PERSONAL_EXERCISE_CATEGORIES);
const selectableMetricSet = new Set(PERSONAL_EXERCISE_METRIC_TYPES);

export class PersonalExerciseDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PersonalExerciseDomainError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new PersonalExerciseDomainError(code, message);
};
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

function canonicalTemplate(templateExerciseKey) {
  try {
    return {
      catalog: resolveCanonicalExerciseCatalogItem(templateExerciseKey),
      metric: resolveCanonicalExerciseMetric(templateExerciseKey),
    };
  } catch {
    fail("UNKNOWN_CANONICAL_TEMPLATE", "Șablonul canonic pentru exercițiul personal este necunoscut.");
  }
}

export function validatePersonalExercise(value) {
  const issues = [];
  if (!isRecord(value)) return { valid: false, issues: ["Exercițiul personal nu este un obiect valid."] };
  if (!isText(value.id)) issues.push("Exercițiul personal nu are ID stabil.");
  if (!isText(value.clientKey)) issues.push("Exercițiul personal nu are clientKey stabil.");
  if (!isText(value.name) || value.name.trim().length > PERSONAL_EXERCISE_LIMITS.nameLength) {
    issues.push("Numele exercițiului personal trebuie să aibă între 1 și 100 de caractere.");
  }
  if (value.location !== "home" && value.location !== "gym") {
    issues.push("Locația exercițiului personal trebuie să fie home sau gym.");
  }
  if (!personalCategorySet.has(value.category)) {
    issues.push("Categoria exercițiului personal nu este aprobată.");
  }
  if (!Number.isInteger(value.revision) || value.revision < 0) issues.push("Revizia exercițiului personal este invalidă.");
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) {
    issues.push("Exercițiul personal nu are timestampuri valide.");
  }
  if (value.archivedAt !== null && !isTimestamp(value.archivedAt)) {
    issues.push("Data arhivării exercițiului personal este invalidă.");
  }

  try {
    const template = canonicalTemplate(value.templateExerciseKey);
    if (value.metricType !== template.metric.metric_type) {
      issues.push("Metrica exercițiului personal nu corespunde șablonului canonic.");
    }
    if (!template.catalog.locations.includes(value.location)) {
      issues.push("Locația exercițiului personal nu este compatibilă cu șablonul canonic.");
    }
  } catch (error) {
    if (error instanceof PersonalExerciseDomainError) issues.push(error.message);
    else throw error;
  }
  return { valid: issues.length === 0, issues };
}

export function createPersonalExercise(input) {
  if (!isRecord(input)) fail("INVALID_PERSONAL_EXERCISE", "Exercițiul personal nou este invalid.");
  const forbidden = ["metric_type", "templateExerciseKey", "location", "defaults"];
  if (forbidden.some((field) => Object.hasOwn(input, field))) {
    fail("PERSONAL_INTERNAL_TEMPLATE_OVERRIDE_FORBIDDEN", "Șablonul intern și locația de compatibilitate nu pot fi suprascrise.");
  }
  const allowed = ["id", "clientKey", "name", "category", "metricType", "timestamp"];
  if (Object.keys(input).some((field) => !allowed.includes(field))) {
    fail("INVALID_PERSONAL_EXERCISE_INPUT", "Exercițiul personal conține câmpuri neautorizate.");
  }
  if (!personalCategorySet.has(input.category)) {
    fail("INVALID_PERSONAL_CATEGORY", "Alege o categorie aprobată pentru exercițiul personal.");
  }
  if (!selectableMetricSet.has(input.metricType)) {
    fail("INVALID_PERSONAL_METRIC", "Alege unul dintre cele trei tipuri aprobate pentru exercițiul personal.");
  }
  const templateExerciseKey = PERSONAL_TEMPLATE_BY_METRIC[input.metricType];
  const exercise = {
    id: input.id,
    clientKey: input.clientKey,
    name: typeof input.name === "string" ? input.name.trim() : input.name,
    templateExerciseKey,
    category: input.category,
    location: "home",
    metricType: input.metricType,
    revision: 0,
    archivedAt: null,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
  const validation = validatePersonalExercise(exercise);
  if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
  return exercise;
}

export function updatePersonalExercise(exercise, input) {
  const validation = validatePersonalExercise(exercise);
  if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
  if (!isRecord(input)) fail("INVALID_PERSONAL_EXERCISE_INPUT", "Actualizarea exercițiului personal este invalidă.");
  if (["metric_type", "templateExerciseKey", "location", "id", "clientKey"].some((field) => Object.hasOwn(input, field))) {
    fail("PERSONAL_IDENTITY_OVERRIDE_FORBIDDEN", "Identitatea și șablonul intern nu pot fi suprascrise.");
  }
  const category = Object.hasOwn(input, "category") ? input.category : exercise.category;
  const metricType = Object.hasOwn(input, "metricType") ? input.metricType : exercise.metricType;
  if (!personalCategorySet.has(category)) {
    fail("INVALID_PERSONAL_CATEGORY", "Alege o categorie aprobată pentru exercițiul personal.");
  }
  if (!selectableMetricSet.has(metricType)) {
    fail("INVALID_PERSONAL_METRIC", "Alege unul dintre cele trei tipuri aprobate pentru exercițiul personal.");
  }
  const next = {
    ...exercise,
    name: Object.hasOwn(input, "name") && typeof input.name === "string" ? input.name.trim() : exercise.name,
    category,
    metricType,
    templateExerciseKey: PERSONAL_TEMPLATE_BY_METRIC[metricType],
    revision: exercise.revision + 1,
    updatedAt: input.timestamp,
  };
  const nextValidation = validatePersonalExercise(next);
  if (!nextValidation.valid) fail("INVALID_PERSONAL_EXERCISE", nextValidation.issues.join(" "));
  return next;
}

export function archivePersonalExercise(exercise, timestamp) {
  const validation = validatePersonalExercise(exercise);
  if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
  if (exercise.archivedAt !== null) return exercise;
  const next = { ...exercise, archivedAt: timestamp, updatedAt: timestamp, revision: exercise.revision + 1 };
  const nextValidation = validatePersonalExercise(next);
  if (!nextValidation.valid) fail("INVALID_PERSONAL_EXERCISE", nextValidation.issues.join(" "));
  return next;
}

export function listActivePersonalExercises(exercises, location = null) {
  if (!Array.isArray(exercises)) fail("INVALID_PERSONAL_EXERCISE_LIST", "Lista exercițiilor personale este invalidă.");
  const ids = new Set();
  return Object.freeze(exercises.filter((exercise) => {
    const validation = validatePersonalExercise(exercise);
    if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
    if (ids.has(exercise.id)) fail("DUPLICATE_PERSONAL_EXERCISE", "Lista conține un exercițiu personal duplicat.");
    ids.add(exercise.id);
    return exercise.archivedAt === null
      && selectableMetricSet.has(exercise.metricType)
      && (location === null || exercise.location === location);
  }).map((exercise) => Object.freeze({ ...exercise })));
}
