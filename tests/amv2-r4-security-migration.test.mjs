import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const remoteArtifactUrl = new URL(
  "../supabase/migrations/20260808223331_catalog_editorial_db_remediation.sql",
  import.meta.url,
);
const hardeningUrl = new URL(
  "../supabase/migrations/202608230001_amv2_pre_cutover_security_hardening.sql",
  import.meta.url,
);

const tables = [
  "amv2_artifact_registry",
  "amv2_canonical_exercises",
  "amv2_import_batches",
  "amv2_import_occurrences",
  "amv2_operation_receipts",
  "amv2_owner_sync_state",
  "amv2_personal_exercises",
  "amv2_workout_day_exercises",
  "amv2_workout_day_sets",
  "amv2_workout_day_tombstones",
  "amv2_workout_days",
];
const authenticatedReadTables = [
  "amv2_artifact_registry",
  "amv2_canonical_exercises",
  "amv2_owner_sync_state",
  "amv2_personal_exercises",
  "amv2_workout_day_exercises",
  "amv2_workout_day_sets",
  "amv2_workout_day_tombstones",
  "amv2_workout_days",
];

test("the reconciled remote-only migration retains its official bytes", async () => {
  const artifact = await readFile(remoteArtifactUrl);
  assert.equal(artifact.byteLength, 1_373);
  assert.equal(
    createHash("sha256").update(artifact).digest("hex"),
    "782bbd8fb9c884a1c76fc536eee169e5e9bba4dde09c090a6b711d0a6078f4ac",
  );
  assert.equal(artifact.at(-1), ";".charCodeAt(0), "official artifact has no terminal newline");
});

test("R4 hardening is transactional, guarded and finalizes every current AMV2 table", async () => {
  const sql = await readFile(hardeningUrl, "utf8");
  assert.match(sql, /^begin;\s/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /alter\s+default\s+privileges/i);
  assert.doesNotMatch(
    sql.replace("drop table public.cp219r4_rls_contract_probe;", ""),
    /\b(drop\s+table|truncate\s+table)\b/i,
  );
  assert.match(sql, /class\.relkind in \('r','p','v','m','f'\)/);
  assert.match(sql, /AMV2_R4_UNREVIEWED_RELATION/);
  assert.match(sql, /AMV2_R4_UNREVIEWED_SEQUENCE/);
  assert.match(sql, /AMV2_R4_UNREVIEWED_FUNCTION/);
  assert.match(sql, /function\.proowner = 'postgres'::regrole/);
  assert.match(sql, /function\.prosecdef/);
  assert.match(sql, /function\.proconfig = array\['search_path=pg_catalog'\]::text\[\]/);
  assert.match(sql, /evtfoid = 'public\.rls_auto_enable\(\)'::regprocedure[\s\S]*evtenabled in \('O','A'\)[\s\S]*evtevent = 'ddl_command_end'/);
  assert.match(sql, /evttags @> array\['CREATE TABLE','CREATE TABLE AS','SELECT INTO'\]::text\[\]/);
  assert.match(sql, /AMV2_R4_RLS_AUTOMATION_BEHAVIOR_INVALID/);
  assert.match(sql, /create table public\.cp219r4_rls_contract_probe \(probe boolean\);/);
  assert.match(sql, /drop table public\.cp219r4_rls_contract_probe;/);

  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated, service_role;`, "i"),
    );
  }
  for (const table of authenticatedReadTables) {
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated;`, "i"));
  }
  for (const table of tables.filter((table) => !authenticatedReadTables.includes(table))) {
    assert.doesNotMatch(sql, new RegExp(`grant select on table public\\.${table} to authenticated;`, "i"));
  }
});

test("R4 exposes only authenticated AMV2 RPCs and explicit reference reads", async () => {
  const sql = await readFile(hardeningUrl, "utf8");
  assert.match(sql, /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated, service_role;/i);
  for (const signature of [
    "amv2_apply_operation\\(text,text,bigint,jsonb\\)",
    "amv2_read_calendar\\(date,date\\)",
    "amv2_read_history_page\\(date,integer,bigint\\)",
  ]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, "i"));
  }
  assert.match(sql, /create policy amv2_artifact_authenticated_select[\s\S]*to authenticated using \(true\);/i);
  assert.match(sql, /create policy amv2_canonical_authenticated_select[\s\S]*to authenticated using \(true\);/i);
});

test("R4 defers Personal history deletion and rejects unsupported Personal metrics", async () => {
  const sql = await readFile(hardeningUrl, "utf8");
  assert.match(sql, /foreign key \(owner_user_id, personal_exercise_id\)[\s\S]*on delete no action[\s\S]*deferrable initially deferred/i);
  assert.match(sql, /AMV2_R4_INCOMPATIBLE_PERSONAL_METRIC_ROWS/);
  assert.match(sql, /check \(metric_type in \('repetitions_weight','repetitions_only','time_per_set'\)\)/i);
  assert.doesNotMatch(
    sql.match(/add constraint amv2_personal_exercises_metric_type_v1_check[\s\S]*?not valid;/i)?.[0] ?? "",
    /total_duration/i,
  );
});
