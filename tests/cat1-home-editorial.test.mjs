import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CAT1_HOME_ADVANCED_ONLY,
  CAT1_HOME_ALLOWLIST,
  CAT1_HOME_DAILY_EXERCISE_COUNT,
  CAT1_HOME_DUMBBELL_EXERCISES,
  CAT1_HOME_EDITORIAL_TEMPLATES,
  CAT1_HOME_EXERCISES,
  CAT1_HOME_GROUP_BY_EXERCISE,
  cat1HomeDailyExerciseCount,
  cat1HomeDayMatchesStructure,
  cat1HomeEquipmentClass,
  cat1HomeSameFamilyConflicts,
} from "../lib/plan-engine/cat1-home-editorial.mjs";
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

const TARGET_AGE = "18-29";
const TARGET_PLACE = "acasa";
const PROGRAMS = Object.freeze(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOALS = Object.freeze(["slabire", "masa", "forma"]);
const TARGET_PROFILES = enumerateValidV2Profiles().filter((profile) =>
  profile.age === TARGET_AGE && profile.place === TARGET_PLACE,
);
const PROTECTED_CHECKPOINT_132_SHA256 = "ed54384c38a7ca3b2ea4836f8e3cafab949692b8b441e426a7636e2763ad4746";

const dumbbell = new Set(CAT1_HOME_DUMBBELL_EXERCISES);
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

test("allowlistul CAT1 × Acasă reutilizează exact 44/44 și clasifică strict cele 14 chei cu gantere", () => {
  assert.strictEqual(CAT1_HOME_ALLOWLIST, CAT3_HOME_ALLOWLIST);
  assert.equal(CAT1_HOME_ALLOWLIST.length, 44);
  assert.equal(new Set(CAT1_HOME_ALLOWLIST).size, 44);
  assert.equal(CAT1_HOME_DUMBBELL_EXERCISES.length, 14);
  assert.equal(new Set(CAT1_HOME_DUMBBELL_EXERCISES).size, 14);
  assert.equal(CAT1_HOME_ADVANCED_ONLY.length, 11);
  assert.equal(Object.keys(CAT1_HOME_GROUP_BY_EXERCISE).length, 44);
  for (const exerciseKey of CAT1_HOME_ALLOWLIST) {
    const exercise = catalogByKey.get(exerciseKey);
    const rule = ruleByKey.get(exerciseKey);
    assert.ok(exercise, exerciseKey);
    assert.ok(rule, exerciseKey);
    assert.ok(exercise.places.includes("acasa"), exerciseKey);
    assert.ok(rule.places.includes("acasa"), exerciseKey);
    assert.equal(exercise.group, CAT1_HOME_GROUP_BY_EXERCISE[exerciseKey], exerciseKey);
    assert.equal(cat1HomeEquipmentClass(exerciseKey), dumbbell.has(exerciseKey) ? "DUMBBELL" : "NON_DUMBBELL");
    if (dumbbell.has(exerciseKey)) assert.match(exercise.name.toLocaleLowerCase("ro"), /ganter/);
  }
});

test("cele 24 de șabloane respectă grupele, nivelul, familiile, rotația și folosesc 44/44", () => {
  assert.deepEqual(CAT1_HOME_DAILY_EXERCISE_COUNT, {
    "incepator-3": 4,
    "incepator-4": 4,
    "avansat-4": 5,
    "avansat-5": 5,
  });
  assert.equal(Object.keys(CAT1_HOME_EDITORIAL_TEMPLATES).length, 24);
  const used = new Set();
  const signatures = new Set();
  for (const profile of TARGET_PROFILES) {
    const key = `${profile.gender}:${profile.goal}:${profile.program}`;
    const weeks = CAT1_HOME_EDITORIAL_TEMPLATES[key];
    const beginner = VALID_PROGRAMS[profile.program].level === "incepator";
    const expectedCount = CAT1_HOME_DAILY_EXERCISE_COUNT[profile.program];
    const dailySignatures = new Set();
    assert.equal(weeks.length, 4, key);
    assert.equal(new Set(weeks.map((week) => JSON.stringify(week))).size, 4, key);
    for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
      const week = weeks[weekIndex];
      assert.equal(week.length, VALID_PROGRAMS[profile.program].daysPerWeek, key);
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        assert.equal(day.length, expectedCount, `${key}: S${weekIndex + 1} Z${dayIndex + 1}`);
        assert.equal(new Set(day).size, day.length, key);
        assert.ok(day.every((exerciseKey) => CAT1_HOME_ALLOWLIST.includes(exerciseKey)), key);
        assert.equal(cat1HomeDayMatchesStructure(profile, weekIndex, dayIndex, day), true, key);
        assert.deepEqual(cat1HomeSameFamilyConflicts(day), [], key);
        if (beginner) assert.equal(day.some((exerciseKey) => CAT1_HOME_ADVANCED_ONLY.includes(exerciseKey)), false, key);
        const signature = [...day].sort().join("|");
        assert.equal(dailySignatures.has(signature), false, `${key}: ${signature}`);
        dailySignatures.add(signature);
        day.forEach((exerciseKey) => used.add(exerciseKey));
      }
      const lowerPair = lowerPairFor(profile.program);
      if (lowerPair) {
        const first = new Set(week[lowerPair[0]].filter((exerciseKey) => CAT1_HOME_GROUP_BY_EXERCISE[exerciseKey] === "Picioare"));
        const overlap = week[lowerPair[1]].filter((exerciseKey) =>
          CAT1_HOME_GROUP_BY_EXERCISE[exerciseKey] === "Picioare" && first.has(exerciseKey));
        assert.deepEqual(overlap, [], key);
      }
    }
    signatures.add(JSON.stringify(weeks));
  }
  assert.equal(signatures.size, 24);
  assert.deepEqual(used, new Set(CAT1_HOME_ALLOWLIST));
});

test("CAT1 × Acasă generează 24 profiluri, 384 zile, 1752 apariții și distribuția exactă 168/216", () => {
  assert.equal(TARGET_PROFILES.length, 24);
  let totalDays = 0;
  let totalOccurrences = 0;
  let femaleOccurrences = 0;
  let maleOccurrences = 0;
  const dailyCounts = new Map();
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    const days = plan.weeks.flatMap((week) => week.days);
    const occurrences = days.reduce((count, day) => count + day.exercises.length, 0);
    assert.equal(days.length, VALID_PROGRAMS[profile.program].daysPerWeek * 4);
    assert.ok(days.every((day) => day.exercises.length === CAT1_HOME_DAILY_EXERCISE_COUNT[profile.program]));
    totalDays += days.length;
    totalOccurrences += occurrences;
    if (profile.gender === "feminin") femaleOccurrences += occurrences;
    else maleOccurrences += occurrences;
    days.forEach((day) => dailyCounts.set(day.exercises.length, (dailyCounts.get(day.exercises.length) ?? 0) + 1));
  }
  assert.equal(totalDays, 384);
  assert.equal(totalOccurrences, 1752);
  assert.equal(femaleOccurrences, 876);
  assert.equal(maleOccurrences, 876);
  assert.deepEqual(Object.fromEntries(dailyCounts), { 4: 168, 5: 216 });
});

test("fiecare plan respectă pragul de gantere corespunzător sexului și programului", () => {
  const expectedOccurrences = { "incepator-3": 48, "incepator-4": 64, "avansat-4": 80, "avansat-5": 100 };
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    const keys = plan.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseKey)));
    const dumbbellOccurrences = keys.filter((exerciseKey) => dumbbell.has(exerciseKey)).length;
    const nonDumbbellOccurrences = keys.length - dumbbellOccurrences;
    assert.equal(keys.length, expectedOccurrences[profile.program]);
    if (profile.gender === "masculin") {
      assert.ok(dumbbellOccurrences > nonDumbbellOccurrences, profileKey(profile));
      assert.ok(dumbbellOccurrences >= Math.floor(keys.length / 2) + 1, profileKey(profile));
    } else {
      assert.ok(dumbbellOccurrences <= nonDumbbellOccurrences, profileKey(profile));
      assert.ok(dumbbellOccurrences <= Math.floor(keys.length / 2), profileKey(profile));
    }
  }
});

test("structurile zilnice sunt exacte, Tras are 3 Spate + 1 Biceps + 1 Abdomen și ordinea rămâne sigură", () => {
  const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        assert.equal(cat1HomeDayMatchesStructure(profile, weekIndex, dayIndex, keys), true, profileKey(profile));
        assert.equal(new Set(keys).size, keys.length, profileKey(profile));
        assert.deepEqual(cat1HomeSameFamilyConflicts(keys), [], profileKey(profile));
        let endingStarted = false;
        let previousRole = -1;
        for (const exercise of day.exercises) {
          const ending = exercise.group === "Abdomen" || exercise.group === "Cardio";
          if (ending) endingStarted = true;
          else {
            assert.equal(endingStarted, false, profileKey(profile));
            assert.ok(roleOrder[exercise.role] >= previousRole, profileKey(profile));
            previousRole = roleOrder[exercise.role];
          }
        }
      }
      if (profile.program === "avansat-5") {
        const pullGroups = week.days[1].exercises.map((exercise) => exercise.group);
        assert.deepEqual(Object.fromEntries([...new Set(pullGroups)].map((group) => [group, pullGroups.filter((value) => value === group).length])), {
          Spate: 3,
          Biceps: 1,
          Abdomen: 1,
        });
        assert.equal(week.days[1].exercises.filter((exercise) => exercise.exerciseKey === CAT1_HOME_EXERCISES.B1).length, 1);
      }
    }
  }
});

test("obiectivele și sexele produc 24/24 planuri unice, fără diferențe de sex nelegate de echipament", () => {
  const signatures = new Set();
  for (const program of PROGRAMS) {
    const goalSignatures = new Set();
    for (const goal of GOALS) {
      const common = { age: TARGET_AGE, goal, place: TARGET_PLACE, program };
      const male = requirePlan({ ...common, gender: "masculin" });
      const female = requirePlan({ ...common, gender: "feminin" });
      assert.notDeepEqual(planWeeks(male), planWeeks(female));
      assert.notEqual(parameterSignature(male), parameterSignature(female));
      for (let weekIndex = 0; weekIndex < 4; weekIndex += 1) {
        for (let dayIndex = 0; dayIndex < male.weeks[weekIndex].days.length; dayIndex += 1) {
          const maleDay = male.weeks[weekIndex].days[dayIndex];
          const femaleDay = female.weeks[weekIndex].days[dayIndex];
          assert.equal(maleDay.title, femaleDay.title);
          assert.deepEqual(maleDay.exercises.map((exercise) => exercise.group).sort(), femaleDay.exercises.map((exercise) => exercise.group).sort());
          for (const group of new Set(maleDay.exercises.map((exercise) => exercise.group))) {
            const maleKeys = maleDay.exercises.filter((exercise) => exercise.group === group).map((exercise) => exercise.exerciseKey).sort();
            const femaleKeys = femaleDay.exercises.filter((exercise) => exercise.group === group).map((exercise) => exercise.exerciseKey).sort();
            if (maleKeys.join("|") === femaleKeys.join("|")) continue;
            const maleDumbbell = maleKeys.filter((key) => dumbbell.has(key)).length;
            const femaleDumbbell = femaleKeys.filter((key) => dumbbell.has(key)).length;
            assert.notEqual(maleDumbbell, femaleDumbbell, `${profileKey({ ...common, gender: "masculin" })}: ${group}`);
          }
        }
      }
      const maleSignature = JSON.stringify(male.weeks);
      const femaleSignature = JSON.stringify(female.weeks);
      signatures.add(maleSignature);
      signatures.add(femaleSignature);
      goalSignatures.add(maleSignature);
      goalSignatures.add(femaleSignature);
    }
    assert.equal(goalSignatures.size, 6, program);
  }
  assert.equal(signatures.size, 24);
});

test("resolverul public, auditul și determinismul trec pentru toate cele 24 de profiluri", () => {
  for (const profile of TARGET_PROFILES) {
    const directA = requirePlan(profile);
    const directB = requirePlan(profile);
    assert.deepEqual(directA, directB, profileKey(profile));
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.plan.structureTemplate, "cat1-home-editorial-complete");
    assert.deepEqual(auditGeneratedPlanV2(result.plan, catalog, registry), { valid: true, issues: [] });
    const expectedCount = cat1HomeDailyExerciseCount(profile);
    for (const week of result.plan.weeks) {
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      assert.equal(projected.length, VALID_PROGRAMS[profile.program].daysPerWeek);
      assert.ok(projected.every((day) => day.exercises.length === expectedCount));
    }
  }
});

test("cele patru săptămâni și primele exerciții variază determinist când selecția oferă alternative", () => {
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    assert.equal(new Set(plan.weeks.map((week) => JSON.stringify(week.days.map((day) =>
      day.exercises.map((exercise) => exercise.exerciseKey),
    )))).size, 4, profileKey(profile));
    const firstExerciseSequences = plan.weeks.map((week) =>
      week.days.map((day) => day.exercises[0]?.exerciseKey).join("|"));
    assert.ok(new Set(firstExerciseSequences).size >= 2, profileKey(profile));
    const repeatedDayTypes = new Map();
    for (const week of plan.weeks) for (const day of week.days) {
      if (!repeatedDayTypes.has(day.title)) repeatedDayTypes.set(day.title, new Set());
      repeatedDayTypes.get(day.title).add(day.exercises[0]?.exerciseKey);
    }
    assert.ok([...repeatedDayTypes.values()].some((keys) => keys.size > 1), profileKey(profile));
  }
});

test("validatorul CAT1 respinge explicit redundanța Flotări și cheia din afara allowlistului", () => {
  const plan = requirePlan({ gender: "masculin", age: TARGET_AGE, goal: "masa", place: TARGET_PLACE, program: "avansat-5" });
  const invalid = structuredClone(plan);
  const pushDay = invalid.weeks[0].days[0];
  const flyIndex = pushDay.exercises.findIndex((exercise) => exercise.exerciseKey === CAT1_HOME_EXERCISES.P3);
  const replacement = structuredClone(pushDay.exercises.find((exercise) => CAT1_HOME_GROUP_BY_EXERCISE[exercise.exerciseKey] === "Piept"));
  replacement.exerciseKey = CAT1_HOME_EXERCISES.P4;
  replacement.name = catalogByKey.get(CAT1_HOME_EXERCISES.P4).name;
  replacement.order = pushDay.exercises[flyIndex].order;
  pushDay.exercises[flyIndex] = replacement;
  const audit = auditGeneratedPlanV2(invalid, catalog, registry);
  assert.equal(audit.valid, false);
  assert.ok(audit.issues.some((issue) => issue.includes("Familii redundante CAT1 × Acasă")));
  const outside = structuredClone(plan);
  outside.weeks[0].days[0].exercises[0].exerciseKey = "legacy-outside-cat1-home";
  const outsideAudit = auditGeneratedPlanV2(outside, catalog, registry);
  assert.equal(outsideAudit.valid, false);
  assert.ok(outsideAudit.issues.some((issue) => issue.includes("Exercițiu în afara allowlistului CAT1 × Acasă")));
});

test("versiunea editorială CAT1 × Acasă izolează planul nou și păstrează refresh-ul curent", () => {
  const base = { gender: "feminin", age: "cat1", goal: "masa", place: "acasa", program: "avansat-5" };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat1-home-editorial-pre-v1" },
  ]) {
    const normalized = normalizeFreePlanSelectionsForCurrentContent(stale);
    assert.equal(normalized.engineVersion, "v2");
    assert.equal(normalized.program, undefined);
    assert.equal(normalized.planInstanceId, undefined);
    assert.equal(normalized.contentVersion, undefined);
  }
  const instanceId = createPlanInstanceId(() => "11111111-1111-4111-8111-111111111111");
  const current = finalizeFreePlanSelections({ ...base, program: undefined, engineVersion: "v2" }, "avansat-5", instanceId);
  assert.ok(current);
  assert.equal(current.contentVersion, "cat1-home-editorial-v1");
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);
  const planKey = withPlanInstanceKey(withPlanContentVersionKey(
    "plan:v2:feminin:18-29:masa:acasa:avansat-5",
    current.contentVersion,
  ), instanceId);
  assert.equal(planContentVersionFromPlanKey(planKey), current.contentVersion);
  assert.equal(planInstanceIdFromPlanKey(planKey), instanceId);
});

test("cele 120 de profiluri din afara CAT1 rămân bit-for-bit identice cu checkpointul 132", () => {
  const rows = enumerateValidV2Profiles()
    .filter((profile) => !(profile.age === TARGET_AGE && profile.place === TARGET_PLACE)
      && !(profile.age === "18-29" && profile.place === "sala"))
    .map((profile) => [profileKey(profile), requirePlan(profile)]);
  assert.equal(rows.length, 120);
  assert.equal(sha(rows), PROTECTED_CHECKPOINT_132_SHA256);
});
