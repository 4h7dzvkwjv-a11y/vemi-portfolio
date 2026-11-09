import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  applyMigrationFiles,
  initializeSupabaseTestShims,
  realPostgresEnvironmentAvailable,
  runPsql,
} from "./helpers/amv2-real-postgres.mjs";
import { OWNER_A } from "./helpers/amv2-postgres.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recoveryPath = path.join(root, "scripts", "amv2", "cp219-recovery.sql");
const cleanupPath = path.join(root, "scripts", "amv2", "cp219-prewrite-cleanup.sql");
const runbookPath = path.join(root, "scripts", "amv2", "CP219R4-CUTOVER-RUNBOOK.md");
const migrations = [
  "202608210001_amv2_workout_day_cloud_preproduction.sql",
  "202608210002_amv2_personal_exercises_final_figma.sql",
  "202608220001_amv2_workout_day_tombstone_sync_safety.sql",
  "202608220002_amv2_history_coverage_v1_import_idempotency.sql",
].map((name) => path.join(root, "supabase", "migrations", name));

const guardedTables = [
  "amv2_personal_exercises",
  "amv2_workout_days",
  "amv2_workout_day_exercises",
  "amv2_workout_day_sets",
  "amv2_operation_receipts",
  "amv2_import_batches",
  "amv2_workout_day_tombstones",
  "amv2_owner_sync_state",
  "amv2_import_occurrences",
];
const expectedTables = [
  "amv2_artifact_registry",
  "amv2_canonical_exercises",
  ...guardedTables,
];
const expectedFunctions = [
  "amv2_apply_operation(text,text,bigint,jsonb)",
  "amv2_apply_operation_cp219r2_base(text,text,bigint,jsonb)",
  "amv2_apply_operation_cp219r1_base(text,text,bigint,jsonb)",
  "amv2_read_calendar(date,date)",
  "amv2_read_history_page(date,integer,bigint)",
  "amv2_replace_workout_day_graph(uuid,bigint,jsonb)",
  "amv2_replace_workout_day_graph_cp219r1_base(uuid,bigint,jsonb)",
  "amv2_validate_personal_exercise_row()",
  "amv2_validate_day_exercise_row()",
  "amv2_validate_set_row()",
];

async function openIsolatedDatabase(label) {
  const baseDatabase = process.env.PGDATABASE;
  const database = `vemi_r4_${label}_${process.pid}`.toLowerCase();
  await runPsql({ sql: `drop database if exists ${database} with (force);` });
  await runPsql({ sql: `create database ${database};` });
  process.env.PGDATABASE = database;
  return async () => {
    process.env.PGDATABASE = baseDatabase;
    await runPsql({ sql: `drop database if exists ${database} with (force);` });
  };
}

function executableSql(source) {
  return source.replace(/^\s*--.*$/gm, "");
}

test("post-write recovery is aggregate-only and requires the complete reviewed schema", async () => {
  const recovery = await readFile(recoveryPath, "utf8");
  assert.match(recovery, /transaction isolation level repeatable read read only/i);
  assert.match(recovery, /POST_WRITE_PRESERVE_DATA_AND_ROLL_FORWARD/);
  assert.match(recovery, /SCHEMA_INCOMPLETE_STOP_AND_INVESTIGATE/);
  assert.doesNotMatch(executableSql(recovery), /\b(drop|truncate|delete|update|insert|alter|create)\b/i);
  for (const table of expectedTables) assert.match(recovery, new RegExp(`public\\.${table}\\b`));
  for (const signature of expectedFunctions) {
    assert.match(recovery, new RegExp(`public\\.${signature.replace(/[()]/g, "\\$&")}`));
  }
  assert.match(recovery, /expected_relation_count = 11/);
  assert.match(recovery, /expected_function_count = 10/);
  for (const check of ["orphaned_day_exercises", "orphaned_sets", "orphaned_import_occurrences", "orphaned_personal_references"]) {
    assert.match(recovery, new RegExp(check));
  }
});

test("pre-first-write cleanup is complete-schema, lock, empty-data and repeatability guarded", async () => {
  const cleanup = await readFile(cleanupPath, "utf8");
  assert.match(cleanup, /expected_relation_count = 11/);
  assert.match(cleanup, /expected_function_count = 10/);
  assert.match(cleanup, /unexpected_relation_count = 0/);
  assert.match(cleanup, /unexpected_function_count = 0/);
  assert.match(cleanup, /relation\.relkind in \('r','p','v','m','f','S'\)/);
  assert.match(cleanup, /in access exclusive mode/i);
  assert.match(cleanup, /AMV2_PREWRITE_CLEANUP_REFUSED_DATA_PRESENT/);
  assert.match(cleanup, /AMV2_PREWRITE_CLEANUP_REFUSED_PARTIAL_SCHEMA/);
  assert.match(cleanup, /AMV2_PREWRITE_CLEANUP_ALREADY_COMPLETE/);
  assert.doesNotMatch(cleanup, /\bcascade\b/i);
  for (const table of guardedTables) assert.match(cleanup, new RegExp(`public\\.${table}\\b`));
  assert.ok(
    cleanup.indexOf("AMV2_PREWRITE_CLEANUP_REFUSED_DATA_PRESENT") < cleanup.indexOf("drop function public.amv2_apply_operation"),
    "the row guard must appear before the first schema-removal statement",
  );
});

test("runbook separates pre-first-write cleanup, post-write preservation and M-07", async () => {
  const runbook = await readFile(runbookPath, "utf8");
  assert.match(runbook, /pre-first-write cleanup/i);
  assert.match(runbook, /After the first AMV2 owner write, pre-write cleanup is permanently forbidden/i);
  assert.match(runbook, /preserve pending client outboxes and server receipts/i);
  assert.match(runbook, /auth_leaked_password_protection/);
  assert.match(runbook, /separate explicit Auth control-plane approval/i);
  assert.match(runbook, /managed `supabase db push --dry-run`/i);
  assert.match(runbook, /only proposed versions must be the five pending versions/i);
});

test("real PostgreSQL proves all guarded row classes refuse before DDL and empty cleanup repeats", {
  skip: realPostgresEnvironmentAvailable() ? false : "disposable real PostgreSQL environment not loaded",
  timeout: 120_000,
}, async (context) => {
  const closeDatabase = await openIsolatedDatabase("recovery");
  try {
    await initializeSupabaseTestShims([OWNER_A]);
    await applyMigrationFiles(migrations);

  await runPsql({ sql: `create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations(version text primary key,name text);
    insert into supabase_migrations.schema_migrations(version,name) values
      ('202608210001','amv2_workout_day_cloud_preproduction'),
      ('202608210002','amv2_personal_exercises_final_figma'),
      ('202608220001','amv2_workout_day_tombstone_sync_safety'),
      ('202608220002','amv2_history_coverage_v1_import_idempotency')
    on conflict(version) do update set name=excluded.name;` });
  const verifier = await runPsql({ file: recoveryPath, quiet: false });
  assert.match(verifier.stdout, /NO_OWNER_ROWS_KEEP_ADDITIVE_SCHEMA/);
  assert.match(verifier.stdout, /orphaned_day_exercises/);

  await context.test("missing reference table is refused by the verifier", async () => {
    await runPsql({ sql: `alter table public.amv2_artifact_registry
      rename to amv2_artifact_registry_missing_probe;` });
    const missingReference = await runPsql({ file: recoveryPath, quiet: false });
    assert.match(missingReference.stdout, /SCHEMA_INCOMPLETE_STOP_AND_INVESTIGATE/);
    await runPsql({ sql: `alter table public.amv2_artifact_registry_missing_probe
      rename to amv2_artifact_registry;` });
  });

  await context.test("missing RPC is refused by the verifier", async () => {
    await runPsql({ sql: `alter function public.amv2_read_history_page(date,integer,bigint)
      rename to amv2_read_history_page_missing_probe;` });
    const missingRpc = await runPsql({ file: recoveryPath, quiet: false });
    assert.match(missingRpc.stdout, /SCHEMA_INCOMPLETE_STOP_AND_INVESTIGATE/);
    await runPsql({ sql: `alter function public.amv2_read_history_page_missing_probe(date,integer,bigint)
      rename to amv2_read_history_page;` });
  });

  const assertSchemaPresent = async () => {
    const result = await runPsql({ sql: `select count(*) from unnest(array[
      'public.amv2_artifact_registry','public.amv2_canonical_exercises','public.amv2_personal_exercises',
      'public.amv2_workout_days','public.amv2_workout_day_exercises','public.amv2_workout_day_sets',
      'public.amv2_operation_receipts','public.amv2_import_batches','public.amv2_workout_day_tombstones',
      'public.amv2_owner_sync_state','public.amv2_import_occurrences'
    ]) as expected(name) where to_regclass(expected.name) is not null;` });
    assert.equal(result.stdout, "11");
  };

  const refusalCases = [
    {
      name: "Personal definition",
      insert: `insert into public.amv2_personal_exercises(
        owner_user_id,id,client_key,name,template_exercise_key,category,location,metric_type,
        default_sets,default_repetitions,default_weight_kg,default_time_per_set_seconds,default_total_duration_seconds
      ) values ('${OWNER_A}','guard-personal','guard-personal','Guard personal','abdomene','Abdomen','home',
        'repetitions_only',3,0,null,null,null);`,
      clear: `delete from public.amv2_personal_exercises where owner_user_id='${OWNER_A}';`,
    },
    {
      name: "WorkoutDay",
      insert: `insert into public.amv2_workout_days(owner_user_id,workout_date,client_key,location)
        values ('${OWNER_A}','2026-08-23','guard-day','gym');`,
      clear: `delete from public.amv2_workout_days where owner_user_id='${OWNER_A}';`,
    },
    {
      name: "operation receipt",
      insert: `insert into public.amv2_operation_receipts(
        owner_user_id,operation_key,operation_type,request_payload,response_payload,request_hash
      ) values ('${OWNER_A}','guard-receipt','upsert_day','{}','{}',md5('{}'));`,
      clear: `delete from public.amv2_operation_receipts where owner_user_id='${OWNER_A}';`,
    },
    {
      name: "import provenance",
      insert: `insert into public.amv2_import_batches(
          owner_user_id,batch_key,source,source_identity,payload,imported_dates,
          source_definition_identity,source_occurrence_identity
        ) values ('${OWNER_A}','guard-batch','v1_local','guard-source','{}','{}',
          'guard-definition','guard-occurrence');
        insert into public.amv2_import_occurrences(
          owner_user_id,source,source_definition_identity,source_occurrence_identity,destination_date,
          destination_client_key,batch_key,operation_key,request_hash
        ) values ('${OWNER_A}','v1_local','guard-definition','guard-occurrence','2026-08-22',
          'guard-destination','guard-batch','guard-import-operation',md5('{}'));`,
      clear: `delete from public.amv2_import_occurrences where owner_user_id='${OWNER_A}';
        delete from public.amv2_import_batches where owner_user_id='${OWNER_A}';`,
    },
    {
      name: "tombstone",
      insert: `insert into public.amv2_workout_day_tombstones(owner_user_id,workout_date,revision)
        values ('${OWNER_A}','2026-08-21',1);`,
      clear: `delete from public.amv2_workout_day_tombstones where owner_user_id='${OWNER_A}';`,
    },
    {
      name: "coverage state",
      insert: `insert into public.amv2_owner_sync_state(owner_user_id,history_revision)
        values ('${OWNER_A}',1);`,
      clear: `delete from public.amv2_owner_sync_state where owner_user_id='${OWNER_A}';`,
    },
  ];

  const unexpectedObjectCases = [
    {
      name: "unreviewed table",
      create: "create table public.amv2_unreviewed_table(id integer);",
      drop: "drop table public.amv2_unreviewed_table;",
    },
    {
      name: "unreviewed view",
      create: "create view public.amv2_unreviewed_view as select 1 as id;",
      drop: "drop view public.amv2_unreviewed_view;",
    },
    {
      name: "unreviewed materialized view",
      create: "create materialized view public.amv2_unreviewed_materialized as select 1 as id;",
      drop: "drop materialized view public.amv2_unreviewed_materialized;",
    },
    {
      name: "unreviewed sequence",
      create: "create sequence public.amv2_unreviewed_sequence;",
      drop: "drop sequence public.amv2_unreviewed_sequence;",
    },
    {
      name: "unreviewed function",
      create: "create function public.amv2_unreviewed_function() returns integer language sql as 'select 1';",
      drop: "drop function public.amv2_unreviewed_function();",
    },
  ];

  for (const scenario of unexpectedObjectCases) {
    await context.test(`${scenario.name} refuses`, async () => {
      await runPsql({ sql: scenario.create });
      await assert.rejects(runPsql({ file: cleanupPath, quiet: false }), (error) => {
        assert.match(error.result?.stderr ?? error.message, /AMV2_PREWRITE_CLEANUP_REFUSED_PARTIAL_SCHEMA/);
        return true;
      });
      await assertSchemaPresent();
      await runPsql({ sql: scenario.drop });
    });
  }

  for (const scenario of refusalCases) {
    await context.test(`${scenario.name} refuses`, async () => {
      await runPsql({ sql: scenario.insert });
      await assert.rejects(runPsql({ file: cleanupPath, quiet: false }), (error) => {
        assert.match(error.result?.stderr ?? error.message, /AMV2_PREWRITE_CLEANUP_REFUSED_DATA_PRESENT/);
        return true;
      });
      await assertSchemaPresent();
      await runPsql({ sql: scenario.clear });
    });
  }

  const first = await runPsql({ file: cleanupPath, quiet: false });
  assert.match(first.stdout, /AMV2_PREWRITE_CLEANUP_COMPLETE/);
  const absent = await runPsql({ sql: `select count(*) from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='public' and relation.relname like 'amv2_%';` });
  assert.equal(absent.stdout, "0");

    await runPsql({ sql: "create table public.amv2_unexpected_only(id integer);" });
    await assert.rejects(runPsql({ file: cleanupPath, quiet: false }), (error) => {
      assert.match(error.result?.stderr ?? error.message, /AMV2_PREWRITE_CLEANUP_REFUSED_PARTIAL_SCHEMA/);
      return true;
    });
    const unexpectedOnly = await runPsql({ sql: "select to_regclass('public.amv2_unexpected_only') is not null;" });
    assert.equal(unexpectedOnly.stdout, "t");
    await runPsql({ sql: "drop table public.amv2_unexpected_only;" });

    const repeated = await runPsql({ file: cleanupPath, quiet: false });
    assert.match(repeated.stdout, /AMV2_PREWRITE_CLEANUP_ALREADY_COMPLETE/);
  } finally {
    await closeDatabase();
  }
});
