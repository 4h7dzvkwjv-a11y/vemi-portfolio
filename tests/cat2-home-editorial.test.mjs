import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CAT2_HOME_ADVANCED_ONLY,
  CAT2_HOME_ALLOWLIST,
  CAT2_HOME_DAILY_EXERCISE_COUNT,
  CAT2_HOME_DAY_GROUPS,
  CAT2_HOME_DAY_TITLES,
  CAT2_HOME_EDITORIAL_TEMPLATES,
  CAT2_HOME_EXERCISES,
  CAT2_HOME_GROUP_BY_EXERCISE,
  cat2HomeDailyExerciseCount,
  cat2HomeDayMatchesStructure,
  cat2HomeExerciseApprovedForGender,
  cat2HomeSameFamilyConflicts,
} from "../lib/plan-engine/cat2-home-editorial.mjs";
import { CAT3_HOME_ALLOWLIST } from "../lib/plan-engine/cat3-home-editorial.mjs";
import {
  VALID_PROGRAMS,
  auditGeneratedPlanV2,
  enumerateValidV2Profiles,
  generatePlanV2,
} from "../lib/plan-engine/v2-runtime.mjs";
import {
  projectPublicV2Week,
  resolvePublicV2Plan,
} from "../lib/plan-engine/public-v2-integration.mjs";
import {
  createPlanInstanceId,
  finalizeFreePlanSelections,
  hasCurrentFreePlanContentVersion,
  normalizeFreePlanSelectionsForCurrentContent,
  planContentVersionFromPlanKey,
  planInstanceIdFromPlanKey,
  withPlanContentVersionKey,
  withPlanInstanceKey,
} from "../utils/progress/free-plan-state.mjs";
import {
  catalog,
  catalogByKey,
  parameterSignature,
  registry,
  ruleByKey,
} from "./helpers/plan-engine-v2-fixture.mjs";

const TARGET_AGE = "30-44";
const TARGET_PLACE = "acasa";
const PROGRAMS = Object.freeze(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOALS = Object.freeze(["slabire", "masa", "forma"]);
const TARGET_PROFILES = enumerateValidV2Profiles().filter((profile) =>
  profile.age === TARGET_AGE && profile.place === TARGET_PLACE,
);
const PROTECTED_CHECKPOINT_132_SHA256 = "e920ac02ab37b8459f9db075ea07213088885489274514593a7fa2b1f3824afa";

const profileKey = (profile) => [profile.gender, profile.age, profile.goal, profile.place, profile.program].join(":");
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const planWeeks = (plan) => plan.weeks.map((week) => week.days.map((day) =>
  day.exercises.map((exercise) => exercise.exerciseKey),
));

function requirePlan(profile) {
  const result = generatePlanV2(profile, catalog, registry);
  assert.equal(result.status, "found", `${profileKey(profile)}\n${result.issues?.join("\n")}`);
  return result.plan;
}

function lowerPairFor(program) {
  if (program === "incepator-4" || program === "avansat-4") return [1, 3];
  if (program === "avansat-5") return [2, 4];
  return null;
}

function legFamily(exerciseKey) {
  const E = CAT2_HOME_EXERCISES;
  if ([E.L4, E.L5, E.L6, E.L7].includes(exerciseKey)) return "genuflexiuni";
  if ([E.L2, E.L3, E.L12].includes(exerciseKey)) return "fandari";
  if ([E.L1, E.L8, E.L9].includes(exerciseKey)) return "posterior";
  if ([E.L10, E.L11].includes(exerciseKey)) return "gambe";
  return null;
}

test("allowlistul CAT2 × Acasă este identic programatic cu allowlistul CAT3 și rezolvă 44/44", () => {
  assert.deepEqual([...CAT2_HOME_ALLOWLIST].sort(), [...CAT3_HOME_ALLOWLIST].sort());
  assert.equal(CAT2_HOME_ALLOWLIST.length, 44);
  assert.equal(new Set(CAT2_HOME_ALLOWLIST).size, 44);
  assert.equal(CAT2_HOME_ADVANCED_ONLY.length, 11);
  assert.equal(Object.keys(CAT2_HOME_GROUP_BY_EXERCISE).length, 44);
  for (const exerciseKey of CAT2_HOME_ALLOWLIST) {
    const exercise = catalogByKey.get(exerciseKey);
    const rule = ruleByKey.get(exerciseKey);
    assert.ok(exercise, exerciseKey);
    assert.ok(rule, exerciseKey);
    assert.ok(exercise.places.includes("acasa"), exerciseKey);
    assert.ok(rule.places.includes("acasa"), exerciseKey);
    assert.equal(exercise.group, CAT2_HOME_GROUP_BY_EXERCISE[exerciseKey], exerciseKey);
  }
  assert.equal(ruleByKey.get(CAT2_HOME_EXERCISES.T2).female_priority, 0);
  assert.equal(cat2HomeExerciseApprovedForGender({
    gender: "feminin",
    age: TARGET_AGE,
    goal: "forma",
    place: TARGET_PLACE,
    program: "avansat-5",
  }, CAT2_HOME_EXERCISES.T2), true);
});

test("cele 12 șabloane canonice respectă structura musculară, nivelul, familiile și rotația", () => {
  assert.deepEqual(CAT2_HOME_DAILY_EXERCISE_COUNT, {
    "incepator-3": 4,
    "incepator-4": 4,
    "avansat-4": 5,
    "avansat-5": 5,
  });
  assert.equal(Object.keys(CAT2_HOME_EDITORIAL_TEMPLATES).length, 12);
  const allUsed = new Set();
  const templateSignatures = new Set();
  for (const [templateKey, weeks] of Object.entries(CAT2_HOME_EDITORIAL_TEMPLATES)) {
    const [, program] = templateKey.split(":");
    const beginner = VALID_PROGRAMS[program].level === "incepator";
    const expectedDays = VALID_PROGRAMS[program].daysPerWeek;
    const expectedCount = CAT2_HOME_DAILY_EXERCISE_COUNT[program];
    const dailySignatures = new Set();
    assert.equal(weeks.length, 4, templateKey);
    assert.equal(new Set(weeks.map((week) => JSON.stringify(week))).size, 4, templateKey);
    for (const week of weeks) {
      assert.equal(week.length, expectedDays, templateKey);
      if (program === "incepator-3") {
        assert.equal(new Set(week.map((day) => legFamily(day[0]))).size, 3, templateKey);
      }
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        assert.equal(day.length, expectedCount, `${templateKey}: Z${dayIndex + 1}`);
        assert.equal(new Set(day).size, day.length, `${templateKey}: Z${dayIndex + 1}`);
        assert.ok(day.every((key) => CAT2_HOME_ALLOWLIST.includes(key)), templateKey);
        assert.equal(cat2HomeDayMatchesStructure(program, dayIndex, day), true, `${templateKey}: Z${dayIndex + 1}`);
        assert.deepEqual(day.map((key) => CAT2_HOME_GROUP_BY_EXERCISE[key]), CAT2_HOME_DAY_GROUPS[program][dayIndex]);
        assert.deepEqual(cat2HomeSameFamilyConflicts(day), [], `${templateKey}: Z${dayIndex + 1}`);
        if (beginner) assert.equal(day.some((key) => CAT2_HOME_ADVANCED_ONLY.includes(key)), false, templateKey);
        const signature = day.join("|");
        assert.equal(dailySignatures.has(signature), false, `${templateKey}: ${signature}`);
        dailySignatures.add(signature);
        day.forEach((key) => allUsed.add(key));
      }
      const lowerPair = lowerPairFor(program);
      if (lowerPair) {
        const first = new Set(week[lowerPair[0]].filter((key) => CAT2_HOME_GROUP_BY_EXERCISE[key] === "Picioare"));
        const overlap = week[lowerPair[1]].filter((key) =>
          CAT2_HOME_GROUP_BY_EXERCISE[key] === "Picioare" && first.has(key),
        );
        assert.deepEqual(overlap, [], templateKey);
      }
    }
    if (program === "incepator-3" || program === "avansat-4" || program === "avansat-5") {
      const firstExercisesByDay = Array.from({ length: expectedDays }, (_, dayIndex) =>
        new Set(weeks.map((week) => week[dayIndex][0])).size,
      );
      if (program === "incepator-3") assert.ok(firstExercisesByDay.every((count) => count === 4), templateKey);
      if (program === "avansat-4") assert.equal(firstExercisesByDay[1], 4, templateKey);
      if (program === "avansat-5") assert.equal(firstExercisesByDay[2], 4, templateKey);
    }
    templateSignatures.add(JSON.stringify(weeks));
  }
  assert.equal(templateSignatures.size, 12);
  assert.deepEqual(allUsed, new Set(CAT2_HOME_ALLOWLIST));
});

test("CAT2 × Acasă generează 24 profiluri, 384 zile și exact 1752 apariții", () => {
  assert.equal(TARGET_PROFILES.length, 24);
  const expected = Object.freeze({
    "incepator-3": { profiles: 6, days: 72, count: 4, occurrences: 288 },
    "incepator-4": { profiles: 6, days: 96, count: 4, occurrences: 384 },
    "avansat-4": { profiles: 6, days: 96, count: 5, occurrences: 480 },
    "avansat-5": { profiles: 6, days: 120, count: 5, occurrences: 600 },
  });
  let totalDays = 0;
  let totalOccurrences = 0;
  const dailyCounts = new Map();
  for (const [program, contract] of Object.entries(expected)) {
    const plans = TARGET_PROFILES.filter((profile) => profile.program === program).map(requirePlan);
    assert.equal(plans.length, contract.profiles);
    const days = plans.flatMap((plan) => plan.weeks.flatMap((week) => week.days));
    assert.equal(days.length, contract.days);
    assert.ok(days.every((day) => day.exercises.length === contract.count));
    assert.ok(days.every((day) => day.title === CAT2_HOME_DAY_TITLES[program][day.dayNumber - 1]));
    const occurrences = days.reduce((count, day) => count + day.exercises.length, 0);
    assert.equal(occurrences, contract.occurrences);
    days.forEach((day) => dailyCounts.set(day.exercises.length, (dailyCounts.get(day.exercises.length) ?? 0) + 1));
    totalDays += days.length;
    totalOccurrences += occurrences;
  }
  assert.equal(totalDays, 384);
  assert.equal(totalOccurrences, 1752);
  assert.deepEqual(Object.fromEntries(dailyCounts), { 4: 168, 5: 216 });
});

test("toate cele 44 de exerciții sunt generate cel puțin o dată, fără conflicte de nivel sau locație", () => {
  const used = new Set();
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    const beginner = VALID_PROGRAMS[profile.program].level === "incepator";
    for (const week of plan.weeks) for (const day of week.days) for (const exercise of day.exercises) {
      used.add(exercise.exerciseKey);
      assert.ok(CAT2_HOME_ALLOWLIST.includes(exercise.exerciseKey));
      assert.ok(catalogByKey.get(exercise.exerciseKey)?.places.includes("acasa"));
      if (beginner) assert.equal(CAT2_HOME_ADVANCED_ONLY.includes(exercise.exerciseKey), false);
      assert.equal(exercise.sourceRecommendation, catalogByKey.get(exercise.exerciseKey).recommendedTarget);
    }
  }
  assert.deepEqual(used, new Set(CAT2_HOME_ALLOWLIST));
});

test("perechile masculin/feminin sunt identice, cele 12 planuri sunt unice și obiectivele diferă real", () => {
  const signatures = new Set();
  for (const program of PROGRAMS) {
    const goalSignatures = new Set();
    for (const goal of GOALS) {
      const common = { age: TARGET_AGE, goal, place: TARGET_PLACE, program };
      const male = requirePlan({ ...common, gender: "masculin" });
      const female = requirePlan({ ...common, gender: "feminin" });
      assert.deepEqual(planWeeks(male), planWeeks(female));
      assert.equal(parameterSignature(male), parameterSignature(female));
      assert.equal(parameterSignature(requirePlan({ ...common, gender: "masculin" })), parameterSignature(male));
      assert.equal(parameterSignature(requirePlan({ ...common, gender: "feminin" })), parameterSignature(female));
      const signature = JSON.stringify(male.weeks);
      signatures.add(signature);
      goalSignatures.add(signature);
    }
    assert.equal(goalSignatures.size, 3, program);
  }
  assert.equal(signatures.size, 12);
});

test("resolverul public proiectează exact planurile CAT2 × Acasă fără fallback", () => {
  for (const profile of TARGET_PROFILES) {
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.plan.structureTemplate, "cat2-home-editorial-complete");
    const expectedCount = cat2HomeDailyExerciseCount(profile);
    const audit = auditGeneratedPlanV2(result.plan, catalog, registry);
    assert.deepEqual(audit, { valid: true, issues: [] });
    for (const week of result.plan.weeks) {
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      assert.equal(projected.length, VALID_PROGRAMS[profile.program].daysPerWeek);
      assert.ok(projected.every((day) => day.exercises.length === expectedCount));
    }
  }
});

test("validatorul editorial respinge o redundanță din familia Flotări", () => {
  const plan = requirePlan({
    gender: "feminin",
    age: TARGET_AGE,
    goal: "slabire",
    place: TARGET_PLACE,
    program: "avansat-5",
  });
  const invalid = structuredClone(plan);
  const pushDay = invalid.weeks[0].days[0];
  const flyIndex = pushDay.exercises.findIndex((exercise) => exercise.exerciseKey === CAT2_HOME_EXERCISES.P3);
  const replacement = structuredClone(pushDay.exercises[0]);
  replacement.exerciseKey = CAT2_HOME_EXERCISES.P4;
  replacement.name = catalogByKey.get(CAT2_HOME_EXERCISES.P4).name;
  replacement.order = pushDay.exercises[flyIndex].order;
  pushDay.exercises[flyIndex] = replacement;
  const audit = auditGeneratedPlanV2(invalid, catalog, registry);
  assert.equal(audit.valid, false);
  assert.ok(audit.issues.some((issue) => issue.includes("Familii redundante CAT2 × Acasă")));
});

test("versiunea editorială CAT2 × Acasă resetează numai selecția veche și persistă la refresh", () => {
  const base = {
    gender: "feminin",
    age: "cat2",
    goal: "masa",
    place: "acasa",
    program: "avansat-5",
  };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat2-home-editorial-pre-v1" },
  ]) {
    const normalized = normalizeFreePlanSelectionsForCurrentContent(stale);
    assert.equal(normalized.engineVersion, "v2");
    assert.equal(normalized.program, undefined);
    assert.equal(normalized.planInstanceId, undefined);
    assert.equal(normalized.contentVersion, undefined);
  }
  const instanceId = createPlanInstanceId(() => "22222222-2222-4222-8222-222222222222");
  const current = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "avansat-5",
    instanceId,
  );
  assert.ok(current);
  assert.equal(current.contentVersion, "cat2-home-editorial-v1");
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);
  const planKey = withPlanInstanceKey(withPlanContentVersionKey(
    "plan:v2:feminin:30-44:masa:acasa:avansat-5",
    current.contentVersion,
  ), instanceId);
  assert.equal(planContentVersionFromPlanKey(planKey), current.contentVersion);
  assert.equal(planInstanceIdFromPlanKey(planKey), instanceId);
});

test("cele 72 de profiluri din afara CAT2 și CAT1 rămân bit-for-bit la checkpointul 132", () => {
  const rows = enumerateValidV2Profiles()
    .filter((profile) => !(profile.age === TARGET_AGE && profile.place === TARGET_PLACE)
      && !(profile.age === "30-44" && profile.place === "sala")
      && !(profile.age === "18-29" && profile.place === "acasa")
      && !(profile.age === "18-29" && profile.place === "sala"))
    .map((profile) => [profileKey(profile), requirePlan(profile)]);
  assert.equal(rows.length, 72);
  assert.equal(sha(rows), PROTECTED_CHECKPOINT_132_SHA256);
});
