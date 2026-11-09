import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindAccountOwner,
  confirmAccountOperation,
  createAccountSyncEnvelope,
  enqueueAccountOperation,
  readAccountSyncEnvelope,
  recordAccountConflict,
  replacePersonalExerciseInSync,
  resolveAccountConflictWithLocal,
  writeAccountSyncEnvelope,
} from "../lib/amv2/account-sync-local.mjs";
import { hydrateCloudCalendarSnapshot, serializePersonalExerciseForCloud, serializeWorkoutDayForCloud } from "../lib/amv2/cloud-graph.mjs";
import { getWorkoutExerciseIdentity } from "../lib/amv2/draft-domain.mjs";
import {
  archivePersonalExercise,
  createPersonalExercise,
  listActivePersonalExercises,
  updatePersonalExercise,
} from "../lib/amv2/personal-exercise-domain.mjs";
import {
  analyzeV1WorkoutDefinition,
  copyV1WorkoutIntoDate,
  listReliableV1History,
  readV1CompatibilitySource,
} from "../lib/amv2/v1-compatibility.mjs";
import {
  addExerciseToWorkoutDay,
  createPersonalWorkoutDayExercise,
  deriveWorkoutDayMuscleGroups,
  removeExerciseFromWorkoutDay,
  validateWorkoutDay,
} from "../lib/amv2/workout-day-domain.mjs";

const NOW = "2026-08-21T10:00:00.000Z";
const LATER = "2026-08-21T11:00:00.000Z";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    snapshot: () => Object.fromEntries(data),
  };
}

test("PersonalExercise controlează categoria și cele trei tipuri prin șabloane interne stabile", () => {
  const personal = createPersonalExercise({
    id: "personal-1", clientKey: "client-1", name: "  Presa mea  ",
    category: "Piept", metricType: "repetitions_weight", timestamp: NOW,
  });
  assert.equal(personal.name, "Presa mea");
  assert.equal(personal.metricType, "repetitions_weight");
  assert.equal(personal.category, "Piept");
  assert.equal(personal.templateExerciseKey, "flexii-gantere");
  assert.equal(personal.location, "home");
  assert.throws(() => createPersonalExercise({
    id: "x", clientKey: "x", name: "X", category: "La sală",
    metricType: "repetitions_weight", timestamp: NOW,
  }), /categorie aprobată/);
  assert.throws(() => createPersonalExercise({
    id: "x", clientKey: "x", name: "X", category: "Piept",
    metricType: "total_duration", timestamp: NOW,
  }), /trei tipuri aprobate/);
  assert.throws(() => createPersonalExercise({
    id: "x", clientKey: "x", name: "X", category: "Piept",
    metricType: "repetitions_weight", templateExerciseKey: "impins-gantere", timestamp: NOW,
  }), /Șablonul intern/);
  const updated = updatePersonalExercise(personal, {
    name: "Planșa mea", category: "Acasă", metricType: "time_per_set", timestamp: LATER,
  });
  assert.equal(updated.revision, 1);
  assert.equal(updated.category, "Acasă");
  assert.equal(updated.metricType, "time_per_set");
  assert.equal(updated.templateExerciseKey, "plank");
  assert.deepEqual(serializePersonalExerciseForCloud(updated), {
    id: "personal-1", clientKey: "client-1", name: "Planșa mea",
    templateExerciseKey: "plank", category: "Acasă", location: "home", metricType: "time_per_set",
  });
  const archived = archivePersonalExercise(updated, "2026-08-21T12:00:00.000Z");
  assert.equal(archived.revision, 2);
  assert.equal(listActivePersonalExercises([archived]).length, 0);
});

test("exercițiul personal intră în WorkoutDay cu zero Gate 0C și duplicatul folosește ID-ul, nu numele", () => {
  const first = createPersonalWorkoutDayExercise({
    exerciseId: "day-personal-1", personalExerciseId: "personal-1", templateExerciseKey: "impins-gantere",
    displayName: "Același nume", category: "Umeri", setIds: ["p1", "p2", "p3"],
  });
  const second = createPersonalWorkoutDayExercise({
    exerciseId: "day-personal-2", personalExerciseId: "personal-2", templateExerciseKey: "impins-gantere",
    displayName: "Același nume", category: "Umeri", setIds: ["q1", "q2", "q3"],
  });
  assert.equal(getWorkoutExerciseIdentity(first), "personal:personal-1");
  assert.deepEqual(first.sets.map((set) => [set.targetRepetitions, set.targetWeightKg]), [[0, 0], [0, 0], [0, 0]]);
  let day = addExerciseToWorkoutDay(null, { date: "2026-08-21", location: "gym", exercise: first, timestamp: NOW });
  day = addExerciseToWorkoutDay(day, { date: "2026-08-21", location: "gym", exercise: second, timestamp: LATER });
  assert.equal(day.exercises.length, 2);
  assert.equal(deriveWorkoutDayMuscleGroups(day).length, 1);
  assert.throws(() => addExerciseToWorkoutDay(day, {
    date: day.date, location: day.location, exercise: { ...first, id: "other" }, timestamp: LATER,
  }), /există deja/);
  assert.equal(removeExerciseFromWorkoutDay(day, "personal:personal-1", LATER).exercises.length, 1);
});

test("cele trei tipuri Personal reutilizează formele zero ale editorului VEMI", () => {
  const cases = [
    ["repetitions_weight", "Piept", "flexii-gantere"],
    ["repetitions_only", "Abdomen", "abdomene"],
    ["time_per_set", "Acasă", "plank"],
  ];
  for (const [metricType, category, templateExerciseKey] of cases) {
    const personal = createPersonalExercise({
      id: `personal-${metricType}`, clientKey: `client-${metricType}`, name: `Personal ${metricType}`,
      category, metricType, timestamp: NOW,
    });
    assert.equal(personal.templateExerciseKey, templateExerciseKey);
    const exercise = createPersonalWorkoutDayExercise({
      exerciseId: `day-${metricType}`, personalExerciseId: personal.id,
      templateExerciseKey: personal.templateExerciseKey, displayName: personal.name, category: personal.category,
      setIds: ["one", "two", "three"].map((suffix) => `${metricType}-${suffix}`),
    });
    assert.equal(exercise.metricType, metricType);
    assert.equal(exercise.sets.length, 3);
    if (metricType === "repetitions_weight") {
      assert.deepEqual(exercise.sets.map((set) => [set.targetRepetitions, set.targetWeightKg]), [[0, 0], [0, 0], [0, 0]]);
    } else if (metricType === "repetitions_only") {
      assert.deepEqual(exercise.sets.map((set) => set.targetRepetitions), [0, 0, 0]);
      assert.equal(exercise.sets.some((set) => Object.hasOwn(set, "targetWeightKg")), false);
    } else {
      assert.deepEqual(exercise.sets.map((set) => set.targetDurationSeconds), [0, 0, 0]);
    }
  }
});

test("outbox-ul este owner-bound, bounded și păstrează conflictul fără a pierde operația locală", () => {
  let state = bindAccountOwner(createAccountSyncEnvelope(NOW), "owner-a", NOW);
  const operation = {
    ownerUserId: "owner-a", operationKey: "op-1", type: "upsert_day", expectedRevision: 0,
    payload: { date: "2026-08-21", value: 0, optional: null }, createdAt: NOW,
  };
  state = enqueueAccountOperation(state, operation, NOW);
  assert.deepEqual(state.outbox[0].payload, { date: "2026-08-21", value: 0, optional: null });
  assert.equal(enqueueAccountOperation(state, structuredClone(operation), NOW), state);
  assert.throws(() => enqueueAccountOperation(state, { ...operation, payload: { date: "different" } }, NOW), /cheie de operație/);
  assert.throws(() => enqueueAccountOperation(state, { ...operation, operationKey: "op-b", ownerUserId: "owner-b" }, NOW), /contului local activ/);
  state = recordAccountConflict(state, {
    operationKey: "op-1", remoteIdentity: "day:2026-08-21", remoteRevision: 4,
    remoteCandidate: { date: "2026-08-21", value: 2 }, reason: "stale",
  }, LATER);
  assert.equal(state.outbox.length, 1);
  assert.equal(state.conflicts[0].remoteRevision, 4);
  state = confirmAccountOperation(state, "op-1", "day:2026-08-21", 5, LATER);
  assert.equal(state.outbox.length, 0);
  assert.equal(state.remoteRevisions["day:2026-08-21"], 5);
});

test("confirmarea cloud propagă revizia în operațiile ordonate iar conflictul cere reluare explicită", () => {
  let state = bindAccountOwner(createAccountSyncEnvelope(NOW), "owner-a", NOW);
  const first = {
    ownerUserId: "owner-a", operationKey: "first", type: "upsert_day", expectedRevision: 0,
    payload: { date: "2026-08-21", value: 0 }, createdAt: NOW,
  };
  const second = { ...first, operationKey: "second", payload: { date: "2026-08-21", value: 1 } };
  state = enqueueAccountOperation(state, first, NOW);
  state = enqueueAccountOperation(state, second, NOW);
  state = confirmAccountOperation(state, "first", "day:2026-08-21", 1, LATER);
  assert.equal(state.outbox[0].expectedRevision, 1);
  state = recordAccountConflict(state, {
    operationKey: "second", remoteIdentity: "day:2026-08-21", remoteRevision: 4,
    remoteCandidate: { date: "2026-08-21", value: 2 }, reason: "stale",
  }, LATER);
  const resolved = resolveAccountConflictWithLocal(state, "second", LATER);
  assert.equal(resolved.outbox[0].expectedRevision, 4);
  assert.equal(resolved.conflicts.length, 0);
});

test("starea locală de cont round-trip-uiește zero/null, personale și outbox fără truthiness fallback", () => {
  const storage = memoryStorage();
  const personal = createPersonalExercise({
    id: "personal-1", clientKey: "client-1", name: "Presa mea",
    category: "Piept", metricType: "repetitions_weight", timestamp: NOW,
  });
  let state = bindAccountOwner(createAccountSyncEnvelope(NOW), "owner-a", NOW);
  state = replacePersonalExerciseInSync(state, personal, NOW);
  state = enqueueAccountOperation(state, {
    ownerUserId: "owner-a", operationKey: "zero", type: "upsert_personal", expectedRevision: 0,
    payload: { repetitions: 0, weight: 0, absent: null }, createdAt: NOW,
  }, NOW);
  assert.equal(writeAccountSyncEnvelope(storage, state).status, "saved_local");
  const loaded = readAccountSyncEnvelope(storage);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.envelope, state);
});

test("graful cloud serializează și hidratează cele patru forme fără a schimba zero/null", () => {
  const source = {
    date: "2026-08-21", location: "gym", createdAt: NOW, updatedAt: NOW,
    exercises: [createPersonalWorkoutDayExercise({
      exerciseId: "personal-row", personalExerciseId: "personal-1", templateExerciseKey: "impins-gantere",
      displayName: "Presa mea", category: "Piept", setIds: ["a", "b", "c"],
    })],
  };
  assert.equal(validateWorkoutDay(source).valid, true);
  const serialized = serializeWorkoutDayForCloud(source);
  assert.equal(serialized.exercises[0].sets[0].targetRepetitions, 0);
  const hydrated = hydrateCloudCalendarSnapshot({
    days: [{ workout_date: source.date, location: "gym", revision: 1, created_at: NOW, updated_at: NOW }],
    personalExercises: [{
      id: "personal-1", client_key: "client-1", name: "Presa mea", template_exercise_key: "impins-gantere",
      category: "Piept", location: "gym", metric_type: "repetitions_weight", revision: 1,
      archived_at: null, created_at: NOW, updated_at: NOW,
    }],
    exercises: [{
      workout_date: source.date, client_key: "personal-row", order_index: 0, canonical_exercise_key: null,
      personal_exercise_id: "personal-1", personal_template_exercise_key: "impins-gantere",
      display_name: "Presa mea", category: "Piept",
      metric_type: "repetitions_weight", total_duration_seconds: null,
    }],
    sets: [0, 1, 2].map((order) => ({
      workout_date: source.date, exercise_client_key: "personal-row", client_key: ["a", "b", "c"][order],
      order_index: order, repetitions: 0, weight_kg: "0.00", duration_seconds: null,
    })),
  });
  assert.equal(hydrated.days[0].exercises[0].reference.templateExerciseKey, "impins-gantere");
  assert.equal(hydrated.days[0].exercises[0].sets[0].targetWeightKg, 0);
});

test("V1 se copiază numai explicit și fără fabricarea datelor ambigue", () => {
  const safe = {
    id: "v1-safe", name: "V1 sigur", place: "sala", exercises: [{
      id: "old", uid: "impins-gantere", name: "Împins", group: "Piept", kind: "forta",
      places: ["sala"], sets: 2, reps: 8, weight: 20, minutes: 0,
    }],
  };
  assert.equal(analyzeV1WorkoutDefinition(safe).unsupported.length, 0);
  let sequence = 0;
  const day = copyV1WorkoutIntoDate({
    workout: safe, existingDay: null, date: "2026-08-22", timestamp: NOW,
    idFactory: (kind) => `${kind}-${sequence++}`,
  });
  assert.equal(day.exercises[0].sets.length, 2);
  assert.deepEqual(day.exercises[0].sets.map((set) => [set.targetRepetitions, set.targetWeightKg]), [[8, 20], [8, 20]]);
  const safeCardio = {
    id: "v1-cardio", name: "Cardio V1", place: "sala", exercises: [{
      id: "old-cardio", uid: "bicicleta-stationara", name: "Bicicletă", group: "Cardio", kind: "cardio",
      places: ["sala"], sets: 0, reps: 0, weight: 0, minutes: 15,
    }],
  };
  assert.equal(analyzeV1WorkoutDefinition(safeCardio).unsupported.length, 0);
  const cardioDay = copyV1WorkoutIntoDate({
    workout: safeCardio, existingDay: null, date: "2026-08-23", timestamp: NOW,
    idFactory: (kind) => `cardio-${kind}`,
  });
  assert.equal(cardioDay.exercises[0].targetTotalDurationSeconds, 900);
  assert.equal(Object.hasOwn(cardioDay.exercises[0], "sets"), false);
  const ambiguous = structuredClone(safe);
  ambiguous.exercises[0].uid = "plank";
  assert.match(analyzeV1WorkoutDefinition(ambiguous).unsupported[0], /fără ambiguitate/);
  assert.throws(() => copyV1WorkoutIntoDate({ workout: safe, existingDay: day, date: day.date, timestamp: NOW, idFactory: () => "x" }), /nu suprascrie/);
});

test("citirea compatibilității V1 nu mută sursa și istoricul expune numai timestampuri fiabile", () => {
  const snapshot = {
    workouts: [{ id: "w", name: "V1", place: "sala", exercises: [] }],
    logs: [
      { id: "good", workoutName: "V1", completedAt: NOW, exerciseCount: 1, exercises: [{ name: "Bicicletă", group: "Cardio", details: "15 min" }] },
      { id: "bad", workoutName: "V1", completedAt: "necunoscut", exerciseCount: 1, exercises: [{ name: "Bicicletă", group: "Cardio", details: "15 min" }] },
      { id: "without-values", workoutName: "V1", completedAt: NOW, exerciseCount: 1 },
    ],
  };
  const storage = memoryStorage({ "vemi-anonymous-progress-v2": JSON.stringify(snapshot) });
  const before = storage.snapshot();
  const source = readV1CompatibilitySource(storage);
  assert.equal(source.workouts.length, 1);
  assert.deepEqual(source.history, listReliableV1History(snapshot.logs));
  assert.equal(source.history.length, 1);
  assert.deepEqual(storage.snapshot(), before);
});
