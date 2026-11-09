import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  applyMigrationFiles,
  authenticatedSql,
  initializeSupabaseTestShims,
  realPostgresEnvironmentAvailable,
  runPsql,
} from "./helpers/amv2-real-postgres.mjs";
import { OWNER_A, OWNER_B } from "./helpers/amv2-postgres.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = [
  "202608210001_amv2_workout_day_cloud_preproduction.sql",
  "202608210002_amv2_personal_exercises_final_figma.sql",
  "202608220001_amv2_workout_day_tombstone_sync_safety.sql",
  "202608220002_amv2_history_coverage_v1_import_idempotency.sql",
].map((name) => path.join(root, "supabase", "migrations", name));

function workoutDay(date, repetitions = 8) {
  return JSON.stringify({
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
  });
}

function importSql(key, batchKey, date, repetitions = 8, expectedRevision = 0) {
  const payload = JSON.stringify({
    batchKey,
    source: "v1_local",
    sourceDefinitionIdentity: "concurrent-reusable-definition",
    sourceOccurrenceIdentity: `concurrent-occurrence:${date}`,
    destinationDate: date,
    days: [JSON.parse(workoutDay(date, repetitions))],
  });
  return `select public.amv2_apply_operation(
    '${key}','import_days',${expectedRevision},$payload$${payload}$payload$::jsonb
  )::text;`;
}

function upsertSql(key, date, repetitions = 8) {
  return `select public.amv2_apply_operation(
    '${key}','upsert_day',0,$payload$${workoutDay(date, repetitions)}$payload$::jsonb
  )::text;`;
}

test("real PostgreSQL 17 proves the R2 chain, measured indexes and concurrent receipts", {
  skip: realPostgresEnvironmentAvailable() ? false : "disposable real PostgreSQL environment not loaded",
  timeout: 120_000,
}, async (context) => {
  await initializeSupabaseTestShims([OWNER_A, OWNER_B]);
  await applyMigrationFiles(migrations.slice(0, 3));

  const longLegacyBatchKey = `legacy-${"x".repeat(400)}`;
  const longLegacyPayload = JSON.stringify({
    batchKey: longLegacyBatchKey,
    source: "v1_local",
    sourceIdentity: "real-legacy-long-occurrence",
    days: [JSON.parse(workoutDay("2020-12-31", 13))],
  });
  await runPsql({ sql: authenticatedSql(OWNER_A, `select public.amv2_apply_operation(
    'real-legacy-long-operation','import_days',0,
    $payload$${longLegacyPayload}$payload$::jsonb
  );`) });

  await runPsql({ sql: `
    insert into public.amv2_personal_exercises(
      owner_user_id,id,client_key,name,template_exercise_key,category,location,metric_type,
      default_sets,default_repetitions,default_weight_kg,default_time_per_set_seconds,
      default_total_duration_seconds
    ) select '${OWNER_A}','plan-personal-'||definition,'plan-personal-client-'||definition,
      'Plan personal '||definition,exercise_key,category,'home',metric_type,default_sets,default_repetitions,default_weight_kg,
      default_time_per_set_seconds,default_total_duration_seconds
      from public.amv2_canonical_exercises
      cross join generate_series(0,11) definition
      where exercise_key='abdomene';
    insert into public.amv2_workout_days(owner_user_id,workout_date,client_key,location)
    select '${OWNER_A}',day::date,'plan-day:'||day::date,'gym'
    from generate_series('2021-01-01'::date,'2025-12-31'::date,'1 day') day;
    insert into public.amv2_workout_day_exercises(
      owner_user_id,workout_date,client_key,order_index,canonical_exercise_key,
      display_name,category,metric_type,total_duration_seconds
    ) select '${OWNER_A}',day::date,'canonical:'||day::date,0,catalog.exercise_key,
      catalog.display_name,catalog.category,catalog.metric_type,null
    from generate_series('2021-01-01'::date,'2025-12-31'::date,'1 day') day
    cross join lateral (
      select exercise_key,display_name,category,metric_type
      from public.amv2_canonical_exercises
      where metric_type='repetitions_only'
      order by exercise_key
      offset ((day::date-'2021-01-01'::date) % 10)
      limit 1
    ) catalog;
    insert into public.amv2_workout_day_exercises(
      owner_user_id,workout_date,client_key,order_index,personal_exercise_id,
      personal_template_exercise_key,display_name,category,metric_type,total_duration_seconds
    ) select '${OWNER_A}',day::date,'personal:'||day::date,1,
      'plan-personal-'||((day::date-'2021-01-01'::date) % 12),
      'abdomene','Plan personal','Abdomen','repetitions_only',null
    from generate_series('2021-01-01'::date,'2025-12-31'::date,'1 day') day;
    analyze public.amv2_workout_days;
    analyze public.amv2_workout_day_exercises;
  ` });

  const rareCanonical = (await runPsql({ sql: `select exercise_key from public.amv2_canonical_exercises
    where metric_type='repetitions_only' order by exercise_key offset 9 limit 1;` })).stdout;
  const canonicalBefore = await runPsql({ sql: `set enable_seqscan=off; explain (analyze,buffers,costs off)
    select workout_date,client_key from public.amv2_workout_day_exercises
    where owner_user_id='${OWNER_A}' and canonical_exercise_key='${rareCanonical}'
    order by workout_date desc limit 25;` });
  const personalBefore = await runPsql({ sql: `set enable_seqscan=off; explain (analyze,buffers,costs off)
    select workout_date,client_key from public.amv2_workout_day_exercises
    where owner_user_id='${OWNER_A}' and personal_exercise_id='plan-personal-11'
    order by workout_date desc limit 25;` });
  assert.doesNotMatch(canonicalBefore.stdout, /canonical_history_idx/);
  assert.doesNotMatch(personalBefore.stdout, /personal_history_idx/);

  await applyMigrationFiles(migrations.slice(3));
  const longLegacyBackfill = await runPsql({ sql: `select char_length(batch_key),operation_key,
    result_payload->>'remoteIdentity',
    (select count(*) from public.amv2_workout_days where owner_user_id='${OWNER_A}'
      and workout_date='2020-12-31')
    from public.amv2_import_occurrences
    where owner_user_id='${OWNER_A}'
      and source_occurrence_identity='real-legacy-long-occurrence';` });
  const expectedLongLegacyOperation = `legacy-batch:${createHash("md5")
    .update(longLegacyBatchKey).digest("hex")}`;
  assert.equal(longLegacyBackfill.stdout,
    `${longLegacyBatchKey.length}|${expectedLongLegacyOperation}|import:real-legacy-long-occurrence|1`);
  await runPsql({ sql: `
    insert into public.amv2_workout_days(owner_user_id,workout_date,client_key,location)
    select '${OWNER_A}',day::date,'dense-day:'||day::date,'gym'
    from generate_series('2026-05-20'::date,'2026-05-22'::date,'1 day') day;
    with catalog as (
      select exercise_key,display_name,category,metric_type,
        row_number() over(order by exercise_key)-1 order_index
      from public.amv2_canonical_exercises
      where metric_type='repetitions_only'
      order by exercise_key
      limit 10
    )
    insert into public.amv2_workout_day_exercises(
      owner_user_id,workout_date,client_key,order_index,canonical_exercise_key,
      display_name,category,metric_type,total_duration_seconds
    ) select '${OWNER_A}',day::date,
      'dense-exercise:'||day::date||':'||catalog.order_index,catalog.order_index,
      catalog.exercise_key,catalog.display_name,catalog.category,catalog.metric_type,null
    from generate_series('2026-05-20'::date,'2026-05-22'::date,'1 day') day
    cross join catalog;
    insert into public.amv2_workout_day_sets(
      owner_user_id,workout_date,exercise_client_key,client_key,order_index,
      repetitions,weight_kg,duration_seconds
    ) select exercise.owner_user_id,exercise.workout_date,exercise.client_key,
      'dense-set:'||exercise.workout_date||':'||exercise.order_index||':'||set_index,
      set_index,0,null,null
    from public.amv2_workout_day_exercises exercise
    cross join generate_series(0,19) set_index
    where exercise.owner_user_id='${OWNER_A}'
      and exercise.workout_date between '2026-05-20' and '2026-05-22';

    insert into public.amv2_import_batches(
      owner_user_id,batch_key,source,source_identity,source_definition_identity,
      source_occurrence_identity,payload,imported_dates
    ) select '${OWNER_A}','plan-batch:'||day::date,'v1_local','plan-occurrence:'||day::date,
      'plan-reusable-definition','plan-occurrence:'||day::date,'{}'::jsonb,array[day::date]
    from generate_series('2021-01-01'::date,'2025-12-31'::date,'1 day') day;
    insert into public.amv2_import_occurrences(
      owner_user_id,source,source_definition_identity,source_occurrence_identity,
      destination_date,destination_client_key,batch_key,operation_key,request_hash
    ) select '${OWNER_A}','v1_local','plan-reusable-definition','plan-occurrence:'||day::date,
      day::date,'plan-day:'||day::date,'plan-batch:'||day::date,
      'plan-operation:'||day::date,md5(day::text)
    from generate_series('2021-01-01'::date,'2025-12-31'::date,'1 day') day;
    analyze public.amv2_workout_day_exercises;
    analyze public.amv2_import_occurrences;
  ` });

  const densePage = await runPsql({ sql: authenticatedSql(OWNER_A, `
    select pg_column_size(page),jsonb_array_length(page->'days'),
      jsonb_array_length(page->'exercises'),jsonb_array_length(page->'sets'),
      jsonb_array_length(page->'personalExercises')
    from (select public.amv2_read_history_page(null,3,null) page) measured;
  `) });
  const [denseBytes, denseDays, denseExercises, denseSets, densePersonal] = densePage.stdout.split("|").map(Number);
  assert.deepEqual([denseDays, denseExercises, denseSets, densePersonal], [3, 30, 600, 0]);
  assert.ok(denseBytes < 512 * 1_024, `max-density 3-day page is ${denseBytes} bytes`);

  const canonicalAfter = await runPsql({ sql: `set enable_seqscan=off; explain (analyze,buffers,costs off)
    select workout_date,client_key from public.amv2_workout_day_exercises
    where owner_user_id='${OWNER_A}' and canonical_exercise_key='${rareCanonical}'
    order by workout_date desc limit 25;` });
  const personalAfter = await runPsql({ sql: `set enable_seqscan=off; explain (analyze,buffers,costs off)
    select workout_date,client_key from public.amv2_workout_day_exercises
    where owner_user_id='${OWNER_A}' and personal_exercise_id='plan-personal-11'
    order by workout_date desc limit 25;` });
  assert.match(canonicalAfter.stdout, /amv2_day_exercises_canonical_history_idx/);
  assert.match(personalAfter.stdout, /amv2_day_exercises_personal_history_idx/);
  const provenanceAfter = await runPsql({ sql: `set enable_seqscan=off; explain (analyze,buffers,costs off)
    select destination_date,batch_key from public.amv2_import_occurrences
    where owner_user_id='${OWNER_A}' and source='v1_local'
      and source_definition_identity='plan-reusable-definition'
    order by destination_date desc limit 25;` });
  assert.match(provenanceAfter.stdout, /amv2_import_occurrences_definition_history_idx/);

  const coveredExistingPaths = await runPsql({ sql: `set enable_seqscan=off;
    explain (costs off) select workout_date from public.amv2_workout_days
      where owner_user_id='${OWNER_A}' and workout_date<'2025-01-01' order by workout_date desc limit 60;
    explain (costs off) select workout_date from public.amv2_workout_day_tombstones
      where owner_user_id='${OWNER_A}' and workout_date<'2025-01-01' order by workout_date desc limit 60;
    explain (costs off) select response_payload from public.amv2_operation_receipts
      where owner_user_id='${OWNER_A}' and operation_key='x';` });
  assert.match(coveredExistingPaths.stdout, /amv2_workout_days_pkey/);
  assert.match(coveredExistingPaths.stdout, /amv2_workout_day_tombstones_pkey/);
  assert.match(coveredExistingPaths.stdout, /amv2_operation_receipts_pkey/);

  context.diagnostic(`canonical plan before: ${canonicalBefore.stdout.replaceAll("\n", " | ")}`);
  context.diagnostic(`canonical plan after: ${canonicalAfter.stdout.replaceAll("\n", " | ")}`);
  context.diagnostic(`personal plan before: ${personalBefore.stdout.replaceAll("\n", " | ")}`);
  context.diagnostic(`personal plan after: ${personalAfter.stdout.replaceAll("\n", " | ")}`);
  context.diagnostic(`provenance plan after: ${provenanceAfter.stdout.replaceAll("\n", " | ")}`);
  context.diagnostic(`max-density 3-day history payload: ${denseBytes} bytes (3 days / 30 exercises / 600 sets)`);

  await runPsql({ sql: `
    create or replace function public.amv2_r2_receipt_delay() returns trigger
      language plpgsql as $fn$
    begin
      if new.operation_key like 'concurrent-%' or new.operation_key='rollback-operation' then
        perform pg_sleep(1);
      end if;
      return new;
    end $fn$;
    create trigger amv2_r2_receipt_delay before insert on public.amv2_operation_receipts
      for each row execute function public.amv2_r2_receipt_delay();
  ` });

  const sameSql = authenticatedSql(OWNER_A,
    importSql("concurrent-same", "concurrent-same-batch", "2026-06-01", 8),
  );
  const sameAStarted = performance.now();
  const sameA = runPsql({ sql: sameSql });
  await delay(150);
  const sameBStarted = performance.now();
  const sameB = runPsql({ sql: sameSql });
  const [sameAResult, sameBResult] = await Promise.all([sameA, sameB]);
  const sameBElapsed = performance.now() - sameBStarted;
  assert.equal(sameAResult.stdout, sameBResult.stdout);
  assert.ok(sameBElapsed >= 700, `second identical request waited only ${sameBElapsed}ms`);
  const sameCounts = await runPsql({ sql: `select
    (select count(*) from public.amv2_workout_days where workout_date='2026-06-01'),
    (select count(*) from public.amv2_operation_receipts where operation_key='concurrent-same'),
    (select count(*) from public.amv2_import_batches where batch_key='concurrent-same-batch'),
    (select count(*) from public.amv2_import_occurrences where destination_date='2026-06-01');` });
  assert.equal(sameCounts.stdout, "1|1|1|1");
  const occurrenceReplay = await runPsql({ sql: authenticatedSql(OWNER_A,
    importSql("occurrence-replay", "occurrence-replay-batch", "2026-06-01", 8, 1),
  ) });
  assert.equal(occurrenceReplay.stdout, sameAResult.stdout);
  assert.equal(
    JSON.parse(occurrenceReplay.stdout).remoteIdentity,
    "import:concurrent-occurrence:2026-06-01",
  );
  const replayCounts = await runPsql({ sql: `select
    (select count(*) from public.amv2_workout_days where workout_date='2026-06-01'),
    (select count(*) from public.amv2_import_batches where batch_key in ('concurrent-same-batch','occurrence-replay-batch')),
    (select count(*) from public.amv2_import_occurrences where destination_date='2026-06-01'),
    (select count(*) from public.amv2_operation_receipts where operation_key in ('concurrent-same','occurrence-replay'));` });
  assert.equal(replayCounts.stdout, "1|1|1|2");

  const conflictA = runPsql({ sql: authenticatedSql(OWNER_A,
    importSql("concurrent-conflict", "concurrent-conflict-a", "2026-06-02", 8),
  ) });
  await delay(100);
  const conflictB = runPsql({ sql: authenticatedSql(OWNER_A,
    importSql("concurrent-conflict", "concurrent-conflict-b", "2026-06-04", 9),
  ) });
  const conflictResults = await Promise.allSettled([conflictA, conflictB]);
  assert.equal(conflictResults.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = conflictResults.find((result) => result.status === "rejected");
  assert.match(rejected.reason.message, /AMV2_IDEMPOTENCY_PAYLOAD_CONFLICT/);
  const conflictCounts = await runPsql({ sql: `select
    (select count(*) from public.amv2_workout_days where workout_date in ('2026-06-02','2026-06-04')),
    (select count(*) from public.amv2_operation_receipts where operation_key='concurrent-conflict'),
    (select count(*) from public.amv2_import_batches where batch_key in ('concurrent-conflict-a','concurrent-conflict-b')),
    (select count(*) from public.amv2_import_occurrences where destination_date in ('2026-06-02','2026-06-04'));` });
  assert.equal(conflictCounts.stdout, "1|1|1|1");

  const rollbackA = runPsql({ sql: `begin;
    set local role authenticated;
    set local "request.jwt.claim.sub"='${OWNER_A}';
    ${importSql("rollback-operation", "rollback-batch", "2026-06-03", 10)}
    select pg_sleep(0.5);
    rollback;` });
  await delay(150);
  const rollbackBStarted = performance.now();
  const rollbackB = runPsql({ sql: authenticatedSql(OWNER_A,
    importSql("rollback-operation", "rollback-batch", "2026-06-03", 10),
  ) });
  await Promise.all([rollbackA, rollbackB]);
  const rollbackBElapsed = performance.now() - rollbackBStarted;
  assert.ok(rollbackBElapsed >= 1_000, `retry after rollback waited only ${rollbackBElapsed}ms`);
  const rollbackCounts = await runPsql({ sql: `select
    (select count(*) from public.amv2_workout_days where workout_date='2026-06-03'),
    (select count(*) from public.amv2_operation_receipts where operation_key='rollback-operation'),
    (select count(*) from public.amv2_import_batches where batch_key='rollback-batch'),
    (select count(*) from public.amv2_import_occurrences where destination_date='2026-06-03');` });
  assert.equal(rollbackCounts.stdout, "1|1|1|1");

  const lifetimeOriginal = await runPsql({ sql: authenticatedSql(OWNER_A,
    upsertSql("lifetime-real-receipt", "2026-06-05", 11),
  ) });
  await runPsql({ sql: `update public.amv2_operation_receipts
    set created_at=now()-interval '100 days'
    where owner_user_id='${OWNER_A}' and operation_key='lifetime-real-receipt';` });
  await runPsql({ sql: authenticatedSql(OWNER_A,
    upsertSql("later-real-write", "2026-06-06", 12),
  ) });
  const lifetimeReplay = await runPsql({ sql: authenticatedSql(OWNER_A,
    upsertSql("lifetime-real-receipt", "2026-06-05", 11),
  ) });
  assert.equal(lifetimeReplay.stdout, lifetimeOriginal.stdout);
  const retainedReceipt = await runPsql({ sql: `select count(*) from public.amv2_operation_receipts
    where owner_user_id='${OWNER_A}' and operation_key='lifetime-real-receipt';` });
  assert.equal(retainedReceipt.stdout, "1");

  const rls = await runPsql({ sql: authenticatedSql(OWNER_B,
    "select count(*) from public.amv2_owner_sync_state; select count(*) from public.amv2_import_occurrences;",
  ) });
  assert.deepEqual(rls.stdout.split(/\r?\n/), ["0", "0"]);

  const version = await runPsql({ sql: "show server_version;" });
  assert.match(version.stdout, /^17\./);
  context.diagnostic(`real PostgreSQL ${version.stdout}; identical retry B waited ${sameBElapsed.toFixed(1)}ms; rollback retry waited ${rollbackBElapsed.toFixed(1)}ms; total test ${(performance.now() - sameAStarted).toFixed(1)}ms`);
});
