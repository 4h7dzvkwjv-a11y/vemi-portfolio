import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const requiredEnvironment = [
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "AMV2_POSTGRES_BIN",
];

export function realPostgresEnvironmentAvailable() {
  return requiredEnvironment.every((key) => typeof process.env[key] === "string" && process.env[key].length > 0);
}

export async function resolvePsql() {
  if (!realPostgresEnvironmentAvailable()) {
    throw new Error("AMV2_REAL_POSTGRES_ENV_REQUIRED");
  }
  const executable = path.join(process.env.AMV2_POSTGRES_BIN, "psql.exe");
  await access(executable);
  return executable;
}

export async function runPsql({ sql, file, quiet = true }) {
  const executable = await resolvePsql();
  const args = ["-X", "-v", "ON_ERROR_STOP=1"];
  if (quiet) args.push("-q", "-A", "-t");
  if (file) args.push("-f", file);
  else args.push("-c", sql);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`psql exited ${code}: ${result.stderr || result.stdout}`), { result }));
    });
  });
}

export async function initializeSupabaseTestShims(ownerIds) {
  const ownerValues = ownerIds.map((owner) => `('${owner}'::uuid)`).join(",");
  await runPsql({ sql: `
    drop schema if exists public cascade;
    create schema public authorization current_user;
    drop schema if exists auth cascade;
    create schema auth authorization current_user;
    do $block$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    end $block$;
    grant usage on schema public,auth to anon,authenticated;
    create table auth.users(id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as
      $fn$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$fn$;
    insert into auth.users(id) values ${ownerValues};
  ` });
}

export async function applyMigrationFiles(files) {
  for (const file of files) await runPsql({ file, quiet: false });
}

export function authenticatedSql(ownerId, statement) {
  return `begin;
    set local role authenticated;
    set local "request.jwt.claim.sub"='${ownerId}';
    ${statement}
    commit;`;
}
