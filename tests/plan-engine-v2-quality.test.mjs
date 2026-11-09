import assert from "node:assert/strict";
import test from "node:test";
import {
  enumerateValidV2Profiles,
  generatePlanV2,
} from "../lib/plan-engine/v2-runtime.mjs";
import {
  catalog,
  parameterSignature,
  registry,
} from "./helpers/plan-engine-v2-fixture.mjs";

const profiles = enumerateValidV2Profiles();
const profileKey = (profile) => [profile.gender, profile.age, profile.goal, profile.place, profile.program].join("|");
const plans = new Map(profiles.map((profile) => {
  const result = generatePlanV2(profile, catalog, registry);
  assert.equal(result.status, "found", `${profileKey(profile)}: ${result.issues?.join("; ")}`);
  return [profileKey(profile), result.plan];
}));
const getPlan = (profile) => plans.get(profileKey(profile));
const exercises = (plan) => plan.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises));
const weekKeys = (week) => week.days.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseKey));

test("toate cele 168 de profiluri folosesc reguli editoriale dedicate", () => {
  for (const gender of ["masculin", "feminin"]) {
    for (const goal of ["masa", "slabire", "forma"]) {
      for (const place of ["acasa", "sala"]) {
        for (const program of ["incepator-3", "incepator-4", "avansat-4", "avansat-5"]) {
          const base = { gender, goal, place, program };
          const age18 = parameterSignature(getPlan({ ...base, age: "18-29" }));
          const age30 = parameterSignature(getPlan({ ...base, age: "30-44" }));
          assert.notEqual(age30, age18);
          assert.notEqual(parameterSignature(getPlan({ ...base, age: "45-59" })), age18);
          if (program === "incepator-3" || program === "avansat-4") {
            assert.notEqual(parameterSignature(getPlan({ ...base, age: "60+" })), age18);
          }
        }
      }
    }
  }
});

test("niciun exercițiu nu depășește 80%, în afara minimului canonic inevitabil pentru flexii", () => {
  const planCounts = new Map(catalog.map((exercise) => [exercise.id, 0]));
  for (const plan of plans.values()) {
    for (const exerciseKey of new Set(exercises(plan).map((exercise) => exercise.exerciseKey))) {
      planCounts.set(exerciseKey, planCounts.get(exerciseKey) + 1);
    }
  }
  const overused = [...planCounts].filter(([key, count]) => key !== "flexii-gantere" && count / plans.size > 0.8);
  assert.deepEqual(overused, []);
  // Cele două sloturi Biceps din planurile feminine avansate CAT1 impun ambele
  // chei ale allowlistului feminin; 136/168 este minimul rezultat fără a atinge
  // cele 144 de profiluri protejate.
  assert.equal(planCounts.get("flexii-gantere"), 136);
});

test("zilele nu sunt dominate de auxiliare și respectă dimensiunea produsului", () => {
  for (const plan of plans.values()) {
    for (const week of plan.weeks) {
      for (const day of week.days) {
        const auxiliary = day.exercises.filter((exercise) => exercise.role === "auxiliar").length;
        const cat1Gym = plan.profile.age === "18-29" && plan.profile.place === "sala";
        if (cat1Gym) assert.ok(auxiliary <= day.exercises.length / 2, `${plan.planKey}, S${week.weekNumber}, Z${day.dayNumber}`);
        if (plan.profile.age === "60+") assert.equal(day.exercises.length, plan.profile.program === "incepator-3" ? 3 : 4);
        else {
          const cat2Gym = plan.profile.age === "30-44" && plan.profile.place === "sala";
          const expected = cat1Gym
            ? plan.profile.program === "incepator-3" ? 4
              : plan.profile.program === "incepator-4" ? plan.profile.gender === "feminin" ? 4 : 5
                : plan.profile.gender === "feminin" ? 5 : 6
            : cat2Gym
            ? plan.profile.program.startsWith("incepator") ? 4 : plan.profile.gender === "feminin" ? 5 : 6
            : plan.profile.place === "sala" && plan.profile.program === "avansat-4" && day.dayNumber === 3
            ? 4
            : plan.profile.program.startsWith("incepator") ? 4 : 5;
          assert.equal(day.exercises.length, expected);
        }
      }
    }
  }
});

test("obiectivele au contexte cardio recognoscibile fără cardio canonic în masă", () => {
  for (const profile of profiles) {
    const cardio = exercises(getPlan(profile)).filter((exercise) => exercise.kind === "cardio").length;
    if (["18-29", "30-44", "45-59"].includes(profile.age) && profile.place === "sala" && profile.program === "avansat-4") assert.equal(cardio, 0, profileKey(profile));
    else if (profile.age === "60+" && profile.place === "sala") assert.equal(cardio, 0, profileKey(profile));
    else if (profile.goal === "masa") {
      if (profile.age === "60+" && profile.place === "acasa") assert.ok(cardio > 0, profileKey(profile));
      else if (profile.age === "18-29" && profile.place === "acasa") assert.ok(cardio > 0, profileKey(profile));
      else if (profile.age === "18-29" && profile.place === "sala" && profile.program !== "avansat-4") assert.ok(cardio > 0, profileKey(profile));
      else if ((profile.age === "30-44" || profile.age === "45-59") && profile.place === "acasa" && profile.program === "avansat-5") assert.ok(cardio > 0, profileKey(profile));
      else if (profile.age === "30-44" && profile.place === "acasa" && profile.program !== "avansat-5") assert.ok(cardio > 0, profileKey(profile));
      else if (profile.age === "30-44" && profile.place === "sala" && profile.program !== "avansat-4") assert.ok(cardio > 0, profileKey(profile));
      else if (profile.age === "45-59" && profile.place === "sala" && profile.program !== "avansat-4") assert.ok(cardio > 0, profileKey(profile));
      else assert.equal(cardio, 0, profileKey(profile));
    } else assert.ok(cardio > 0, profileKey(profile));
  }
});

test("nivelul avansat crește volumul real pentru toate perechile comparabile", () => {
  for (const gender of ["masculin", "feminin"]) {
    for (const age of ["18-29", "30-44", "45-59", "60+"]) {
      for (const goal of ["masa", "slabire", "forma"]) {
        for (const place of ["acasa", "sala"]) {
          const base = { gender, age, goal, place };
          const volume = (program) => exercises(getPlan({ ...base, program }))
            .reduce((total, exercise) => total + exercise.sets, 0);
          const beginnerProgram = age === "60+" ? "incepator-3" : "incepator-4";
          assert.ok(volume("avansat-4") > volume(beginnerProgram), profileKey({ ...base, program: "avansat-4" }));
        }
      }
    }
  }
});

test("toate configurațiile editoriale păstrează patru săptămâni distincte", () => {
  for (const plan of plans.values()) {
    assert.equal(new Set(plan.weeks.map((week) => weekKeys(week).join("|"))).size, 4, plan.planKey);
  }
});
