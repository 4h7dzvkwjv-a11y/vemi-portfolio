import assert from "node:assert/strict";
import test from "node:test";
import {
  CAT4_HOME_ALLOWLIST,
  CAT4_HOME_CRUNCH_PAIR,
  CAT4_HOME_DAILY_EXERCISE_COUNT,
  CAT4_HOME_EDITORIAL_TEMPLATES,
  CAT4_HOME_EXERCISES,
  CAT4_HOME_FLOOR_EXERCISES,
  CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR,
  CAT4_HOME_STANDING_EXERCISES,
  cat4HomeDailyExerciseCount,
} from "../lib/plan-engine/cat4-home-editorial.mjs";
import {
  auditGeneratedPlanV2,
  enumerateValidV2Profiles,
  generatePlanV2,
} from "../lib/plan-engine/v2-runtime.mjs";
import { projectPublicV2Week } from "../lib/plan-engine/public-v2-integration.mjs";
import { catalog, catalogByKey, registry } from "./helpers/plan-engine-v2-fixture.mjs";

const EXPECTED_TABLES = Object.freeze({
  "slabire:incepator-3": [
    "E1>E7>E6|E2>E8>E3|E4>E5>E10", "E2>E1>E9|E8>E7>E10|E5>E4>E6",
    "E7>E2>E3|E1>E4>E6|E8>E5>E9", "E5>E1>E10|E7>E8>E9|E2>E4>E3",
  ],
  "slabire:avansat-4": [
    "E1>E2>E7>E6|E8>E4>E5>E6|E2>E8>E7>E9|E1>E5>E4>E10", "E2>E1>E8>E9|E7>E5>E4>E10|E8>E2>E1>E3|E4>E7>E5>E6",
    "E7>E8>E1>E3|E5>E2>E4>E6|E1>E7>E8>E10|E2>E4>E5>E9", "E8>E2>E7>E10|E4>E1>E5>E9|E7>E8>E2>E6|E5>E1>E4>E6",
  ],
  "masa:incepator-3": [
    "E7>E3>E6|E8>E9>E10|E2>E7>E3", "E8>E6>E10|E7>E3>E9|E4>E5>E6",
    "E2>E9>E3|E4>E7>E10|E5>E6>E9", "E5>E6>E10|E1>E7>E6|E8>E2>E9",
  ],
  "masa:avansat-4": [
    "E7>E8>E3>E6|E2>E7>E9>E10|E4>E5>E6>E10|E1>E7>E10>E9", "E8>E7>E6>E10|E7>E2>E3>E9|E5>E4>E9>E6|E2>E8>E3>E10",
    "E2>E8>E9>E3|E4>E7>E6>E10|E7>E5>E6>E9|E8>E1>E10>E6", "E5>E7>E10>E6|E1>E8>E9>E6|E8>E2>E6>E3|E7>E4>E9>E10",
  ],
  "forma:incepator-3": [
    "E7>E2>E3|E8>E4>E6|E5>E1>E10", "E2>E5>E9|E4>E7>E10|E1>E8>E3",
    "E8>E2>E6|E5>E4>E10|E7>E1>E9", "E4>E8>E10|E1>E2>E9|E2>E7>E6",
  ],
  "forma:avansat-4": [
    "E1>E7>E6>E3|E2>E8>E9>E10|E4>E5>E6>E9|E7>E2>E10>E6", "E2>E5>E9>E6|E8>E7>E3>E10|E5>E4>E6>E10|E1>E8>E9>E3",
    "E7>E4>E10>E9|E4>E2>E6>E3|E1>E8>E3>E10|E5>E7>E9>E6", "E8>E2>E3>E9|E1>E5>E10>E6|E7>E4>E9>E3|E2>E8>E6>E10",
  ],
});

const codeByExercise = new Map(Object.entries(CAT4_HOME_EXERCISES).map(([code, key]) => [key, code]));
const templateSignature = (weeks) => weeks.map((week) => week.map((day) =>
  day.map((exerciseKey) => codeByExercise.get(exerciseKey)).join(">"),
).join("|"));
const planExerciseWeeks = (plan) => plan.weeks.map((week) => week.days.map((day) =>
  day.exercises.map((exercise) => exercise.exerciseKey),
));

test("maparea E1–E10 este canonică, unică și compatibilă cu Acasă", () => {
  assert.deepEqual(CAT4_HOME_EXERCISES, {
    E1: "alergare-pe-loc",
    E2: "atingeri-alternative-ale-piciorului-din-picioare",
    E3: "abdomene",
    E4: "aplecari-laterale-din-picioare",
    E5: "crunch-lateral-din-picioare",
    E6: "dead-bug",
    E7: "genuflexiuni",
    E8: "ridicari-de-genunchi-cu-rotatie",
    E9: "russian-twist",
    E10: "superman-alternativ",
  });
  assert.equal(CAT4_HOME_ALLOWLIST.length, 10);
  assert.equal(new Set(CAT4_HOME_ALLOWLIST).size, 10);
  for (const exerciseKey of CAT4_HOME_ALLOWLIST) {
    assert.ok(catalogByKey.has(exerciseKey), exerciseKey);
    assert.ok(catalogByKey.get(exerciseKey).places.includes("acasa"), exerciseKey);
  }
});

test("cele șase șabloane corespund exact tabelelor editoriale Plan A–F", () => {
  assert.equal(Object.keys(CAT4_HOME_EDITORIAL_TEMPLATES).length, 6);
  for (const [templateKey, expected] of Object.entries(EXPECTED_TABLES)) {
    assert.deepEqual(templateSignature(CAT4_HOME_EDITORIAL_TEMPLATES[templateKey]), expected, templateKey);
  }
});

test("CAT4 × Acasă generează exact 12 profiluri, 168 zile și 600 apariții", () => {
  const targetProfiles = enumerateValidV2Profiles().filter((profile) => profile.age === "60+" && profile.place === "acasa");
  assert.equal(targetProfiles.length, 12);
  const plans = targetProfiles.map((profile) => {
    const result = generatePlanV2(profile, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    return result.plan;
  });
  assert.equal(plans.filter((plan) => plan.profile.program === "incepator-3").length, 6);
  assert.equal(plans.filter((plan) => plan.profile.program === "avansat-4").length, 6);
  assert.equal(plans.filter((plan) => plan.profile.gender === "masculin").length, 6);
  assert.equal(plans.filter((plan) => plan.profile.gender === "feminin").length, 6);
  const beginnerDays = [];
  const advancedDays = [];
  for (const plan of plans) {
    const target = plan.profile.program === "incepator-3" ? beginnerDays : advancedDays;
    for (const week of plan.weeks) {
      const projected = projectPublicV2Week(plan, week.weekNumber);
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        target.push(week.days[dayIndex].exercises.length);
        assert.equal(projected[dayIndex].exercises.length, week.days[dayIndex].exercises.length);
      }
    }
  }
  assert.equal(beginnerDays.length, 72);
  assert.equal(beginnerDays.filter((count) => count === 3).length, 72);
  assert.equal(beginnerDays.filter((count) => count !== 3).length, 0);
  assert.equal(advancedDays.length, 96);
  assert.equal(advancedDays.filter((count) => count === 4).length, 96);
  assert.equal(advancedDays.filter((count) => count !== 4).length, 0);
  assert.equal([...beginnerDays, ...advancedDays].reduce((total, count) => total + count, 0), 600);
  assert.equal(new Set(plans.map((plan) => JSON.stringify(plan.weeks))).size, 6);
});

test("contractul editorial final oprește completarea generică înainte de materializare și proiecția UI", () => {
  assert.deepEqual(CAT4_HOME_DAILY_EXERCISE_COUNT, { "incepator-3": 3, "avansat-4": 4 });
  const targetProfiles = enumerateValidV2Profiles().filter((profile) => profile.age === "60+" && profile.place === "acasa");
  for (const profile of targetProfiles) {
    const result = generatePlanV2(profile, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.plan.structureTemplate, "cat4-home-editorial-batch-1");
    const expectedCount = cat4HomeDailyExerciseCount(profile);
    const editorialTemplate = CAT4_HOME_EDITORIAL_TEMPLATES[`${profile.goal}:${profile.program}`];
    for (let weekIndex = 0; weekIndex < result.plan.weeks.length; weekIndex += 1) {
      const projected = projectPublicV2Week(result.plan, weekIndex + 1);
      for (let dayIndex = 0; dayIndex < result.plan.weeks[weekIndex].days.length; dayIndex += 1) {
        const keys = result.plan.weeks[weekIndex].days[dayIndex].exercises.map((exercise) => exercise.exerciseKey);
        assert.equal(keys.length, expectedCount);
        assert.deepEqual(keys, editorialTemplate[weekIndex][dayIndex]);
        assert.equal(projected[dayIndex].exercises.length, expectedCount);
      }
    }
  }
});

test("planurile CAT4 × Acasă respectă allowlistul, ordinea, rotația și volumul fix", () => {
  const allowlist = new Set(CAT4_HOME_ALLOWLIST);
  const standing = new Set(CAT4_HOME_STANDING_EXERCISES);
  const floor = new Set(CAT4_HOME_FLOOR_EXERCISES);
  const crunchPair = new Set(CAT4_HOME_CRUNCH_PAIR);
  assert.deepEqual(CAT4_HOME_CRUNCH_PAIR, [CAT4_HOME_EXERCISES.E3, CAT4_HOME_EXERCISES.E5]);
  assert.equal(CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR, 1);
  const targetProfiles = enumerateValidV2Profiles().filter((profile) => profile.age === "60+" && profile.place === "acasa");
  for (const profile of targetProfiles) {
    const result = generatePlanV2(profile, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    const plan = result.plan;
    const used = new Set();
    const dailySequences = new Set();
    const parameterSignaturesByExercise = new Map();
    for (const week of plan.weeks) {
      assert.equal(week.days.length, profile.program === "incepator-3" ? 3 : 4);
      for (const day of week.days) {
        assert.equal(day.exercises.length, profile.program === "incepator-3" ? 3 : 4);
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        assert.equal(new Set(keys).size, keys.length);
        assert.ok(keys.every((key) => allowlist.has(key)));
        assert.ok(keys.filter((key) => crunchPair.has(key)).length <= CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR);
        const signature = keys.join("|");
        assert.equal(dailySequences.has(signature), false, `${plan.planKey}: ${signature}`);
        dailySequences.add(signature);
        let floorStarted = false;
        for (const exercise of day.exercises) {
          used.add(exercise.exerciseKey);
          if (floor.has(exercise.exerciseKey)) floorStarted = true;
          if (floorStarted) assert.equal(standing.has(exercise.exerciseKey), false, exercise.exerciseKey);
          const parameterSignature = [exercise.sets, exercise.target.kind, exercise.target.min, exercise.target.max, exercise.restSeconds].join(":");
          parameterSignaturesByExercise.set(exercise.exerciseKey, new Set([
            ...(parameterSignaturesByExercise.get(exercise.exerciseKey) ?? []),
            parameterSignature,
          ]));
        }
      }
    }
    assert.deepEqual(used, allowlist);
    assert.equal(new Set(plan.weeks.map((week) => JSON.stringify(week.days.map((day) => day.exercises.map((exercise) => exercise.exerciseKey))))).size, 4);
    for (let dayIndex = 0; dayIndex < plan.weeks[0].days.length; dayIndex += 1) {
      assert.equal(new Set(plan.weeks.map((week) => week.days[dayIndex].exercises[0].exerciseKey)).size, 4);
    }
    for (const signatures of parameterSignaturesByExercise.values()) assert.equal(signatures.size, 1);
  }
});

test("validatorul editorial respinge explicit coexistența perechii Crunch în aceeași zi", () => {
  const result = generatePlanV2({
    gender: "masculin",
    age: "60+",
    goal: "slabire",
    place: "acasa",
    program: "avansat-4",
  }, catalog, registry);
  assert.equal(result.status, "found");
  const invalidPlan = structuredClone(result.plan);
  const conflictDay = invalidPlan.weeks[0].days[1];
  assert.ok(conflictDay.exercises.some((exercise) => exercise.exerciseKey === CAT4_HOME_EXERCISES.E5));
  conflictDay.exercises[3] = {
    ...conflictDay.exercises[3],
    exerciseKey: CAT4_HOME_EXERCISES.E3,
  };
  const audit = auditGeneratedPlanV2(invalidPlan, catalog, registry);
  assert.equal(audit.valid, false);
  assert.ok(audit.issues.some((issue) => issue.includes("Pereche Crunch redundantă la S1 Z2: 2/1")));
});

test("perechile masculin/feminin sunt identice, iar CAT4 × Sală folosește propria structură editorială", () => {
  const profiles = enumerateValidV2Profiles();
  for (const goal of ["slabire", "masa", "forma"]) {
    for (const program of ["incepator-3", "avansat-4"]) {
      const common = { age: "60+", goal, place: "acasa", program };
      const male = generatePlanV2({ ...common, gender: "masculin" }, catalog, registry);
      const female = generatePlanV2({ ...common, gender: "feminin" }, catalog, registry);
      assert.equal(male.status, "found");
      assert.equal(female.status, "found");
      assert.deepEqual(planExerciseWeeks(male.plan), planExerciseWeeks(female.plan));
    }
  }
  const gymProfiles = profiles.filter((profile) => profile.age === "60+" && profile.place === "sala");
  assert.equal(gymProfiles.length, 12);
  for (const profile of gymProfiles) {
    const result = generatePlanV2(profile, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.plan.structureTemplate, "cat4-gym-editorial-complete");
  }
});
