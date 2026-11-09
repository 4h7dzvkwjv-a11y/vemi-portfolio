import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readBytes = (path) => readFile(new URL(`../${path}`, import.meta.url));

test("ruta AMV2 rămâne aditivă și nu montează sau modifică motorul AMV1", async () => {
  const [route, client, header, amv1Route, amv1Page] = await Promise.all([
    read("app/antrenamentul-meu-v2/page.tsx"),
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/amv2-header.tsx"),
    read("app/antrenamentul-meu/page.tsx"),
    read("components/vemi-page.tsx"),
  ]);
  assert.match(route, /Amv2Client/);
  assert.doesNotMatch(route, /VemiPage|loadLiveExerciseCatalog|supabase|progress|auth/i);
  assert.match(client, /data-amv2-route="calendar-workout-log"/);
  assert.doesNotMatch(client, /loadLiveExerciseCatalog|ExerciseVideo|\/api\/progress/i);
  assert.match(header, /VemiNavigationDrawer knownHasWorkout=\{null\}/);
  assert.match(amv1Route, /VemiPage workoutOnly/);
  assert.match(amv1Route, /loadLiveExerciseCatalog/);
  assert.doesNotMatch(amv1Route + amv1Page, /amv2|antrenamentul-meu-v2/i);
});

test("Gate 0C rămâne byte-identic și unica autoritate metrică", async () => {
  const [mappingBytes, manifestBytes, adapter, dayDomain] = await Promise.all([
    readBytes("data/amv2/gate-0c/exercise-metric-map.v1.4.json"),
    readBytes("data/amv2/gate-0c/exercise-metric-map.v1.4.manifest.json"),
    read("lib/amv2/exercise-metric-map.mjs"),
    read("lib/amv2/workout-day-domain.mjs"),
  ]);
  assert.equal(mappingBytes.length, 28_948);
  assert.equal(createHash("sha256").update(mappingBytes).digest("hex"), "94dc6c256d407f89deb121aca18215e52ddb045288e50ebcd7f86464886917fa");
  assert.equal(manifestBytes.length, 2_304);
  assert.equal(createHash("sha256").update(manifestBytes).digest("hex"), "e99f0c853df569486df7fc895644573eaddb9a571fb943593338d7d4c10b8c98");
  assert.match(adapter, /exercise-metric-map\.v1\.4\.json/);
  assert.match(dayDomain, /resolveCanonicalExerciseMetric/);
  assert.match(dayDomain, /CANONICAL_METRIC_OVERRIDE_FORBIDDEN/);
});

test("calendarul derivă markerii din categoria canonică și afișează maximum patru plus N", async () => {
  const [calendar, domain, client] = await Promise.all([
    read("components/amv2/monthly-workout-calendar.tsx"),
    read("lib/amv2/workout-day-domain.mjs"),
    read("components/amv2/amv2-client.tsx"),
  ]);
  assert.match(calendar, /deriveWorkoutDayMuscleGroups/);
  assert.match(calendar, /visibleCalendarMarkers/);
  assert.match(calendar, /\+\{overflow\}/);
  assert.match(domain, /resolveCanonicalExerciseCatalogItem/);
  assert.match(domain, /seen\.has\(category\)/);
  assert.doesNotMatch(domain, /displayName.*marker|persist.*marker/i);
  assert.match(client, /selectedDayBadges/);
});

test("persistența WorkoutDay este separată, atomică și lasă v3 neatins", async () => {
  const [client, calendarLocal, legacyLocal] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("lib/amv2/workout-calendar-local.mjs"),
    read("lib/amv2/local-schema-v3.mjs"),
  ]);
  assert.match(calendarLocal, /vemi-amv2-workout-calendar-v1/);
  assert.match(calendarLocal, /vemi-amv2-local-v3/);
  assert.match(calendarLocal, /storage\.setItem\(AMV2_WORKOUT_CALENDAR_STORAGE_KEY/);
  assert.match(legacyLocal, /vemi-amv2-local-v3/);
  assert.doesNotMatch(client + calendarLocal, /localStorage\.(?:clear|removeItem)/);
  assert.doesNotMatch(client + calendarLocal, /vemi-anonymous-progress-v2|vemi-custom-workouts|vemi-authenticated-progress-cache-v2/);
});

test("suprafețele session/history CP217 nu mai sunt conectate în produsul vizibil", async () => {
  const client = await read("components/amv2/amv2-client.tsx");
  assert.doesNotMatch(client, /ActiveSessionView|CompletedHistoryView|HistoryDetailView|startLocalSession|completeActiveSession|abandonActiveSession/);
  assert.doesNotMatch(client, /active-session-view|workout-history|local-engine|session-domain/);
  assert.doesNotMatch(client, /Începe antrenamentul|Reia antrenamentul|Încheie antrenamentul|Abandonează antrenamentul|Istoric sesiuni/);
});

test("layoutul păstrează gramatica AMV2 și protecția mobilă 360/390", async () => {
  const css = await read("components/amv2/amv2.module.css");
  assert.match(css, /calendarGrid/);
  assert.match(css, /grid-template-columns:\s*repeat\(7/);
  assert.match(css, /@media \(max-width: 370px\)/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.doesNotMatch(css, /WebGL|backdrop-filter:\s*blur|animation:\s*.*infinite/i);
});
