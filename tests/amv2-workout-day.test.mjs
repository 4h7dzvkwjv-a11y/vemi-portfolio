import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_EXERCISE_CATALOG } from "../lib/amv2/exercise-catalog.mjs";
import { resolveCanonicalExerciseMetric } from "../lib/amv2/exercise-metric-map.mjs";
import {
  addExerciseToWorkoutDay,
  createCalendarMonth,
  createWorkoutDay,
  createWorkoutDayExercise,
  deriveWorkoutDayMuscleGroups,
  monthKeyFromDateKey,
  reduceWorkoutDayExercise,
  removeExerciseFromWorkoutDay,
  shiftMonthKey,
  updateWorkoutDayExercise,
  updateWorkoutDayLocation,
  validateWorkoutDay,
  WorkoutDayDomainError,
} from "../lib/amv2/workout-day-domain.mjs";

const timestamp = "2026-08-21T10:00:00.000Z";

function exercise(exerciseKey, index = 0) {
  const metric = resolveCanonicalExerciseMetric(exerciseKey);
  const exerciseId = `day-exercise-${index}-${exerciseKey}`;
  const input = { exerciseId, exerciseKey };
  if (metric.metric_type !== "total_duration") {
    input.setIds = [1, 2, 3].map((ordinal) => `${exerciseId}-set-${ordinal}`);
  }
  return createWorkoutDayExercise(input);
}

function dayWithKeys(keys, date = "2026-08-21", location = "gym") {
  let day = createWorkoutDay({ date, location, exercise: exercise(keys[0], 0), timestamp });
  keys.slice(1).forEach((exerciseKey, index) => {
    day = addExerciseToWorkoutDay(day, {
      date,
      location,
      exercise: exercise(exerciseKey, index + 1),
      timestamp,
    });
  });
  return day;
}

test("calendarul lunar pornește lunea și navighează determinist în trecut și viitor", () => {
  const august = createCalendarMonth("2026-08");
  assert.equal(august.cells.length, 42);
  assert.equal(august.cells[0].dateKey, "2026-07-27");
  assert.equal(august.cells.at(-1).dateKey, "2026-09-06");
  assert.equal(monthKeyFromDateKey("2026-08-21"), "2026-08");
  assert.equal(shiftMonthKey("2026-08", -1), "2026-07");
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
  assert.equal(validateWorkoutDay(dayWithKeys(["abdomene"], "2025-01-03")).valid, true);
  assert.equal(validateWorkoutDay(dayWithKeys(["abdomene"], "2027-12-30")).valid, true);
});

test("factory-ul calendaristic derivă toate cele patru metrici și matricea zero Gate 0C", () => {
  const repetitionsWeight = exercise("impins-gantere", 0);
  const repetitionsOnly = exercise("abdomene", 1);
  const timePerSet = exercise("plank-cu-greutate", 2);
  const totalDuration = exercise("bicicleta-stationara", 3);

  assert.equal(repetitionsWeight.metricType, "repetitions_weight");
  assert.deepEqual(repetitionsWeight.sets.map((set) => [set.targetRepetitions, set.targetWeightKg]), [[0, 0], [0, 0], [0, 0]]);
  assert.equal(repetitionsOnly.metricType, "repetitions_only");
  assert.deepEqual(repetitionsOnly.sets.map((set) => set.targetRepetitions), [0, 0, 0]);
  assert.equal(repetitionsOnly.sets.every((set) => !Object.hasOwn(set, "targetWeightKg")), true);
  assert.equal(timePerSet.metricType, "time_per_set");
  assert.deepEqual(timePerSet.sets.map((set) => set.targetDurationSeconds), [0, 0, 0]);
  assert.equal(timePerSet.sets.every((set) => !Object.hasOwn(set, "targetWeightKg")), true);
  assert.equal(totalDuration.metricType, "total_duration");
  assert.equal(totalDuration.targetTotalDurationSeconds, 0);
  assert.equal(Object.hasOwn(totalDuration, "sets"), false);
  assert.throws(
    () => createWorkoutDayExercise({ exerciseId: "bad", exerciseKey: "abdomene", setIds: ["1", "2", "3"], metricType: "time_per_set" }),
    (error) => error instanceof WorkoutDayDomainError && error.code === "CANONICAL_METRIC_OVERRIDE_FORBIDDEN",
  );
  assert.throws(
    () => createWorkoutDayExercise({ exerciseId: "bad", exerciseKey: "necunoscut", setIds: ["1", "2", "3"] }),
    (error) => error.code === "UNKNOWN_EXERCISE_KEY",
  );
});

test("WorkoutDay are identitate pe dată, locație proprie și limită strictă 1–10", () => {
  const firstTenKeys = CANONICAL_EXERCISE_CATALOG.slice(0, 10).map((item) => item.exerciseKey);
  const fullDay = dayWithKeys(firstTenKeys);
  assert.equal(fullDay.exercises.length, 10);
  assert.equal(validateWorkoutDay(fullDay).valid, true);
  assert.throws(
    () => addExerciseToWorkoutDay(fullDay, {
      date: fullDay.date,
      location: fullDay.location,
      exercise: exercise(CANONICAL_EXERCISE_CATALOG[10].exerciseKey, 10),
      timestamp,
    }),
    (error) => error.code === "WORKOUT_DAY_CAPACITY",
  );

  const movedHome = updateWorkoutDayLocation(fullDay, "home", "2026-08-21T10:05:00.000Z");
  assert.equal(movedHome.location, "home");
  assert.deepEqual(movedHome.exercises, fullDay.exercises);
});

test("duplicatul folosește exercise_key iar update/cancel păstrează ziua atomic", () => {
  const source = dayWithKeys(["abdomene"]);
  const snapshot = structuredClone(source);
  assert.throws(
    () => addExerciseToWorkoutDay(source, {
      date: source.date,
      location: source.location,
      exercise: exercise("abdomene", 99),
      timestamp,
    }),
    (error) => error.code === "DUPLICATE_EXERCISE",
  );
  assert.deepEqual(source, snapshot);

  const edited = reduceWorkoutDayExercise(source.exercises[0], {
    type: "update_set_targets",
    setId: source.exercises[0].sets[0].id,
    targetRepetitions: 17,
  }, "2026-08-21T10:06:00.000Z");
  assert.equal(source.exercises[0].sets[0].targetRepetitions, 0);
  const saved = updateWorkoutDayExercise(source, edited, "2026-08-21T10:07:00.000Z");
  assert.equal(saved.exercises[0].sets[0].targetRepetitions, 17);
  assert.equal(saved.exercises[0].reference.exerciseKey, "abdomene");
});

test("seriile rămân 1–20 și total_duration nu primește serii artificiale", () => {
  let current = exercise("abdomene");
  current = reduceWorkoutDayExercise(current, { type: "add_set", setId: "set-4" }, timestamp);
  assert.equal(current.sets.length, 4);
  assert.equal(current.sets[3].targetRepetitions, 0);
  current = reduceWorkoutDayExercise(current, { type: "move_set", setId: "set-4", toIndex: 0 }, timestamp);
  assert.equal(current.sets[0].id, "set-4");
  current = reduceWorkoutDayExercise(current, { type: "remove_set", setId: "set-4" }, timestamp);
  assert.equal(current.sets.length, 3);
  assert.throws(
    () => reduceWorkoutDayExercise(exercise("bicicleta-stationara"), { type: "add_set", setId: "forbidden" }, timestamp),
    (error) => error.code === "SET_ACTION_NOT_ALLOWED",
  );
});

test("markerii deduplică grupa canonică, păstrează ordinea și dispar odată cu ultimul exercițiu", () => {
  const chestKeys = CANONICAL_EXERCISE_CATALOG.filter((item) => item.category === "Piept").slice(0, 5).map((item) => item.exerciseKey);
  const chestDay = dayWithKeys(chestKeys);
  assert.deepEqual(deriveWorkoutDayMuscleGroups(chestDay).map((group) => group.id), ["Piept"]);

  const categoryKeys = ["Piept", "Triceps", "Spate", "Biceps", "Abdomen", "Picioare"].map(
    (category) => CANONICAL_EXERCISE_CATALOG.find((item) => item.category === category).exerciseKey,
  );
  const diverseDay = dayWithKeys(categoryKeys);
  assert.deepEqual(deriveWorkoutDayMuscleGroups(diverseDay).map((group) => group.id), [
    "Piept", "Triceps", "Spate", "Biceps", "Abdomen", "Picioare",
  ]);

  const chestAndTriceps = dayWithKeys([chestKeys[0], categoryKeys[1]]);
  const withoutChest = removeExerciseFromWorkoutDay(chestAndTriceps, chestKeys[0], timestamp);
  assert.deepEqual(deriveWorkoutDayMuscleGroups(withoutChest).map((group) => group.id), ["Triceps"]);
  assert.equal(removeExerciseFromWorkoutDay(withoutChest, categoryKeys[1], timestamp), null);
});

test("categoria stocată nu poate înlocui identitatea canonică", () => {
  const day = dayWithKeys(["abdomene"]);
  const tampered = structuredClone(day);
  tampered.exercises[0].category = "Piept";
  const validation = validateWorkoutDay(tampered);
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join(" "), /grupa musculară nu corespunde catalogului canonic/);
});
