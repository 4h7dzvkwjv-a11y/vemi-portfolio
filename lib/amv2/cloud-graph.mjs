import { validatePersonalExercise } from "./personal-exercise-domain.mjs";
import { validateDayTombstone } from "./sync-reconciliation.mjs";
import { validateWorkoutDay } from "./workout-day-domain.mjs";

export class Amv2CloudGraphError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "Amv2CloudGraphError";
    this.code = code;
  }
}
const fail = (code, message) => { throw new Amv2CloudGraphError(code, message); };
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

export function serializeWorkoutDayForCloud(day) {
  const validation = validateWorkoutDay(day);
  if (!validation.valid) fail("INVALID_WORKOUT_DAY", validation.issues.join(" "));
  return {
    date: day.date,
    clientKey: `workout-day:${day.date}`,
    location: day.location,
    exercises: JSON.parse(JSON.stringify(day.exercises)),
  };
}

export function serializePersonalExerciseForCloud(exercise) {
  const validation = validatePersonalExercise(exercise);
  if (!validation.valid) fail("INVALID_PERSONAL_EXERCISE", validation.issues.join(" "));
  return {
    id: exercise.id,
    clientKey: exercise.clientKey,
    name: exercise.name,
    templateExerciseKey: exercise.templateExerciseKey,
    category: exercise.category,
    location: exercise.location,
    metricType: exercise.metricType,
  };
}

export function hydrateCloudCalendarSnapshot(snapshot) {
  if (!isRecord(snapshot)
    || !Array.isArray(snapshot.days)
    || !Array.isArray(snapshot.exercises)
    || !Array.isArray(snapshot.sets)
    || !Array.isArray(snapshot.personalExercises)) {
    fail("INVALID_CLOUD_SNAPSHOT", "Snapshotul calendarului din cont este invalid.");
  }
  const rawTombstones = snapshot.tombstones ?? [];
  if (!Array.isArray(rawTombstones)) fail("INVALID_CLOUD_SNAPSHOT", "Lista ștergerilor cloud este invalidă.");
  const personalTemplateById = new Map(snapshot.personalExercises.map((row) => [row.id, row.template_exercise_key]));
  const exercisesByDate = new Map();
  for (const row of snapshot.exercises) {
    if (!isRecord(row) || typeof row.workout_date !== "string") fail("INVALID_CLOUD_SNAPSHOT", "Rândul cloud de exercițiu este invalid.");
    const rows = exercisesByDate.get(row.workout_date) ?? [];
    rows.push(row);
    exercisesByDate.set(row.workout_date, rows);
  }
  const setsByExercise = new Map();
  for (const row of snapshot.sets) {
    const key = `${row.workout_date}:${row.exercise_client_key}`;
    const rows = setsByExercise.get(key) ?? [];
    rows.push(row);
    setsByExercise.set(key, rows);
  }
  const days = snapshot.days.map((row) => {
    const exercises = (exercisesByDate.get(row.workout_date) ?? [])
      .sort((left, right) => left.order_index - right.order_index)
      .map((exerciseRow) => {
        const reference = exerciseRow.canonical_exercise_key
          ? { source: "canonical", exerciseKey: exerciseRow.canonical_exercise_key }
          : {
              source: "personal",
              personalExerciseId: exerciseRow.personal_exercise_id,
              templateExerciseKey: exerciseRow.personal_template_exercise_key
                ?? personalTemplateById.get(exerciseRow.personal_exercise_id),
            };
        const base = {
          id: exerciseRow.client_key,
          orderIndex: exerciseRow.order_index,
          reference,
          displayName: exerciseRow.display_name,
          category: exerciseRow.category,
          metricType: exerciseRow.metric_type,
        };
        if (exerciseRow.metric_type === "total_duration") {
          return { ...base, targetTotalDurationSeconds: exerciseRow.total_duration_seconds };
        }
        const sets = (setsByExercise.get(`${row.workout_date}:${exerciseRow.client_key}`) ?? [])
          .sort((left, right) => left.order_index - right.order_index)
          .map((setRow) => {
            const setBase = { id: setRow.client_key, orderIndex: setRow.order_index };
            if (exerciseRow.metric_type === "repetitions_weight") return { ...setBase, targetRepetitions: setRow.repetitions, targetWeightKg: Number(setRow.weight_kg) };
            if (exerciseRow.metric_type === "repetitions_only") return { ...setBase, targetRepetitions: setRow.repetitions };
            return { ...setBase, targetDurationSeconds: setRow.duration_seconds };
          });
        return { ...base, sets };
      });
    const day = {
      date: row.workout_date,
      location: row.location,
      exercises,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const validation = validateWorkoutDay(day);
    if (!validation.valid) fail("INVALID_CLOUD_WORKOUT_DAY", validation.issues.join(" "));
    return day;
  });
  const personalExercises = snapshot.personalExercises.map((row) => ({
    id: row.id,
    clientKey: row.client_key,
    name: row.name,
    templateExerciseKey: row.template_exercise_key,
    category: row.category,
    location: row.location,
    metricType: row.metric_type,
    revision: row.revision,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  personalExercises.forEach((exercise) => {
    const validation = validatePersonalExercise(exercise);
    if (!validation.valid) fail("INVALID_CLOUD_PERSONAL_EXERCISE", validation.issues.join(" "));
  });
  const tombstones = rawTombstones.map((row) => {
    if (!isRecord(row)) fail("INVALID_CLOUD_TOMBSTONE", "Snapshotul conține un marker de ștergere invalid.");
    return {
      date: row.workout_date,
      revision: Number(row.revision),
      deletedAt: row.deleted_at,
    };
  });
  if (tombstones.some((tombstone) => !validateDayTombstone(tombstone))) {
    fail("INVALID_CLOUD_TOMBSTONE", "Snapshotul conține un marker de ștergere invalid.");
  }
  const tombstoneDates = new Set(tombstones.map((tombstone) => tombstone.date));
  if (tombstoneDates.size !== tombstones.length || days.some((day) => tombstoneDates.has(day.date))) {
    fail("CONTRADICTORY_CLOUD_SNAPSHOT", "Snapshotul cloud conține stări active și șterse incompatibile.");
  }
  const dayRevisions = Object.fromEntries(snapshot.days.map((row) => [row.workout_date, Number(row.revision)]));
  return { days, personalExercises, tombstones, dayRevisions };
}
