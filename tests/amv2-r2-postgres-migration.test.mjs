import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  asRole,
  closeAmv2TestDatabase,
  createAmv2TestDatabase,
  OWNER_A,
  OWNER_B,
} from "./helpers/amv2-postgres.mjs";

const migrationUrl = new URL(
  "../supabase/migrations/202608220002_amv2_history_coverage_v1_import_idempotency.sql",
  import.meta.url,
);

function workoutDay(date, repetitions = 8) {
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

async function historyPage(db, before = null, limit = 60, revision = null) {
  const result = await db.query(
    "select public.amv2_read_history_page($1::date,$2,$3::bigint) result",
    [before, limit, revision],
  );
  return result.rows[0].result;
}

test("R2 migration is additive, transactional, owner-safe and locks before receipt lookup", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate)\b/i);
  assert.doesNotMatch(sql, /custom_workouts|workout_sessions|workout_exercise_logs|user_free_plans/i);
  assert.match(sql, /amv2_owner_sync_state/);
  assert.match(sql, /amv2_import_occurrences/);
  const lock = sql.indexOf("amv2-operation:");
  const receiptRead = sql.indexOf("select request_payload,response_payload,request_hash");
  assert.ok(lock >= 0 && receiptRead > lock, "receipt must be re-read after the operation lock");
  assert.match(sql, /force row level security/);
  assert.match(sql, /using \(\(select auth\.uid\(\)\)=owner_user_id\)/);
  assert.match(sql, /AMV2_IDEMPOTENCY_PAYLOAD_CONFLICT/);
});

test("history pages use an exclusive date cursor and one coherent owner revision", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    for (const [index, date] of ["2022-01-01", "2023-01-01", "2024-01-01", "2025-01-01", "2026-01-01"].entries()) {
      await apply(db, `create-${index}`, "upsert_day", 0, workoutDay(date, index + 1));
    }
    await apply(db, "delete-middle", "delete_day", 1, { date: "2024-01-01" });

    const first = await historyPage(db, null, 2, null);
    const currentMonth = (await db.query(
      "select public.amv2_read_calendar('2026-01-01','2026-12-31') snapshot",
    )).rows[0].snapshot;
    assert.equal(currentMonth.snapshotRevision, first.snapshotRevision);
    assert.equal(first.hasMore, true);
    assert.equal(first.nextCursor, "2025-01-01");
    assert.deepEqual(first.days.map((row) => row.workout_date), ["2026-01-01", "2025-01-01"]);
    const second = await historyPage(db, first.nextCursor, 2, first.snapshotRevision);
    assert.deepEqual([
      ...second.days.map((row) => row.workout_date),
      ...second.tombstones.map((row) => row.workout_date),
    ].sort().reverse(), ["2024-01-01", "2023-01-01"]);
    const third = await historyPage(db, second.nextCursor, 2, first.snapshotRevision);
    assert.equal(third.hasMore, false);
    assert.deepEqual(third.days.map((row) => row.workout_date), ["2022-01-01"]);
    const allDates = [first, second, third].flatMap((page) => [
      ...page.days.map((row) => row.workout_date),
      ...page.tombstones.map((row) => row.workout_date),
    ]);
    assert.equal(new Set(allDates).size, 5);

    await apply(db, "new-generation", "upsert_day", 0, workoutDay("2026-02-01"));
    await assert.rejects(
      historyPage(db, first.nextCursor, 2, first.snapshotRevision),
      /SNAPSHOT_REVISION_CHANGED/,
    );

    await asRole(db, "authenticated", OWNER_B);
    const empty = await historyPage(db, null, 3, null);
    assert.deepEqual({ days: empty.days, tombstones: empty.tombstones, revision: empty.snapshotRevision }, {
      days: [], tombstones: [], revision: 0,
    });
    assert.equal(empty.hasMore, false);
    await assert.rejects(historyPage(db, null, 4, null), /HISTORY_CURSOR_INVALID/);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});

test("one reusable V1 definition imports to multiple dates while occurrence and operation retries remain idempotent", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    const definition = "legacy-workout-definition";
    const occurrenceForDate = (date) => `legacy-workout-occurrence:${date}`;
    let thirdResult;
    for (const [index, date] of ["2026-04-01", "2026-04-02", "2026-04-03"].entries()) {
      const occurrence = occurrenceForDate(date);
      const payload = {
        batchKey: `batch-${index}`,
        source: "v1_local",
        sourceDefinitionIdentity: definition,
        sourceOccurrenceIdentity: occurrence,
        destinationDate: date,
        days: [workoutDay(date, index + 5)],
      };
      const result = await apply(db, `import-${index}`, "import_days", 0, payload);
      assert.deepEqual(result.dates, [date]);
      assert.deepEqual(result.appliedDates, [date]);
      assert.equal(result.remoteIdentity, `import:${occurrence}`);
      if (date === "2026-04-03") thirdResult = result;
    }
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days")).rows[0].amount, 3);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_import_occurrences")).rows[0].amount, 3);
    assert.equal((await db.query("select count(distinct source_definition_identity)::int amount from public.amv2_import_occurrences")).rows[0].amount, 1);

    const repeatedPayload = {
      batchKey: "batch-repeat",
      source: "v1_local",
      sourceDefinitionIdentity: definition,
      sourceOccurrenceIdentity: occurrenceForDate("2026-04-03"),
      destinationDate: "2026-04-03",
      days: [workoutDay("2026-04-03", 7)],
    };
    const repeated = await apply(db, "import-repeat", "import_days", 1, repeatedPayload);
    assert.deepEqual(repeated, thirdResult);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_workout_days")).rows[0].amount, 3);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_import_batches where batch_key='batch-repeat'")).rows[0].amount, 0);

    const operationPayload = {
      batchKey: "batch-operation",
      source: "v1_local",
      sourceDefinitionIdentity: definition,
      sourceOccurrenceIdentity: "another-occurrence",
      destinationDate: "2026-04-04",
      days: [workoutDay("2026-04-04", 8)],
    };
    const first = await apply(db, "stable-operation", "import_days", 0, operationPayload);
    assert.deepEqual(await apply(db, "stable-operation", "import_days", 0, operationPayload), first);
    await assert.rejects(
      apply(db, "stable-operation", "import_days", 0, { ...operationPayload, batchKey: "changed" }),
      /IDEMPOTENCY_PAYLOAD_CONFLICT/,
    );
    assert.equal((await db.query("select count(*)::int amount from public.amv2_operation_receipts where operation_key='stable-operation'")).rows[0].amount, 1);

    await assert.rejects(apply(db, "occurrence-conflict", "import_days", 0, {
      batchKey: "batch-conflict",
      source: "v1_local",
      sourceDefinitionIdentity: definition,
      sourceOccurrenceIdentity: occurrenceForDate("2026-04-03"),
      destinationDate: "2026-04-03",
      days: [workoutDay("2026-04-03", 99)],
    }), /IMPORT_OCCURRENCE_CONFLICT/);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_import_batches where batch_key='batch-conflict'")).rows[0].amount, 0);

    await assert.rejects(apply(db, "destination-mismatch", "import_days", 0, {
      batchKey: "batch-mismatch",
      source: "v1_local",
      sourceDefinitionIdentity: definition,
      sourceOccurrenceIdentity: "mismatch-occurrence",
      destinationDate: "2026-04-05",
      days: [workoutDay("2026-04-06", 10)],
    }), /IMPORT_DESTINATION_INVALID/);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});

test("R2 owner tables remain read-only and isolated through RLS", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "owner-a", "upsert_day", 0, workoutDay("2026-05-01"));
    assert.equal((await db.query("select count(*)::int amount from public.amv2_owner_sync_state")).rows[0].amount, 1);
    await assert.rejects(db.query(`insert into public.amv2_owner_sync_state(owner_user_id,history_revision)
      values('${OWNER_A}',99)`), /permission denied/i);

    await asRole(db, "authenticated", OWNER_B);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_owner_sync_state")).rows[0].amount, 0);
    assert.equal((await db.query("select count(*)::int amount from public.amv2_import_occurrences")).rows[0].amount, 0);

    await asRole(db, "anon");
    await assert.rejects(db.query("select * from public.amv2_owner_sync_state"), /permission denied/i);
    await assert.rejects(db.query("select * from public.amv2_import_occurrences"), /permission denied/i);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});

test("an operation receipt remains replayable after 90 days and later delegated writes", async () => {
  const { db } = await createAmv2TestDatabase();
  try {
    await asRole(db, "authenticated", OWNER_A);
    const original = await apply(db, "lifetime-receipt", "upsert_day", 0, workoutDay("2026-07-01", 7));
    await asRole(db, "postgres");
    await db.exec(`update public.amv2_operation_receipts
      set created_at=now()-interval '100 days'
      where owner_user_id='${OWNER_A}' and operation_key='lifetime-receipt'`);
    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "later-delegated-write", "upsert_day", 0, workoutDay("2026-07-02", 8));
    assert.deepEqual(await apply(db, "lifetime-receipt", "upsert_day", 0, workoutDay("2026-07-01", 7)), original);
    assert.equal((await db.query(`select count(*)::int amount from public.amv2_operation_receipts
      where operation_key='lifetime-receipt'`)).rows[0].amount, 1);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});

test("receipt-missing legacy multi-date backfill reuses one complete batch result", async () => {
  const { db } = await createAmv2TestDatabase({ migrationCount: 3 });
  try {
    const firstDay = workoutDay("2026-08-01", 8);
    const secondDay = workoutDay("2026-08-02", 9);
    const originalPayload = {
      batchKey: "legacy-original-batch",
      source: "v1_local",
      sourceIdentity: "legacy-multi-occurrence",
      days: [firstDay, secondDay],
    };
    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "legacy-original-operation", "import_days", 0, originalPayload);
    await asRole(db, "postgres");
    await db.exec(`delete from public.amv2_operation_receipts
      where owner_user_id='${OWNER_A}' and operation_key='legacy-original-operation'`);
    await db.exec(await readFile(migrationUrl, "utf8"));

    await asRole(db, "authenticated", OWNER_A);
    const replay = await apply(db, "legacy-replay-operation", "import_days", 0, {
      ...originalPayload,
      batchKey: "legacy-replay-batch",
    });
    assert.deepEqual(replay, {
      remoteIdentity: "import:legacy-multi-occurrence",
      revision: 1,
      dates: ["2026-08-01", "2026-08-02"],
      appliedDates: ["2026-08-01", "2026-08-02"],
    });
    const occurrenceResults = await db.query(`select result_payload
      from public.amv2_import_occurrences
      where source_occurrence_identity='legacy-multi-occurrence'
      order by destination_date`);
    assert.equal(occurrenceResults.rows.length, 2);
    assert.deepEqual(occurrenceResults.rows[0].result_payload, occurrenceResults.rows[1].result_payload);
    assert.equal((await db.query(`select count(*)::int amount from public.amv2_import_batches
      where batch_key='legacy-replay-batch'`)).rows[0].amount, 0);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});

test("an applied pre-R2 receipt is canonicalized before an unacknowledged old-outbox retry", async () => {
  const { db } = await createAmv2TestDatabase({ migrationCount: 3 });
  try {
    const payload = {
      batchKey: "legacy-applied-batch",
      source: "v1_local",
      sourceIdentity: "legacy-applied-occurrence",
      days: [workoutDay("2026-08-10", 10)],
    };
    await asRole(db, "authenticated", OWNER_A);
    const preR2 = await apply(db, "legacy-unacknowledged-operation", "import_days", 0, payload);
    assert.equal(preR2.remoteIdentity, "import:legacy-applied-batch");

    await asRole(db, "postgres");
    await db.exec(await readFile(migrationUrl, "utf8"));
    await asRole(db, "authenticated", OWNER_A);
    const retried = await apply(db, "legacy-unacknowledged-operation", "import_days", 0, payload);
    assert.deepEqual(retried, {
      ...preR2,
      remoteIdentity: "import:legacy-applied-occurrence",
    });
    const receipt = (await db.query(`select response_payload from public.amv2_operation_receipts
      where operation_key='legacy-unacknowledged-operation'`)).rows[0].response_payload;
    const occurrence = (await db.query(`select result_payload from public.amv2_import_occurrences
      where source_occurrence_identity='legacy-applied-occurrence'`)).rows[0].result_payload;
    assert.deepEqual(receipt, retried);
    assert.deepEqual(occurrence, retried);
    assert.equal((await db.query(`select count(*)::int amount from public.amv2_workout_days
      where workout_date='2026-08-10'`)).rows[0].amount, 1);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});

test("a pre-R2 import with an unbounded batch key survives the R2 provenance backfill", async () => {
  const { db } = await createAmv2TestDatabase({ migrationCount: 3 });
  try {
    const longBatchKey = `legacy-${"x".repeat(400)}`;
    const payload = {
      batchKey: longBatchKey,
      source: "v1_local",
      sourceIdentity: "legacy-long-batch-occurrence",
      days: [workoutDay("2026-08-20", 12)],
    };
    await asRole(db, "authenticated", OWNER_A);
    await apply(db, "legacy-long-batch-operation", "import_days", 0, payload);

    await asRole(db, "postgres");
    await db.exec(await readFile(migrationUrl, "utf8"));
    const occurrence = (await db.query(`select batch_key,operation_key,result_payload
      from public.amv2_import_occurrences
      where owner_user_id='${OWNER_A}'
        and source_occurrence_identity='legacy-long-batch-occurrence'`)).rows[0];
    const expectedSyntheticKey = `legacy-batch:${createHash("md5").update(longBatchKey).digest("hex")}`;
    assert.equal(occurrence.batch_key, longBatchKey);
    assert.equal(occurrence.operation_key, expectedSyntheticKey);
    assert.ok(occurrence.operation_key.length <= 160);
    assert.equal(occurrence.result_payload.remoteIdentity, "import:legacy-long-batch-occurrence");
    assert.equal((await db.query(`select count(*)::int amount from public.amv2_workout_days
      where owner_user_id='${OWNER_A}' and workout_date='2026-08-20'`)).rows[0].amount, 1);
  } finally {
    await closeAmv2TestDatabase(db);
  }
});
