import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CAT2_GYM_ADVANCED_ONLY,
  CAT2_GYM_EDITORIAL_TEMPLATES,
  CAT2_GYM_ELIGIBLE_POOL,
  CAT2_GYM_FEMALE_ALLOWLIST,
  CAT2_GYM_FEMALE_BEGINNER_ALLOWLIST,
  CAT2_GYM_HOME_ONLY_FORBIDDEN,
  CAT2_GYM_MALE_ADVANCED_ALLOWLIST,
  CAT2_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT2_GYM_MALE_BEGINNER_ALLOWLIST,
  CAT2_GYM_MALE_CHEST_CABLE,
  cat2GymAllowlist,
  cat2GymDailyExerciseCount,
  cat2GymDayMatchesStructure,
  cat2GymDayTitle,
  cat2GymSameFamilyConflicts,
} from "../lib/plan-engine/cat2-gym-editorial.mjs";
import {
  CAT3_GYM_ELIGIBLE_POOL,
  CAT3_GYM_FEMALE_ALLOWLIST,
  CAT3_GYM_MALE_ADVANCED_ALLOWLIST,
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
  registry,
  ruleByKey,
} from "./helpers/plan-engine-v2-fixture.mjs";

const TARGET_AGE = "30-44";
const TARGET_PLACE = "sala";
const PROGRAMS = Object.freeze(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOALS = Object.freeze(["slabire", "masa", "forma"]);
const TARGET_PROFILES = enumerateValidV2Profiles().filter((profile) =>
  profile.age === TARGET_AGE && profile.place === TARGET_PLACE,
);
const PROTECTED_CHECKPOINT_132_HASH = "932c23ae761b022f3e135b2d14c355e704a885e4ec99c3d5903c5115c4f651cd";

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

test("CAT2 Gym reutilizează exact contractele canonice 105/56/101 și păstrează eligibilitatea de nivel", () => {
  assert.strictEqual(CAT2_GYM_ELIGIBLE_POOL, CAT3_GYM_ELIGIBLE_POOL);
  assert.strictEqual(CAT2_GYM_FEMALE_ALLOWLIST, CAT3_GYM_FEMALE_ALLOWLIST);
  assert.strictEqual(CAT2_GYM_MALE_ADVANCED_ALLOWLIST, CAT3_GYM_MALE_ADVANCED_ALLOWLIST);
  assert.equal(CAT2_GYM_ELIGIBLE_POOL.length, 105);
  assert.equal(CAT2_GYM_FEMALE_ALLOWLIST.length, 56);
  assert.equal(CAT2_GYM_FEMALE_BEGINNER_ALLOWLIST.length, 49);
  assert.equal(CAT2_GYM_MALE_BEGINNER_ALLOWLIST.length, 84);
  assert.equal(CAT2_GYM_MALE_ADVANCED_ALLOWLIST.length, 101);
  assert.ok(CAT2_GYM_MALE_ADVANCED_ALLOWLIST.includes("dips-paralele"));
  assert.ok(CAT2_GYM_MALE_BEGINNER_ALLOWLIST.includes("flotari"));

  for (const key of CAT2_GYM_ELIGIBLE_POOL) {
    const exercise = catalogByKey.get(key);
    const rule = ruleByKey.get(key);
    assert.ok(exercise, key);
    assert.ok(rule, key);
    assert.ok(exercise.places.includes("sala"), key);
    assert.ok(rule.places.includes("sala"), key);
  }
  for (const key of CAT2_GYM_HOME_ONLY_FORBIDDEN) assert.equal(CAT2_GYM_ELIGIBLE_POOL.includes(key), false, key);
});

test("cele 24 de șabloane respectă exact structurile musculare, volumul și variația celor patru săptămâni", () => {
  assert.equal(TARGET_PROFILES.length, 24);
  assert.equal(Object.keys(CAT2_GYM_EDITORIAL_TEMPLATES).length, 24);
  for (const profile of TARGET_PROFILES) {
    const template = CAT2_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`];
    assert.ok(template, profileKey(profile));
    assert.equal(template.length, 4);
    assert.equal(new Set(template.map((week) => JSON.stringify(week))).size, 4, profileKey(profile));
    const dailySignatures = new Set();
    let upperDays = 0;
    let lowerDays = 0;
    for (let weekIndex = 0; weekIndex < template.length; weekIndex += 1) {
      const week = template[weekIndex];
      assert.equal(week.length, VALID_PROGRAMS[profile.program].daysPerWeek);
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        assert.equal(day.length, cat2GymDailyExerciseCount(profile));
        assert.equal(new Set(day).size, day.length);
        assert.ok(day.every((key) => cat2GymAllowlist(profile).includes(key)), profileKey(profile));
        assert.ok(day.every((key) => !CAT2_GYM_HOME_ONLY_FORBIDDEN.includes(key)), profileKey(profile));
        assert.deepEqual(cat2GymSameFamilyConflicts(day), []);
        const groups = day.map((key) => catalogByKey.get(key).group);
        assert.equal(cat2GymDayMatchesStructure(profile, weekIndex, dayIndex, groups), true, `${profileKey(profile)} S${weekIndex + 1} Z${dayIndex + 1}`);
        const signature = day.join("|");
        assert.equal(dailySignatures.has(signature), false, `${profileKey(profile)} ${signature}`);
        dailySignatures.add(signature);
        if (profile.program === "incepator-3") {
          if (cat2GymDayTitle(profile, weekIndex, dayIndex) === "Partea superioară") upperDays += 1;
          else lowerDays += 1;
        }
      }
      const lowerPair = profile.program === "incepator-4" ? [1, 3]
        : profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerPair) {
        const first = new Set(week[lowerPair[0]].filter((key) => catalogByKey.get(key).group === "Picioare"));
        assert.deepEqual(
          week[lowerPair[1]].filter((key) => catalogByKey.get(key).group === "Picioare" && first.has(key)),
          [],
          profileKey(profile),
        );
      }
    }
    if (profile.program === "incepator-3") {
      assert.equal(upperDays, 6);
      assert.equal(lowerDays, 6);
    }
    for (let dayIndex = 0; dayIndex < template[0].length; dayIndex += 1) {
      assert.ok(new Set(template.map((week) => week[dayIndex][0])).size >= 2, `${profileKey(profile)} Z${dayIndex + 1}`);
    }
  }
});

test("generatorul produce exact 24 profiluri, 384 zile și 1.860 de apariții", () => {
  const distribution = new Map();
  const genderOccurrences = new Map();
  let totalDays = 0;
  let totalOccurrences = 0;
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    for (const day of plan.weeks.flatMap((week) => week.days)) {
      totalDays += 1;
      totalOccurrences += day.exercises.length;
      distribution.set(day.exercises.length, (distribution.get(day.exercises.length) ?? 0) + 1);
      genderOccurrences.set(profile.gender, (genderOccurrences.get(profile.gender) ?? 0) + day.exercises.length);
    }
  }
  assert.equal(totalDays, 384);
  assert.equal(totalOccurrences, 1860);
  assert.equal(distribution.get(4), 168);
  assert.equal(distribution.get(5), 108);
  assert.equal(distribution.get(6), 108);
  assert.equal(genderOccurrences.get("feminin"), 876);
  assert.equal(genderOccurrences.get("masculin"), 984);
});

test("allowlisturile, restricțiile și limita pentru piept la cablu sunt respectate în toate planurile", () => {
  const advancedOnly = new Set(CAT2_GYM_ADVANCED_ONLY);
  const femaleAllowlist = new Set(CAT2_GYM_FEMALE_ALLOWLIST);
  const maleAdvancedForbidden = new Set(CAT2_GYM_MALE_ADVANCED_FORBIDDEN);
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    const keys = plan.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises.map((exercise) => exercise.exerciseKey));
    assert.equal(keys.includes("flotari-hindu"), false, profileKey(profile));
    assert.ok(keys.every((key) => !CAT2_GYM_HOME_ONLY_FORBIDDEN.includes(key)), profileKey(profile));
    if (profile.gender === "feminin") assert.ok(keys.every((key) => femaleAllowlist.has(key)), profileKey(profile));
    if (profile.program.startsWith("incepator")) assert.ok(keys.every((key) => !advancedOnly.has(key)), profileKey(profile));
    if (profile.gender === "masculin" && profile.program.startsWith("avansat")) {
      assert.ok(keys.every((key) => !maleAdvancedForbidden.has(key)), profileKey(profile));
    }
    if (profile.gender === "masculin") {
      assert.ok(keys.filter((key) => CAT2_GYM_MALE_CHEST_CABLE.includes(key)).length <= 2, profileKey(profile));
    }
  }
});

test("materializarea publică păstrează titlurile, grupele, ordinea și auditul editorial", () => {
  for (const profile of TARGET_PROFILES) {
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.plan.structureTemplate, "cat2-gym-editorial-complete");
    assert.equal(auditGeneratedPlanV2(result.plan, catalog, registry).valid, true);
    for (let weekIndex = 0; weekIndex < result.plan.weeks.length; weekIndex += 1) {
      const week = result.plan.weeks[weekIndex];
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        assert.equal(day.title, cat2GymDayTitle(profile, weekIndex, dayIndex));
        assert.equal(cat2GymDayMatchesStructure(profile, weekIndex, dayIndex, day.exercises.map((exercise) => exercise.group)), true);
        assert.ok(day.exercises.some((exercise) => exercise.role === "principal"));
        assert.equal(day.exercises.filter((exercise) => exercise.role === "auxiliar").length <= day.exercises.length / 2, true);
        assert.deepEqual(cat2GymSameFamilyConflicts(keys), []);
        const endingIndex = day.exercises.findIndex((exercise) => exercise.group === "Abdomen" || exercise.group === "Cardio");
        if (endingIndex !== -1) {
          assert.ok(day.exercises.slice(endingIndex).every((exercise) => exercise.group === "Abdomen" || exercise.group === "Cardio"));
        }
        const strength = endingIndex === -1 ? day.exercises : day.exercises.slice(0, endingIndex);
        const firstAuxiliary = strength.findIndex((exercise) => exercise.role === "auxiliar");
        if (firstAuxiliary !== -1) assert.ok(strength.slice(firstAuxiliary).every((exercise) => exercise.role === "auxiliar"));
        assert.equal(projected[dayIndex].exercises.length, keys.length);
      }
    }
  }
});

test("toate planurile sunt deterministe, unice și diferențiate controlat după obiectiv", () => {
  const signatures = new Set();
  for (const profile of TARGET_PROFILES) {
    const first = requirePlan(profile);
    const second = requirePlan(profile);
    assert.deepEqual(second, first, profileKey(profile));
    signatures.add(JSON.stringify(planWeeks(first)));
  }
  assert.equal(signatures.size, 24);
  for (const gender of ["masculin", "feminin"])
    for (const program of PROGRAMS) {
      const plans = GOALS.map((goal) => requirePlan({ gender, age: TARGET_AGE, goal, place: TARGET_PLACE, program }));
      assert.equal(new Set(plans.map((plan) => JSON.stringify(planWeeks(plan)))).size, 3, `${gender}:${program}`);
    }
});

test("versiunea editorială CAT2 × La sală resetează selecția veche și persistă la refresh", () => {
  const base = { gender: "feminin", age: "cat2", goal: "masa", place: "sala", program: "avansat-5" };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat2-gym-editorial-pre-v1" },
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
    createPlanInstanceId(() => "44444444-4444-4444-8444-444444444444"),
  );
  assert.ok(current);
  assert.equal(current.contentVersion, "cat2-gym-editorial-v1");
  assert.equal(current.contentVersion, expectedFreePlanContentVersion(current));
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);
});

test("cele 96 de profiluri din afara CAT2 Sală și CAT1 rămân bit-for-bit la checkpointul 132", () => {
  const rows = enumerateValidV2Profiles()
    .filter((profile) => !(profile.age === TARGET_AGE && profile.place === TARGET_PLACE)
      && !(profile.age === "18-29" && profile.place === "acasa")
      && !(profile.age === "18-29" && profile.place === "sala"))
    .map((profile) => [profileKey(profile), sha(requirePlan(profile))])
    .sort(([left], [right]) => left.localeCompare(right));
  const aggregate = createHash("sha256")
    .update(rows.map(([key, planHash]) => `${key}:${planHash}`).join("\n"))
    .digest("hex");
  assert.equal(rows.length, 96);
  assert.equal(aggregate, PROTECTED_CHECKPOINT_132_HASH);
});
