import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export const OWNER_A = "00000000-0000-0000-0000-0000000000a1";
export const OWNER_B = "00000000-0000-0000-0000-0000000000b2";

export async function createAmv2TestDatabase({ migrationCount } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users(id) values ('${OWNER_A}'),('${OWNER_B}');
  `);
  const migrationFiles = [
    "../../supabase/migrations/202608210001_amv2_workout_day_cloud_preproduction.sql",
    "../../supabase/migrations/202608210002_amv2_personal_exercises_final_figma.sql",
    "../../supabase/migrations/202608220001_amv2_workout_day_tombstone_sync_safety.sql",
    "../../supabase/migrations/202608220002_amv2_history_coverage_v1_import_idempotency.sql",
  ];
  const selectedMigrations = migrationCount === undefined
    ? migrationFiles
    : migrationFiles.slice(0, migrationCount);
  const migration = (await Promise.all(selectedMigrations.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  await db.exec(migration);
  return { db, migration };
}

export async function asRole(db, role, ownerId = null) {
  await db.exec("reset role");
  if (ownerId === null) await db.exec("reset request.jwt.claim.sub");
  else await db.exec(`set request.jwt.claim.sub='${ownerId}'`);
  await db.exec(`set role ${role}`);
}

export async function closeAmv2TestDatabase(db) {
  await db.exec("reset role");
  await db.close();
}
