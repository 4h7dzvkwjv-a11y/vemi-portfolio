import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Lipsește secțiunea ${start}`);
  assert.notEqual(to, -1, `Lipsește secțiunea ${end}`);
  return source.slice(from, to);
}

function catalogEntries(source) {
  const catalog = section(source, "export const EXERCISE_CATALOG", "export const EXERCISE_ALIASES");
  return [...catalog.matchAll(/exerciseKey: "([^"]+)", name: "([^"]+)", group: "([^"]+)"/g)]
    .map((match) => ({ key: match[1], name: match[2], group: match[3] }));
}

test("catalogul canonic conține 73 de chei stabile și unice", async () => {
  const source = await read("lib/exercises/catalog.ts");
  const exercises = catalogEntries(source);

  assert.equal(exercises.length, 73);
  assert.equal(new Set(exercises.map((exercise) => exercise.key)).size, exercises.length);
  assert.equal(new Set(exercises.map((exercise) => exercise.name)).size, exercises.length);
  for (const exercise of exercises) {
    assert.match(exercise.key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("cele nouă variante editoriale sunt exerciții canonice distincte", async () => {
  const source = await read("lib/exercises/catalog.ts");
  const keys = new Set(catalogEntries(source).map((exercise) => exercise.key));
  const variants = [
    "impins-inclinat-aparat",
    "fandari-pe-loc",
    "ramat-rucsac",
    "ramat-aparat",
    "presa-umeri",
    "tractiuni-asistate",
    "genuflexiuni-goblet",
    "dips-paralele",
    "genuflexiuni-haltera",
  ];
  for (const key of variants) assert.ok(keys.has(key), `Lipsește ${key}`);
});

test("toate exercițiile din planuri și carnet folosesc chei din catalog", async () => {
  const [catalogSource, page] = await Promise.all([
    read("lib/exercises/catalog.ts"),
    read("components/vemi-page.tsx"),
  ]);
  const keys = new Set(catalogEntries(catalogSource).map((exercise) => exercise.key));
  const plannedKeys = [...page.matchAll(/exerciseKey: "([^"]+)"/g)].map((match) => match[1]);

  assert.ok(plannedKeys.length >= 48);
  for (const key of plannedKeys) assert.ok(keys.has(key), `Cheie necunoscută în pagină: ${key}`);
  assert.doesNotMatch(page, /exercises\.map\(\(\[name/);
});

test("API-ul nu mai generează chei poziționale pentru exerciții", async () => {
  const route = await read("app/api/progress/route.ts");
  assert.match(route, /resolveExerciseKey\(exercise\.exerciseKey, exercise\.name\)/);
  assert.match(route, /resolveExerciseKey\(definition\?\.id, exercise\.name\)/);
  assert.match(route, /createProgressExerciseKeyResolver/);
  assert.match(route, /\.from\("exercises"\)/);
  assert.match(route, /\.eq\("is_active", true\)/);
  assert.doesNotMatch(route, /exercise_key:\s*`\$\{workoutKey\}:\$\{exercise\.order\}`/);
  assert.doesNotMatch(route, /exercise_key:\s*definition\?\.id\s*\?\?\s*`import-/);
});

test("migrarea conține același seed, RLS și oprire sigură pentru date necunoscute", async () => {
  const [catalogSource, migration, hosting] = await Promise.all([
    read("lib/exercises/catalog.ts"),
    read("supabase/migrations/202608040003_vemi_exercise_catalog.sql"),
    read(".openai/hosting.json"),
  ]);
  const catalogKeys = new Set(catalogEntries(catalogSource).map((exercise) => exercise.key));
  const seed = section(migration, "insert into public.exercises", "insert into public.exercise_aliases");
  const seedKeys = new Set([...seed.matchAll(/^\s*\('([^']+)',\s*'[^']+',\s*'(?:Piept|Spate|Picioare|Umeri|Biceps|Triceps|Abdomen|Cardio)'/gm)].map((match) => match[1]));

  assert.deepEqual([...seedKeys].sort(), [...catalogKeys].sort());
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
  assert.match(migration, /raise exception 'VEMI catalog migration stopped/);
  assert.match(migration, /alter table public\.exercises enable row level security/);
  assert.match(migration, /alter table public\.exercise_aliases enable row level security/);
  assert.match(migration, /foreign key \(exercise_key\) references public\.exercises\(exercise_key\)/);
  assert.doesNotMatch(migration, /exercise_videos/);
  assert.match(hosting, /"r2": null/);
});
