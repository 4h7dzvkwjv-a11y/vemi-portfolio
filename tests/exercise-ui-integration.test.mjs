import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("/exercitii, Planuri gratuite și Antrenamentul meu primesc exclusiv catalogul live", async () => {
  const [exercisePage, freePlanPage, workoutPage, clientPage] = await Promise.all([
    read("app/exercitii/page.tsx"),
    read("app/planuri-gratuite/page.tsx"),
    read("app/antrenamentul-meu/page.tsx"),
    read("components/vemi-page.tsx"),
  ]);

  for (const page of [exercisePage, freePlanPage, workoutPage]) {
    assert.match(page, /loadLiveExerciseCatalog/);
    assert.match(page, /exerciseCatalog=\{exerciseCatalog\}/);
    assert.doesNotMatch(page, /STATIC_EXERCISE_CATALOG|EXERCISE_CATALOG|lib\/exercises\/catalog["']/);
  }
  assert.doesNotMatch(clientPage, /EXERCISE_CATALOG|EXERCISE_ALIASES|resolveExerciseKey/);
  assert.match(clientPage, /data-catalog-source=\{exerciseCatalog\?\.source \?\? "unavailable"\}/);
});

test("loaderul live folosește patru citiri batch, RLS și numai exerciții active", async () => {
  const loader = await read("lib/exercises/live-catalog.ts");

  assert.match(loader, /Promise\.all\(\[/);
  for (const table of ["exercises", "exercise_collection_memberships", "exercise_aliases", "exercise_videos"]) {
    assert.match(loader, new RegExp(`\\.from\\("${table}"\\)`));
  }
  assert.ok((loader.match(/\.eq\("is_active", true\)/g) ?? []).length >= 1);
  assert.match(loader, /normalizeAuthoritativeVideoEligibility/);
  assert.match(loader, /recommended_display/);
  assert.match(loader, /instruction_1/);
  assert.match(loader, /instruction_2/);
  assert.match(loader, /order_index/);
  assert.match(loader, /order_index nu este continuu/);
  assert.doesNotMatch(loader, /service[_-]?role|SUPABASE_SECRET|\.insert\(|\.update\(|\.delete\(|\.upsert\(/i);
});

test("filtrarea, ordinea și căutarea folosesc memberships și aliasurile live", async () => {
  const [model, clientPage] = await Promise.all([
    read("lib/exercises/catalog-model.ts"),
    read("components/vemi-page.tsx"),
  ]);

  assert.match(model, /exerciseHasCollection/);
  assert.match(model, /exerciseMembershipOrder/);
  assert.match(model, /sortCatalogExercises/);
  assert.match(model, /\[exercise\.name, \.\.\.exercise\.aliases\]/);
  assert.match(clientPage, /exerciseHasCollection\(exercise, publicExerciseGroup\)/);
  assert.match(clientPage, /sortCatalogExercises\(filtered, publicExerciseGroup === "toate"/);
  assert.match(clientPage, /EXERCISE_COLLECTION_LABELS\[collectionKey\]/);
  assert.doesNotMatch(clientPage, /exercise\.group === publicExerciseGroup/);
});

test("cardurile afișează metadata editorială live și păstrează excepțiile fără video", async () => {
  const [loader, eligibility, clientPage] = await Promise.all([
    read("lib/exercises/live-catalog.ts"),
    read("lib/exercises/video-eligibility.mjs"),
    read("components/vemi-page.tsx"),
  ]);

  assert.match(clientPage, /recommendedTarget=\{exercise\.recommendedTarget\}/);
  assert.match(clientPage, /guidance1=\{exercise\.guidance1\}/);
  assert.match(clientPage, /guidance2=\{exercise\.guidance2\}/);
  assert.match(clientPage, /exercise\.videoState === "not-required"/);
  for (const key of ["mers-rapid-pe-banda", "bicicleta-stationara", "bicicleta-eliptica"]) {
    assert.match(eligibility, new RegExp(`"${key}"`));
    assert.doesNotMatch(loader, new RegExp(key));
  }
  assert.doesNotMatch(clientPage, /Conținut controlat, temporar|Catalogul final va furniza/);
});

test("salvarea selectorului validează cheile active data-driven și păstrează fallback-ul legacy", async () => {
  const route = await read("app/api/progress/route.ts");

  assert.match(route, /createProgressExerciseKeyResolver/);
  assert.match(route, /\.from\("exercises"\)[\s\S]*\.eq\("is_active", true\)/);
  assert.match(route, /\.from\("exercise_aliases"\)/);
  assert.match(route, /activeKeys\.has\(exerciseKey\)/);
  assert.match(route, /keyByName\.get\(normalizeExerciseSearchText\(exerciseName\)\)/);
  assert.match(route, /requireLegacyExerciseKey\(exerciseKey, exerciseName\)/);
  assert.match(route, /id: exercise\.exercise_key/);
  assert.doesNotMatch(route, /service[_-]?role|SUPABASE_SECRET/i);
});

test("ruta video publică validează exercițiul activ din DB, nu din catalogul static", async () => {
  const route = await read("app/api/exercises/[exerciseKey]/video/route.ts");

  assert.match(route, /exercise:exercises!inner\(canonical_name\)/);
  assert.match(route, /\.eq\("exercise\.is_active", true\)/);
  assert.match(route, /\.eq\("exercise_key", exerciseKey\)/);
  assert.doesNotMatch(route, /getExerciseByKey|lib\/exercises\/catalog/);
  assert.doesNotMatch(route, /R2_WRITE|uploadR2Object/);
});
