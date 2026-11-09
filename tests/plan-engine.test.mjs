import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  makeProfileConfigurationKey,
  resolvePlanConfiguration,
  validatePlanConfiguration,
} from "../lib/plan-engine/runtime.mjs";

const registry = [
  { exercise_key: "demo_exercise_a", display_name: "Exercițiu demonstrativ A", status: "active", available_locations: ["home", "gym"] },
  { exercise_key: "demo_exercise_inactive", display_name: "Exercițiu demonstrativ inactiv", status: "inactive", available_locations: ["home", "gym"] },
];

const fiveDayProfile = { gender: "male", age_group: "18_29", goal: "weight_loss", location: "gym", level: "advanced", days_per_week: 5 };
const threeDayProfile = { gender: "female", age_group: "30_44", goal: "general_fitness", location: "home", level: "beginner", days_per_week: 3 };

function createConfiguration(profile) {
  return {
    schema_version: 1,
    configuration_key: makeProfileConfigurationKey(profile),
    profile,
    number_of_weeks: 2,
    metadata: { title: "Plan test", summary: "Date placeholder", language: "ro", content_status: "mock" },
    weeks: [1, 2].map((week) => ({
      week_number: week,
      display_label: `Săptămâna ${week}`,
      progression: { summary: `Progresie test ${week}` },
      days: Array.from({ length: profile.days_per_week }, (_, index) => ({
        day_number: index + 1,
        display_label: `Ziua ${index + 1}`,
        title: `Sesiune ${index + 1}`,
        exercises: [{ order: 1, exercise_key: "demo_exercise_a", sets: 3, target: { kind: "repetitions", min: 8, max: 10 }, rest_seconds: 60 }],
      })),
    })),
  };
}

const configurations = [createConfiguration(fiveDayProfile), createConfiguration(threeDayProfile)];

test("profilul valid identifică determinist configurația existentă", () => {
  const result = resolvePlanConfiguration(fiveDayProfile, configurations, registry);
  assert.equal(result.status, "found");
  assert.equal(result.configuration_key, "plan:v1:male:18_29:weight_loss:gym:advanced:5");
});

test("profilul fără configurație întoarce not_found fără fallback", () => {
  const result = resolvePlanConfiguration({ ...fiveDayProfile, age_group: "45_59" }, configurations, registry);
  assert.equal(result.status, "not_found");
  assert.match(result.message, /niciun fallback automat/i);
  assert.equal("plan" in result, false);
});

test("configurația incompletă este blocată", () => {
  const incomplete = structuredClone(configurations[0]);
  incomplete.weeks[0].days = [];
  const validation = validatePlanConfiguration(incomplete, registry);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((entry) => entry.code === "missing_days"));
});

test("exercise_key necunoscut este detectat", () => {
  const invalid = structuredClone(configurations[0]);
  invalid.weeks[0].days[0].exercises[0].exercise_key = "cheie_inexistenta";
  const validation = validatePlanConfiguration(invalid, registry);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((entry) => entry.code === "unknown_exercise_key"));
});

test("configurațiile de 3 și 5 zile păstrează numărul exact în fiecare săptămână", () => {
  const threeDay = resolvePlanConfiguration(threeDayProfile, configurations, registry);
  const fiveDay = resolvePlanConfiguration(fiveDayProfile, configurations, registry);
  assert.equal(threeDay.status, "found");
  assert.equal(fiveDay.status, "found");
  for (const week of threeDay.plan.weeks) assert.equal(week.days.length, 3);
  for (const week of fiveDay.plan.weeks) assert.equal(week.days.length, 5);
});

test("referințele către exerciții dezactivate sunt respinse", () => {
  const inactive = structuredClone(configurations[0]);
  inactive.weeks[0].days[0].exercises[0].exercise_key = "demo_exercise_inactive";
  const validation = validatePlanConfiguration(inactive, registry);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((entry) => entry.code === "inactive_exercise_reference"));
});

test("planurile referă doar exercise_key, iar denumirea rămâne în registru", () => {
  const exercise = configurations[0].weeks[0].days[0].exercises[0];
  assert.equal(typeof exercise.exercise_key, "string");
  assert.equal("display_name" in exercise, false);
  assert.equal(registry.find((entry) => entry.exercise_key === exercise.exercise_key)?.display_name, "Exercițiu demonstrativ A");
});

test("ruta demonstrativă se randă separat de planurile gratuite", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("plan-engine-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/generator-plan-demo", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Un profil clar/);
  assert.match(html, /DEMO TEHNIC/);
  assert.doesNotMatch(html, /Planul gratuit activ/);
});

test("interfața este mobile-first și adaugă layout-uri dedicate pentru tabletă și desktop", async () => {
  const css = await readFile(new URL("../app/generator-plan-demo/plan-generator-demo.module.css", import.meta.url), "utf8");
  assert.match(css, /\.choices\s*\{[^}]*display:\s*grid/);
  assert.match(css, /@media\s*\(min-width:\s*720px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1040px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,1fr\)\)/);
});
