import assert from "node:assert/strict";
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
const migrations = [
  "202608210001_amv2_workout_day_cloud_preproduction.sql",
  "202608210002_amv2_personal_exercises_final_figma.sql",
  "202608220001_amv2_workout_day_tombstone_sync_safety.sql",
  "202608220002_amv2_history_coverage_v1_import_idempotency.sql",
  "202608230001_amv2_pre_cutover_security_hardening.sql",
].map((name) => path.join(root, "supabase", "migrations", name));
const graphProbe = path.join(root, "tests", "helpers", "amv2-r4-postgres-security.sql");

async function installFaithfulSecurityShims() {
  await runPsql({ sql: `
    do $block$ begin
      if not exists(select 1 from pg_roles where rolname='postgres') then
        create role postgres superuser nologin;
      end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then
        create role service_role nologin;
      end if;
    end $block$;
    alter role postgres superuser;
    alter table auth.users add column if not exists raw_user_meta_data jsonb not null default '{}'::jsonb;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges in schema public
      grant truncate,references,trigger,maintain on tables to anon,authenticated,service_role;
    create or replace function public.rls_auto_enable()
    returns event_trigger
    language plpgsql
    security definer
    set search_path to 'pg_catalog'
    as $function$
    declare command record;
    begin
      for command in select * from pg_event_trigger_ddl_commands() loop
        if command.object_type in ('table','partitioned table')
          and command.schema_name='public' then
          execute format('alter table if exists %s enable row level security',command.object_identity);
        end if;
      end loop;
    end
    $function$;
    alter function public.rls_auto_enable() owner to postgres;
    drop event trigger if exists ensure_rls;
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      execute function public.rls_auto_enable();
  ` });
}

async function installPreR4Schema() {
  await initializeSupabaseTestShims([OWNER_A]);
  await installFaithfulSecurityShims();
  await applyMigrationFiles(migrations.slice(0, -1));
}

function parseJsonLine(output) {
  const line = output.split(/\r?\n/).find((candidate) => candidate.trim().startsWith("{"));
  assert.ok(line, `expected JSON output, received: ${output}`);
  return JSON.parse(line);
}

test("real PostgreSQL proves the final R4 privilege, RLS, metric and account-deletion contract", {
  skip: realPostgresEnvironmentAvailable() ? false : "disposable real PostgreSQL environment not loaded",
  timeout: 180_000,
}, async () => {
  await initializeSupabaseTestShims([OWNER_A]);
  await installFaithfulSecurityShims();
  await applyMigrationFiles(migrations);

  const privilegeProbe = await runPsql({ sql: `
    with table_privileges as (
      select role_name,
        count(*) filter (where case when role_name='PUBLIC' then exists (
          select 1 from aclexplode(coalesce(class.relacl,acldefault('r',class.relowner))) acl
          where acl.grantee=0 and acl.privilege_type='SELECT'
        ) else has_table_privilege(role_name,'public.'||class.relname,'SELECT') end) as select_count,
        count(*) filter (where case when role_name='PUBLIC' then exists (
          select 1 from aclexplode(coalesce(class.relacl,acldefault('r',class.relowner))) acl
          where acl.grantee=0 and acl.privilege_type in
            ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
        ) else
          has_table_privilege(role_name,'public.'||class.relname,'INSERT')
          or has_table_privilege(role_name,'public.'||class.relname,'UPDATE')
          or has_table_privilege(role_name,'public.'||class.relname,'DELETE')
          or has_table_privilege(role_name,'public.'||class.relname,'TRUNCATE')
          or has_table_privilege(role_name,'public.'||class.relname,'REFERENCES')
          or has_table_privilege(role_name,'public.'||class.relname,'TRIGGER')
          or has_table_privilege(role_name,'public.'||class.relname,'MAINTAIN')
        end) as non_select_count
      from pg_class class
      join pg_namespace namespace on namespace.oid=class.relnamespace
      cross join (values ('PUBLIC'),('anon'),('authenticated'),('service_role')) roles(role_name)
      where namespace.nspname='public' and class.relkind in ('r','p')
        and class.relname like 'amv2\\_%' escape '\\'
      group by role_name
    ), function_privileges as (
      select role_name,
        count(*) filter (where case when role_name='PUBLIC' then exists (
          select 1 from aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) acl
          where acl.grantee=0 and acl.privilege_type='EXECUTE'
        ) else has_function_privilege(role_name,function.oid,'EXECUTE') end) as execute_count
      from pg_proc function
      join pg_namespace namespace on namespace.oid=function.pronamespace
      cross join (values ('PUBLIC'),('anon'),('authenticated'),('service_role')) roles(role_name)
      where namespace.nspname='public'
        and (function.proname like 'amv2\\_%' escape '\\' or function.proname='rls_auto_enable')
      group by role_name
    )
    select json_build_object(
      'tables',(select json_object_agg(role_name,json_build_object(
        'select',select_count,'non_select',non_select_count)) from table_privileges),
      'functions',(select json_object_agg(role_name,execute_count) from function_privileges),
      'event_enabled',(select evtenabled from pg_event_trigger where evtname='ensure_rls'),
      'reference_policies',(select count(*) from pg_policies where schemaname='public'
        and tablename in ('amv2_artifact_registry','amv2_canonical_exercises')
        and cmd='SELECT' and roles='{authenticated}'),
      'reference_rls',(select count(*) from pg_class class join pg_namespace namespace on namespace.oid=class.relnamespace
        where namespace.nspname='public' and class.relname in ('amv2_artifact_registry','amv2_canonical_exercises')
          and class.relrowsecurity),
      'fk_deferred',(select condeferrable and condeferred from pg_constraint
        where conrelid='public.amv2_workout_day_exercises'::regclass
          and conname='amv2_workout_day_exercises_owner_user_id_personal_exercise_fkey'),
      'metric_constraint_valid',(select convalidated from pg_constraint
        where conrelid='public.amv2_personal_exercises'::regclass
          and conname='amv2_personal_exercises_metric_type_v1_check'),
      'history_index',(to_regclass('public.amv2_day_exercises_personal_history_idx') is not null)
    )::text;
  ` });
  const matrix = parseJsonLine(privilegeProbe.stdout);
  assert.deepEqual(matrix.tables.PUBLIC, { select: 0, non_select: 0 });
  assert.deepEqual(matrix.tables.anon, { select: 0, non_select: 0 });
  assert.deepEqual(matrix.tables.authenticated, { select: 8, non_select: 0 });
  assert.deepEqual(matrix.tables.service_role, { select: 0, non_select: 0 });
  assert.equal(matrix.functions.PUBLIC, 0);
  assert.equal(matrix.functions.anon, 0);
  assert.equal(matrix.functions.authenticated, 3);
  assert.equal(matrix.functions.service_role, 0);
  assert.equal(matrix.event_enabled, "O");
  assert.equal(matrix.reference_policies, 2);
  assert.equal(matrix.reference_rls, 2);
  assert.equal(matrix.fk_deferred, true);
  assert.equal(matrix.metric_constraint_valid, true);
  assert.equal(matrix.history_index, true);

  const authenticatedReferences = await runPsql({ sql: `begin;
    set local role authenticated;
    select json_build_object(
      'artifacts',(select count(*) from public.amv2_artifact_registry),
      'canonical',(select count(*) from public.amv2_canonical_exercises)
    )::text;
    commit;` });
  const referenceCounts = parseJsonLine(authenticatedReferences.stdout);
  assert.ok(referenceCounts.artifacts > 0);
  assert.ok(referenceCounts.canonical > 0);

  const authenticatedCalendar = await runPsql({ sql: `begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '${OWNER_A}';
    select public.amv2_read_calendar('2026-01-01','2026-01-31');
    commit;` });
  assert.match(authenticatedCalendar.stdout, /snapshotRevision/);

  for (const internalTable of ["amv2_import_batches", "amv2_import_occurrences", "amv2_operation_receipts"]) {
    await assert.rejects(
      () => runPsql({ sql: `begin;
        set local role authenticated;
        select count(*) from public.${internalTable};
        rollback;` }),
      /permission denied/i,
      `${internalTable} must deny direct authenticated reads`,
    );
  }

  const graphResult = await runPsql({ file: graphProbe, quiet: false });
  assert.match(graphResult.stdout, /"account_delete_full_graph"\s*:\s*"PASS"/);
  assert.match(graphResult.stdout, /"path"\s*:\s*"direct"[\s\S]*"status"\s*:\s*"rejected"/);
  assert.match(graphResult.stdout, /"path"\s*:\s*"rpc"[\s\S]*"status"\s*:\s*"rejected"/);
  assert.match(graphResult.stdout, /"metric_types"\s*:\s*\["repetitions_only",\s*"total_duration"\]/);
});

test("real PostgreSQL rejects replica-only RLS automation before R4 changes any schema", {
  skip: realPostgresEnvironmentAvailable() ? false : "disposable real PostgreSQL environment not loaded",
  timeout: 180_000,
}, async () => {
  await installPreR4Schema();
  await runPsql({ sql: "alter event trigger ensure_rls enable replica;" });

  await assert.rejects(
    () => applyMigrationFiles(migrations.slice(-1)),
    /AMV2_R4_RLS_EVENT_TRIGGER_INVALID/,
  );
  const contractRemainedUnchanged = await runPsql({ sql: `select json_build_object(
    'event_enabled',(select evtenabled from pg_event_trigger where evtname='ensure_rls'),
    'metric_constraint',(to_regclass('public.amv2_personal_exercises') is not null and exists(
      select 1 from pg_constraint where conrelid='public.amv2_personal_exercises'::regclass
        and conname='amv2_personal_exercises_metric_type_v1_check'
    ))
  )::text;` });
  assert.deepEqual(parseJsonLine(contractRemainedUnchanged.stdout), {
    event_enabled: "R",
    metric_constraint: false,
  });
});

test("real PostgreSQL rejects wrong event tags and a no-op RLS automation body", {
  skip: realPostgresEnvironmentAvailable() ? false : "disposable real PostgreSQL environment not loaded",
  timeout: 180_000,
}, async (context) => {
  await context.test("wrong event tags", async () => {
    await installPreR4Schema();
    await runPsql({ sql: `drop event trigger ensure_rls;
      create event trigger ensure_rls on ddl_command_end
        when tag in ('CREATE VIEW') execute function public.rls_auto_enable();` });
    await assert.rejects(
      () => applyMigrationFiles(migrations.slice(-1)),
      /AMV2_R4_RLS_EVENT_TRIGGER_INVALID/,
    );
  });

  await context.test("no-op security-definer body", async () => {
    await installPreR4Schema();
    await runPsql({ sql: `create or replace function public.rls_auto_enable()
      returns event_trigger language plpgsql security definer set search_path='pg_catalog'
      as $function$ begin null; end $function$;
      alter function public.rls_auto_enable() owner to postgres;` });
    await assert.rejects(
      () => applyMigrationFiles(migrations.slice(-1)),
      /AMV2_R4_RLS_AUTOMATION_BEHAVIOR_INVALID/,
    );
    const probe = await runPsql({ sql: "select to_regclass('public.cp219r4_rls_contract_probe') is null;" });
    assert.equal(probe.stdout, "t", "failed migration must roll the empty probe back");
  });
});
