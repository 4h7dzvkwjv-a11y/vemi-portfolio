import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CAT3_GYM_ADVANCED_ONLY,
  CAT3_GYM_DAY_GROUPS,
  CAT3_GYM_DAY_TITLES,
  CAT3_GYM_EDITORIAL_TEMPLATES,
  CAT3_GYM_ELIGIBLE_POOL,
  CAT3_GYM_FEMALE_ALLOWLIST,
  CAT3_GYM_FEMALE_BEGINNER_ALLOWLIST,
  CAT3_GYM_FEMALE_CABLE_ALLOWLIST,
  CAT3_GYM_HOME_ONLY_FORBIDDEN,
  CAT3_GYM_MALE_ADVANCED_ALLOWLIST,
  CAT3_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT3_GYM_MALE_BEGINNER_ALLOWLIST,
  CAT3_GYM_MALE_CHEST_CABLE,
  cat3GymAllowlist,
  cat3GymDailyExerciseCount,
  cat3GymSameFamilyConflicts,
  cat3GymShouldRotateFirst,
} from "../lib/plan-engine/cat3-gym-editorial.mjs";
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
  expectedFreePlanContentVersion,
  finalizeFreePlanSelections,
  hasCurrentFreePlanContentVersion,
  normalizeFreePlanSelectionsForCurrentContent,
} from "../utils/progress/free-plan-state.mjs";
import {
  catalog,
  catalogByKey,
  parameterSignature,
  registry,
  ruleByKey,
} from "./helpers/plan-engine-v2-fixture.mjs";

const TARGET_AGE = "45-59";
const TARGET_PLACE = "sala";
const PROGRAMS = Object.freeze(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOALS = Object.freeze(["slabire", "masa", "forma"]);
const TARGET_PROFILES = enumerateValidV2Profiles().filter((profile) =>
  profile.age === TARGET_AGE && profile.place === TARGET_PLACE,
);
const PROTECTED_CHECKPOINT_132_HASH = "2a5c9dd24d4baf18ecb9fad41fdbd87b3db08bb61d9b6482e49bad26eb74a5f0";

const profileKey = (profile) => [profile.gender, profile.age, profile.goal, profile.place, profile.program].join(":");
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const planWeeks = (plan) => plan.weeks.map((week) => week.days.map((day) =>
  day.exercises.map((exercise) => exercise.exerciseKey),
));
const exerciseCounts = (plan) => {
  const counts = new Map();
  for (const exercise of plan.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises)) {
    counts.set(exercise.exerciseKey, (counts.get(exercise.exerciseKey) ?? 0) + 1);
  }
  return [...counts].sort(([left], [right]) => left.localeCompare(right));
};

function requirePlan(profile) {
  const result = generatePlanV2(profile, catalog, registry);
  assert.equal(result.status, "found", `${profileKey(profile)}\n${result.issues?.join("\n")}`);
  return result.plan;
}

test("pool-urile CAT3 × La sală rezolvă exact contractele 105/56/101", () => {
  const derivedEligible = catalog.filter((exercise) => {
    const rule = ruleByKey.get(exercise.id);
    return exercise.places.includes("sala")
      && rule.places.includes("sala")
      && (rule.male_priority > 0 || rule.female_priority > 0)
      && rule.level.eligible.some((level) => level === "incepator" || level === "avansat");
  }).map((exercise) => exercise.id).sort();
  assert.deepEqual([...CAT3_GYM_ELIGIBLE_POOL].sort(), derivedEligible);
  assert.equal(CAT3_GYM_ELIGIBLE_POOL.length, 105);
  assert.equal(new Set(CAT3_GYM_ELIGIBLE_POOL).size, 105);

  assert.equal(CAT3_GYM_FEMALE_ALLOWLIST.length, 56);
  assert.equal(new Set(CAT3_GYM_FEMALE_ALLOWLIST).size, 56);
  assert.equal(CAT3_GYM_FEMALE_BEGINNER_ALLOWLIST.length, 49);
  assert.equal(CAT3_GYM_FEMALE_CABLE_ALLOWLIST.length, 7);
  assert.deepEqual(
    CAT3_GYM_FEMALE_ALLOWLIST.filter((key) => key.includes("cablu") || key === "face-pull").sort(),
    [...CAT3_GYM_FEMALE_CABLE_ALLOWLIST].sort(),
  );

  assert.equal(CAT3_GYM_MALE_BEGINNER_ALLOWLIST.length, 84);
  assert.equal(CAT3_GYM_MALE_ADVANCED_ALLOWLIST.length, 101);
  assert.equal(new Set(CAT3_GYM_MALE_ADVANCED_ALLOWLIST).size, 101);
  assert.deepEqual(
    CAT3_GYM_ELIGIBLE_POOL.filter((key) => !CAT3_GYM_MALE_ADVANCED_ALLOWLIST.includes(key)).sort(),
    [...CAT3_GYM_MALE_ADVANCED_FORBIDDEN].sort(),
  );
  assert.ok(CAT3_GYM_MALE_ADVANCED_ALLOWLIST.includes("dips-paralele"));
  assert.ok(CAT3_GYM_MALE_BEGINNER_ALLOWLIST.includes("flotari"));

  for (const key of new Set([
    ...CAT3_GYM_FEMALE_ALLOWLIST,
    ...CAT3_GYM_MALE_BEGINNER_ALLOWLIST,
    ...CAT3_GYM_MALE_ADVANCED_ALLOWLIST,
  ])) {
    const exercise = catalogByKey.get(key);
    const rule = ruleByKey.get(key);
    assert.ok(exercise, key);
    assert.ok(rule, key);
    assert.ok(exercise.places.includes("sala"), key);
    assert.ok(rule.places.includes("sala"), key);
  }
  for (const key of CAT3_GYM_HOME_ONLY_FORBIDDEN) assert.equal(CAT3_GYM_ELIGIBLE_POOL.includes(key), false, key);
});

test("cele 24 de șabloane au patru săptămâni și structura musculară exactă", () => {
  assert.equal(Object.keys(CAT3_GYM_EDITORIAL_TEMPLATES).length, 24);
  for (const profile of TARGET_PROFILES) {
    const template = CAT3_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`];
    assert.ok(template, profileKey(profile));
    assert.equal(template.length, 4, profileKey(profile));
    assert.equal(new Set(template.map((week) => JSON.stringify(week))).size, 4, profileKey(profile));
    const dailySignatures = new Set();
    for (const week of template) {
      assert.equal(week.length, VALID_PROGRAMS[profile.program].daysPerWeek, profileKey(profile));
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        assert.equal(day.length, cat3GymDailyExerciseCount(profile, dayIndex), `${profileKey(profile)} Z${dayIndex + 1}`);
        assert.equal(new Set(day).size, day.length, `${profileKey(profile)} Z${dayIndex + 1}`);
        assert.ok(day.every((key) => cat3GymAllowlist(profile).includes(key)), profileKey(profile));
        assert.ok(day.every((key) => !CAT3_GYM_HOME_ONLY_FORBIDDEN.includes(key)), profileKey(profile));
        assert.deepEqual(cat3GymSameFamilyConflicts(day), [], `${profileKey(profile)} Z${dayIndex + 1}`);
        const signature = day.join("|");
        assert.equal(dailySignatures.has(signature), false, `${profileKey(profile)}: ${signature}`);
        dailySignatures.add(signature);
      }
      const lowerPair = profile.program === "incepator-4" ? [1, 3]
        : profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerPair) {
        const first = new Set(week[lowerPair[0]]);
        assert.deepEqual(week[lowerPair[1]].filter((key) => first.has(key)), [], profileKey(profile));
      }
    }
    for (let dayIndex = 0; dayIndex < template[0].length; dayIndex += 1) {
      if (!cat3GymShouldRotateFirst(profile, dayIndex)) continue;
      assert.equal(new Set(template.map((week) => week[dayIndex][0])).size, 4, `${profileKey(profile)} Z${dayIndex + 1}`);
    }
  }
});

test("generatorul produce 24 profiluri, 384 zile și exact 1728 apariții", () => {
  assert.equal(TARGET_PROFILES.length, 24);
  const expected = Object.freeze({
    "incepator-3": { profiles: 6, days: 72, occurrences: 288 },
    "incepator-4": { profiles: 6, days: 96, occurrences: 384 },
    "avansat-4": { profiles: 6, days: 96, occurrences: 456 },
    "avansat-5": { profiles: 6, days: 120, occurrences: 600 },
  });
  let totalDays = 0;
  let totalOccurrences = 0;
  let fourExerciseDays = 0;
  let fiveExerciseDays = 0;
  for (const [program, contract] of Object.entries(expected)) {
    const plans = TARGET_PROFILES.filter((profile) => profile.program === program).map(requirePlan);
    assert.equal(plans.length, contract.profiles);
    const days = plans.flatMap((plan) => plan.weeks.flatMap((week) => week.days));
    const occurrences = days.reduce((count, day) => count + day.exercises.length, 0);
    assert.equal(days.length, contract.days);
    assert.equal(occurrences, contract.occurrences);
    totalDays += days.length;
    totalOccurrences += occurrences;
    fourExerciseDays += days.filter((day) => day.exercises.length === 4).length;
    fiveExerciseDays += days.filter((day) => day.exercises.length === 5).length;
  }
  assert.equal(totalDays, 384);
  assert.equal(totalOccurrences, 1728);
  assert.equal(fourExerciseDays, 192);
  assert.equal(fiveExerciseDays, 192);
});

test("allowlisturile pe sex și nivel nu au nicio abatere în planurile generate", () => {
  const advancedOnly = new Set(CAT3_GYM_ADVANCED_ONLY);
  const femaleAllowlist = new Set(CAT3_GYM_FEMALE_ALLOWLIST);
  const maleAdvancedForbidden = new Set(CAT3_GYM_MALE_ADVANCED_FORBIDDEN);
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    const keys = plan.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises.map((exercise) => exercise.exerciseKey));
    assert.equal(keys.includes("flotari-hindu"), false, profileKey(profile));
    if (profile.gender === "feminin") assert.ok(keys.every((key) => femaleAllowlist.has(key)), profileKey(profile));
    if (profile.program.startsWith("incepator")) assert.ok(keys.every((key) => !advancedOnly.has(key)), profileKey(profile));
    if (profile.gender === "masculin" && profile.program.startsWith("avansat")) {
      assert.ok(keys.every((key) => !maleAdvancedForbidden.has(key)), profileKey(profile));
    }
    if (profile.gender === "masculin") {
      assert.ok(keys.filter((key) => CAT3_GYM_MALE_CHEST_CABLE.includes(key)).length <= 2, profileKey(profile));
    }
  }
});

test("structura materializată, titlurile, familiile și proiecția publică rămân exacte", () => {
  for (const profile of TARGET_PROFILES) {
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.plan.structureTemplate, "cat3-gym-editorial-complete");
    assert.equal(auditGeneratedPlanV2(result.plan, catalog, registry).valid, true);
    for (const week of result.plan.weeks) {
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        assert.equal(day.title, CAT3_GYM_DAY_TITLES[profile.program][dayIndex]);
        assert.deepEqual(day.exercises.map((exercise) => exercise.group), CAT3_GYM_DAY_GROUPS[profile.program][dayIndex]);
        assert.deepEqual(cat3GymSameFamilyConflicts(keys), []);
        assert.equal(new Set(keys).size, keys.length);
        assert.equal(projected[dayIndex].exercises.length, keys.length);
      }
    }
  }
});

test("toate planurile țintă sunt deterministe, unice și diferențiate editorial", () => {
  const signatures = new Set();
  for (const profile of TARGET_PROFILES) {
    const first = requirePlan(profile);
    const second = requirePlan(profile);
    assert.deepEqual(second, first, profileKey(profile));
    assert.equal(parameterSignature(second), parameterSignature(first));
    signatures.add(JSON.stringify(planWeeks(first)));
  }
  assert.equal(signatures.size, 24);

  for (const gender of ["masculin", "feminin"])
    for (const program of PROGRAMS) {
      const plans = GOALS.map((goal) => requirePlan({ gender, age: TARGET_AGE, goal, place: TARGET_PLACE, program }));
      assert.equal(new Set(plans.map((plan) => JSON.stringify(exerciseCounts(plan)))).size, 3, `${gender}:${program}`);
    }

  for (const goal of GOALS)
    for (const program of PROGRAMS) {
      const male = requirePlan({ gender: "masculin", age: TARGET_AGE, goal, place: TARGET_PLACE, program });
      const female = requirePlan({ gender: "feminin", age: TARGET_AGE, goal, place: TARGET_PLACE, program });
      assert.notDeepEqual(planWeeks(male), planWeeks(female), `${goal}:${program}`);
    }
});

test("versiunea editorială CAT3 × La sală resetează numai selecția veche și persistă la refresh", () => {
  const base = { gender: "feminin", age: "cat3", goal: "masa", place: "sala", program: "avansat-5" };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat3-gym-editorial-pre-v1" },
  ]) {
    const normalized = normalizeFreePlanSelectionsForCurrentContent(stale);
    assert.equal(normalized.engineVersion, "v2");
    assert.equal(normalized.program, undefined);
    assert.equal(normalized.planInstanceId, undefined);
    assert.equal(normalized.contentVersion, undefined);
  }
  const current = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "avansat-5",
    createPlanInstanceId(() => "33333333-3333-4333-8333-333333333333"),
  );
  assert.ok(current);
  assert.equal(current.contentVersion, "cat3-gym-editorial-v1");
  assert.equal(current.contentVersion, expectedFreePlanContentVersion(current));
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);
});

test("cele 48 de profiluri din afara CAT3 Sală, CAT2 și CAT1 rămân bit-for-bit la checkpointul 132", () => {
  const rows = enumerateValidV2Profiles()
    .filter((profile) => !(profile.age === TARGET_AGE && profile.place === TARGET_PLACE)
      && profile.age !== "30-44"
      && !(profile.age === "18-29" && profile.place === "acasa")
      && !(profile.age === "18-29" && profile.place === "sala"))
    .map((profile) => {
      const plan = requirePlan(profile);
      return [profileKey(profile), sha(plan)];
    })
    .sort(([left], [right]) => left.localeCompare(right));
  const aggregate = createHash("sha256")
    .update(rows.map(([key, planHash]) => `${key}:${planHash}`).join("\n"))
    .digest("hex");
  assert.equal(rows.length, 48);
  assert.equal(aggregate, PROTECTED_CHECKPOINT_132_HASH);
});
