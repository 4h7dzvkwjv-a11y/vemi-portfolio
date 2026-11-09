import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CANONICAL_EXERCISE_CATALOG,
  CANONICAL_EXERCISE_CATEGORIES,
  filterCanonicalExerciseCatalog,
  resolveCanonicalExerciseCatalogItem,
} from "../lib/amv2/exercise-catalog.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("catalogul direct păstrează 114 exercise_key canonice și filtrează fără a schimba identitatea", () => {
  assert.equal(CANONICAL_EXERCISE_CATALOG.length, 114);
  assert.equal(new Set(CANONICAL_EXERCISE_CATALOG.map((item) => item.exerciseKey)).size, 114);
  assert.deepEqual(CANONICAL_EXERCISE_CATEGORIES, [
    "Piept", "Spate", "Umeri", "Biceps", "Triceps", "Picioare", "Abdomen", "Cardio", "Acasă",
  ]);
  const canonical = resolveCanonicalExerciseCatalogItem("plank-cu-greutate");
  const searched = filterCanonicalExerciseCatalog({ query: "greutate", category: "Abdomen", location: "gym" });
  assert.equal(searched.find((item) => item.exerciseKey === canonical.exerciseKey), canonical);
  assert.equal(filterCanonicalExerciseCatalog({ category: "Biceps" }).some((item) => item.exerciseKey === canonical.exerciseKey), false);
  const homeCollection = filterCanonicalExerciseCatalog({ category: "Acasă" });
  assert.ok(homeCollection.length > 0);
  assert.ok(homeCollection.every((item) => item.collections.includes("Acasă")));
  assert.ok(CANONICAL_EXERCISE_CATALOG.every((item) => !Object.hasOwn(item, "videoAvailable")));
});

test("catalogul CP219P deschide un singur exercițiu direct, fără coadă sau confirmare multiplă", async () => {
  const [panel, client] = await Promise.all([
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/amv2-client.tsx"),
  ]);
  assert.match(panel, /Catalog Exerciții/);
  assert.match(panel, />VEMI<\/button>/);
  assert.match(panel, />Personal<\/button>/);
  assert.doesNotMatch(panel, /Alege un exercițiu|Personale/);
  assert.match(panel, /onSelectExercise\(exercise\.exerciseKey\)/);
  assert.match(panel, /Caută exerciții/);
  assert.match(panel, /category/);
  assert.doesNotMatch(panel, /locationCopy|locationLabel|Catalog canonic/);
  assert.match(client, /selectCatalogExercise/);
  assert.match(client, /setEditor\(\{ mode: "new", exercise \}\)/);
  assert.doesNotMatch(panel + client, /pendingExerciseKeys|togglePending|multi-select|Adaugă \d+ exerciții/i);
  assert.doesNotMatch(panel, /type="checkbox"|aria-pressed=\{selected\}/);
});

test("duplicatul canonic deschide editorul existent iar exercițiul 11 este blocat înainte de creare", async () => {
  const [panel, client, domain] = await Promise.all([
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/amv2-client.tsx"),
    read("lib/amv2/workout-day-domain.mjs"),
  ]);
  assert.match(client, /reference\.exerciseKey === exerciseKey/);
  assert.match(client, /openExerciseEditor\(existing\)/);
  assert.match(client, /WORKOUT_DAY_LIMITS\.exercises\.max/);
  assert.match(domain, /DUPLICATE_EXERCISE/);
  assert.match(domain, /maximum 10 exerciții/);
  assert.match(panel, /disabled=\{capacityFull && !alreadyAdded\}/);
  assert.match(panel, /alreadyAdded \? `Modifică/);
  assert.doesNotMatch(panel + client, /13\s*[–-]\s*19|20 din 20|slot 20|capacity warning/i);
});

test("metricul rămâne exclusiv Gate 0C și nu apare niciun selector în Add Exercise", async () => {
  const [adapter, factory, client, panel] = await Promise.all([
    read("lib/amv2/exercise-metric-map.mjs"),
    read("lib/amv2/workout-day-domain.mjs"),
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/add-exercises-panel.tsx"),
  ]);
  assert.match(adapter, /exercise-metric-map\.v1\.4\.json/);
  assert.match(factory, /resolveCanonicalExerciseMetric/);
  assert.match(factory, /CANONICAL_METRIC_OVERRIDE_FORBIDDEN/);
  assert.doesNotMatch(panel, /<select|Cum se măsoară\?|Timp \+ greutate|time_weight_per_set|metricType\s*:/i);
  assert.match(client, /createWorkoutDayExercise\(input\)/);
});
