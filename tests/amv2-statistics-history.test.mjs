import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveCanonicalExerciseMetric } from "../lib/amv2/exercise-metric-map.mjs";
import {
  addExerciseToWorkoutDay,
  createPersonalWorkoutDayExercise,
  createWorkoutDay,
  createWorkoutDayExercise,
  reduceWorkoutDayExercise,
} from "../lib/amv2/workout-day-domain.mjs";
import {
  deriveWorkoutStatistics,
  findExerciseHistory,
  selectRecentExerciseOccurrences,
} from "../lib/amv2/workout-statistics.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const timestamp = "2026-08-21T10:00:00.000Z";

function canonicalExercise(exerciseKey, id, value) {
  const metric = resolveCanonicalExerciseMetric(exerciseKey);
  const input = { exerciseId: id, exerciseKey };
  if (metric.metric_type !== "total_duration") {
    input.setIds = [1, 2, 3].map((ordinal) => `${id}-set-${ordinal}`);
  }
  let exercise = createWorkoutDayExercise(input);
  if (metric.metric_type === "total_duration") {
    return reduceWorkoutDayExercise(exercise, {
      type: "update_total_duration_target",
      targetTotalDurationSeconds: value,
    }, timestamp);
  }
  const action = { type: "update_set_targets", setId: exercise.sets[0].id };
  if (metric.metric_type === "repetitions_weight") {
    action.targetRepetitions = 8;
    action.targetWeightKg = value;
  } else if (metric.metric_type === "repetitions_only") {
    action.targetRepetitions = value;
  } else {
    action.targetDurationSeconds = value;
  }
  return reduceWorkoutDayExercise(exercise, action, timestamp);
}

function personalExercise(id, value) {
  let exercise = createPersonalWorkoutDayExercise({
    exerciseId: `entry-${id}`,
    personalExerciseId: id,
    templateExerciseKey: "abdomene",
    displayName: "Ridicări controlate",
    category: "Umeri",
    setIds: [1, 2, 3].map((ordinal) => `entry-${id}-set-${ordinal}`),
  });
  exercise = reduceWorkoutDayExercise(exercise, {
    type: "update_set_targets",
    setId: exercise.sets[0].id,
    targetRepetitions: value,
  }, timestamp);
  return exercise;
}

function workoutDay(date, exercises) {
  let day = createWorkoutDay({ date, location: "gym", exercise: exercises[0], timestamp });
  for (const exercise of exercises.slice(1)) {
    day = addExerciseToWorkoutDay(day, { date, location: "gym", exercise, timestamp });
  }
  return day;
}

function fixtureDays() {
  return [
    workoutDay("2026-07-30", [canonicalExercise("impins-gantere", "weight-old", 40)]),
    workoutDay("2026-08-03", [canonicalExercise("abdomene", "reps", 12)]),
    workoutDay("2026-08-12", [canonicalExercise("plank-cu-greutate", "time", 45)]),
    workoutDay("2026-08-20", [canonicalExercise("impins-gantere", "weight-new", 60)]),
    workoutDay("2026-08-21", [
      personalExercise("personal-shoulder", 20),
      canonicalExercise("bicicleta-stationara", "duration", 900),
    ]),
  ];
}

test("statisticile sunt derivate determinist din WorkoutDay, fără stare paralelă", () => {
  const statistics = deriveWorkoutStatistics(fixtureDays(), "2026-08-21");

  assert.equal(statistics.activeDays, 5);
  assert.equal(statistics.activeWeeks, 4);
  assert.equal(statistics.averageWeeklyFrequency, 1.3);
  assert.deepEqual(statistics.recentWeeks.map((week) => week.dayCount), [1, 1, 1, 2]);
  assert.equal(statistics.groups.reduce((sum, group) => sum + group.count, 0), 6);
  assert.equal(statistics.groups.find((group) => group.category === "Piept")?.count, 2);
  assert.equal(statistics.exerciseHistories.length, 5);
});

test("istoricul comun grupează identitatea canonică și Personal, cel mai nou primul", () => {
  const statistics = deriveWorkoutStatistics(fixtureDays(), "2026-08-21");
  const canonical = findExerciseHistory(statistics, "canonical:impins-gantere");
  const personal = findExerciseHistory(statistics, "personal:personal-shoulder");

  assert.ok(canonical);
  assert.equal(canonical.metricType, "repetitions_weight");
  assert.equal(canonical.latestDate, "2026-08-20");
  assert.equal(canonical.latestValue, 60);
  assert.equal(canonical.bestValue, 60);
  assert.deepEqual(canonical.trend.map((point) => point.value), [40, 60]);
  assert.deepEqual(canonical.occurrences.map((item) => item.date), ["2026-08-20", "2026-07-30"]);

  assert.ok(personal);
  assert.equal(personal.displayName, "Ridicări controlate");
  assert.equal(personal.category, "Umeri");
  assert.equal(personal.metricType, "repetitions_only");
  assert.equal(personal.latestValue, 20);
});

test("sumarele și evoluția se adaptează tuturor celor patru metrici", () => {
  const statistics = deriveWorkoutStatistics(fixtureDays(), "2026-08-21");
  const cases = [
    ["canonical:impins-gantere", "repetitions_weight", 60],
    ["canonical:abdomene", "repetitions_only", 12],
    ["canonical:plank-cu-greutate", "time_per_set", 45],
    ["canonical:bicicleta-stationara", "total_duration", 900],
  ];
  for (const [identity, metricType, expected] of cases) {
    const history = findExerciseHistory(statistics, identity);
    assert.ok(history, identity);
    assert.equal(history.metricType, metricType);
    assert.equal(history.latestValue, expected);
    assert.equal(history.bestValue, expected);
    assert.equal(history.occurrences[0].exercise.metricType, metricType);
  }
  assert.equal(findExerciseHistory(statistics, "canonical:missing"), null);
});

test("selectorul comun Recent History exclude data editorului și limitează newest-first la două apariții", () => {
  const days = [
    workoutDay("2026-08-10", [canonicalExercise("impins-gantere", "weight-10", 20)]),
    workoutDay("2026-08-14", [canonicalExercise("impins-gantere", "weight-14", 30)]),
    workoutDay("2026-08-18", [canonicalExercise("impins-gantere", "weight-18", 40)]),
    workoutDay("2026-08-21", [canonicalExercise("impins-gantere", "weight-21", 50)]),
  ];
  const history = findExerciseHistory(deriveWorkoutStatistics(days, "2026-08-21"), "canonical:impins-gantere");

  assert.ok(history);
  assert.deepEqual(
    selectRecentExerciseOccurrences(history, "2026-08-21").map((occurrence) => occurrence.date),
    ["2026-08-18", "2026-08-14"],
  );
  assert.deepEqual(
    selectRecentExerciseOccurrences(history, "2026-08-18").map((occurrence) => occurrence.date),
    ["2026-08-14", "2026-08-10"],
  );
  assert.deepEqual(
    selectRecentExerciseOccurrences(history, "2026-08-14").map((occurrence) => occurrence.date),
    ["2026-08-10"],
  );
  assert.deepEqual(selectRecentExerciseOccurrences(history, "2026-08-10"), []);
  assert.deepEqual(selectRecentExerciseOccurrences(history, "invalid-date"), []);
});

test("Recent History păstrează identitatea Personal și formele celor trei metrici ale editorului", () => {
  const personalDays = [
    workoutDay("2026-08-12", [personalExercise("stable-personal", 8)]),
    workoutDay("2026-08-19", [personalExercise("stable-personal", 12)]),
    workoutDay("2026-08-21", [personalExercise("stable-personal", 16)]),
  ];
  const personalHistory = findExerciseHistory(
    deriveWorkoutStatistics(personalDays, "2026-08-21"),
    "personal:stable-personal",
  );
  assert.ok(personalHistory);
  assert.deepEqual(
    selectRecentExerciseOccurrences(personalHistory, "2026-08-21").map((occurrence) => occurrence.date),
    ["2026-08-19", "2026-08-12"],
  );

  for (const [exerciseKey, expectedMetric] of [
    ["impins-gantere", "repetitions_weight"],
    ["abdomene", "repetitions_only"],
    ["plank-cu-greutate", "time_per_set"],
  ]) {
    const history = findExerciseHistory(
      deriveWorkoutStatistics([
        workoutDay("2026-08-18", [canonicalExercise(exerciseKey, `${exerciseKey}-old`, 10)]),
        workoutDay("2026-08-20", [canonicalExercise(exerciseKey, `${exerciseKey}-new`, 20)]),
      ], "2026-08-21"),
      `canonical:${exerciseKey}`,
    );
    const recent = selectRecentExerciseOccurrences(history, "2026-08-21");
    assert.equal(recent.length, 2);
    assert.equal(recent[0].exercise.metricType, expectedMetric);
    assert.deepEqual(
      recent[0].exercise.sets.map((set) => set.id),
      [1, 2, 3].map((ordinal) => `${exerciseKey}-new-set-${ordinal}`),
    );
  }
});

test("launcherul, destinațiile, editorul și WorkoutDay folosesc aceeași navigare de istoric", async () => {
  const [client, launcher, statistics, history, recent, occurrence, card, editor, controls, css] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/statistics-launcher.tsx"),
    read("components/amv2/statistics-view.tsx"),
    read("components/amv2/exercise-history-view.tsx"),
    read("components/amv2/exercise-recent-history.tsx"),
    read("components/amv2/exercise-history-occurrence.tsx"),
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("components/amv2/editable-exercise-card.tsx"),
    read("components/amv2/exercise-visual-controls.tsx"),
    read("components/amv2/amv2.module.css"),
  ]);

  assert.ok(client.indexOf("<Amv2Hero />") < client.indexOf("<MonthlyWorkoutCalendar"));
  assert.ok(client.indexOf("<MonthlyWorkoutCalendar") < client.indexOf("<StatisticsLauncher"));
  assert.match(client, /deriveWorkoutStatistics\(envelope\?\.days \?\? \[\], todayDate\)/);
  assert.match(client, /historyProjectionComplete/);
  assert.match(client, /readAmv2HistoryPage/);
  assert.match(client, /reconcileRemoteOwnerHistoryPage/);
  assert.match(client, /advanceHistoryCoverage/);
  assert.match(client, /openExerciseHistory\(identity, "statistics"\)/);
  assert.match(client, /onOpenHistory=\{\(\) => openExerciseHistory/);
  assert.match(launcher, /Statistici/);
  assert.match(launcher, /activeDays/);
  assert.match(launcher, /Se sincronizează istoricul complet/);
  for (const section of ["Rezumat", "Activitate", "Grupe lucrate", "Istoric exerciții"]) {
    assert.match(statistics, new RegExp(section));
  }
  assert.match(history, /history\.occurrences\.map/);
  assert.match(history, /complete/);
  assert.match(history, /Se sincronizează istoricul complet al exercițiului/);
  assert.match(history, /repetitions_weight/);
  assert.match(history, /repetitions_only/);
  assert.match(history, /time_per_set/);
  assert.match(card, /<ExerciseHistoryButton onClick=\{onOpenHistory\} \/>/);
  assert.match(editor, /<ExerciseHistoryButton onClick=\{onOpenHistory \?/);
  assert.match(editor, /<ExerciseRecentHistory/);
  assert.match(client, /selectRecentExerciseOccurrences\(editorHistory, selectedDate\)/);
  assert.match(client, /openExerciseHistory\(editorHistory\.identity, "editor"\)/);
  assert.match(recent, /Ultimele 2 sesiuni/);
  assert.match(recent, /Istoricul recent al exercițiului/);
  assert.match(recent, /Nu există încă istoric pentru acest exercițiu\./);
  assert.match(recent, /Se sincronizează istoricul complet/);
  assert.match(recent, /occurrences\.map/);
  assert.doesNotMatch(recent, /input|button|onClick|Șterge|Modifică|Adaugă/);
  for (const label of ["Seria", "Repetări", "Greutate", "Timp"]) assert.match(occurrence, new RegExp(label));
  assert.match(controls, /disabled=\{disabled\}/);
  assert.match(css, /\.statisticsLauncher \{[\s\S]*?min-height: 80px;/);
  assert.match(css, /\.compactHero \{[\s\S]*?height: 99px;/);
  assert.match(css, /\.exerciseRecentHistory \{[\s\S]*?margin-top: 40px;/);
});

test("destinațiile Statistici și Istoric păstrează headerul global și rândul Înapoi separat", async () => {
  const [client, statistics, history] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/statistics-view.tsx"),
    read("components/amv2/exercise-history-view.tsx"),
  ]);
  assert.match(client, /<Amv2Header \/>/);
  assert.match(client, /screen !== "statistics" && screen !== "history"/);
  assert.match(statistics, /analyticsBack[\s\S]*?Înapoi/);
  assert.match(history, /analyticsBack[\s\S]*?Înapoi/);
  assert.doesNotMatch(statistics + history, /Supabase|fetch\(|localStorage|sessionStorage/);
});
