import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUBLIC_V2_FREQUENCIES_BY_LEVEL,
  enumeratePublicV2Selections,
  normalizePublicV2Selections,
  projectPublicV2Week,
  publicFrequenciesForLevel,
  publicProgramsForAge,
  publicProgramDetails,
  publicProgramForLevelFrequency,
  publicV2ProfileKey,
  resolvePublicV2Plan,
} from "../lib/plan-engine/public-v2-integration.mjs";
import {
  VALID_PROGRAMS,
  generatePlanV2,
} from "../lib/plan-engine/v2-runtime.mjs";
import {
  catalog,
  catalogByKey,
  registry,
} from "./helpers/plan-engine-v2-fixture.mjs";

const publicSelections = enumeratePublicV2Selections();

test("UI-ul public păstrează patru perechi pentru CAT1–CAT3 și două pentru CAT4", () => {
  assert.deepEqual(PUBLIC_V2_FREQUENCIES_BY_LEVEL, { incepator: [3, 4], avansat: [4, 5] });
  assert.deepEqual(publicFrequenciesForLevel("incepator"), [3, 4]);
  assert.deepEqual(publicFrequenciesForLevel("avansat"), [4, 5]);
  assert.equal(publicProgramForLevelFrequency("incepator", 3), "incepator-3");
  assert.equal(publicProgramForLevelFrequency("incepator", 4), "incepator-4");
  assert.equal(publicProgramForLevelFrequency("avansat", 4), "avansat-4");
  assert.equal(publicProgramForLevelFrequency("avansat", 5), "avansat-5");
  assert.equal(publicProgramForLevelFrequency("incepator", 5), null);
  assert.equal(publicProgramForLevelFrequency("avansat", 3), null);
  assert.deepEqual(publicProgramsForAge("cat1"), ["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
  assert.deepEqual(publicProgramsForAge("cat4"), ["incepator-3", "avansat-4"]);
  assert.deepEqual(publicProgramsForAge("60+"), ["incepator-3", "avansat-4"]);
});

test("normalizarea publică produce profilul și cheia canonică fără a expune aliasurile UI", () => {
  const result = normalizePublicV2Selections({
    gender: "feminin",
    ageCategory: "cat3",
    goal: "forma",
    place: "acasa",
    level: "incepator",
    frequency: 4,
    engineVersion: "v2",
  });
  assert.equal(result.status, "valid");
  assert.deepEqual(result.profile, {
    gender: "feminin",
    age: "45-59",
    goal: "forma",
    place: "acasa",
    program: "incepator-4",
  });
  assert.equal(result.level, "incepator");
  assert.equal(result.frequency, 4);
  assert.equal(result.canonicalKey, publicV2ProfileKey(result.profile));
  assert.equal(result.fallbackUsed, false);
});

test("matricea publică are 168 profiluri și 168 chei canonice unice", () => {
  assert.equal(publicSelections.length, 168);
  const normalized = publicSelections.map((selection) => normalizePublicV2Selections(selection));
  assert.ok(normalized.every((result) => result.status === "valid"));
  assert.equal(new Set(normalized.map((result) => result.canonicalKey)).size, 168);
  assert.equal(publicSelections.filter((selection) => selection.age !== "60+").length, 144);
  assert.equal(publicSelections.filter((selection) => selection.age === "60+" && selection.place === "acasa").length, 12);
  assert.equal(publicSelections.filter((selection) => selection.age === "60+" && selection.place === "sala").length, 12);
  assert.deepEqual(new Set(publicSelections.map((selection) => selection.program)), new Set([
    "incepator-3",
    "incepator-4",
    "avansat-4",
    "avansat-5",
  ]));
});

test("perechile invalide și orice încercare V1 sunt respinse fără fallback", () => {
  const base = { gender: "masculin", age: "30-44", goal: "masa", place: "sala", engineVersion: "v2" };
  for (const invalid of [
    { ...base, level: "incepator", frequency: 5 },
    { ...base, level: "avansat", frequency: 3 },
    { ...base, program: "avansat-3", level: "incepator", frequency: 3 },
    { ...base, program: "incepator-3", engineVersion: "v1" },
    { ...base, age: "60+", program: "incepator-4" },
    { ...base, ageCategory: "cat4", program: "avansat-5" },
  ]) {
    const result = resolvePublicV2Plan(invalid, catalog, registry);
    assert.equal(result.status, "invalid_profile");
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.engineVersion, "v2");
  }
});

test("toate cele 168 de profiluri folosesc același traseu public V2 și coincid exact cu motorul", () => {
  const fullPlanSignatures = new Set();
  for (const selection of publicSelections) {
    const first = resolvePublicV2Plan(selection, catalog, registry);
    const second = resolvePublicV2Plan(selection, catalog, registry);
    const third = resolvePublicV2Plan(selection, catalog, registry);
    assert.equal(first.status, "found", first.issues?.join("\n"));
    assert.equal(second.status, "found", second.issues?.join("\n"));
    assert.equal(third.status, "found", third.issues?.join("\n"));
    assert.equal(first.resolver, "public-v2");
    assert.equal(first.fallbackUsed, false);
    assert.equal(first.engineVersion, "v2");
    assert.equal(first.canonicalKey, first.plan.planKey);
    assert.deepEqual(first.plan, second.plan);
    assert.deepEqual(first.plan, third.plan);

    const direct = generatePlanV2(first.normalizedProfile, catalog, registry);
    assert.equal(direct.status, "found", direct.issues?.join("\n"));
    assert.deepEqual(first.plan, direct.plan);
    assert.equal(first.plan.weeks.length, 4);
    const expectedDays = VALID_PROGRAMS[first.normalizedProfile.program].daysPerWeek;
    for (let weekIndex = 0; weekIndex < 4; weekIndex += 1) {
      const week = first.plan.weeks[weekIndex];
      assert.equal(week.days.length, expectedDays);
      assert.ok(week.days.every((day) => day.exercises.length > 0));
      const projected = projectPublicV2Week(first.plan, weekIndex + 1);
      assert.deepEqual(projected, week.days.map((day) => ({
        day: day.day,
        focus: day.title,
        duration: day.duration,
        exercises: day.exercises.map((exercise) => ({
          exerciseKey: exercise.exerciseKey,
          name: exercise.name,
          target: exercise.targetDisplay,
          rest: exercise.restDisplay,
        })),
      })));
      for (const day of week.days) for (const exercise of day.exercises) {
        assert.ok(catalogByKey.has(exercise.exerciseKey));
        assert.ok(catalogByKey.get(exercise.exerciseKey).places.includes(first.normalizedProfile.place));
      }
    }
    fullPlanSignatures.add(JSON.stringify(first.plan.weeks));
  }
  assert.ok(fullPlanSignatures.size > 0 && fullPlanSignatures.size <= 168);
});

test("catalogul incomplet oprește integrarea publică și nu activează V1 sau un plan static", () => {
  const result = resolvePublicV2Plan(publicSelections[0], catalog.slice(1), registry);
  assert.equal(result.status, "invalid_registry");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.resolver, "public-v2");
  assert.match(result.issues.join("\n"), /114|exercițiu activ/i);
});

test("pagina publică folosește resolverul auditabil, păstrează V1 numai istoric și salvează navigarea", async () => {
  const [page, anonymousProgress, progressClient] = await Promise.all([
    readFile(new URL("../components/vemi-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../utils/progress/anonymous.ts", import.meta.url), "utf8"),
    readFile(new URL("../utils/progress/client.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /resolvePublicV2Plan/);
  assert.match(page, /projectPublicV2Week/);
  assert.doesNotMatch(page, /generatePlanV2/);
  assert.match(page, /createFreePlanGenerationGate/);
  assert.match(page, /finalizeFreePlanSelections/);
  assert.match(page, /Începător — 3 zile/);
  assert.doesNotMatch(page, /programLevelDraft|chooseProgramFrequency/);
  assert.match(page, /history\.replaceState/);
  assert.match(page, /legacyPlanWorkouts/);
  assert.match(page, /planEngineVersion === "v1"/);
  assert.match(anonymousProgress, /input\.engineVersion === "v1" \|\| place \? "v1"/);
  assert.match(progressClient, /engineVersion\?: "v1" \| "v2"/);
  assert.deepEqual(publicProgramDetails("avansat-5"), { level: "avansat", frequency: 5 });
});
