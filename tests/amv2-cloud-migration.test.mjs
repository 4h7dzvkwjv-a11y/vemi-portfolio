import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asRole,
  closeAmv2TestDatabase,
  createAmv2TestDatabase,
  OWNER_A,
  OWNER_B,
} from "./helpers/amv2-postgres.mjs";

function canonicalExercise(id, key, metricType, values) {
  return {
    id,
    orderIndex: 0,
    reference: { source: "canonical", exerciseKey: key },
    displayName: values.name,
    category: values.category,
    metricType,
    ...(metricType === "total_duration"
      ? { targetTotalDurationSeconds: values.total }
      : { sets: values.sets }),
  };
}

const fourMetricDay = {
  date: "2026-08-21",
  clientKey: "workout-day:2026-08-21",
  location: "gym",
  exercises: [
    canonicalExercise("e-rw", "impins-gantere", "repetitions_weight", {
      name: "Împins cu gantere",
      category: "Piept",
      sets: [{ id: "rw-1", orderIndex: 0, targetRepetitions: 0, targetWeightKg: 0 }],
    }),
    canonicalExercise("e-ro", "abdomene", "repetitions_only", {
      name: "Crunch abdominal",
      category: "Abdomen",
      sets: [{ id: "ro-1", orderIndex: 0, targetRepetitions: 0 }],
    }),
    canonicalExercise("e-time", "plank-cu-greutate", "time_per_set", {
      name: "Plank cu greutate",
      category: "Abdomen",
      sets: [{ id: "time-1", orderIndex: 0, targetDurationSeconds: 0 }],
    }),
    canonicalExercise("e-total", "bicicleta-stationara", "total_duration", {
      name: "Bicicletă staționară",
      category: "Cardio",
      total: 0,
    }),
  ].map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
};

async function apply(db, key, type, revision, payload) {
  const result = await db.query(
    "select public.amv2_apply_operation($1,$2,$3,$4::jsonb) result",
    [key, type, revision, JSON.stringify(payload)],
  );
  return result.rows[0].result;
}

test("migrarea CP219 se aplică și se reparcurge determinist pe PostgreSQL izolat", async () => {
  const { db, migration } = await createAmv2TestDatabase();
  try {
    await db.exec(migration);
    const rows = await db.query("select metric_type,count(*)::int amount from public.amv2_canonical_exercises group by metric_type order by metric_type");
    assert.deepEqual(Object.fromEntries(rows.rows.map((row) => [row.metric_type, row.amount])), {
      repetitions_only: 29,
      repetitions_weight: 75,
      time_per_set: 7,
      total_duration: 3,
    });
    const artifact = await db.query("select sha256,row_count from public.amv2_artifact_registry where artifact_key='gate-0c-final-v1.4'");
    assert.deepEqual(artifact.rows[0], {
      sha256: "94dc6c256d407f89deb121aca18215e52ddb045288e50ebcd7f86464886917fa",
      row_count: 114,
    });
  } finally { await closeAmv2TestDatabase(db); }
});

test("RLS și granturile separă anon, owner și non-owner", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "anon");
    await assert.rejects(db.query("select * from public.amv2_workout_days"), /permission denied/i);
    await assert.rejects(apply(db, "anon-op", "upsert_day", 0, fourMetricDay), /permission denied/i);

    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "owner-a-create", "upsert_day", 0, fourMetricDay);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days")).rows[0].amount, 1);
    assert.equal((await db.query("select public.amv2_read_calendar('2026-08-01','2026-08-31') snapshot")).rows[0].snapshot.days.length, 1);
    await assert.rejects(db.query(`insert into public.amv2_workout_days(owner_user_id,workout_date,client_key,location)
      values('${OWNER_A}','2026-08-30','direct','gym')`), /permission denied/i);

    await asRole(db, "authenticated", OWNER_B);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days")).rows[0].amount, 0);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_exercises")).rows[0].amount, 0);
    assert.equal((await db.query("select public.amv2_read_calendar('2026-08-01','2026-08-31') snapshot")).rows[0].snapshot.days.length, 0);

    await asRole(db, "authenticated");
    await assert.rejects(apply(db, "missing-owner", "upsert_day", 0, fourMetricDay), /AUTH_REQUIRED/i);

    await asRole(db, "postgres");
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days")).rows[0].amount, 1);
  } finally { await closeAmv2TestDatabase(db); }
});

test("graful celor patru metrici se salvează atomic cu zero/null și fără serii artificiale", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    const response = await apply(db, "four-metrics", "upsert_day", 0, fourMetricDay);
    assert.equal(response.revision, 1);
    const exercises = await db.query("select metric_type,total_duration_seconds from public.amv2_workout_day_exercises order by order_index");
    assert.deepEqual(exercises.rows.map((row) => row.metric_type), ["repetitions_weight", "repetitions_only", "time_per_set", "total_duration"]);
    assert.equal(exercises.rows[3].total_duration_seconds, 0);
    const sets = await db.query("select repetitions,weight_kg,duration_seconds from public.amv2_workout_day_sets order by exercise_client_key");
    assert.equal(sets.rows.length, 3);
    assert.ok(sets.rows.some((row) => row.repetitions === 0 && Number(row.weight_kg) === 0 && row.duration_seconds === null));
    assert.ok(sets.rows.some((row) => row.repetitions === 0 && row.weight_kg === null));
    assert.ok(sets.rows.some((row) => row.duration_seconds === 0 && row.repetitions === null && row.weight_kg === null));
  } finally { await closeAmv2TestDatabase(db); }
});

test("idempotency, revision conflict și metric override sunt respinse fără salvare parțială", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    const first = await apply(db, "stable-key", "upsert_day", 0, fourMetricDay);
    const retry = await apply(db, "stable-key", "upsert_day", 0, fourMetricDay);
    assert.deepEqual(retry, first);
    await assert.rejects(apply(db, "stable-key", "upsert_day", 0, { ...fourMetricDay, location: "home" }), /IDEMPOTENCY/i);
    await assert.rejects(apply(db, "stale-key", "upsert_day", 0, { ...fourMetricDay, location: "home" }), /REVISION_CONFLICT/i);
    await assert.rejects(apply(db, "x".repeat(161), "upsert_day", 1, fourMetricDay), /OPERATION_INVALID/i);

    const override = structuredClone(fourMetricDay);
    override.date = "2026-08-22";
    override.clientKey = "workout-day:2026-08-22";
    override.exercises[1].metricType = "repetitions_weight";
    await assert.rejects(apply(db, "metric-override", "upsert_day", 0, override), /METRIC_OVERRIDE/i);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days where workout_date='2026-08-22'")).rows[0].amount, 0);
  } finally { await closeAmv2TestDatabase(db); }
});

test("PersonalExercise păstrează snapshoturile WorkoutDay după editare și arhivare", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    const personal = await apply(db, "personal-create", "upsert_personal", 0, {
      id: "personal-a",
      clientKey: "personal-a-client",
      name: "Împinsul meu",
      templateExerciseKey: "flexii-gantere",
      category: "Umeri",
      location: "home",
      metricType: "repetitions_weight",
    });
    assert.equal(personal.revision, 1);
    const row = (await db.query("select metric_type,category,default_repetitions,default_weight_kg from public.amv2_personal_exercises")).rows[0];
    assert.deepEqual({ ...row, default_weight_kg: Number(row.default_weight_kg) }, {
      metric_type: "repetitions_weight", category: "Umeri", default_repetitions: 0, default_weight_kg: 0,
    });
    await assert.rejects(apply(db, "personal-template-mismatch", "upsert_personal", 1, {
      id: "personal-a", clientKey: "personal-a-client", name: "Împinsul meu",
      templateExerciseKey: "plank", category: "Acasă", location: "home", metricType: "repetitions_weight",
    }), /TEMPLATE_INCOMPATIBLE/i);

    const personalDay = {
      date: "2026-08-23", clientKey: "workout-day:2026-08-23", location: "gym",
      exercises: [{
        id: "personal-row", orderIndex: 0,
        reference: { source: "personal", personalExerciseId: "personal-a", templateExerciseKey: "flexii-gantere" },
        displayName: "Împinsul meu", category: "Umeri", metricType: "repetitions_weight",
        sets: [{ id: "p-set", orderIndex: 0, targetRepetitions: 0, targetWeightKg: 0 }],
      }],
    };
    await apply(db, "personal-day", "upsert_day", 0, personalDay);
    const edited = await apply(db, "personal-edit", "upsert_personal", 1, {
      id: "personal-a", clientKey: "personal-a-client", name: "Planșa mea",
      templateExerciseKey: "plank", category: "Acasă", location: "home", metricType: "time_per_set",
    });
    assert.equal(edited.revision, 2);
    const preserved = await apply(db, "personal-day-after-edit", "upsert_day", 1, personalDay);
    assert.equal(preserved.revision, 2);
    const daySnapshot = (await db.query("select display_name,category,metric_type,personal_template_exercise_key from public.amv2_workout_day_exercises where personal_exercise_id='personal-a'")).rows[0];
    assert.deepEqual(daySnapshot, {
      display_name: "Împinsul meu", category: "Umeri", metric_type: "repetitions_weight",
      personal_template_exercise_key: "flexii-gantere",
    });
    await apply(db, "personal-archive", "archive_personal", 2, { id: "personal-a" });
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_exercises where personal_exercise_id='personal-a'")).rows[0].amount, 1);
    await assert.rejects(apply(db, "personal-update-after-archive", "upsert_personal", 3, {
      id: "personal-a", clientKey: "personal-a-client", name: "Împinsul arhivat",
      templateExerciseKey: "plank", category: "Acasă", location: "home", metricType: "time_per_set",
    }), /PERSONAL_ARCHIVED/i);
    await assert.rejects(apply(db, "personal-archive-again", "archive_personal", 3, { id: "personal-a" }), /PERSONAL_ARCHIVED/i);

    const imported = structuredClone(fourMetricDay);
    imported.date = "2026-08-24";
    imported.clientKey = "workout-day:2026-08-24";
    const imported2 = structuredClone(fourMetricDay);
    imported2.date = "2026-08-25";
    imported2.clientKey = "workout-day:2026-08-25";
    const result = await apply(db, "import-v1", "import_days", 0, {
      batchKey: "batch-v1", source: "v1_local", sourceIdentity: "legacy-workout", days: [imported, imported2],
    });
    assert.equal(result.dates.length, 2);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_import_batches")).rows[0].amount, 1);
  } finally { await closeAmv2TestDatabase(db); }
});

test("importul multi-day este integral: o destinație ocupată anulează întregul batch", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    const occupied = structuredClone(fourMetricDay);
    occupied.date = "2026-08-26";
    occupied.clientKey = "workout-day:2026-08-26";
    await apply(db, "occupied-day", "upsert_day", 0, occupied);

    const first = structuredClone(fourMetricDay);
    first.date = "2026-08-27";
    first.clientKey = "workout-day:2026-08-27";
    await assert.rejects(apply(db, "atomic-import", "import_days", 0, {
      batchKey: "atomic-batch", source: "v1_local", sourceIdentity: "legacy-atomic", days: [first, occupied],
    }), /IMPORT_DESTINATION_EXISTS/i);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days where workout_date='2026-08-27'")).rows[0].amount, 0);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_import_batches where batch_key='atomic-batch'")).rows[0].amount, 0);
  } finally { await closeAmv2TestDatabase(db); }
});

test("relațiile owner-safe blochează referința către PersonalExercise-ul altui cont", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_B);
    await apply(db, "owner-b-personal", "upsert_personal", 0, {
      id: "private-personal", clientKey: "private-client", name: "Privat",
      templateExerciseKey: "flexii-gantere", category: "Piept", location: "home", metricType: "repetitions_weight",
    });
    await asRole(db, "authenticated", OWNER_A);
    const crossOwnerDay = {
      date: "2026-08-29", clientKey: "workout-day:2026-08-29", location: "gym",
      exercises: [{
        id: "cross-owner", orderIndex: 0,
        reference: { source: "personal", personalExerciseId: "private-personal", templateExerciseKey: "flexii-gantere" },
        displayName: "Privat", category: "Piept", metricType: "repetitions_weight",
        sets: [{ id: "cross-set", orderIndex: 0, targetRepetitions: 0, targetWeightKg: 0 }],
      }],
    };
    await assert.rejects(apply(db, "cross-owner", "upsert_day", 0, crossOwnerDay), /query returned no rows|strict/i);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days where workout_date='2026-08-29'")).rows[0].amount, 0);
  } finally { await closeAmv2TestDatabase(db); }
});
