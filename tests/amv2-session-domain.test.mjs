import assert from "node:assert/strict";
import test from "node:test";
import { Amv2DomainError, createWorkoutDraft, createWorkoutExercise, reduceWorkoutDraft } from "../lib/amv2/draft-domain.mjs";
import {
  completeWorkoutSession,
  createWorkoutDefinitionSnapshot,
  createWorkoutSession,
  reduceWorkoutSession,
  sessionHasExecutedWork,
  validateWorkoutSession,
} from "../lib/amv2/session-domain.mjs";
import {
  abandonActiveSessionInLocalEnvelope,
  completeActiveSessionInLocalEnvelope,
  startLocalSession,
  updateActiveSessionInLocalEnvelope,
} from "../lib/amv2/local-engine.mjs";
import {
  AMV2_LOCAL_STORAGE_KEY,
  createLocalEnvelope,
  readLocalEnvelope,
  writeLocalEnvelope,
} from "../lib/amv2/local-schema-v3.mjs";

const at = (second) => `2026-08-21T12:00:${String(second).padStart(2, "0")}.000Z`;

function allMetricDraft() {
  return createWorkoutDraft({
    id: "engine-draft",
    name: "Motor local complet",
    location: "gym",
    exercises: [
      createWorkoutExercise({
        id: "weight",
        orderIndex: 0,
        exerciseKey: "impins-gantere",
        displayName: "Împins cu gantere",
        category: "Piept",
        setIds: ["weight-1", "weight-2", "weight-3"],
      }),
      createWorkoutExercise({
        id: "repetitions",
        orderIndex: 1,
        exerciseKey: "abdomene",
        displayName: "Crunch abdominal",
        category: "Abdomen",
        setIds: ["repetitions-1", "repetitions-2", "repetitions-3"],
      }),
      createWorkoutExercise({
        id: "time",
        orderIndex: 2,
        exerciseKey: "plank-cu-greutate",
        displayName: "Plank cu greutate",
        category: "Abdomen",
        setIds: ["time-1", "time-2", "time-3"],
      }),
      createWorkoutExercise({
        id: "total",
        orderIndex: 3,
        exerciseKey: "bicicleta-stationara",
        displayName: "Bicicletă staționară",
        category: "Cardio",
      }),
    ],
    updatedAt: at(0),
  });
}

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

const domainError = (code) => (error) => error instanceof Amv2DomainError && error.code === code;

test("pornirea creează o identitate stabilă și un snapshot autonom pentru toate cele patru metrici", () => {
  const draft = allMetricDraft();
  const definition = createWorkoutDefinitionSnapshot(draft, at(1));
  const session = createWorkoutSession({ id: "session-1", definition, startedAt: at(2) });

  assert.equal(session.id, "session-1");
  assert.equal(session.status, "in_progress");
  assert.equal(session.definitionRevision, draft.revision);
  assert.deepEqual(session.exercises.map((exercise) => exercise.metricType), [
    "repetitions_weight",
    "repetitions_only",
    "time_per_set",
    "total_duration",
  ]);
  assert.deepEqual(session.exercises[0].sets.map((set) => [
    set.targetRepetitions,
    set.targetWeightKg,
    set.actualRepetitions,
    set.actualWeightKg,
  ]), [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.deepEqual(session.exercises[1].sets.map((set) => [set.targetRepetitions, set.actualRepetitions]), [[0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(session.exercises[2].sets.map((set) => [set.targetDurationSeconds, set.actualDurationSeconds]), [[0, 0], [0, 0], [0, 0]]);
  assert.equal(session.exercises[3].targetTotalDurationSeconds, 0);
  assert.equal(session.exercises[3].actualTotalDurationSeconds, 0);
  assert.equal(Object.hasOwn(session.exercises[3], "sets"), false);
  assert.equal(validateWorkoutSession(session).valid, true);

  draft.name = "Definiție editată după start";
  draft.exercises[0].sets[0].targetRepetitions = 99;
  assert.equal(session.workoutName, "Motor local complet");
  assert.equal(session.exercises[0].sets[0].targetRepetitions, 0);
});

test("un singur slot activ este permis iar start repetat reia aceeași sesiune", () => {
  const draft = allMetricDraft();
  const envelope = createLocalEnvelope({ installationScopeId: "install-1", draft, savedAt: at(0) });
  const started = startLocalSession(envelope, { draft, sessionId: "session-stable", startedAt: at(1) });
  const repeated = startLocalSession(started, { draft, sessionId: "session-duplicate", startedAt: at(2) });

  assert.equal(started.activeSession.id, "session-stable");
  assert.equal(repeated, started);
  assert.equal(repeated.activeSession.id, "session-stable");
  assert.equal(repeated.definitions.length, 1);
});

test("actualele sunt independente de ținte, păstrează zero și validează limitele pe toate metricile", () => {
  const definition = createWorkoutDefinitionSnapshot(allMetricDraft(), at(1));
  let session = createWorkoutSession({ id: "session-values", definition, startedAt: at(2) });
  session = reduceWorkoutSession(session, {
    type: "update_set_actuals",
    exerciseId: "weight",
    setId: "weight-1",
    actualWeightKg: 50,
    updatedAt: at(3),
  });
  assert.equal(sessionHasExecutedWork(session), false);
  assert.equal(session.exercises[0].sets[0].targetWeightKg, 0);
  assert.equal(session.exercises[0].sets[0].actualWeightKg, 50);

  session = reduceWorkoutSession(session, {
    type: "update_set_actuals",
    exerciseId: "weight",
    setId: "weight-1",
    actualRepetitions: 8,
    actualWeightKg: 0,
    updatedAt: at(4),
  });
  session = reduceWorkoutSession(session, {
    type: "update_set_actuals",
    exerciseId: "repetitions",
    setId: "repetitions-2",
    actualRepetitions: 12,
    updatedAt: at(5),
  });
  session = reduceWorkoutSession(session, {
    type: "update_set_actuals",
    exerciseId: "time",
    setId: "time-3",
    actualDurationSeconds: 45,
    updatedAt: at(6),
  });
  session = reduceWorkoutSession(session, {
    type: "update_total_duration_actual",
    exerciseId: "total",
    actualTotalDurationSeconds: 600,
    updatedAt: at(7),
  });

  assert.equal(sessionHasExecutedWork(session), true);
  assert.equal(session.exercises[0].sets[0].actualRepetitions, 8);
  assert.equal(session.exercises[0].sets[0].actualWeightKg, 0);
  assert.equal(session.exercises[1].sets[1].actualRepetitions, 12);
  assert.equal(session.exercises[2].sets[2].actualDurationSeconds, 45);
  assert.equal(session.exercises[3].actualTotalDurationSeconds, 600);
  assert.throws(() => reduceWorkoutSession(session, {
    type: "update_set_actuals",
    exerciseId: "time",
    setId: "time-1",
    actualDurationSeconds: -1,
    updatedAt: at(8),
  }), domainError("INVALID_ACTUAL_VALUE"));
  assert.throws(() => reduceWorkoutSession(session, {
    type: "update_total_duration_actual",
    exerciseId: "total",
    actualTotalDurationSeconds: Number.NaN,
    updatedAt: at(8),
  }), domainError("INVALID_ACTUAL_TOTAL_DURATION"));
});

test("sesiunea all-zero nu se finalizează iar greutatea singură nu califică execuția", () => {
  const definition = createWorkoutDefinitionSnapshot(allMetricDraft(), at(1));
  const zero = createWorkoutSession({ id: "session-zero", definition, startedAt: at(2) });
  assert.throws(() => completeWorkoutSession(zero, at(3)), domainError("SESSION_EXECUTION_REQUIRED"));

  const weightOnly = reduceWorkoutSession(zero, {
    type: "update_set_actuals",
    exerciseId: "weight",
    setId: "weight-1",
    actualWeightKg: 80,
    updatedAt: at(3),
  });
  assert.equal(sessionHasExecutedWork(weightOnly), false);
  assert.throws(() => completeWorkoutSession(weightOnly, at(4)), domainError("SESSION_EXECUTION_REQUIRED"));

  const repetitionsWithZeroWeight = reduceWorkoutSession(weightOnly, {
    type: "update_set_actuals",
    exerciseId: "weight",
    setId: "weight-1",
    actualRepetitions: 5,
    actualWeightKg: 0,
    updatedAt: at(4),
  });
  const completed = completeWorkoutSession(repetitionsWithZeroWeight, at(5));
  assert.equal(completed.status, "completed");
  assert.equal(completed.exercises[0].sets[1].actualRepetitions, 0);
  assert.equal(completeWorkoutSession(completed, at(6)), completed);
  assert.throws(() => reduceWorkoutSession(completed, {
    type: "update_set_actuals",
    exerciseId: "weight",
    setId: "weight-2",
    actualRepetitions: 1,
    updatedAt: at(6),
  }), domainError("SESSION_TERMINAL"));
});

test("finalizarea este atomică și idempotentă, iar istoricul rămâne autonom față de definiție", () => {
  const draft = allMetricDraft();
  let envelope = createLocalEnvelope({ installationScopeId: "install-atomic", draft, savedAt: at(0) });
  envelope = startLocalSession(envelope, { draft, sessionId: "session-complete", startedAt: at(1) });
  envelope = updateActiveSessionInLocalEnvelope(envelope, {
    type: "update_set_actuals",
    exerciseId: "repetitions",
    setId: "repetitions-1",
    actualRepetitions: 10,
    updatedAt: at(2),
  });
  const completed = completeActiveSessionInLocalEnvelope(envelope, {
    sessionId: "session-complete",
    completedAt: at(3),
  });
  assert.equal(completed.activeSession, null);
  assert.equal(completed.completedSessions.length, 1);
  assert.equal(completed.completedSessions[0].status, "completed");
  assert.equal(completeActiveSessionInLocalEnvelope(completed, {
    sessionId: "session-complete",
    completedAt: at(4),
  }), completed);

  const changedDraft = reduceWorkoutDraft(draft, {
    type: "rename",
    name: "Alt nume după finalizare",
    updatedAt: at(4),
  });
  assert.equal(changedDraft.name, "Alt nume după finalizare");
  assert.equal(completed.completedSessions[0].workoutName, "Motor local complet");
  assert.equal(completed.completedSessions[0].exercises[1].sets[0].actualRepetitions, 10);
});

test("abandonarea este terminală, păstrată tehnic și nu intră în istoricul finalizat", () => {
  const draft = allMetricDraft();
  let envelope = createLocalEnvelope({ installationScopeId: "install-abandon", draft, savedAt: at(0) });
  envelope = startLocalSession(envelope, { draft, sessionId: "session-abandoned", startedAt: at(1) });
  const abandoned = abandonActiveSessionInLocalEnvelope(envelope, {
    sessionId: "session-abandoned",
    abandonedAt: at(2),
  });
  assert.equal(abandoned.activeSession, null);
  assert.equal(abandoned.completedSessions.length, 0);
  assert.equal(abandoned.abandonedSessions.length, 1);
  assert.equal(abandoned.abandonedSessions[0].status, "abandoned");
  assert.equal(abandonActiveSessionInLocalEnvelope(abandoned, {
    sessionId: "session-abandoned",
    abandonedAt: at(3),
  }), abandoned);

  const restarted = startLocalSession(abandoned, { draft, sessionId: "session-next", startedAt: at(3) });
  assert.equal(restarted.activeSession.id, "session-next");
  assert.equal(restarted.abandonedSessions.length, 1);
});

test("schema locală v3 păstrează sesiunea activă, istoricul și compatibilitatea envelope-ului CP216", () => {
  const draft = allMetricDraft();
  let envelope = createLocalEnvelope({ installationScopeId: "install-roundtrip", draft, savedAt: at(0) });
  envelope = startLocalSession(envelope, { draft, sessionId: "session-roundtrip", startedAt: at(1) });
  envelope = updateActiveSessionInLocalEnvelope(envelope, {
    type: "update_total_duration_actual",
    exerciseId: "total",
    actualTotalDurationSeconds: 300,
    updatedAt: at(2),
  });
  const storage = memoryStorage();
  assert.equal(writeLocalEnvelope(storage, envelope).status, "saved_local");
  const reloaded = readLocalEnvelope(memoryStorage(Object.fromEntries(storage.data)));
  assert.equal(reloaded.status, "loaded");
  assert.deepEqual(reloaded.envelope, envelope);
  assert.equal(reloaded.envelope.activeSession.exercises[3].actualTotalDurationSeconds, 300);

  const oldEnvelope = createLocalEnvelope({ installationScopeId: "install-cp216", draft, savedAt: at(0) });
  delete oldEnvelope.activeSession;
  delete oldEnvelope.completedSessions;
  delete oldEnvelope.abandonedSessions;
  const oldRaw = JSON.stringify(oldEnvelope);
  const oldStorage = memoryStorage({ [AMV2_LOCAL_STORAGE_KEY]: oldRaw });
  const oldLoaded = readLocalEnvelope(oldStorage);
  assert.equal(oldLoaded.status, "loaded");
  assert.equal(oldLoaded.envelope.activeSession, null);
  assert.deepEqual(oldLoaded.envelope.completedSessions, []);
  assert.deepEqual(oldLoaded.envelope.abandonedSessions, []);
  assert.equal(oldStorage.data.get(AMV2_LOCAL_STORAGE_KEY), oldRaw);
  assert.deepEqual(oldStorage.writes, []);
});
