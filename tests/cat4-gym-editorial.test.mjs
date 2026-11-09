import assert from "node:assert/strict";
import test from "node:test";
import {
  CAT4_GYM_ALLOWLIST,
  CAT4_GYM_DAILY_EXERCISE_COUNT,
  CAT4_GYM_DAY_GROUPS,
  CAT4_GYM_DAY_TITLES,
  CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE,
  CAT4_GYM_EDITORIAL_TEMPLATES,
  CAT4_GYM_EXERCISES,
  cat4GymDailyExerciseCount,
} from "../lib/plan-engine/cat4-gym-editorial.mjs";
import {
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

const EXPECTED_KEYS = Object.freeze({
  A1: "abdomene",
  A2: "dead-bug",
  A3: "russian-twist",
  L1: "extensii-pentru-femurali-din-culcat",
  L2: "extensii-cvadriceps",
  L3: "flexii-pentru-picioare-la-aparat",
  L4: "genuflexiuni",
  L5: "presa-pentru-picioare-la-aparat-din-sezut",
  L6: "presa-pentru-picioare-la-45",
  C1: "fluturari-la-aparat",
  C2: "impins-cu-gantere-apropiate",
  C3: "impins-la-aparat",
  C4: "pec-deck",
  S1: "fluturari-inverse",
  S2: "ridicari-laterale-cu-gantere-din-sezut-cu-spatele-sprijinit",
  S3: "impins-cu-gantere-pentru-umeri-din-sezut",
  S4: "ridicari-laterale-cu-gantere-din-sezut",
  T1: "extensii-pentru-triceps-la-cablu-cu-bara",
  T2: "extensii-pentru-triceps-la-cablu-cu-franghia",
  B1: "ramat-aparat",
  B2: "tractiuni-la-helcometru-cu-priza-ingusta",
  B3: "tractiuni-la-helcometru-cu-priza-larga",
  I1: "flexii-gantere",
  I2: "flexii-la-cablu-cu-franghia",
});

const EXPECTED_APPROVED = Object.freeze({
  "slabire:incepator-3": [
    "C3>S2>T2|L5>L2>L1|B2>I2>A2",
    "S3>C1>T1|L4>L6>L3|I1>B1>A1",
    "T2>C2>S1|L6>L1>L2|B3>A3>I2",
    "S4>T1>C4|L3>L4>L5|A2>I1>B2",
  ],
  "slabire:avansat-4": [
    "C3>S3>T2>A2|L4>L2>L1>A3|B2>I2>A1>A2|L5>L6>L3>A1",
    "C1>S2>T1>A3|L5>L3>L2>A2|B1>I1>A1>A3|L4>L6>L1>A1",
    "C2>S1>T2>A1|L6>L1>L4>A3|B3>I2>A2>A1|L5>L2>L3>A2",
    "C4>S4>T1>A2|L4>L3>L5>A1|B2>I1>A3>A2|L6>L2>L1>A3",
  ],
});

const codeByExercise = new Map(Object.entries(CAT4_GYM_EXERCISES).map(([code, key]) => [key, code]));
const templateSignature = (weeks) => weeks.map((week) => week.map((day) =>
  day.map((exerciseKey) => codeByExercise.get(exerciseKey)).join(">"),
).join("|"));
const planExerciseWeeks = (plan) => plan.weeks.map((week) => week.days.map((day) =>
  day.exercises.map((exercise) => exercise.exerciseKey),
));

function requirePlan(profile) {
  const result = generatePlanV2(profile, catalog, registry);
  assert.equal(result.status, "found", result.issues?.join("\n"));
  return result.plan;
}

test("allowlistul CAT4 × La sală rezolvă exact cele 24 de exerciții canonice active", () => {
  assert.deepEqual(CAT4_GYM_EXERCISES, EXPECTED_KEYS);
  assert.equal(CAT4_GYM_ALLOWLIST.length, 24);
  assert.equal(new Set(CAT4_GYM_ALLOWLIST).size, 24);
  assert.equal(Object.keys(CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE).length, 24);
  for (const exerciseKey of CAT4_GYM_ALLOWLIST) {
    const exercise = catalogByKey.get(exerciseKey);
    const rule = ruleByKey.get(exerciseKey);
    assert.ok(exercise, exerciseKey);
    assert.ok(rule, exerciseKey);
    assert.ok(exercise.places.includes("sala"), exerciseKey);
    assert.ok(rule.places.includes("sala"), exerciseKey);
    assert.ok(rule.male_priority > 0, exerciseKey);
    assert.ok(rule.female_priority > 0, exerciseKey);
  }
  assert.equal(CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE[CAT4_GYM_EXERCISES.S1], "Umeri");
  assert.equal(catalogByKey.get(CAT4_GYM_EXERCISES.S1).group, "Spate");
});

test("cele două planuri Slăbire corespund exact tabelelor aprobate", () => {
  for (const [templateKey, expected] of Object.entries(EXPECTED_APPROVED)) {
    assert.deepEqual(templateSignature(CAT4_GYM_EDITORIAL_TEMPLATES[templateKey]), expected, templateKey);
  }
});

test("cele șase șabloane sunt canonice, distincte și respectă împărțirea musculară", () => {
  assert.deepEqual(CAT4_GYM_DAILY_EXERCISE_COUNT, { "incepator-3": 3, "avansat-4": 4 });
  assert.equal(Object.keys(CAT4_GYM_EDITORIAL_TEMPLATES).length, 6);
  const allUsed = new Set();
  const templateSignatures = new Set();
  for (const [templateKey, weeks] of Object.entries(CAT4_GYM_EDITORIAL_TEMPLATES)) {
    const program = templateKey.split(":")[1];
    const expectedDays = program === "incepator-3" ? 3 : 4;
    const expectedCount = CAT4_GYM_DAILY_EXERCISE_COUNT[program];
    assert.equal(weeks.length, 4, templateKey);
    assert.equal(new Set(weeks.map((week) => JSON.stringify(week))).size, 4, templateKey);
    const dailySignatures = new Set();
    for (const week of weeks) {
      assert.equal(week.length, expectedDays, templateKey);
      for (let dayIndex = 0; dayIndex < week.length; dayIndex += 1) {
        const day = week[dayIndex];
        assert.equal(day.length, expectedCount, templateKey);
        assert.equal(new Set(day).size, day.length, templateKey);
        assert.ok(day.every((key) => CAT4_GYM_ALLOWLIST.includes(key)), templateKey);
        const actualGroups = day.map((key) => CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE[key]).sort();
        assert.deepEqual(actualGroups, [...CAT4_GYM_DAY_GROUPS[program][dayIndex]].sort(), templateKey);
        const signature = day.join("|");
        assert.equal(dailySignatures.has(signature), false, `${templateKey}: ${signature}`);
        dailySignatures.add(signature);
        day.forEach((key) => allUsed.add(key));
      }
    }
    templateSignatures.add(JSON.stringify(weeks));
  }
  assert.equal(templateSignatures.size, 6);
  assert.deepEqual(allUsed, new Set(CAT4_GYM_ALLOWLIST));
});

test("CAT4 × La sală generează 12 profiluri, 168 zile și exact 600 apariții", () => {
  const profiles = enumerateValidV2Profiles().filter((profile) => profile.age === "60+" && profile.place === "sala");
  assert.equal(profiles.length, 12);
  const plans = profiles.map(requirePlan);
  const beginnerDays = [];
  const advancedDays = [];
  for (const plan of plans) {
    assert.equal(plan.structureTemplate, "cat4-gym-editorial-complete");
    const target = plan.profile.program === "incepator-3" ? beginnerDays : advancedDays;
    for (const week of plan.weeks) {
      const projected = projectPublicV2Week(plan, week.weekNumber);
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        assert.equal(day.title, CAT4_GYM_DAY_TITLES[plan.profile.program][dayIndex]);
        assert.equal(projected[dayIndex].exercises.length, day.exercises.length);
        target.push(day.exercises.length);
      }
    }
  }
  assert.equal(beginnerDays.length, 72);
  assert.equal(beginnerDays.filter((count) => count === 3).length, 72);
  assert.equal(beginnerDays.reduce((total, count) => total + count, 0), 216);
  assert.equal(advancedDays.length, 96);
  assert.equal(advancedDays.filter((count) => count === 4).length, 96);
  assert.equal(advancedDays.reduce((total, count) => total + count, 0), 384);
  assert.equal([...beginnerDays, ...advancedDays].reduce((total, count) => total + count, 0), 600);
  assert.equal(new Set(plans.map((plan) => JSON.stringify(plan.weeks))).size, 6);
});

test("perechile masculin/feminin sunt identice, iar cele șase planuri rămân deterministe", () => {
  for (const goal of ["slabire", "masa", "forma"]) {
    for (const program of ["incepator-3", "avansat-4"]) {
      const common = { age: "60+", goal, place: "sala", program };
      const male = requirePlan({ ...common, gender: "masculin" });
      const female = requirePlan({ ...common, gender: "feminin" });
      assert.deepEqual(planExerciseWeeks(male), planExerciseWeeks(female));
      assert.equal(parameterSignature(requirePlan({ ...common, gender: "masculin" })), parameterSignature(male));
      assert.equal(parameterSignature(requirePlan({ ...common, gender: "masculin" })), parameterSignature(male));
    }
  }
});

test("planurile Avansat separă complet Zilele 2/4 și folosesc două abdomen distincte în Ziua 3", () => {
  for (const goal of ["slabire", "masa", "forma"]) {
    const plan = requirePlan({ gender: "masculin", age: "60+", goal, place: "sala", program: "avansat-4" });
    for (const week of plan.weeks) {
      const dayTwo = new Set(week.days[1].exercises.map((exercise) => exercise.exerciseKey));
      const dayFour = week.days[3].exercises.map((exercise) => exercise.exerciseKey);
      assert.equal(dayFour.filter((key) => dayTwo.has(key)).length, 0);
      const dayThreeAbs = week.days[2].exercises
        .map((exercise) => exercise.exerciseKey)
        .filter((key) => CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE[key] === "Abdomen");
      assert.equal(dayThreeAbs.length, 2);
      assert.equal(new Set(dayThreeAbs).size, 2);
    }
  }
});

test("validatorul respinge suprapuneri Avansat și abateri de la șablonul canonic", () => {
  const plan = requirePlan({
    gender: "masculin",
    age: "60+",
    goal: "slabire",
    place: "sala",
    program: "avansat-4",
  });
  const invalidPlan = structuredClone(plan);
  invalidPlan.weeks[0].days[3].exercises[0] = structuredClone(invalidPlan.weeks[0].days[1].exercises[0]);
  const audit = auditGeneratedPlanV2(invalidPlan, catalog, registry);
  assert.equal(audit.valid, false);
  assert.ok(audit.issues.some((issue) => issue.includes("Structura editorială CAT4 × La sală diferă")));
  assert.ok(audit.issues.some((issue) => issue.includes("Zilele 2 și 4 CAT4 × La sală se suprapun")));
});

test("resolverul public proiectează 3/4 carduri fără fallback sau chei ascunse", () => {
  for (const profile of enumerateValidV2Profiles().filter((item) => item.age === "60+" && item.place === "sala")) {
    const result = resolvePublicV2Plan({ ...profile, engineVersion: "v2" }, catalog, registry);
    assert.equal(result.status, "found", result.issues?.join("\n"));
    assert.equal(result.fallbackUsed, false);
    const expected = cat4GymDailyExerciseCount(profile);
    for (const week of result.plan.weeks) {
      const projected = projectPublicV2Week(result.plan, week.weekNumber);
      assert.equal(projected.length, profile.program === "incepator-3" ? 3 : 4);
      for (const day of projected) {
        assert.equal(day.exercises.length, expected);
        assert.equal(new Set(day.exercises.map((exercise) => exercise.exerciseKey)).size, expected);
      }
    }
  }
});
