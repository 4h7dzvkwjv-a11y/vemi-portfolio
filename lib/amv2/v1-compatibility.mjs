import { resolveCanonicalExerciseCatalogItem } from "./exercise-catalog.mjs";
import { resolveCanonicalExerciseMetric } from "./exercise-metric-map.mjs";
import {
  addExerciseToWorkoutDay,
  createWorkoutDayExercise,
  reduceWorkoutDayExercise,
} from "./workout-day-domain.mjs";

export class Amv2V1CompatibilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "Amv2V1CompatibilityError";
    this.code = code;
  }
}

const fail = (code, message) => { throw new Amv2V1CompatibilityError(code, message); };
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const integerWithin = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const numberWithin = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function resolveSafeV1Exercise(exercise) {
  if (!isRecord(exercise) || !isText(exercise.uid)) {
    return { status: "unsupported", reason: "Exercițiul V1 nu are exercise_key canonic fiabil." };
  }
  let catalog;
  let mapping;
  try {
    catalog = resolveCanonicalExerciseCatalogItem(exercise.uid);
    mapping = resolveCanonicalExerciseMetric(exercise.uid);
  } catch {
    return { status: "unsupported", reason: `Exercițiul V1 ${exercise.uid} nu aparține universului Gate 0C.` };
  }
  if (mapping.metric_type !== "total_duration" && !integerWithin(exercise.sets, 1, 20)) {
    return { status: "unsupported", reason: `${catalog.displayName}: numărul de serii V1 nu este sigur.` };
  }
  if (mapping.metric_type === "repetitions_weight") {
    if (!integerWithin(exercise.reps, 0, 100) || !numberWithin(exercise.weight, 0, 500)) {
      return { status: "unsupported", reason: `${catalog.displayName}: repetițiile sau greutatea V1 sunt invalide.` };
    }
  } else if (mapping.metric_type === "repetitions_only") {
    if (!integerWithin(exercise.reps, 0, 100) || (exercise.weight ?? 0) !== 0) {
      return { status: "unsupported", reason: `${catalog.displayName}: valorile V1 nu sunt compatibile cu repetitions_only.` };
    }
  } else if (mapping.metric_type === "time_per_set") {
    return { status: "unsupported", reason: `${catalog.displayName}: V1 nu păstrează durata fiecărei serii fără ambiguitate.` };
  } else {
    if (!numberWithin(exercise.minutes, 0, 300) || !Number.isInteger(exercise.minutes * 60)) {
      return { status: "unsupported", reason: `${catalog.displayName}: durata V1 nu are o conversie sigură în secunde.` };
    }
  }
  return { status: "supported", exercise, catalog, mapping };
}

export function analyzeV1WorkoutDefinition(workout) {
  if (!isRecord(workout)
    || !isText(workout.id)
    || (workout.place !== "acasa" && workout.place !== "sala")
    || !Array.isArray(workout.exercises)) {
    return { supported: [], unsupported: ["Definiția V1 este invalidă sau incompletă."] };
  }
  const supported = [];
  const unsupported = [];
  const keys = new Set();
  workout.exercises.forEach((exercise) => {
    const result = resolveSafeV1Exercise(exercise);
    if (result.status === "unsupported") {
      unsupported.push(result.reason);
      return;
    }
    if (keys.has(result.exercise.uid)) {
      unsupported.push(`${result.catalog.displayName}: exercise_key este duplicat în definiția V1.`);
      return;
    }
    keys.add(result.exercise.uid);
    supported.push(result);
  });
  return { supported, unsupported };
}

function createMappedExercise(supported, idFactory, timestamp) {
  const { exercise: source, mapping } = supported;
  const exerciseId = idFactory("exercise");
  const setIds = mapping.metric_type === "total_duration"
    ? undefined
    : Array.from({ length: Math.max(3, source.sets) }, () => idFactory("set"));
  let exercise = createWorkoutDayExercise({
    exerciseId,
    exerciseKey: source.uid,
    ...(setIds ? { setIds: setIds.slice(0, 3) } : {}),
  });
  if (setIds && source.sets !== 3) {
    while (exercise.sets.length < source.sets) {
      exercise = reduceWorkoutDayExercise(exercise, { type: "add_set", setId: setIds[exercise.sets.length] }, timestamp);
    }
    while (exercise.sets.length > source.sets) {
      exercise = reduceWorkoutDayExercise(exercise, { type: "remove_set", setId: exercise.sets.at(-1).id }, timestamp);
    }
  }
  if (mapping.metric_type === "total_duration") {
    return reduceWorkoutDayExercise(exercise, {
      type: "update_total_duration_target",
      targetTotalDurationSeconds: source.minutes * 60,
    }, timestamp);
  }
  for (const set of exercise.sets) {
    const action = mapping.metric_type === "repetitions_weight"
      ? { type: "update_set_targets", setId: set.id, targetRepetitions: source.reps, targetWeightKg: source.weight }
      : { type: "update_set_targets", setId: set.id, targetRepetitions: source.reps };
    exercise = reduceWorkoutDayExercise(exercise, action, timestamp);
  }
  return exercise;
}

export function copyV1WorkoutIntoDate({ workout, existingDay, date, timestamp, idFactory }) {
  if (existingDay !== null) fail("DESTINATION_DAY_EXISTS", "Importul V1 nu suprascrie o zi AMV2 existentă.");
  if (typeof idFactory !== "function") fail("INVALID_ID_FACTORY", "Importul V1 necesită identități locale stabile.");
  const analysis = analyzeV1WorkoutDefinition(workout);
  if (analysis.unsupported.length > 0 || analysis.supported.length === 0) {
    fail("UNSUPPORTED_V1_WORKOUT", analysis.unsupported.join(" ") || "Definiția V1 nu conține exerciții compatibile.");
  }
  if (analysis.supported.length > 10) fail("WORKOUT_DAY_CAPACITY", "Importul V1 depășește limita de 10 exerciții pentru o zi.");
  const location = workout.place === "acasa" ? "home" : "gym";
  let day = null;
  for (const supported of analysis.supported) {
    day = addExerciseToWorkoutDay(day, {
      date,
      location,
      exercise: createMappedExercise(supported, idFactory, timestamp),
      timestamp,
    });
  }
  return day;
}

export function listReliableV1History(logs) {
  if (!Array.isArray(logs)) return [];
  return Object.freeze(logs.filter((log) => isRecord(log)
    && isText(log.id)
    && isText(log.workoutName)
    && isText(log.completedAt)
    && Number.isFinite(Date.parse(log.completedAt))
    && Number.isInteger(log.exerciseCount)
    && log.exerciseCount >= 0
    && Array.isArray(log.exercises)
    && log.exercises.length === log.exerciseCount
    && log.exercises.every((exercise) => isRecord(exercise)
      && isText(exercise.name)
      && isText(exercise.group)
      && isText(exercise.details)))
    .map((log) => Object.freeze({
      id: log.id,
      workoutName: log.workoutName,
      completedAt: log.completedAt,
      exerciseCount: log.exerciseCount,
      exercises: Object.freeze(log.exercises.map((exercise) => Object.freeze({
        name: exercise.name,
        group: exercise.group,
        details: exercise.details,
      }))),
      source: "V1",
    })));
}

export function readV1CompatibilitySource(storage) {
  const parse = (key, fallback) => {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  const snapshot = parse("vemi-anonymous-progress-v2", null);
  const workouts = Array.isArray(snapshot?.workouts)
    ? snapshot.workouts
    : parse("vemi-custom-workouts", []);
  const logs = Array.isArray(snapshot?.logs)
    ? snapshot.logs
    : parse("vemi-workout-logs", []);
  return {
    workouts: Array.isArray(workouts) ? workouts.slice(0, 100) : [],
    history: listReliableV1History(logs),
  };
}
