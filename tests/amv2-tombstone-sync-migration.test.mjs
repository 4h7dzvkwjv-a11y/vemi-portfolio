import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  asRole,
  closeAmv2TestDatabase,
  createAmv2TestDatabase,
  OWNER_A,
  OWNER_B,
} from "./helpers/amv2-postgres.mjs";

const migrationUrl = new URL("../supabase/migrations/202608220001_amv2_workout_day_tombstone_sync_safety.sql", import.meta.url);

function workoutDay(date = "2026-08-21", repetitions = 8) {
  return {
    date,
    clientKey: `workout-day:${date}`,
    location: "gym",
    exercises: [{
      id: `exercise-${date}`,
      orderIndex: 0,
      reference: { source: "canonical", exerciseKey: "abdomene" },
      displayName: "Crunch abdominal",
      category: "Abdomen",
      metricType: "repetitions_only",
      sets: [{ id: `set-${date}`, orderIndex: 0, targetRepetitions: repetitions }],
    }],
  };
}

async function apply(db, key, type, revision, payload) {
  const result = await db.query(
    "select public.amv2_apply_operation($1,$2,$3,$4::jsonb) result",
    [key, type, revision, JSON.stringify(payload)],
  );
  return result.rows[0].result;
}

test("migrarea tombstone este aditivă, tranzacțională și nu atinge AMV1", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate)\b/i);
  assert.doesNotMatch(sql, /custom_workouts|workout_sessions|workout_exercise_logs|user_free_plans/i);
  assert.match(sql, /primary key \(owner_user_id,workout_date\)/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /using \(\(select auth\.uid\(\)\)=owner_user_id\)/i);
});

test("delete, retry și recreare păstrează o revizie monotonă și împiedică resurrection de pe device stale", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    assert.equal((await apply(db, "create", "upsert_day", 0, workoutDay())).revision, 1);

    const deleted = await apply(db, "delete", "delete_day", 1, { date: "2026-08-21" });
    assert.deepEqual({ revision: deleted.revision, deleted: deleted.deleted }, { revision: 2, deleted: true });
    assert.deepEqual(await apply(db, "delete", "delete_day", 1, { date: "2026-08-21" }), deleted);
    assert.equal((await apply(db, "delete-equivalent", "delete_day", 2, { date: "2026-08-21" })).revision, 2);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_tombstones")).rows[0].amount, 1);

    await assert.rejects(apply(db, "stale-resurrection", "upsert_day", 1, workoutDay("2026-08-21", 12)), /REVISION_CONFLICT/i);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days")).rows[0].amount, 0);

    const recreated = await apply(db, "keep-local-after-delete", "upsert_day", 2, workoutDay("2026-08-21", 12));
    assert.equal(recreated.revision, 3);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_tombstones")).rows[0].amount, 0);
    await assert.rejects(apply(db, "stale-delete", "delete_day", 2, { date: "2026-08-21" }), /REVISION_CONFLICT/i);

    assert.equal((await apply(db, "delete-recreated", "delete_day", 3, { date: "2026-08-21" })).revision, 4);
    const snapshot = (await db.query("select public.amv2_read_calendar('2026-08-01','2026-08-31') snapshot")).rows[0].snapshot;
    assert.equal(snapshot.days.length, 0);
    assert.equal(snapshot.exercises.length, 0);
    assert.equal(snapshot.sets.length, 0);
    assert.deepEqual(snapshot.tombstones.map((row) => [row.workout_date, Number(row.revision)]), [["2026-08-21", 4]]);
  } finally { await closeAmv2TestDatabase(db); }
});

test("RLS expune tombstone numai ownerului iar scrierea directă rămâne blocată", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "anon");
    await assert.rejects(db.query("select * from public.amv2_workout_day_tombstones"), /permission denied/i);

    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "owner-a-create", "upsert_day", 0, workoutDay());
    await apply(db, "owner-a-delete", "delete_day", 1, { date: "2026-08-21" });
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_tombstones")).rows[0].amount, 1);
    await assert.rejects(db.query(`insert into public.amv2_workout_day_tombstones(owner_user_id,workout_date,revision)
      values('${OWNER_A}','2026-08-22',1)`), /permission denied/i);

    await asRole(db, "authenticated", OWNER_B);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_tombstones")).rows[0].amount, 0);
    assert.equal((await db.query("select public.amv2_read_calendar('2026-08-01','2026-08-31') snapshot")).rows[0].snapshot.tombstones.length, 0);
    assert.equal((await apply(db, "owner-b-same-date", "upsert_day", 0, workoutDay())).revision, 1);
  } finally { await closeAmv2TestDatabase(db); }
});

test("tombstone-ul are retenție compactă: cel mult un marker per owner și dată", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "create-cycle-one", "upsert_day", 0, workoutDay());
    await apply(db, "delete-cycle-one", "delete_day", 1, { date: "2026-08-21" });
    await apply(db, "recreate-cycle-two", "upsert_day", 2, workoutDay());
    await apply(db, "delete-cycle-two", "delete_day", 3, { date: "2026-08-21" });
    await apply(db, "delete-cycle-two-again", "delete_day", 4, { date: "2026-08-21" });
    const rows = await db.query("select workout_date,revision,count(*) over()::int amount from public.amv2_workout_day_tombstones");
    assert.equal(rows.rows.length, 1);
    assert.equal(Number(rows.rows[0].revision), 4);
    assert.equal(rows.rows[0].amount, 1);
  } finally { await closeAmv2TestDatabase(db); }
});

test("migrarea reparcursă reface markerii pentru delete receipts preexistente fără zi activă", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "preexisting-create", "upsert_day", 0, workoutDay());
    await apply(db, "preexisting-delete", "delete_day", 1, { date: "2026-08-21" });
    await asRole(db, "postgres");
    await db.exec("delete from public.amv2_workout_day_tombstones");
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_day_tombstones")).rows[0].amount, 0);
    await db.exec(await readFile(migrationUrl, "utf8"));
    const restored = await db.query("select workout_date,revision from public.amv2_workout_day_tombstones");
    assert.deepEqual(restored.rows.map((row) => [
      row.workout_date instanceof Date ? row.workout_date.toISOString().slice(0, 10) : row.workout_date,
      Number(row.revision),
    ]), [["2026-08-21", 2]]);
  } finally { await closeAmv2TestDatabase(db); }
});
