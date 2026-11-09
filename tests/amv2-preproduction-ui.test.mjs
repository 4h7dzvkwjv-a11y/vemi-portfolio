import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { getAmv2PublicApiError } from "../lib/amv2/public-api-error.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("clientul CP219P păstrează local-first fără mesaje persistente de stare în produs", async () => {
  const [client, cloud, durable] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("lib/amv2/cloud-sync-client.ts"),
    read("lib/amv2/durable-local-store.mjs"),
  ]);
  for (const copy of ["Salvat pe acest dispozitiv", "Se salvează", "Salvat în cont", "Fără conexiune · salvat local"]) {
    assert.doesNotMatch(client, new RegExp(copy));
  }
  assert.match(client, /commitWorkoutDayMutation/);
  assert.match(client, /commitPersonalMutation/);
  assert.match(client, /onAuthStateChange/);
  assert.match(client, /const flushKey = `\$\{scope\.key\}:\$\{token\.epoch\}`/);
  assert.match(client, /expectedSyncRevision: syncRevisionRef\.current/);
  assert.match(client, /isStaleSyncRevision/);
  assert.equal(
    (client.match(/reloadAlreadyCommittedMutation\(/g) ?? []).length,
    (client.match(/store\.commit(?:WorkoutDay|Personal)Mutation\(/g) ?? []).length,
    "fiecare commit day/Personal/import trebuie să reîncarce proiecția la retry idempotent");
  assert.match(client, /reconcileCloudConflictOwnerProjection/);
  assert.match(client, /enqueueAccountOperation/);
  assert.match(client, /Salvează explicit ziua în cont/);
  assert.match(client, /localOnlyDayDatesRef/);
  assert.match(client, /localOnlyPersonalIdsRef/);
  assert.match(client, /Păstrează versiunea locală/);
  assert.match(client, /Folosește versiunea din cont/);
  assert.match(cloud, /response\.ok/);
  assert.match(durable, /indexedDB|openAmv2DurableStore/);
  const transitionIndex = client.indexOf("beginScopeTransition(scope)");
  const clearIndex = client.indexOf("clearOwnerProjection()", transitionIndex);
  const firstAwaitIndex = client.indexOf("await openStore()", transitionIndex);
  assert.ok(transitionIndex > -1 && clearIndex > transitionIndex && firstAwaitIndex > clearIndex,
    "proiecția ownerului precedent trebuie golită sincron înaintea primei hidratări async");
  assert.doesNotMatch(client, /readWorkoutCalendar\(window\.localStorage|readAccountSyncEnvelope\(window\.localStorage/);
  assert.doesNotMatch(client, /\.from\(|\.rpc\(|service_role/i);
});

test("Personal Exercises urmează catalogul și formularul Figma fără a expune șablonul intern", async () => {
  const [panel, editor, domain, client] = await Promise.all([
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/personal-exercise-editor.tsx"),
    read("lib/amv2/personal-exercise-domain.mjs"),
    read("components/amv2/amv2-client.tsx"),
  ]);
  assert.match(panel, />Personal<\/button>/);
  assert.match(panel, /Creează exercițiu/);
  assert.doesNotMatch(panel, /Exercițiile mele|Personale/);
  assert.match(panel, /Șterge/);
  assert.doesNotMatch(panel, /Arhivează|Model VEMI|metric metadata/i);
  assert.match(panel, /Salvează în cont/);
  assert.match(editor, /Creează exercițiu/);
  assert.match(editor, /NUME/);
  assert.match(editor, /CATEGORIE/);
  assert.match(editor, /TIP EXERCIȚIU/);
  assert.match(editor, /Repetări \+ greutate/);
  assert.match(editor, /Repetări/);
  assert.match(editor, /Timp/);
  assert.doesNotMatch(editor, /Model VEMI|Durată totală|Timp \+ greutate|templateExerciseKey/);
  assert.match(domain, /PERSONAL_TEMPLATE_BY_METRIC/);
  assert.match(domain, /PERSONAL_INTERNAL_TEMPLATE_OVERRIDE_FORBIDDEN/);
  assert.match(client, /createPersonalWorkoutDayExercise/);
  assert.doesNotMatch(panel + editor, /metric_type|Cum se măsoară\?|Timp \+ greutate/);
});

test("compatibilitatea V1 este explicită, nu suprascrie ziua și păstrează sursa", async () => {
  const [client, catalog, panel, compatibility] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/v1-import-panel.tsx"),
    read("lib/amv2/v1-compatibility.mjs"),
  ]);
  assert.match(catalog, /Copiază explicit din V1/);
  assert.match(client, /openV1Import/);
  assert.match(panel, /Sursa rămâne neschimbată/);
  assert.match(compatibility, /DESTINATION_DAY_EXISTS/);
  assert.match(compatibility, /fără ambiguitate/);
  assert.doesNotMatch(compatibility, /removeItem|clear\(/);
});

test("endpointul AMV2 derivă owner-ul din claims și folosește numai RPC-ul atomic", async () => {
  const route = await read("app/api/amv2/sync/route.ts");
  assert.match(route, /getClaims\(\)/);
  assert.match(route, /claims\?\.sub/);
  assert.match(route, /if \(!userId\) return json\(\{ authenticated: false \}\);/);
  assert.match(route, /if \(!userId\) return json\(\{ authenticated: false \}, 401\);/);
  assert.match(route, /amv2_apply_operation/);
  assert.doesNotMatch(route, /owner_user_id\s*:\s*body|service_role|SUPABASE_SERVICE_ROLE/);
  assert.equal(getAmv2PublicApiError("conflict").body.code, "CONFLICT");
  assert.equal(getAmv2PublicApiError("conflict").status, 409);
  assert.match(route, /remoteCandidate: authoritative\.canonicalCandidate/);
  assert.match(route, /remoteDeleted: authoritative\.deleted/);
});

test("migrarea este aditivă, owner-safe și nu acordă scrieri anonime", async () => {
  const [migration, personalMigration, recovery, packageJson] = await Promise.all([
    read("supabase/migrations/202608210001_amv2_workout_day_cloud_preproduction.sql"),
    read("supabase/migrations/202608210002_amv2_personal_exercises_final_figma.sql"),
    read("scripts/amv2/cp219-recovery.sql"),
    read("package.json"),
  ]);
  for (const table of ["amv2_workout_days", "amv2_workout_day_exercises", "amv2_workout_day_sets", "amv2_personal_exercises", "amv2_operation_receipts", "amv2_import_batches"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration, /security definer set search_path = ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /force row level security/g);
  assert.match(migration, /revoke all[\s\S]*from public,anon,authenticated/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|truncate|references|trigger).*anon/i);
  assert.doesNotMatch(migration, /service_role/i);
  assert.match(personalMigration, /personal_template_exercise_key/);
  assert.match(personalMigration, /'Piept','Spate','Umeri','Biceps','Triceps','Picioare','Abdomen','Cardio','Acasă'/);
  assert.match(personalMigration, /security definer set search_path = ''/);
  assert.match(personalMigration, /AMV2_PERSONAL_SNAPSHOT_OVERRIDE_FORBIDDEN/);
  assert.doesNotMatch(personalMigration, /grant (?:insert|update|delete|truncate|references|trigger).*anon/i);
  assert.match(recovery, /REVIEW AND RUN ONLY AFTER A SEPARATE BACKUP\/AUTHORIZATION/);
  assert.equal(JSON.parse(packageJson).devDependencies["@electric-sql/pglite"], "0.5.5");
});
