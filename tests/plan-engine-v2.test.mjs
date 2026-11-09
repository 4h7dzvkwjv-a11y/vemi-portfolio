import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SCORE_WEIGHTS,
  VALID_PROGRAMS,
  auditGeneratedPlanV2,
  enumerateValidV2Profiles,
  generatePlanV2,
  validateV2Registry,
} from "../lib/plan-engine/v2-runtime.mjs";
import { cat1HomeExerciseApprovedForGender } from "../lib/plan-engine/cat1-home-editorial.mjs";
import { cat2HomeExerciseApprovedForGender } from "../lib/plan-engine/cat2-home-editorial.mjs";
import { cat3HomeExerciseApprovedForGender } from "../lib/plan-engine/cat3-home-editorial.mjs";
import {
  catalog,
  catalogByKey,
  exerciseSignature,
  manifest,
  manifestSha256,
  parameterSignature,
  registry,
  ruleByKey,
} from "./helpers/plan-engine-v2-fixture.mjs";

const EXPECTED_MANIFEST_SHA256 = "90dbf41cb202089cc8e39f80c49b115cd8ca93904282802e841b64e21302f8de";
const profiles = enumerateValidV2Profiles();

function requirePlan(profile) {
  const result = generatePlanV2(profile, catalog, registry);
  assert.equal(result.status, "found", result.issues?.join("\n"));
  return result.plan;
}

function allExercises(plan) {
  return plan.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises));
}

function weekExerciseSignature(week) {
  return week.days.map((day) => day.exercises.map((exercise) => exercise.exerciseKey).join(",")).join("|");
}

test("manifestul canonic și registry-ul Punctului 2 sunt complete 114/114", () => {
  assert.equal(manifestSha256, EXPECTED_MANIFEST_SHA256);
  assert.equal(manifest.exercises.length, 114);
  assert.equal(manifest.contract.point_2_schema_version, "vemi-point-2-1.0");
  assert.ok(manifest.exercises.every((exercise) => exercise.generation.needs_point_2_review === false));
  assert.equal(registry.source_manifest.sha256, EXPECTED_MANIFEST_SHA256);
  assert.equal(registry.rules.length, 114);
  assert.deepEqual(validateV2Registry(catalog, registry), { valid: true, issues: [] });
});

test("matricea canonică are 168 combinații după restrângerea CAT4", () => {
  assert.equal(profiles.length, 168);
  assert.equal(profiles.filter((profile) => profile.age !== "60+").length, 144);
  assert.equal(profiles.filter((profile) => profile.age === "60+" && profile.place === "acasa").length, 12);
  assert.equal(profiles.filter((profile) => profile.age === "60+" && profile.place === "sala").length, 12);
  assert.deepEqual(Object.keys(VALID_PROGRAMS), ["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
});

test("toate cele 168 de combinații sunt deterministe în minimum trei rulări", () => {
  for (const profile of profiles) {
    const first = requirePlan(profile);
    const second = requirePlan(profile);
    const third = requirePlan(profile);
    assert.equal(parameterSignature(first), parameterSignature(second));
    assert.equal(parameterSignature(first), parameterSignature(third));
  }
});

test("fiecare plan respectă locația, nivelul, rotația, excluderile și frecvența", () => {
  for (const profile of profiles) {
    const plan = requirePlan(profile);
    const expectedDays = VALID_PROGRAMS[profile.program].daysPerWeek;
    const validation = auditGeneratedPlanV2(plan, catalog, registry);
    assert.equal(validation.valid, true, `${plan.planKey}\n${validation.issues.join("\n")}`);
    assert.equal(plan.weeks.length, 4);
    for (const week of plan.weeks) {
      assert.equal(week.days.length, expectedDays);
      for (const day of week.days) {
        const cat1HomeEditorial = profile.age === "18-29" && profile.place === "acasa";
        const cat2Editorial = profile.age === "30-44";
        const completeEditorial = cat1HomeEditorial || profile.age === "60+" || profile.age === "45-59" || cat2Editorial;
        if (completeEditorial) {
          const expectedCount = profile.age === "60+"
            ? profile.program === "incepator-3" ? 3 : 4
            : profile.age === "30-44" && profile.place === "sala"
              ? profile.program.startsWith("incepator") ? 4 : profile.gender === "feminin" ? 5 : 6
            : profile.place === "sala" && profile.program === "avansat-4" && day.dayNumber === 3
              ? 4
              : profile.program.startsWith("incepator") ? 4 : 5;
          assert.equal(day.exercises.length, expectedCount);
        } else {
          assert.ok(day.exercises.length >= 4 && day.exercises.length <= 6);
        }
        assert.equal(new Set(day.exercises.map((exercise) => exercise.exerciseKey)).size, day.exercises.length);
        for (const exercise of day.exercises) {
          const liveExercise = catalogByKey.get(exercise.exerciseKey);
          const rule = ruleByKey.get(exercise.exerciseKey);
          assert.ok(liveExercise?.places.includes(profile.place));
          assert.ok(rule?.places.includes(profile.place));
          const cat4GymEditorial = profile.age === "60+" && profile.place === "sala";
          if (!cat4GymEditorial) assert.ok(rule?.level.eligible.includes(VALID_PROGRAMS[profile.program].level));
          const priority = profile.gender === "masculin" ? rule.male_priority : rule.female_priority;
          assert.ok(priority > 0
            || cat1HomeExerciseApprovedForGender(profile, exercise.exerciseKey)
            || cat2HomeExerciseApprovedForGender(profile, exercise.exerciseKey)
            || cat3HomeExerciseApprovedForGender(profile, exercise.exerciseKey));
        }
      }
    }
  }
});

test("toate cele 168 de planuri editoriale au patru săptămâni distincte", () => {
  for (const profile of profiles) {
    const plan = requirePlan(profile);
    assert.equal(new Set(plan.weeks.map(weekExerciseSignature)).size, 4, plan.planKey);
  }
});

test("sexul, vârsta, obiectivul și nivelul influențează selecția conform scoring-ului", () => {
  const base = { age: "30-44", goal: "forma", place: "sala", program: "avansat-4" };
  const male = requirePlan({ ...base, gender: "masculin" });
  const female = requirePlan({ ...base, gender: "feminin" });
  assert.notEqual(exerciseSignature(male), exerciseSignature(female));
  assert.equal(SCORE_WEIGHTS.genderPriority, 5);

  const younger = requirePlan({ ...base, gender: "masculin", age: "18-29" });
  const older = requirePlan({ ...base, gender: "masculin", age: "60+" });
  const countAgeClass = (plan, selection) => allExercises(plan)
    .filter((exercise) => ruleByKey.get(exercise.exerciseKey).age_60_plus.selection === selection).length;
  assert.notEqual(exerciseSignature(younger), exerciseSignature(older));
  assert.ok(countAgeClass(older, "preferred") > countAgeClass(younger, "preferred"));
  assert.ok(countAgeClass(older, "not_default") < countAgeClass(younger, "not_default"));

  const mass = requirePlan({ ...base, gender: "masculin", age: "18-29", goal: "masa" });
  const weightLoss = requirePlan({ ...base, gender: "masculin", age: "18-29", goal: "slabire" });
  const cardioCount = (plan) => allExercises(plan).filter((exercise) => exercise.kind === "cardio").length;
  assert.notEqual(exerciseSignature(mass), exerciseSignature(weightLoss));
  assert.equal(cardioCount(mass), 0);
  assert.equal(cardioCount(weightLoss), 0);

  const beginner = requirePlan({ ...base, gender: "feminin", goal: "masa", program: "incepator-4" });
  const advanced = requirePlan({ ...base, gender: "feminin", goal: "masa", program: "avansat-4" });
  const volume = (plan) => allExercises(plan).reduce((total, exercise) => total + exercise.sets, 0);
  assert.notEqual(exerciseSignature(beginner), exerciseSignature(advanced));
  assert.ok(volume(advanced) > volume(beginner));
});

test("catalogul incomplet sau cu o cheie inactivă/necunoscută este respins fără fallback", () => {
  const result = generatePlanV2(profiles[0], catalog.slice(1), registry);
  assert.equal(result.status, "invalid_registry");
  assert.match(result.issues.join("\n"), /exact 114|nu are exercițiu activ/i);
  const unknownCatalog = structuredClone(catalog);
  unknownCatalog[0].id = "legacy-inactive-necunoscut";
  const unknownResult = generatePlanV2(profiles[0], unknownCatalog, registry);
  assert.equal(unknownResult.status, "invalid_registry");
  assert.match(unknownResult.issues.join("\n"), /nu are exercițiu activ|nu are Punctul 2/i);
});

test("Plan Engine V2 folosește batch-ul live, păstrează V1 și nu atinge Recommendation Engine", async () => {
  const [page, publicIntegration, publicRoute, progressRoute, anonymousProgress] = await Promise.all([
    readFile(new URL("../components/vemi-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/plan-engine/public-v2-integration.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/planuri-gratuite/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/progress/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../utils/progress/anonymous.ts", import.meta.url), "utf8"),
  ]);
  assert.match(publicRoute, /loadLiveExerciseCatalog/);
  assert.match(page, /resolvePublicV2Plan/);
  assert.doesNotMatch(page, /generatePlanV2/);
  assert.match(publicIntegration, /generatePlanV2/);
  assert.match(publicIntegration, /fallbackUsed: false/);
  assert.match(page, /finalizeFreePlanSelections/);
  assert.match(publicIntegration, /engineVersion: PLAN_ENGINE_V2/);
  assert.match(page, /const gymWorkouts/);
  assert.match(page, /const homeWorkouts/);
  assert.match(page, /legacyPlanWorkouts/);
  assert.match(page, /catalogReadyForV2 \? exerciseLibrary : \[\]/);
  assert.match(page, /resolvePublicV2Plan\([\s\S]*?liveExerciseLibrary,[\s\S]*?point2Registry/);
  assert.match(page, /Planul nu poate fi generat în siguranță momentan/);
  assert.doesNotMatch(page, /Math\.random\(/);
  assert.match(progressRoute, /plan:v2:/);
  assert.match(progressRoute, /normalizePublicV2Selections/);
  assert.match(progressRoute, /requireFreePlanSelections/);
  assert.match(progressRoute, /Selecția planului nu este validă/);
  assert.match(progressRoute, /total_workouts: daysPerWeek \* 4/);
  assert.match(progressRoute, /startsWith\("plan:v2:"\) \? "v2"/);
  assert.match(anonymousProgress, /engineVersion/);
  assert.match(anonymousProgress, /input\.engineVersion === "v1" \|\| place \? "v1"/);
  assert.doesNotMatch(page, /Recommendation Engine|recommendation-engine/i);
});
