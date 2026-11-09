import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CAT1_GYM_ADVANCED_ONLY,
  CAT1_GYM_EDITORIAL_TEMPLATES,
  CAT1_GYM_ELIGIBLE_POOL,
  CAT1_GYM_FEMALE_ALLOWLIST,
  CAT1_GYM_FEMALE_BEGINNER_ALLOWLIST,
  CAT1_GYM_FEMALE_FREE_BAR_FORBIDDEN,
  CAT1_GYM_HOME_ONLY_FORBIDDEN,
  CAT1_GYM_MALE_ADVANCED_ALLOWLIST,
  CAT1_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT1_GYM_MALE_BEGINNER_ALLOWLIST,
  CAT1_GYM_MALE_CHEST_CABLE,
  cat1GymAllowlist,
  cat1GymDailyExerciseCount,
  cat1GymDayMatchesStructure,
  cat1GymDayTitle,
  cat1GymSameFamilyConflicts,
} from "../lib/plan-engine/cat1-gym-editorial.mjs";
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
  activeFreePlanSessions,
  createPlanInstanceId,
  expectedFreePlanContentVersion,
  finalizeFreePlanSelections,
  hasCurrentFreePlanContentVersion,
  normalizeFreePlanSelectionsForCurrentContent,
  resetActiveFreePlanSnapshot,
  withPlanContentVersionKey,
  withPlanInstanceKey,
} from "../utils/progress/free-plan-state.mjs";
import {
  catalog,
  catalogByKey,
  registry,
  ruleByKey,
} from "./helpers/plan-engine-v2-fixture.mjs";

const TARGET_AGE = "18-29";
const TARGET_PLACE = "sala";
const PROGRAMS = Object.freeze(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOALS = Object.freeze(["slabire", "masa", "forma"]);
const TARGET_PROFILES = enumerateValidV2Profiles().filter((profile) =>
  profile.age === TARGET_AGE && profile.place === TARGET_PLACE,
);
const PROTECTED_CHECKPOINT_132_HASH = "0fc0dcb4eaee3edfc52848c2c1a4edf38fb8592af793fc9115b503a3256b7515";

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

function isFemaleMachineExercise(key) {
  return key.includes("aparat")
    || key.includes("cablu")
    || key.includes("helcometru")
    || key.startsWith("presa-")
    || key === "pec-deck";
}

test("CAT1 Gym reutilizează exact contractele canonice 105/56/101", () => {
  assert.strictEqual(CAT1_GYM_ELIGIBLE_POOL, CAT3_GYM_ELIGIBLE_POOL);
  assert.strictEqual(CAT1_GYM_FEMALE_ALLOWLIST, CAT3_GYM_FEMALE_ALLOWLIST);
  assert.strictEqual(CAT1_GYM_MALE_ADVANCED_ALLOWLIST, CAT3_GYM_MALE_ADVANCED_ALLOWLIST);
  assert.equal(CAT1_GYM_ELIGIBLE_POOL.length, 105);
  assert.equal(CAT1_GYM_FEMALE_ALLOWLIST.length, 56);
  assert.equal(new Set(CAT1_GYM_FEMALE_ALLOWLIST).size, 56);
  assert.equal(CAT1_GYM_FEMALE_BEGINNER_ALLOWLIST.length, 49);
  assert.equal(CAT1_GYM_MALE_BEGINNER_ALLOWLIST.length, 84);
  assert.equal(CAT1_GYM_MALE_ADVANCED_ALLOWLIST.length, 101);
  assert.ok(CAT1_GYM_MALE_ADVANCED_ALLOWLIST.includes("dips-paralele"));
  assert.ok(CAT1_GYM_MALE_BEGINNER_ALLOWLIST.includes("flotari"));
  assert.equal(CAT1_GYM_MALE_BEGINNER_ALLOWLIST.includes("flotari-hindu"), false);
  assert.ok(CAT1_GYM_FEMALE_FREE_BAR_FORBIDDEN.every((key) => !CAT1_GYM_FEMALE_ALLOWLIST.includes(key)));

  for (const key of CAT1_GYM_ELIGIBLE_POOL) {
    const exercise = catalogByKey.get(key);
    const rule = ruleByKey.get(key);
    assert.ok(exercise, key);
    assert.ok(rule, key);
    assert.ok(exercise.places.includes("sala"), key);
    assert.ok(rule.places.includes("sala"), key);
  }
  for (const key of CAT1_GYM_HOME_ONLY_FORBIDDEN) {
    assert.equal(CAT1_GYM_ELIGIBLE_POOL.includes(key), false, key);
  }
});

test("cele 24 de șabloane respectă structurile, volumul și variația celor patru săptămâni", () => {
  assert.equal(TARGET_PROFILES.length, 24);
  assert.equal(Object.keys(CAT1_GYM_EDITORIAL_TEMPLATES).length, 24);
  for (const profile of TARGET_PROFILES) {
    const template = CAT1_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`];
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
        assert.equal(day.length, cat1GymDailyExerciseCount(profile));
        assert.equal(new Set(day).size, day.length, `${profileKey(profile)} S${weekIndex + 1} Z${dayIndex + 1}`);
        assert.ok(day.every((key) => cat1GymAllowlist(profile).includes(key)), profileKey(profile));
        assert.ok(day.every((key) => !CAT1_GYM_HOME_ONLY_FORBIDDEN.includes(key)), profileKey(profile));
        assert.deepEqual(cat1GymSameFamilyConflicts(day), []);
        assert.equal(
          cat1GymDayMatchesStructure(profile, weekIndex, dayIndex, day.map((key) => catalogByKey.get(key).group)),
          true,
          `${profileKey(profile)} S${weekIndex + 1} Z${dayIndex + 1}`,
        );
        const signature = day.join("|");
        assert.equal(dailySignatures.has(signature), false, `${profileKey(profile)} ${signature}`);
        dailySignatures.add(signature);
        if (profile.program === "incepator-3") {
          if (cat1GymDayTitle(profile, weekIndex, dayIndex) === "Partea superioară") upperDays += 1;
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
      const firstExercises = requirePlan(profile).weeks.map((week) => week.days[dayIndex].exercises[0].exerciseKey);
      assert.ok(new Set(firstExercises).size >= 2, `${profileKey(profile)} Z${dayIndex + 1}`);
    }
  }
});

test("generatorul și resolverul public produc 24 profiluri, 384 zile și exact 1.908 apariții", () => {
  const distribution = new Map();
  const genderOccurrences = new Map();
  let totalDays = 0;
  let totalOccurrences = 0;
  for (const profile of TARGET_PROFILES) {
    const publicResult = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(publicResult.status, "found", publicResult.issues?.join("\n"));
    assert.equal(publicResult.fallbackUsed, false);
    assert.equal(publicResult.plan.structureTemplate, "cat1-gym-editorial-complete");
    assert.equal(auditGeneratedPlanV2(publicResult.plan, catalog, registry).valid, true);
    for (const day of publicResult.plan.weeks.flatMap((week) => week.days)) {
      totalDays += 1;
      totalOccurrences += day.exercises.length;
      distribution.set(day.exercises.length, (distribution.get(day.exercises.length) ?? 0) + 1);
      genderOccurrences.set(profile.gender, (genderOccurrences.get(profile.gender) ?? 0) + day.exercises.length);
    }
  }
  assert.equal(totalDays, 384);
  assert.equal(totalOccurrences, 1908);
  assert.equal(distribution.get(4), 120);
  assert.equal(distribution.get(5), 156);
  assert.equal(distribution.get(6), 108);
  assert.equal(genderOccurrences.get("feminin"), 876);
  assert.equal(genderOccurrences.get("masculin"), 1032);
});

test("allowlisturile, compatibilitatea și toate restricțiile Gym sunt respectate", () => {
  const advancedOnly = new Set(CAT1_GYM_ADVANCED_ONLY);
  const femaleAllowlist = new Set(CAT1_GYM_FEMALE_ALLOWLIST);
  const femaleFreeBar = new Set(CAT1_GYM_FEMALE_FREE_BAR_FORBIDDEN);
  const maleAdvancedForbidden = new Set(CAT1_GYM_MALE_ADVANCED_FORBIDDEN);
  for (const profile of TARGET_PROFILES) {
    const plan = requirePlan(profile);
    const exercises = plan.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises);
    const keys = exercises.map((exercise) => exercise.exerciseKey);
    assert.equal(keys.includes("flotari-hindu"), false, profileKey(profile));
    assert.ok(keys.every((key) => !CAT1_GYM_HOME_ONLY_FORBIDDEN.includes(key)), profileKey(profile));
    assert.ok(keys.every((key) => catalogByKey.has(key) && ruleByKey.has(key)), profileKey(profile));
    for (const exercise of exercises) {
      const catalogExercise = catalogByKey.get(exercise.exerciseKey);
      const rule = ruleByKey.get(exercise.exerciseKey);
      assert.ok(catalogExercise.places.includes("sala"), exercise.exerciseKey);
      assert.ok(rule.places.includes("sala"), exercise.exerciseKey);
      assert.ok(rule.level.eligible.includes(VALID_PROGRAMS[profile.program].level), exercise.exerciseKey);
      assert.ok((profile.gender === "feminin" ? rule.female_priority : rule.male_priority) > 0, exercise.exerciseKey);
    }
    if (profile.gender === "feminin") {
      assert.ok(keys.every((key) => femaleAllowlist.has(key)), profileKey(profile));
      assert.ok(keys.every((key) => !femaleFreeBar.has(key)), profileKey(profile));
      const machineOccurrences = keys.filter(isFemaleMachineExercise).length;
      const dumbbellOccurrences = keys.filter((key) => key.includes("ganter")).length;
      assert.ok(machineOccurrences > dumbbellOccurrences, `${profileKey(profile)} ${machineOccurrences}/${dumbbellOccurrences}`);
    }
    if (profile.program.startsWith("incepator")) {
      assert.ok(keys.every((key) => !advancedOnly.has(key)), profileKey(profile));
    }
    if (profile.gender === "masculin" && profile.program.startsWith("avansat")) {
      assert.ok(keys.every((key) => !maleAdvancedForbidden.has(key)), profileKey(profile));
    }
    if (profile.gender === "masculin") {
      assert.ok(keys.filter((key) => CAT1_GYM_MALE_CHEST_CABLE.includes(key)).length <= 2, profileKey(profile));
    }
  }
});

test("ordinea publică păstrează principalele înaintea auxiliarelor și Abdomen/Cardio la final", () => {
  for (const profile of TARGET_PROFILES) {
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    for (let weekIndex = 0; weekIndex < result.plan.weeks.length; weekIndex += 1) {
      const week = result.plan.weeks[weekIndex];
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        assert.equal(day.title, cat1GymDayTitle(profile, weekIndex, dayIndex));
        assert.equal(cat1GymDayMatchesStructure(profile, weekIndex, dayIndex, day.exercises.map((exercise) => exercise.group)), true);
        assert.ok(day.exercises.some((exercise) => exercise.role === "principal"));
        assert.equal(day.exercises.filter((exercise) => exercise.role === "auxiliar").length <= day.exercises.length / 2, true);
        assert.equal(new Set(keys).size, keys.length);
        assert.deepEqual(cat1GymSameFamilyConflicts(keys), []);
        const endingIndex = day.exercises.findIndex((exercise) => exercise.group === "Abdomen" || exercise.group === "Cardio");
        if (endingIndex !== -1) {
          assert.ok(day.exercises.slice(endingIndex).every((exercise) => exercise.group === "Abdomen" || exercise.group === "Cardio"));
        }
        const strength = endingIndex === -1 ? day.exercises : day.exercises.slice(0, endingIndex);
        const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
        const roles = strength.map((exercise) => roleOrder[exercise.role]);
        assert.deepEqual(roles, [...roles].sort((left, right) => left - right));
        assert.equal(projected[dayIndex].exercises.length, keys.length);
      }
    }
  }
});

test("planurile sunt deterministe, 24/24 unice și diferențiate real după obiectiv", () => {
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
      const selectedSets = plans.map((plan) => [...new Set(planWeeks(plan).flat(2))].sort().join("|"));
      assert.equal(new Set(selectedSets).size, 3, `${gender}:${program}:selection`);
    }
});

test("versiunea CAT1 Gym resetează numai instanța veche, păstrează refresh-ul și istoricul", () => {
  const base = { gender: "feminin", age: "cat1", goal: "masa", place: "sala", program: "avansat-5" };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat1-gym-editorial-pre-v1" },
  ]) {
    const normalized = normalizeFreePlanSelectionsForCurrentContent(stale);
    assert.equal(normalized.engineVersion, "v2");
    assert.equal(normalized.program, undefined);
    assert.equal(normalized.planInstanceId, undefined);
    assert.equal(normalized.contentVersion, undefined);
  }
  const firstInstance = createPlanInstanceId(() => "11111111-1111-4111-8111-111111111111");
  const secondInstance = createPlanInstanceId(() => "22222222-2222-4222-8222-222222222222");
  const current = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "avansat-5",
    firstInstance,
  );
  const regenerated = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "avansat-5",
    secondInstance,
  );
  assert.ok(current);
  assert.ok(regenerated);
  assert.equal(current.contentVersion, "cat1-gym-editorial-v1");
  assert.equal(current.contentVersion, expectedFreePlanContentVersion(current));
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);
  assert.notEqual(current.planInstanceId, regenerated.planInstanceId);

  const history = [{ id: "history-old" }];
  const reset = resetActiveFreePlanSnapshot({
    selections: current,
    activeWeek: 4,
    completed: ["w1-sala-Ziua 1"],
    logs: history,
  });
  assert.equal(reset.activeWeek, 1);
  assert.deepEqual(reset.completed, []);
  assert.strictEqual(reset.logs, history);

  const canonicalKey = "plan:v2:feminin:18-29:masa:sala:avansat-5";
  const plan = {
    id: "new-plan",
    plan_key: withPlanInstanceKey(withPlanContentVersionKey(canonicalKey, current.contentVersion), secondInstance),
    started_at: "2026-08-10T08:00:00.000Z",
  };
  const sessions = [
    { id: "old", source: "free_plan", free_plan_id: "new-plan", completed_at: "2026-08-09T08:00:00.000Z" },
    { id: "new", source: "free_plan", free_plan_id: "new-plan", completed_at: "2026-08-10T09:00:00.000Z" },
  ];
  assert.deepEqual(activeFreePlanSessions(plan, sessions).map((session) => session.id), ["new"]);
});

test("cele 144 de profiluri non-target rămân bit-for-bit la checkpointul 132", () => {
  const rows = enumerateValidV2Profiles()
    .filter((profile) => !(profile.age === TARGET_AGE && profile.place === TARGET_PLACE))
    .map((profile) => [profileKey(profile), sha(requirePlan(profile))])
    .sort(([left], [right]) => left.localeCompare(right));
  const aggregate = createHash("sha256")
    .update(rows.map(([key, planHash]) => `${key}:${planHash}`).join("\n"))
    .digest("hex");
  assert.equal(rows.length, 144);
  assert.equal(aggregate, PROTECTED_CHECKPOINT_132_HASH);
});
