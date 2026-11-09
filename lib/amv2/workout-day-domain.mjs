import {
  Amv2DomainError,
  createPersonalWorkoutExercise,
  createWorkoutExercise,
  getWorkoutExerciseIdentity,
  getWorkoutExerciseTemplateKey,
  reduceWorkoutDraft,
  validateWorkoutDraft,
} from "./draft-domain.mjs";
import {
  CanonicalExerciseCatalogError,
  resolveCanonicalExerciseCatalogItem,
} from "./exercise-catalog.mjs";
import { AMV2_CATEGORY_COLORS } from "./category-presentation.mjs";
import {
  CanonicalExerciseMetricMapError,
  resolveCanonicalExerciseMetric,
} from "./exercise-metric-map.mjs";

export const WORKOUT_DAY_LIMITS = Object.freeze({
  exercises: Object.freeze({ min: 1, max: 10 }),
  visibleCalendarMarkers: 4,
});

export { AMV2_CATEGORY_COLORS };

export class WorkoutDayDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkoutDayDomainError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new WorkoutDayDomainError(code, message);
};

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isTimestamp = (value) => isText(value) && Number.isFinite(Date.parse(value));

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function localDateParts(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    fail("INVALID_DATE", "Data calendaristică este invalidă.");
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function toLocalDateKey(date = new Date()) {
  const { year, month, day } = localDateParts(date);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthKeyFromDateKey(dateKey) {
  if (!isDateKey(dateKey)) fail("INVALID_DATE", "Data calendaristică trebuie să aibă forma YYYY-MM-DD.");
  return dateKey.slice(0, 7);
}

export function shiftMonthKey(monthKey, delta) {
  if (typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey) || !Number.isInteger(delta)) {
    fail("INVALID_MONTH", "Luna calendaristică este invalidă.");
  }
  const [year, month] = monthKey.split("-").map(Number);
  if (month < 1 || month > 12) fail("INVALID_MONTH", "Luna calendaristică este invalidă.");
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${String(shifted.getFullYear()).padStart(4, "0")}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function createCalendarMonth(monthKey) {
  if (typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    fail("INVALID_MONTH", "Luna calendaristică este invalidă.");
  }
  const [year, month] = monthKey.split("-").map(Number);
  if (month < 1 || month > 12) fail("INVALID_MONTH", "Luna calendaristică este invalidă.");
  const firstDay = new Date(year, month - 1, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month - 1, 1 - mondayOffset + index);
    return Object.freeze({
      dateKey: toLocalDateKey(date),
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === month - 1,
    });
  });
  return Object.freeze({
    monthKey,
    label: new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(firstDay),
    cells: Object.freeze(cells),
  });
}

function canonicalCatalogItem(exerciseKey) {
  try {
    return resolveCanonicalExerciseCatalogItem(exerciseKey);
  } catch (error) {
    if (error instanceof CanonicalExerciseCatalogError) fail(error.code, error.message);
    throw error;
  }
}

function canonicalMetric(exerciseKey) {
  try {
    return resolveCanonicalExerciseMetric(exerciseKey);
  } catch (error) {
    if (error instanceof CanonicalExerciseMetricMapError) fail(error.code, error.message);
    throw error;
  }
}

function normalizeExerciseOrder(exercises) {
  return exercises.map((exercise, orderIndex) => {
    const normalized = { ...exercise, orderIndex };
    if (Array.isArray(exercise.sets)) {
      normalized.sets = exercise.sets.map((set, setIndex) => ({ ...set, orderIndex: setIndex }));
    }
    return normalized;
  });
}

function validateCanonicalCatalogIdentity(exercise, label, issues) {
  try {
    const canonical = resolveCanonicalExerciseCatalogItem(getWorkoutExerciseTemplateKey(exercise));
    if (exercise.reference?.source === "canonical" && exercise.displayName !== canonical.displayName) {
      issues.push(`${label}: numele afișat nu corespunde catalogului canonic.`);
    }
    if (exercise.reference?.source === "canonical" && exercise.category !== canonical.category) {
      issues.push(`${label}: grupa musculară nu corespunde catalogului canonic.`);
    }
  } catch (error) {
    if (error instanceof CanonicalExerciseCatalogError) {
      issues.push(`${label}: exercise_key lipsește din catalogul canonic.`);
      return;
    }
    throw error;
  }
}

export function createPersonalWorkoutDayExercise(input) {
  if (!isRecord(input)) fail("INVALID_EXERCISE", "Exercițiul personal calendaristic este invalid.");
  const allowedFields = ["exerciseId", "personalExerciseId", "templateExerciseKey", "displayName", "category", "setIds"];
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
    fail("INVALID_EXERCISE_INPUT", "Exercițiul personal nou conține câmpuri neautorizate.");
  }
  const metric = canonicalMetric(input.templateExerciseKey);
  if (metric.metric_type === "total_duration" && Object.hasOwn(input, "setIds")) {
    fail("SET_ACTION_NOT_ALLOWED", "total_duration nu acceptă serii artificiale.");
  }
  try {
    return createPersonalWorkoutExercise({
      id: input.exerciseId,
      orderIndex: 0,
      personalExerciseId: input.personalExerciseId,
      templateExerciseKey: input.templateExerciseKey,
      displayName: input.displayName,
      category: input.category,
      ...(Object.hasOwn(input, "setIds") ? { setIds: input.setIds } : {}),
    });
  } catch (error) {
    if (error instanceof Amv2DomainError) fail(error.code, error.message);
    throw error;
  }
}

export function createWorkoutDayExercise(input) {
  if (!isRecord(input)) fail("INVALID_EXERCISE", "Exercițiul calendaristic este invalid.");
  if (Object.hasOwn(input, "metricType") || Object.hasOwn(input, "metric_type")) {
    fail("CANONICAL_METRIC_OVERRIDE_FORBIDDEN", "Tipul metric este stabilit exclusiv prin exercise_key.");
  }
  const allowedFields = ["exerciseId", "exerciseKey", "setIds"];
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
    fail("INVALID_EXERCISE_INPUT", "Exercițiul nou acceptă numai identitatea canonică și ID-urile locale.");
  }
  const { exerciseId, exerciseKey, setIds } = input;
  const catalogItem = canonicalCatalogItem(exerciseKey);
  const metric = canonicalMetric(exerciseKey);
  const exerciseInput = {
    id: exerciseId,
    orderIndex: 0,
    exerciseKey,
    displayName: catalogItem.displayName,
    category: catalogItem.category,
  };
  if (metric.metric_type !== "total_duration") exerciseInput.setIds = setIds;
  else if (Object.hasOwn(input, "setIds")) {
    fail("SET_ACTION_NOT_ALLOWED", "total_duration nu acceptă serii artificiale.");
  }
  try {
    return createWorkoutExercise(exerciseInput);
  } catch (error) {
    if (error instanceof Amv2DomainError) fail(error.code, error.message);
    throw error;
  }
}

export function validateWorkoutDay(day) {
  const issues = [];
  if (!isRecord(day)) return { valid: false, issues: ["WorkoutDay nu este un obiect valid."] };
  if (!isDateKey(day.date)) issues.push("WorkoutDay nu are o dată calendaristică validă.");
  if (day.location !== "home" && day.location !== "gym") {
    issues.push("Locația WorkoutDay trebuie să fie home sau gym.");
  }
  if (!isTimestamp(day.createdAt)) issues.push("WorkoutDay nu are createdAt valid.");
  if (!isTimestamp(day.updatedAt)) issues.push("WorkoutDay nu are updatedAt valid.");
  if (!Array.isArray(day.exercises)) {
    issues.push("WorkoutDay nu are lista de exerciții.");
    return { valid: false, issues };
  }
  if (day.exercises.length < WORKOUT_DAY_LIMITS.exercises.min
    || day.exercises.length > WORKOUT_DAY_LIMITS.exercises.max) {
    issues.push("O zi de antrenament trebuie să conțină între 1 și 10 exerciții.");
  }

  const shellValidation = validateWorkoutDraft({
    id: `workout-day:${day.date}`,
    name: "",
    location: day.location,
    exercises: day.exercises,
    revision: 0,
    updatedAt: day.updatedAt,
  }, { requireName: false });
  issues.push(...shellValidation.issues);
  day.exercises.forEach((exercise, index) => {
    validateCanonicalCatalogIdentity(exercise, `Exercițiul ${index + 1}`, issues);
  });
  return { valid: issues.length === 0, issues };
}

function assertWorkoutDay(day) {
  const validation = validateWorkoutDay(day);
  if (!validation.valid) fail("INVALID_WORKOUT_DAY", validation.issues.join(" "));
}

export function createWorkoutDay({ date, location, exercise, timestamp }) {
  const day = {
    date,
    location,
    exercises: normalizeExerciseOrder([exercise]),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  assertWorkoutDay(day);
  return day;
}

export function addExerciseToWorkoutDay(day, { date, location, exercise, timestamp }) {
  if (day === null) return createWorkoutDay({ date, location, exercise, timestamp });
  assertWorkoutDay(day);
  if (day.date !== date) fail("DATE_MISMATCH", "Exercițiul nu poate fi adăugat pe altă dată.");
  const identity = getWorkoutExerciseIdentity(exercise);
  if (!identity) fail("INVALID_EXERCISE_REFERENCE", "Identitatea exercițiului este invalidă.");
  if (day.exercises.some((candidate) => getWorkoutExerciseIdentity(candidate) === identity)) {
    fail("DUPLICATE_EXERCISE", "Exercițiul există deja în ziua selectată.");
  }
  if (day.exercises.length >= WORKOUT_DAY_LIMITS.exercises.max) {
    fail("WORKOUT_DAY_CAPACITY", "O zi poate conține maximum 10 exerciții.");
  }
  const next = {
    ...day,
    exercises: normalizeExerciseOrder([...day.exercises, exercise]),
    updatedAt: timestamp,
  };
  assertWorkoutDay(next);
  return next;
}

export function updateWorkoutDayExercise(day, exercise, timestamp) {
  assertWorkoutDay(day);
  const identity = getWorkoutExerciseIdentity(exercise);
  const index = day.exercises.findIndex((candidate) => getWorkoutExerciseIdentity(candidate) === identity);
  if (index < 0) fail("EXERCISE_NOT_FOUND", "Exercițiul nu există în ziua selectată.");
  if (exercise.id !== day.exercises[index].id) {
    fail("EXERCISE_ID_MISMATCH", "Identitatea locală a exercițiului nu poate fi schimbată.");
  }
  const exercises = day.exercises.map((candidate, candidateIndex) => candidateIndex === index
    ? { ...exercise, orderIndex: candidate.orderIndex }
    : candidate);
  const next = { ...day, exercises: normalizeExerciseOrder(exercises), updatedAt: timestamp };
  assertWorkoutDay(next);
  return next;
}

export function removeExerciseFromWorkoutDay(day, exerciseIdentity, timestamp) {
  assertWorkoutDay(day);
  const normalizedIdentity = typeof exerciseIdentity === "string" && exerciseIdentity.includes(":")
    ? exerciseIdentity
    : `canonical:${exerciseIdentity}`;
  const index = day.exercises.findIndex((exercise) => getWorkoutExerciseIdentity(exercise) === normalizedIdentity);
  if (index < 0) fail("EXERCISE_NOT_FOUND", "Exercițiul nu există în ziua selectată.");
  if (day.exercises.length === 1) return null;
  const next = {
    ...day,
    exercises: normalizeExerciseOrder(day.exercises.filter((_, candidateIndex) => candidateIndex !== index)),
    updatedAt: timestamp,
  };
  assertWorkoutDay(next);
  return next;
}

export function updateWorkoutDayLocation(day, location, timestamp) {
  assertWorkoutDay(day);
  const next = { ...day, location, updatedAt: timestamp };
  assertWorkoutDay(next);
  return next;
}

export function reduceWorkoutDayExercise(exercise, action, updatedAt) {
  if (!isRecord(action) || !isText(action.type)) fail("INVALID_ACTION", "Acțiunea editorului este invalidă.");
  const allowedActions = new Set([
    "add_set",
    "remove_set",
    "move_set",
    "update_set_targets",
    "update_total_duration_target",
  ]);
  if (!allowedActions.has(action.type)) fail("INVALID_ACTION", "Acțiunea nu este permisă în editorul calendaristic.");
  const shell = {
    id: "workout-day-exercise-editor",
    name: "",
    location: "gym",
    exercises: normalizeExerciseOrder([exercise]),
    revision: 0,
    updatedAt,
  };
  try {
    const next = reduceWorkoutDraft(shell, {
      ...action,
      exerciseId: exercise.id,
      updatedAt,
    });
    return { ...next.exercises[0], orderIndex: exercise.orderIndex };
  } catch (error) {
    if (error instanceof Amv2DomainError) fail(error.code, error.message);
    throw error;
  }
}

export function deriveWorkoutDayMuscleGroups(day) {
  assertWorkoutDay(day);
  const seen = new Set();
  const groups = [];
  day.exercises.forEach((exercise) => {
    const category = exercise.category;
    if (seen.has(category)) return;
    seen.add(category);
    groups.push(Object.freeze({
      id: category,
      label: category,
      color: AMV2_CATEGORY_COLORS[category] ?? "#5d7868",
    }));
  });
  return Object.freeze(groups);
}
