import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkoutDraft,
  createWorkoutExercise,
  reduceWorkoutDraft,
} from "../lib/amv2/draft-domain.mjs";
import {
  AMV2_LOCAL_STORAGE_KEY,
  createLocalEnvelope,
  readLocalEnvelope,
  validateLocalEnvelope,
  writeLocalEnvelope,
} from "../lib/amv2/local-schema-v3.mjs";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  return {
    data,
    writes,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { writes.push([key, value]); data.set(key, value); },
  };
}

function allMetricDraft() {
  return createWorkoutDraft({
    id: "draft-local",
    name: "Antrenament local",
    location: "home",
    exercises: [
      createWorkoutExercise({
        id: "weight-local",
        orderIndex: 0,
        exerciseKey: "impins-gantere",
        displayName: "Împins cu gantere",
        category: "Piept",
        setIds: ["weight-a", "weight-b", "weight-c"],
      }),
      createWorkoutExercise({
        id: "repetitions-local",
        orderIndex: 1,
        exerciseKey: "abdomene",
        displayName: "Crunch abdominal",
        category: "Abdomen",
        setIds: ["repetitions-a", "repetitions-b", "repetitions-c"],
      }),
      createWorkoutExercise({
        id: "time-local",
        orderIndex: 2,
        exerciseKey: "plank-cu-greutate",
        displayName: "Plank cu greutate",
        category: "Abdomen",
        setIds: ["time-a", "time-b", "time-c"],
      }),
      createWorkoutExercise({
        id: "total-local",
        orderIndex: 3,
        exerciseKey: "bicicleta-stationara",
        displayName: "Bicicletă staționară",
        category: "Cardio",
      }),
    ],
    updatedAt: "2026-08-20T10:00:00.000Z",
  });
}

function positiveCp214Draft() {
  const draft = createWorkoutDraft({
    id: "cp214-positive",
    name: "Date locale CP214",
    location: "gym",
    exercises: [
      createWorkoutExercise({
        id: "cp214-weight",
        orderIndex: 0,
        exerciseKey: "impins-gantere",
        displayName: "Împins cu gantere",
        category: "Piept",
        setIds: ["cp214-weight-a", "cp214-weight-b", "cp214-weight-c"],
      }),
      createWorkoutExercise({
        id: "cp214-time",
        orderIndex: 1,
        exerciseKey: "plank",
        displayName: "Plank",
        category: "Abdomen",
        setIds: ["cp214-time-a", "cp214-time-b", "cp214-time-c"],
      }),
    ],
    updatedAt: "2026-08-20T10:00:00.000Z",
  });
  draft.exercises[0].sets.forEach((set, index) => {
    set.targetRepetitions = [12, 10, 8][index];
    set.targetWeightKg = [18, 20, 25][index];
  });
  draft.exercises[1].sets.forEach((set, index) => {
    set.targetDurationSeconds = [30, 40, 45][index];
  });
  return draft;
}

const envelope = (draft = allMetricDraft()) => createLocalEnvelope({
  installationScopeId: "installation-1",
  draft,
  savedAt: "2026-08-20T10:00:01.000Z",
});

test("citirea lipsei este side-effect-free și folosește numai cheia AMV2 v3", () => {
  const storage = memoryStorage({
    "vemi-anonymous-progress-v2": "preserve-v2",
    "vemi-custom-workouts": "preserve-legacy",
  });
  assert.deepEqual(readLocalEnvelope(storage), { status: "missing" });
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.data.get("vemi-anonymous-progress-v2"), "preserve-v2");
  assert.equal(storage.data.get("vemi-custom-workouts"), "preserve-legacy");
});

test("schema locală v3 recuperează toate cele patru metrici și zero exact după refresh", () => {
  const storage = memoryStorage();
  const source = envelope();
  const saved = writeLocalEnvelope(storage, source);
  assert.equal(saved.status, "saved_local");
  assert.match(saved.serialized, /"targetRepetitions":0/);
  assert.match(saved.serialized, /"targetWeightKg":0/);
  assert.match(saved.serialized, /"targetDurationSeconds":0/);
  assert.match(saved.serialized, /"targetTotalDurationSeconds":0/);
  assert.doesNotMatch(saved.serialized, /"target(?:Repetitions|DurationSeconds|TotalDurationSeconds)":(?:10|30|900)/);

  const refreshedStorage = memoryStorage(Object.fromEntries(storage.data));
  const loaded = readLocalEnvelope(refreshedStorage);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.envelope, source);
  assert.deepEqual(loaded.envelope.drafts[0].exercises.map((exercise) => exercise.metricType), [
    "repetitions_weight",
    "repetitions_only",
    "time_per_set",
    "total_duration",
  ]);
  assert.equal(Object.hasOwn(loaded.envelope.drafts[0].exercises[3], "sets"), false);
  assert.equal(loaded.envelope.drafts[0].exercises[3].targetTotalDurationSeconds, 0);
  assert.deepEqual(refreshedStorage.writes, []);
});

test("zero și null nu sunt interschimbate prin validare sau round-trip", () => {
  const source = envelope();
  const invalidNull = structuredClone(source);
  invalidNull.drafts[0].exercises[1].sets[0].targetRepetitions = null;
  assert.equal(validateLocalEnvelope(invalidNull).valid, false);

  const storage = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: JSON.stringify(invalidNull) });
  const raw = storage.data.get(AMV2_LOCAL_STORAGE_KEY);
  assert.equal(readLocalEnvelope(storage).status, "invalid");
  assert.equal(storage.data.get(AMV2_LOCAL_STORAGE_KEY), raw);
  assert.deepEqual(storage.writes, []);

  const validStorage = memoryStorage();
  assert.equal(writeLocalEnvelope(validStorage, source).status, "saved_local");
  const parsed = JSON.parse(validStorage.data.get(AMV2_LOCAL_STORAGE_KEY));
  assert.equal(parsed.drafts[0].exercises[1].sets[0].targetRepetitions, 0);
  assert.equal(Object.hasOwn(parsed.drafts[0].exercises[1].sets[0], "targetWeightKg"), false);
});

test("valorile pozitive CP214 valide se încarcă fără zero-backfill sau rescriere", () => {
  const source = envelope(positiveCp214Draft());
  const raw = JSON.stringify(source);
  const storage = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: raw });
  const loaded = readLocalEnvelope(storage);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.raw, raw);
  assert.deepEqual(loaded.envelope, source);
  assert.deepEqual(loaded.envelope.drafts[0].exercises[0].sets.map((set) => [
    set.targetRepetitions,
    set.targetWeightKg,
  ]), [[12, 18], [10, 20], [8, 25]]);
  assert.deepEqual(loaded.envelope.drafts[0].exercises[1].sets.map((set) => set.targetDurationSeconds), [30, 40, 45]);
  assert.deepEqual(storage.writes, []);
});

test("mismatch-ul metricii canonice și cheia necunoscută sunt respinse fără repair", () => {
  for (const mutate of [
    (value) => { value.drafts[0].exercises[2].metricType = "repetitions_weight"; },
    (value) => { value.drafts[0].exercises[2].reference.exerciseKey = "cheie-necunoscuta"; },
  ]) {
    const value = envelope();
    mutate(value);
    const raw = JSON.stringify(value);
    const storage = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: raw });
    const result = readLocalEnvelope(storage);
    assert.equal(result.status, "invalid");
    assert.equal(storage.data.get(AMV2_LOCAL_STORAGE_KEY), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test("JSON corupt și versiunea necunoscută sunt respinse fără ștergere sau rescriere", () => {
  const corrupt = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: "{broken" });
  const corruptResult = readLocalEnvelope(corrupt);
  assert.equal(corruptResult.status, "invalid");
  assert.equal(corrupt.data.get(AMV2_LOCAL_STORAGE_KEY), "{broken");
  assert.deepEqual(corrupt.writes, []);

  const unknown = { ...envelope(), version: 4 };
  const raw = JSON.stringify(unknown);
  const versioned = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: raw });
  assert.equal(readLocalEnvelope(versioned).status, "invalid");
  assert.equal(versioned.data.get(AMV2_LOCAL_STORAGE_KEY), raw);
  assert.deepEqual(versioned.writes, []);
});

test("citirea respinge peste 512 KiB înainte de hidratare și păstrează payloadul", () => {
  const oversized = { ...envelope(), savedAt: "x".repeat(513 * 1024) };
  const raw = JSON.stringify(oversized);
  const storage = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: raw });
  const result = readLocalEnvelope(storage);
  assert.equal(result.status, "invalid");
  assert.match(result.error, /512 KiB/);
  assert.ok(result.payloadBytes > 512 * 1024);
  assert.equal(storage.data.get(AMV2_LOCAL_STORAGE_KEY), raw);
  assert.deepEqual(storage.writes, []);
});

test("schema permite exact un draft și păstrează explicit compatibilitatea v2", () => {
  const value = envelope();
  assert.equal(validateLocalEnvelope(value).valid, true);
  assert.deepEqual(value.compatibility, {
    preserveAnonymousV2: true,
    destructiveConversionAllowed: false,
  });
  assert.equal(value.importState.sourceVersion, 2);
  assert.equal(value.importState.preservesSource, true);
  assert.equal(validateLocalEnvelope({ ...value, drafts: [] }).valid, false);
  assert.equal(validateLocalEnvelope({ ...value, drafts: [value.drafts[0], value.drafts[0]] }).valid, false);
});

test("eșecul storage și payloadul peste 512 KiB raportează save_error fără succes fals", () => {
  const throwingStorage = {
    getItem() { return null; },
    setItem() { throw new Error("quota exceeded"); },
  };
  const failed = writeLocalEnvelope(throwingStorage, envelope());
  assert.equal(failed.status, "save_error");
  assert.match(failed.error, /quota exceeded/);

  const oversized = structuredClone(envelope());
  oversized.drafts[0].exercises[0].displayName = "x".repeat(513 * 1024);
  const storage = memoryStorage();
  const tooLarge = writeLocalEnvelope(storage, oversized);
  assert.equal(tooLarge.status, "save_error");
  assert.match(tooLarge.error, /512 KiB/);
  assert.deepEqual(storage.writes, []);
});

test("salvarea AMV2 nu atinge cheile anonime, auth sau legacy", () => {
  const protectedEntries = {
    "vemi-local-progress-schema-version": "2",
    "vemi-anonymous-progress-v2": "anonymous-v2",
    "vemi-anonymous-import-status-v2": "pending",
    "vemi-authenticated-progress-cache-v2": "account-cache",
    "vemi-custom-workouts": "legacy-workouts",
  };
  const storage = memoryStorage(protectedEntries);
  assert.equal(writeLocalEnvelope(storage, envelope()).status, "saved_local");
  for (const [key, value] of Object.entries(protectedEntries)) assert.equal(storage.data.get(key), value);
  assert.deepEqual(storage.writes.map(([key]) => key), [AMV2_LOCAL_STORAGE_KEY]);
});

test("schema v3 păstrează exact exercițiile confirmate prin Add Exercises după reload", () => {
  const source = allMetricDraft();
  const added = reduceWorkoutDraft(source, {
    type: "add_exercises",
    selections: [
      { exerciseKey: "genuflexiuni-haltera", exerciseId: "added-weight" },
      { exerciseKey: "flotari", exerciseId: "added-repetitions" },
      { exerciseKey: "cobra-din-culcat", exerciseId: "added-time" },
      { exerciseKey: "mers-rapid-pe-banda", exerciseId: "added-total" },
    ],
    updatedAt: "2026-08-21T10:00:00.000Z",
  });
  const storage = memoryStorage();
  const saved = writeLocalEnvelope(storage, envelope(added));
  assert.equal(saved.status, "saved_local");

  const loaded = readLocalEnvelope(memoryStorage(Object.fromEntries(storage.data)));
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.envelope.drafts[0], added);
  assert.deepEqual(loaded.envelope.drafts[0].exercises.slice(-4).map((exercise) => exercise.metricType), [
    "repetitions_weight",
    "repetitions_only",
    "time_per_set",
    "total_duration",
  ]);
  assert.equal(loaded.envelope.drafts[0].exercises.at(-1).targetTotalDurationSeconds, 0);
  assert.equal(Object.hasOwn(loaded.envelope.drafts[0].exercises.at(-1), "sets"), false);
});
