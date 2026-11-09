import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("migrarea Modulului 2 activează RLS pe fiecare tabel personal", async () => {
  const migration = await read("supabase/migrations/202608040002_vemi_progress.sql");
  const tables = [
    "user_free_plans",
    "custom_workouts",
    "custom_workout_exercises",
    "workout_sessions",
    "workout_exercise_logs",
  ];

  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`${table}_own_all`));
  }
  assert.ok((migration.match(/user_id = auth\.uid\(\)/g) ?? []).length >= tables.length * 2);
  assert.ok((migration.match(/revoke all on table public\./g) ?? []).length >= tables.length);
});

test("jurnalul păstrează valorile reale per exercițiu", async () => {
  const [migration, route] = await Promise.all([
    read("supabase/migrations/202608040002_vemi_progress.sql"),
    read("app/api/progress/route.ts"),
  ]);

  for (const field of ["actual_sets", "actual_reps", "actual_weight_kg", "actual_duration_seconds", "completed"]) {
    assert.match(migration, new RegExp(field));
    assert.match(route, new RegExp(field));
  }
  assert.match(route, /auth\.getClaims\(\)/);
  assert.doesNotMatch(route, /service[_-]?role|SUPABASE_SECRET/i);
});

test("pagina de progres și dashboard-ul folosesc aceeași sesiune server-side", async () => {
  const [route, dashboard, client] = await Promise.all([
    read("app/api/progress/route.ts"),
    read("app/contul-meu/page.tsx"),
    read("utils/progress/client.ts"),
  ]);
  assert.match(route, /createClient/);
  assert.match(route, /auth\.getClaims\(\)/);
  assert.match(dashboard, /auth\.getClaims\(\)/);
  assert.match(client, /fetchProgress\("\/api\/progress"/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /restoreProgressSession/);
  assert.doesNotMatch(client, /from\("|auth\.getUser/);
});

test("Contul meu afișează progresul gratuit și zona Premium blocată", async () => {
  const [page, dashboard] = await Promise.all([
    read("app/contul-meu/page.tsx"),
    read("app/contul-meu/account-client.tsx"),
  ]);

  assert.match(page, /user_free_plans/);
  assert.match(page, /workout_sessions/);
  assert.match(dashboard, /Continuă antrenamentul/);
  assert.match(dashboard, /Istoricul antrenamentelor/);
  assert.match(dashboard, /Chestionarul personal/);
  assert.match(dashboard, /Asistență WhatsApp/);
});

test("progresul anonim, coada autentificată și cloud-ul sunt stări separate", async () => {
  const [page, client, account, anonymous] = await Promise.all([
    read("components/vemi-page.tsx"),
    read("utils/progress/client.ts"),
    read("app/contul-meu/account-client.tsx"),
    read("utils/progress/anonymous.ts"),
  ]);
  assert.match(page, /loadCloudProgress/);
  assert.match(page, /saveCloudFreeWorkout/);
  assert.match(page, /saveCloudCustomWorkout/);
  assert.match(page, /finishCloudCustomWorkout/);
  assert.doesNotMatch(page, /importCloudWorkoutLogs/);
  assert.doesNotMatch(account, /importCloudWorkoutLogs|saveCloudFreePlan|saveCloudCustomWorkout/);
  assert.match(client, /vemi-authenticated-sync-queue-v2/);
  assert.match(client, /ownerUserId/);
  assert.match(anonymous, /vemi-anonymous-progress-v2/);
  assert.match(anonymous, /vemi-anonymous-import-status-v2/);
  assert.match(anonymous, /vemi-local-progress-legacy-backup-v2/);
  assert.match(anonymous, /mutation\.action === "save_free_plan" \|\| mutation\.action === "save_free_workout"/);
  assert.match(anonymous, /mutation\.action === "finish_custom_workout"/);
  assert.match(anonymous, /localStorage\.removeItem\(LEGACY_QUEUE_KEY\)/);
  assert.match(client, /if \(saved\) removeMutation/);
  assert.match(client, /flushPendingProgressMutations/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /pageshow/);
  assert.match(account, /restoreProgressSession/);
  assert.match(account, /router\.refresh\(\)/);
});

test("importul progresului anonim este explicit, verificat și poate fi amânat", async () => {
  const [account, client, route, anonymous] = await Promise.all([
    read("app/contul-meu/account-client.tsx"),
    read("utils/progress/client.ts"),
    read("app/api/progress/route.ts"),
    read("utils/progress/anonymous.ts"),
  ]);
  assert.match(account, /"Importă progresul"/);
  assert.match(account, />Nu acum<\/button>/);
  assert.match(account, /onClick=\{\(\) => void importAnonymousProgress\(\)\}/);
  assert.match(account, /cloudProgressConfirmsImport/);
  assert.match(account, /markAnonymousProgressImported/);
  assert.match(account, /Nu ai pierdut nimic\. Încearcă din nou/);
  assert.match(client, /action: "import_anonymous_progress"/);
  assert.match(client, /const cloud = await loadCloudProgress\(\)/);
  assert.match(route, /body\.action === "import_anonymous_progress"/);
  assert.match(route, /Math\.max\(existingCompleted, incomingCompleted, mergedOrdinals\.size\)/);
  assert.match(route, /anonymous:\$\{snapshot\.importId\}:\$\{log\.id\}/);
  assert.match(route, /eq\("completed_at", completedAt\)/);
  assert.match(anonymous, /status: "pending"/);
  assert.match(anonymous, /status: "imported"/);
});

test("reîncercarea finalizării unui antrenament este idempotentă", async () => {
  const [route, client] = await Promise.all([
    read("app/api/progress/route.ts"),
    read("utils/progress/client.ts"),
  ]);
  assert.match(client, /finish-custom-workout:\$\{log\.id\}/);
  assert.match(client, /inFlightMutations/);
  assert.match(route, /workoutKey = `custom:\$\{mutationId\}`/);
  assert.match(route, /eq\("workout_key", workoutKey\)\.maybeSingle/);
  assert.match(route, /delete\(\)\.eq\("session_id", sessionId\)/);
});
