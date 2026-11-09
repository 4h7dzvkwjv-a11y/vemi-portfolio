import assert from "node:assert/strict";
import test from "node:test";
import { resolveCanonicalExerciseMetric } from "../lib/amv2/exercise-metric-map.mjs";
import {
  AMV2_LEGACY_LOCAL_STORAGE_KEY,
  AMV2_WORKOUT_CALENDAR_STORAGE_KEY,
  createWorkoutCalendarEnvelope,
  findWorkoutDay,
  readWorkoutCalendar,
  replaceWorkoutDayInCalendar,
  validateWorkoutCalendarEnvelope,
  writeWorkoutCalendar,
} from "../lib/amv2/workout-calendar-local.mjs";
import {
  addExerciseToWorkoutDay,
  createWorkoutDay,
  createWorkoutDayExercise,
  reduceWorkoutDayExercise,
  removeExerciseFromWorkoutDay,
  updateWorkoutDayExercise,
} from "../lib/amv2/workout-day-domain.mjs";

const t0 = "2026-08-21T10:00:00.000Z";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, value); }
}

function exercise(exerciseKey, index = 0) {
  const metric = resolveCanonicalExerciseMetric(exerciseKey);
  const exerciseId = `exercise-${index}-${exerciseKey}`;
  const input = { exerciseId, exerciseKey };
  if (metric.metric_type !== "total_duration") {
    input.setIds = [1, 2, 3].map((ordinal) => `${exerciseId}-set-${ordinal}`);
  }
  return createWorkoutDayExercise(input);
}

test("calendarul local pornește gol și nu creează WorkoutDay fără exerciții", () => {
  const envelope = createWorkoutCalendarEnvelope(t0);
  assert.deepEqual(envelope.days, []);
  assert.equal(validateWorkoutCalendarEnvelope(envelope).valid, true);
  assert.equal(findWorkoutDay(envelope, "2026-08-21"), null);
});

test("add/edit/delete persistă atomic, iar refresh recuperează zero și total_duration fără serii", () => {
  const storage = new MemoryStorage();
  let envelope = createWorkoutCalendarEnvelope(t0);
  const keys = ["impins-gantere", "abdomene", "plank-cu-greutate", "bicicleta-stationara"];
  let day = createWorkoutDay({
    date: "2026-08-21",
    location: "gym",
    exercise: exercise(keys[0], 0),
    timestamp: t0,
  });
  keys.slice(1).forEach((key, index) => {
    day = addExerciseToWorkoutDay(day, {
      date: day.date,
      location: day.location,
      exercise: exercise(key, index + 1),
      timestamp: t0,
    });
  });
  envelope = replaceWorkoutDayInCalendar(envelope, day.date, day, t0);
  assert.equal(writeWorkoutCalendar(storage, envelope).status, "saved_local");

  const loaded = readWorkoutCalendar(storage);
  assert.equal(loaded.status, "loaded");
  const recovered = loaded.envelope.days[0];
  assert.deepEqual(recovered.exercises[0].sets.map((set) => [set.targetRepetitions, set.targetWeightKg]), [[0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(recovered.exercises[1].sets.map((set) => set.targetRepetitions), [0, 0, 0]);
  assert.deepEqual(recovered.exercises[2].sets.map((set) => set.targetDurationSeconds), [0, 0, 0]);
  assert.equal(recovered.exercises[3].targetTotalDurationSeconds, 0);
  assert.equal(Object.hasOwn(recovered.exercises[3], "sets"), false);

  const editedExercise = reduceWorkoutDayExercise(recovered.exercises[0], {
    type: "update_set_targets",
    setId: recovered.exercises[0].sets[0].id,
    targetRepetitions: 12,
    targetWeightKg: 0,
  }, "2026-08-21T10:02:00.000Z");
  const editedDay = updateWorkoutDayExercise(recovered, editedExercise, "2026-08-21T10:02:00.000Z");
  const editedEnvelope = replaceWorkoutDayInCalendar(loaded.envelope, editedDay.date, editedDay, "2026-08-21T10:02:00.000Z");
  writeWorkoutCalendar(storage, editedEnvelope);
  const reloaded = readWorkoutCalendar(storage);
  assert.equal(reloaded.envelope.days[0].exercises[0].sets[0].targetRepetitions, 12);
  assert.equal(reloaded.envelope.days[0].exercises[0].sets[0].targetWeightKg, 0);

  const withoutOne = removeExerciseFromWorkoutDay(reloaded.envelope.days[0], "bicicleta-stationara", "2026-08-21T10:03:00.000Z");
  const afterDelete = replaceWorkoutDayInCalendar(reloaded.envelope, withoutOne.date, withoutOne, "2026-08-21T10:03:00.000Z");
  writeWorkoutCalendar(storage, afterDelete);
  assert.equal(readWorkoutCalendar(storage).envelope.days[0].exercises.length, 3);
});

test("zilele sunt unice și sortate, inclusiv pentru date viitoare", () => {
  let envelope = createWorkoutCalendarEnvelope(t0);
  const future = createWorkoutDay({ date: "2027-01-10", location: "home", exercise: exercise("abdomene", 1), timestamp: t0 });
  const past = createWorkoutDay({ date: "2025-12-01", location: "gym", exercise: exercise("plank", 2), timestamp: t0 });
  envelope = replaceWorkoutDayInCalendar(envelope, future.date, future, t0);
  envelope = replaceWorkoutDayInCalendar(envelope, past.date, past, t0);
  assert.deepEqual(envelope.days.map((day) => day.date), ["2025-12-01", "2027-01-10"]);

  const duplicate = { ...envelope, days: [past, structuredClone(past)] };
  assert.equal(validateWorkoutCalendarEnvelope(duplicate).valid, false);
  assert.match(validateWorkoutCalendarEnvelope(duplicate).issues.join(" "), /apare de mai multe ori/);
});

test("markerii nu sunt persistați separat și datele locale CP217 rămân izolate", () => {
  const legacy = JSON.stringify({ schemaVersion: 3, untouched: true });
  const storage = new MemoryStorage({ [AMV2_LEGACY_LOCAL_STORAGE_KEY]: legacy });
  let envelope = createWorkoutCalendarEnvelope(t0);
  const day = createWorkoutDay({ date: "2026-08-21", location: "gym", exercise: exercise("abdomene"), timestamp: t0 });
  envelope = replaceWorkoutDayInCalendar(envelope, day.date, day, t0);
  writeWorkoutCalendar(storage, envelope);

  const raw = storage.getItem(AMV2_WORKOUT_CALENDAR_STORAGE_KEY);
  assert.doesNotMatch(raw, /markers|dots|muscleGroups/);
  assert.equal(storage.getItem(AMV2_LEGACY_LOCAL_STORAGE_KEY), legacy);
});

test("ultima eliminare șterge natural înregistrarea zilei", () => {
  const storage = new MemoryStorage();
  let envelope = createWorkoutCalendarEnvelope(t0);
  const day = createWorkoutDay({ date: "2026-08-21", location: "gym", exercise: exercise("abdomene"), timestamp: t0 });
  envelope = replaceWorkoutDayInCalendar(envelope, day.date, day, t0);
  const removedDay = removeExerciseFromWorkoutDay(day, "abdomene", t0);
  assert.equal(removedDay, null);
  envelope = replaceWorkoutDayInCalendar(envelope, day.date, removedDay, t0);
  writeWorkoutCalendar(storage, envelope);
  assert.deepEqual(readWorkoutCalendar(storage).envelope.days, []);
});
