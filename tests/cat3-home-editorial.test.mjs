import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CAT3_HOME_ADVANCED_ONLY,
  CAT3_HOME_ALLOWLIST,
  CAT3_HOME_DAILY_EXERCISE_COUNT,
  CAT3_HOME_DAY_TITLES,
  CAT3_HOME_EDITORIAL_TEMPLATES,
  CAT3_HOME_EXERCISES,
  CAT3_HOME_GROUP_BY_EXERCISE,
  cat3HomeDailyExerciseCount,
  cat3HomeDayMatchesStructure,
  cat3HomeExerciseApprovedForGender,
  cat3HomeSameFamilyConflicts,
  cat3HomeSurfaceTransitions,
} from "../lib/plan-engine/cat3-home-editorial.mjs";
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
  catalog,
  catalogByKey,
  parameterSignature,
  registry,
  ruleByKey,
} from "./helpers/plan-engine-v2-fixture.mjs";

const TARGET_AGE = "45-59";
const TARGET_PLACE = "acasa";
const PROGRAMS = Object.freeze(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOALS = Object.freeze(["slabire", "masa", "forma"]);
const TARGET_PROFILES = enumerateValidV2Profiles().filter((profile) =>
  profile.age === TARGET_AGE && profile.place === TARGET_PLACE,
);
const PROTECTED_CHECKPOINT_132_SHA256 = "82dbc62ae37e4f6ad865dbd823f3460c64b2b2fb82d324478a4187306cf564bb";

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

test("allowlistul CAT3 × Acasă rezolvă exact cele 44 de exerciții canonice aprobate", () => {
  assert.equal(CAT3_HOME_ALLOWLIST.length, 44);
  assert.equal(new Set(CAT3_HOME_ALLOWLIST).size, 44);
  assert.equal(CAT3_HOME_ADVANCED_ONLY.length, 11);
  assert.equal(new Set(CAT3_HOME_ADVANCED_ONLY).size, 11);
  assert.equal(Object.keys(CAT3_HOME_GROUP_BY_EXERCISE).length, 44);
  for (const exerciseKey of CAT3_HOME_ALLOWLIST) {
    const exercise = catalogByKey.get(exerciseKey);
    const rule = ruleByKey.get(exerciseKey);
    assert.ok(exercise, exerciseKey);
    assert.ok(rule, exerciseKey);
    assert.ok(exercise.places.includes("acasa"), exerciseKey);
    assert.ok(rule.places.includes("acasa"), exerciseKey);
    assert.equal(exercise.group, CAT3_HOME_GROUP_BY_EXERCISE[exerciseKey], exerciseKey);
  }
  assert.equal(ruleByKey.get(CAT3_HOME_EXERCISES.T2).female_priority, 0);
  assert.equal(cat3HomeExerciseApprovedForGender({
    gender: "feminin",
    age: TARGET_AGE,
    goal: "forma",
    place: TARGET_PLACE,
    program: "avansat-5",
  }, CAT3_HOME_EXERCISES.T2), true);
});

test("cele 12 șabloane canonice respectă volumul, structura, familiile și variația", () => {
  assert.deepEqual(CAT3_HOME_DAILY_EXERCISE_COUNT, {
    "incepator-3": 4,
    "incepator-4": 4,
    "avansat-4": 5,
    "avansat-5": 5,
  });
  assert.equal(Object.keys(CAT3_HOME_EDITORIAL_TEMPLATES).length, 12);
  const allUsed = new Set();
  const templateSignatures = new Set();
  for (const [templateKey, weeks] of Object.entries(CAT3_HOME_EDITORIAL_TEMPLATES)) {
    const program = templateKey.split(":")[1];
    const expectedDays = VALID_PROGRAMS[program].daysPerWeek;
    const expectedCount = CAT3_HOME_DAILY_EXERCISE_COUNT[program];
    const beginner = VALID_PROGRAMS[program].level === "incepator";
    const dailySignatures = new Set();
    assert.equal(weeks.length, 4, templateKey);
    assert.equal(new Set(weeks.map((week) => JSON.stringify(week))).size, 4, templateKey);
    assert.equal(new Set(weeks.map((week) => week[0][0])).size, 4, templateKey);
    for (const week of weeks) {
      assert.equal(week.length, expectedDays, templateKey);
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        assert.equal(day.length, expectedCount, `${templateKey}: Z${dayIndex + 1}`);
        assert.equal(new Set(day).size, day.length, `${templateKey}: Z${dayIndex + 1}`);
        assert.ok(day.every((key) => CAT3_HOME_ALLOWLIST.includes(key)), templateKey);
        assert.equal(cat3HomeDayMatchesStructure(program, dayIndex, day), true, `${templateKey}: Z${dayIndex + 1}`);
        assert.deepEqual(cat3HomeSameFamilyConflicts(day), [], `${templateKey}: Z${dayIndex + 1}`);
        assert.ok(cat3HomeSurfaceTransitions(day) <= 1, `${templateKey}: Z${dayIndex + 1}`);
        if (beginner) assert.equal(day.some((key) => CAT3_HOME_ADVANCED_ONLY.includes(key)), false, templateKey);
        const signature = day.join("|");
        assert.equal(dailySignatures.has(signature), false, `${templateKey}: ${signature}`);
        dailySignatures.add(signature);
        day.forEach((key) => allUsed.add(key));
      }
      const lowerPair = lowerPairFor(program);
      if (lowerPair) {
        const first = new Set(week[lowerPair[0]].filter((key) => CAT3_HOME_GROUP_BY_EXERCISE[key] === "Picioare"));
        const overlap = week[lowerPair[1]].filter((key) =>
          CAT3_HOME_GROUP_BY_EXERCISE[key] === "Picioare" && first.has(key),
        );
        assert.deepEqual(overlap, [], templateKey);
      }
    }
    templateSignatures.add(JSON.stringify(weeks));
  }
  assert.equal(templateSignatures.size, 12);
  assert.deepEqual(allUsed, new Set(CAT3_HOME_ALLOWLIST));
});

test("CAT3 × Acasă generează 24 profiluri, 384 zile și exact 1752 apariții", () => {
  assert.equal(TARGET_PROFILES.length, 24);
  const expected = Object.freeze({
    "incepator-3": { profiles: 6, days: 72, count: 4, occurrences: 288 },
    "incepator-4": { profiles: 6, days: 96, count: 4, occurrences: 384 },
    "avansat-4": { profiles: 6, days: 96, count: 5, occurrences: 480 },
    "avansat-5": { profiles: 6, days: 120, count: 5, occurrences: 600 },
  });
  let totalDays = 0;
  let totalOccurrences = 0;
  for (const [program, contract] of Object.entries(expected)) {
    const plans = TARGET_PROFILES.filter((profile) => profile.program === program).map(requirePlan);
    assert.equal(plans.length, contract.profiles);
    const days = plans.flatMap((plan) => plan.weeks.flatMap((week) => week.days));
    assert.equal(days.length, contract.days);
    assert.equal(days.filter((day) => day.exercises.length === contract.count).length, contract.days);
    assert.ok(days.every((day) => day.title === CAT3_HOME_DAY_TITLES[program][day.dayNumber - 1]));
    const occurrences = days.reduce((count, day) => count + day.exercises.length, 0);
    assert.equal(occurrences, contract.occurrences);
    totalDays += days.length;
    totalOccurrences += occurrences;
  }
  assert.equal(totalDays, 384);
  assert.equal(totalOccurrences, 1752);
});

test("perechile masculin/feminin sunt identice, planurile sunt 12/24 și deterministe", () => {
  const signatures = new Set();
  for (const goal of GOALS) {
    for (const program of PROGRAMS) {
      const common = { age: TARGET_AGE, goal, place: TARGET_PLACE, program };
      const male = requirePlan({ ...common, gender: "masculin" });
      const female = requirePlan({ ...common, gender: "feminin" });
      assert.deepEqual(planWeeks(male), planWeeks(female));
      assert.equal(parameterSignature(male), parameterSignature(female));
      assert.equal(parameterSignature(requirePlan({ ...common, gender: "masculin" })), parameterSignature(male));
      assert.equal(parameterSignature(requirePlan({ ...common, gender: "feminin" })), parameterSignature(female));
      signatures.add(JSON.stringify(male.weeks));
    }
  }
  assert.equal(signatures.size, 12);
  assert.ok(TARGET_PROFILES.filter((profile) => profile.gender === "feminin" && profile.program.startsWith("avansat"))
    .map(requirePlan)
    .some((plan) => plan.weeks.some((week) => week.days.some((day) =>
      day.exercises.some((exercise) => exercise.exerciseKey === CAT3_HOME_EXERCISES.T2),
    ))));
});

test("resolverul public proiectează exact 4/5 carduri fără fallback, duplicate sau carduri ascunse", () => {
  for (const profile of TARGET_PROFILES) {
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.plan.structureTemplate, "cat3-home-editorial-complete");
    const expectedCount = cat3HomeDailyExerciseCount(profile);
    for (const week of result.plan.weeks) {
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      assert.equal(projected.length, VALID_PROGRAMS[profile.program].daysPerWeek);
      for (let dayIndex = 0; dayIndex < projected.length; dayIndex += 1) {
        assert.equal(projected[dayIndex].exercises.length, expectedCount);
        assert.equal(projected[dayIndex].exercises.length, week.days[dayIndex].exercises.length);
        assert.equal(new Set(projected[dayIndex].exercises.map((exercise) => exercise.exerciseKey)).size, expectedCount);
      }
    }
  }
});

test("validatorul editorial respinge explicit o a doua variantă din familia Flotări", () => {
  const plan = requirePlan({
    gender: "feminin",
    age: TARGET_AGE,
    goal: "slabire",
    place: TARGET_PLACE,
    program: "avansat-5",
  });
  const invalid = structuredClone(plan);
  const pushDay = invalid.weeks[0].days[0];
  const flyIndex = pushDay.exercises.findIndex((exercise) => exercise.exerciseKey === CAT3_HOME_EXERCISES.P3);
  const replacement = structuredClone(pushDay.exercises.find((exercise) =>
    exercise.exerciseKey === CAT3_HOME_EXERCISES.P1
      || exercise.exerciseKey === CAT3_HOME_EXERCISES.P4
      || exercise.exerciseKey === CAT3_HOME_EXERCISES.P5
      || exercise.exerciseKey === CAT3_HOME_EXERCISES.P6,
  ));
  replacement.order = pushDay.exercises[flyIndex].order;
  pushDay.exercises[flyIndex] = replacement;
  const audit = auditGeneratedPlanV2(invalid, catalog, registry);
  assert.equal(audit.valid, false);
  assert.ok(audit.issues.some((issue) => issue.includes("Familii redundante CAT3 × Acasă")));
});

test("cele 24 de profiluri din afara CAT3, CAT2 și CAT1 rămân bit-for-bit la checkpointul 132", () => {
  const rows = enumerateValidV2Profiles()
    .filter((profile) => profile.age !== TARGET_AGE
      && profile.age !== "30-44"
      && !(profile.age === "18-29" && profile.place === "acasa")
      && !(profile.age === "18-29" && profile.place === "sala"))
    .map((profile) => [profileKey(profile), requirePlan(profile)]);
  assert.equal(rows.length, 24);
  assert.equal(sha(rows), PROTECTED_CHECKPOINT_132_SHA256);
});
