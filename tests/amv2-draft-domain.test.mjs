import assert from "node:assert/strict";
import test from "node:test";
import {
  AMV2_LIMITS,
  Amv2DomainError,
  createWorkoutDraft,
  createWorkoutExercise,
  hasExecutedWork,
  reduceWorkoutDraft,
  validateWorkoutDraft,
} from "../lib/amv2/draft-domain.mjs";
import {
  AMV2_CANONICAL_METRIC_TYPES,
  CANONICAL_EXERCISE_METRIC_ROWS,
  CanonicalExerciseMetricMapError,
  resolveCanonicalExerciseMetric,
} from "../lib/amv2/exercise-metric-map.mjs";

const timestamp = (revision = 0) => `2026-08-20T10:00:${String(revision).padStart(2, "0")}.000Z`;

const weightExercise = () => createWorkoutExercise({
  id: "weight-exercise",
  orderIndex: 0,
  exerciseKey: "impins-gantere",
  displayName: "Împins cu gantere",
  category: "Piept",
  setIds: ["weight-set-1", "weight-set-2", "weight-set-3"],
});

const repetitionsExercise = () => createWorkoutExercise({
  id: "repetitions-exercise",
  orderIndex: 1,
  exerciseKey: "abdomene",
  displayName: "Crunch abdominal",
  category: "Abdomen",
  setIds: ["repetitions-set-1", "repetitions-set-2", "repetitions-set-3"],
});

const timeExercise = () => createWorkoutExercise({
  id: "time-exercise",
  orderIndex: 2,
  exerciseKey: "plank-cu-greutate",
  displayName: "Plank cu greutate",
  category: "Abdomen",
  setIds: ["time-set-1", "time-set-2", "time-set-3"],
});

const totalDurationExercise = () => createWorkoutExercise({
  id: "total-duration-exercise",
  orderIndex: 3,
  exerciseKey: "bicicleta-stationara",
  displayName: "Bicicletă staționară",
  category: "Cardio",
});

const draft = () => createWorkoutDraft({
  id: "draft-1",
  name: "Antrenament complet",
  location: "gym",
  exercises: [weightExercise(), repetitionsExercise(), timeExercise(), totalDurationExercise()],
  updatedAt: timestamp(),
});

const domainErrorCode = (code) => (error) => error instanceof Amv2DomainError && error.code === code;

test("adapterul canonic validează 114 rânduri și distribuția Final V1.4", () => {
  assert.deepEqual(AMV2_CANONICAL_METRIC_TYPES, [
    "repetitions_weight",
    "repetitions_only",
    "time_per_set",
    "total_duration",
  ]);
  assert.equal(CANONICAL_EXERCISE_METRIC_ROWS.length, 114);
  assert.equal(new Set(CANONICAL_EXERCISE_METRIC_ROWS.map((row) => row.exercise_key)).size, 114);
  assert.deepEqual(Object.fromEntries(AMV2_CANONICAL_METRIC_TYPES.map((metric) => [
    metric,
    CANONICAL_EXERCISE_METRIC_ROWS.filter((row) => row.metric_type === metric).length,
  ])), {
    repetitions_weight: 75,
    repetitions_only: 29,
    time_per_set: 7,
    total_duration: 3,
  });
  assert.equal(resolveCanonicalExerciseMetric("abdomene").metric_type, "repetitions_only");
  assert.deepEqual(resolveCanonicalExerciseMetric("plank-cu-greutate"), {
    exercise_key: "plank-cu-greutate",
    metric_type: "time_per_set",
    default_source: "GENERIC_FALLBACK",
    default_sets: 3,
    default_repetitions: null,
    default_weight_kg: null,
    default_time_per_set_seconds: 0,
    default_total_duration_seconds: null,
  });
  assert.throws(
    () => resolveCanonicalExerciseMetric("cheie-necunoscuta"),
    (error) => error instanceof CanonicalExerciseMetricMapError && error.code === "UNKNOWN_EXERCISE_KEY",
  );
  assert.ok(Object.isFrozen(CANONICAL_EXERCISE_METRIC_ROWS));
  assert.ok(CANONICAL_EXERCISE_METRIC_ROWS.every(Object.isFrozen));
});

test("toate cele patru metrici pornesc cu matricea zero exactă", () => {
  const weight = weightExercise();
  const repetitions = repetitionsExercise();
  const time = timeExercise();
  const total = totalDurationExercise();

  assert.equal(weight.metricType, "repetitions_weight");
  assert.equal(weight.sets.length, 3);
  assert.deepEqual(weight.sets.map(({ targetRepetitions, targetWeightKg }) => ({
    targetRepetitions,
    targetWeightKg,
  })), Array.from({ length: 3 }, () => ({ targetRepetitions: 0, targetWeightKg: 0 })));
  assert.ok(weight.sets.every((set) => !Object.hasOwn(set, "targetDurationSeconds")));

  assert.equal(repetitions.metricType, "repetitions_only");
  assert.equal(repetitions.sets.length, 3);
  assert.deepEqual(repetitions.sets.map((set) => set.targetRepetitions), [0, 0, 0]);
  assert.ok(repetitions.sets.every((set) => !Object.hasOwn(set, "targetWeightKg")
    && !Object.hasOwn(set, "targetDurationSeconds")));

  assert.equal(time.metricType, "time_per_set");
  assert.equal(time.sets.length, 3);
  assert.deepEqual(time.sets.map((set) => set.targetDurationSeconds), [0, 0, 0]);
  assert.ok(time.sets.every((set) => !Object.hasOwn(set, "targetRepetitions")
    && !Object.hasOwn(set, "targetWeightKg")));

  assert.equal(total.metricType, "total_duration");
  assert.equal(total.targetTotalDurationSeconds, 0);
  assert.equal(Object.hasOwn(total, "sets"), false);
});

test("factory-ul derivă metrica numai din exercise_key și respinge override-ul", () => {
  const baseInput = {
    id: "override-exercise",
    orderIndex: 0,
    exerciseKey: "abdomene",
    displayName: "Crunch abdominal",
    category: "Abdomen",
    setIds: ["one", "two", "three"],
  };
  for (const metricType of ["repetitions_only", "repetitions_weight"]) {
    assert.throws(
      () => createWorkoutExercise({ ...baseInput, metricType }),
      domainErrorCode("CANONICAL_METRIC_OVERRIDE_FORBIDDEN"),
    );
  }
  assert.throws(
    () => createWorkoutExercise({ ...baseInput, exerciseKey: "cheie-necunoscuta" }),
    domainErrorCode("UNKNOWN_EXERCISE_KEY"),
  );
  assert.throws(
    () => createWorkoutExercise({ ...baseInput, exerciseKey: "bicicleta-stationara" }),
    domainErrorCode("SET_ACTION_NOT_ALLOWED"),
  );
});

test("validarea hidratării impune identitatea și metrica din mapping", () => {
  const base = draft();
  assert.equal(validateWorkoutDraft(base).valid, true);

  const mismatch = structuredClone(base);
  mismatch.exercises[2].metricType = "repetitions_weight";
  assert.equal(validateWorkoutDraft(mismatch).valid, false);
  assert.match(validateWorkoutDraft(mismatch).issues.join(" "), /mappingului canonic/);

  const unknown = structuredClone(base);
  unknown.exercises[2].reference.exerciseKey = "cheie-necunoscuta";
  assert.equal(validateWorkoutDraft(unknown).valid, false);
  assert.match(validateWorkoutDraft(unknown).issues.join(" "), /exercise_key necunoscut/);

  const duplicate = structuredClone(base);
  duplicate.exercises[1].reference.exerciseKey = "impins-gantere";
  duplicate.exercises[1].displayName = "Alt nume vizibil";
  assert.equal(validateWorkoutDraft(duplicate).valid, false);
  assert.match(validateWorkoutDraft(duplicate).issues.join(" "), /canonic este duplicat/);
});

test("zero este valid, editabil și distinct de no-op", () => {
  const base = draft();
  const positive = reduceWorkoutDraft(base, {
    type: "update_set_targets",
    exerciseId: "weight-exercise",
    setId: "weight-set-2",
    targetRepetitions: 8,
    targetWeightKg: 12.5,
    updatedAt: timestamp(1),
  });
  const reset = reduceWorkoutDraft(positive, {
    type: "update_set_targets",
    exerciseId: "weight-exercise",
    setId: "weight-set-2",
    targetRepetitions: 0,
    targetWeightKg: 0,
    updatedAt: timestamp(2),
  });
  assert.equal(reset.exercises[0].sets[1].targetRepetitions, 0);
  assert.equal(reset.exercises[0].sets[1].targetWeightKg, 0);
  assert.equal(reset.revision, 2);

  const unchanged = reduceWorkoutDraft(base, {
    type: "update_set_targets",
    exerciseId: "weight-exercise",
    setId: "weight-set-1",
    targetRepetitions: 0,
    targetWeightKg: 0,
    updatedAt: timestamp(3),
  });
  assert.equal(unchanged, base);
  assert.equal(unchanged.revision, 0);
});

test("limitele zero/max sunt acceptate iar valorile invalide sunt respinse", () => {
  const base = draft();
  const updateSet = (exerciseId, setId, patch) => reduceWorkoutDraft(base, {
    type: "update_set_targets",
    exerciseId,
    setId,
    ...patch,
    updatedAt: timestamp(1),
  });

  assert.doesNotThrow(() => updateSet("weight-exercise", "weight-set-1", {
    targetRepetitions: 100,
    targetWeightKg: 500,
  }));
  assert.doesNotThrow(() => updateSet("repetitions-exercise", "repetitions-set-1", { targetRepetitions: 100 }));
  assert.doesNotThrow(() => updateSet("time-exercise", "time-set-1", { targetDurationSeconds: 3_600 }));
  assert.doesNotThrow(() => reduceWorkoutDraft(base, {
    type: "update_total_duration_target",
    exerciseId: "total-duration-exercise",
    targetTotalDurationSeconds: 18_000,
    updatedAt: timestamp(1),
  }));

  for (const invalid of [-1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => updateSet("weight-exercise", "weight-set-1", { targetRepetitions: invalid }), Amv2DomainError);
  }
  for (const invalid of [-0.1, 500.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => updateSet("weight-exercise", "weight-set-1", { targetWeightKg: invalid }), Amv2DomainError);
  }
  for (const invalid of [-1, 3_601, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => updateSet("time-exercise", "time-set-1", { targetDurationSeconds: invalid }), Amv2DomainError);
  }
  for (const invalid of [-1, 18_001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => reduceWorkoutDraft(base, {
      type: "update_total_duration_target",
      exerciseId: "total-duration-exercise",
      targetTotalDurationSeconds: invalid,
      updatedAt: timestamp(1),
    }), Amv2DomainError);
  }
});

test("acțiunile pe serii sunt exhaustive, normalizează ordinea și păstrează limitele", () => {
  let current = draft();
  current = reduceWorkoutDraft(current, {
    type: "add_set",
    exerciseId: "repetitions-exercise",
    setId: "repetitions-set-4",
    updatedAt: timestamp(1),
  });
  assert.deepEqual(current.exercises[1].sets[3], {
    id: "repetitions-set-4",
    orderIndex: 3,
    targetRepetitions: 0,
  });
  current = reduceWorkoutDraft(current, {
    type: "move_set",
    exerciseId: "repetitions-exercise",
    setId: "repetitions-set-4",
    toIndex: 0,
    updatedAt: timestamp(2),
  });
  assert.deepEqual(current.exercises[1].sets.map((set) => [set.id, set.orderIndex]), [
    ["repetitions-set-4", 0],
    ["repetitions-set-1", 1],
    ["repetitions-set-2", 2],
    ["repetitions-set-3", 3],
  ]);

  while (current.exercises[1].sets.length > 1) {
    current = reduceWorkoutDraft(current, {
      type: "remove_set",
      exerciseId: "repetitions-exercise",
      setId: current.exercises[1].sets.at(-1).id,
      updatedAt: timestamp(current.revision + 1),
    });
  }
  assert.throws(() => reduceWorkoutDraft(current, {
    type: "remove_set",
    exerciseId: "repetitions-exercise",
    setId: current.exercises[1].sets[0].id,
    updatedAt: timestamp(current.revision + 1),
  }), domainErrorCode("MINIMUM_SET_REQUIRED"));

  let capacity = draft();
  for (let index = 4; index <= AMV2_LIMITS.setsPerExercise.max; index += 1) {
    capacity = reduceWorkoutDraft(capacity, {
      type: "add_set",
      exerciseId: "time-exercise",
      setId: `time-set-${index}`,
      updatedAt: timestamp(index),
    });
  }
  assert.equal(capacity.exercises[2].sets.length, 20);
  assert.throws(() => reduceWorkoutDraft(capacity, {
    type: "add_set",
    exerciseId: "time-exercise",
    setId: "time-set-21",
    updatedAt: timestamp(21),
  }), domainErrorCode("SET_CAPACITY_REACHED"));
});

test("câmpurile incompatibile și acțiunile pe serii pentru total_duration sunt respinse", () => {
  const base = draft();
  const update = (exerciseId, setId, patch) => reduceWorkoutDraft(base, {
    type: "update_set_targets",
    exerciseId,
    setId,
    ...patch,
    updatedAt: timestamp(1),
  });
  assert.throws(
    () => update("weight-exercise", "weight-set-1", { targetDurationSeconds: 0 }),
    domainErrorCode("METRIC_FIELD_MISMATCH"),
  );
  assert.throws(
    () => update("repetitions-exercise", "repetitions-set-1", { targetWeightKg: 0 }),
    domainErrorCode("METRIC_FIELD_MISMATCH"),
  );
  assert.throws(
    () => update("time-exercise", "time-set-1", { targetRepetitions: 0 }),
    domainErrorCode("METRIC_FIELD_MISMATCH"),
  );
  assert.throws(
    () => update("weight-exercise", "weight-set-1", {}),
    domainErrorCode("INVALID_TARGET_PATCH"),
  );
  for (const action of [
    { type: "add_set", setId: "forbidden" },
    { type: "remove_set", setId: "forbidden" },
    { type: "move_set", setId: "forbidden", toIndex: 0 },
    { type: "update_set_targets", setId: "forbidden", targetDurationSeconds: 0 },
  ]) {
    assert.throws(() => reduceWorkoutDraft(base, {
      ...action,
      exerciseId: "total-duration-exercise",
      updatedAt: timestamp(1),
    }), domainErrorCode("SET_ACTION_NOT_ALLOWED"));
  }
  assert.throws(() => reduceWorkoutDraft(base, {
    type: "update_total_duration_target",
    exerciseId: "weight-exercise",
    targetTotalDurationSeconds: 0,
    updatedAt: timestamp(1),
  }), domainErrorCode("METRIC_FIELD_MISMATCH"));

  const totalWithSetTarget = structuredClone(base);
  totalWithSetTarget.exercises[3].targetWeightKg = 0;
  assert.equal(validateWorkoutDraft(totalWithSetTarget).valid, false);
  const perSetWithTotalTarget = structuredClone(base);
  perSetWithTotalTarget.exercises[0].targetTotalDurationSeconds = 0;
  assert.equal(validateWorkoutDraft(perSetWithTotalTarget).valid, false);
});

test("predicatul pur de execuție respectă fiecare metrică", () => {
  assert.equal(hasExecutedWork({
    metricType: "repetitions_weight",
    sets: [{ actualRepetitions: 0, actualWeightKg: 50 }],
  }), false);
  assert.equal(hasExecutedWork({
    metricType: "repetitions_weight",
    sets: [{ actualRepetitions: 8, actualWeightKg: 0 }],
  }), true);
  assert.equal(hasExecutedWork({
    metricType: "repetitions_only",
    sets: [{ actualRepetitions: 0 }, { actualRepetitions: 12 }],
  }), true);
  assert.equal(hasExecutedWork({
    metricType: "time_per_set",
    sets: [{ actualDurationSeconds: 0 }, { actualDurationSeconds: 30 }],
  }), true);
  assert.equal(hasExecutedWork({ metricType: "total_duration", actualTotalDurationSeconds: 60 }), true);
  assert.equal(hasExecutedWork({ metricType: "repetitions_only", sets: [{ actualRepetitions: 0 }] }), false);
  assert.equal(hasExecutedWork({ metricType: "time_per_set", sets: [{ actualDurationSeconds: 0 }] }), false);
  assert.equal(hasExecutedWork({ metricType: "total_duration", actualTotalDurationSeconds: 0 }), false);
  assert.equal(hasExecutedWork({ metricType: "repetitions_weight", sets: [] }), false);
});
