import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deterministicKeyForProfile,
  validatePlanBatchDryRun,
} from "../lib/plan-import/batch-validator.mjs";

const schema = JSON.parse(await readFile(new URL("../data/plan-engine/plan-config.schema.json", import.meta.url), "utf8"));
const registry = [
  { exercise_key: "demo_active", display_name: "Activ", status: "active", available_locations: ["home", "gym"] },
  { exercise_key: "demo_inactive", display_name: "Inactiv", status: "inactive", available_locations: ["home", "gym"] },
  { exercise_key: "demo_retired", display_name: "Retras", status: "retired", available_locations: ["home", "gym"] },
];
const fixedNow = () => new Date("2026-08-07T12:00:00.000Z");

const baseProfile = { gender: "male", age_group: "18_29", goal: "weight_loss", location: "gym", level: "advanced", days_per_week: 5 };

function configuration(profile = baseProfile, exerciseKey = "demo_active") {
  return {
    schema_version: 1,
    configuration_key: deterministicKeyForProfile(profile),
    profile: structuredClone(profile),
    number_of_weeks: 2,
    metadata: { title: "Plan test", summary: "Date normalizate de test", language: "ro", content_status: "draft" },
    weeks: [1, 2].map((weekNumber) => ({
      week_number: weekNumber,
      display_label: `Săptămâna ${weekNumber}`,
      progression: { summary: `Progresie ${weekNumber}` },
      days: Array.from({ length: profile.days_per_week }, (_, dayIndex) => ({
        day_number: dayIndex + 1,
        display_label: `Ziua ${dayIndex + 1}`,
        title: `Sesiunea ${dayIndex + 1}`,
        instructions: "Instrucțiune test",
        exercises: [{
          order: 1,
          exercise_key: exerciseKey,
          sets: 3,
          target: { kind: "repetitions", min: 8, max: 10 },
          rest_seconds: 60,
          instructions: "Execuție test",
        }],
      })),
    })),
  };
}

function validate(configurations, expectedConfigurationKeys) {
  return validatePlanBatchDryRun({ configurations }, {
    schema,
    exerciseRegistry: registry,
    expectedConfigurationKeys,
    now: fixedNow,
  });
}

test("lotul complet valid primește status VALID, dar publică zero planuri", () => {
  const plan = configuration();
  const report = validate([plan], [plan.configuration_key]);
  assert.equal(report.status, "valid");
  assert.equal(report.summary.valid_configurations, 1);
  assert.deepEqual(report.publication, { attempted: false, published_configurations: 0, active_data_changed: false });
});

test("JSON invalid este respins cu locație de parsare", () => {
  const report = validatePlanBatchDryRun('{"configurations":[}', { schema, exerciseRegistry: registry, now: fixedNow });
  assert.equal(report.status, "rejected");
  assert.equal(report.issues[0].code, "json_parse_error");
  assert.match(report.issues[0].path, /line|\$/);
});

test("configurația incompletă este identificată precis", () => {
  const plan = configuration();
  delete plan.weeks;
  const report = validate([plan]);
  assert.equal(report.status, "rejected");
  assert.ok(report.issues.some((entry) => entry.path === "configurations[0].weeks"));
});

test("profilul invalid este respins", () => {
  const plan = configuration();
  plan.profile.level = "expert";
  const report = validate([plan]);
  assert.ok(report.issues.some((entry) => entry.category === "profile"));
});

test("cheia deterministă care nu corespunde profilului este respinsă", () => {
  const plan = configuration();
  plan.configuration_key = "plan:v1:female:18_29:weight_loss:gym:advanced:5";
  const report = validate([plan]);
  assert.ok(report.issues.some((entry) => entry.code === "configuration_key_mismatch"));
});

test("două configurații cu aceeași cheie resping întregul lot", () => {
  const plan = configuration();
  const report = validate([plan, structuredClone(plan)]);
  assert.equal(report.status, "rejected");
  assert.equal(report.summary.duplicate_keys, 1);
  assert.equal(report.summary.invalid_configurations, 2);
});

test("exercise_key inexistent este raportat separat", () => {
  const report = validate([configuration(baseProfile, "demo_missing")]);
  assert.equal(report.summary.unknown_exercise_keys, 1);
  assert.ok(report.issues.some((entry) => entry.path.endsWith("exercise_key")));
});

test("exercițiul inactiv este raportat separat", () => {
  const report = validate([configuration(baseProfile, "demo_inactive")]);
  assert.equal(report.summary.inactive_exercises, 1);
});

test("exercițiul retras este raportat separat", () => {
  const report = validate([configuration(baseProfile, "demo_retired")]);
  assert.equal(report.summary.retired_exercises, 1);
});

test("profilul de 5 zile cu numai 4 zile este respins", () => {
  const plan = configuration();
  plan.weeks[0].days.pop();
  const report = validate([plan]);
  assert.ok(report.issues.some((entry) => entry.code === "days_per_week_mismatch"));
});

test("săptămâna lipsă este detectată", () => {
  const plan = configuration();
  plan.weeks.pop();
  const report = validate([plan]);
  assert.ok(report.issues.some((entry) => entry.code === "week_count_mismatch"));
});

test("ziua fără exerciții este respinsă", () => {
  const plan = configuration();
  plan.weeks[0].days[0].exercises = [];
  const report = validate([plan]);
  assert.ok(report.issues.some((entry) => entry.code === "empty_training_day"));
});

test("câmpul obligatoriu lipsă este detectat prin schema existentă", () => {
  const plan = configuration();
  delete plan.metadata.title;
  const report = validate([plan]);
  assert.ok(report.issues.some((entry) => entry.code === "schema_required" && entry.path === "configurations[0].metadata.title"));
});

test("configurația ambiguă este marcată explicit", () => {
  const plan = configuration();
  const report = validate([plan, structuredClone(plan)]);
  assert.equal(report.summary.ambiguous_configurations, 1);
  assert.ok(report.issues.some((entry) => entry.code === "ambiguous_configuration"));
});

test("matricea de acoperire raportează combinația așteptată absentă", () => {
  const plan = configuration();
  const missingKey = "plan:v1:female:30_44:general_fitness:home:beginner:3";
  const report = validate([plan], [plan.configuration_key, missingKey]);
  assert.equal(report.summary.missing_configurations, 1);
  assert.deepEqual(report.coverage.missing_keys, [missingKey]);
  assert.equal(report.status, "rejected");
});

test("configurațiile suplimentare față de matrice sunt raportate", () => {
  const plan = configuration();
  const expectedKey = "plan:v1:female:30_44:general_fitness:home:beginner:3";
  const report = validate([plan], [expectedKey]);
  assert.equal(report.summary.extra_configurations, 1);
  assert.deepEqual(report.coverage.extra_keys, [plan.configuration_key]);
});

test("99 configurații valide și una invalidă resping atomic întregul lot", () => {
  const profiles = [];
  for (const gender of ["male", "female"])
    for (const age_group of ["18_29", "30_44", "45_59", "60_plus"])
      for (const goal of ["weight_loss", "muscle_gain", "general_fitness"])
        for (const location of ["home", "gym"])
          for (const level of ["beginner", "intermediate", "advanced"])
            for (const days_per_week of [1, 2, 3, 4, 5, 6, 7]) profiles.push({ gender, age_group, goal, location, level, days_per_week });

  const plans = profiles.slice(0, 100).map((profile) => configuration(profile));
  plans[99].weeks[0].days[0].exercises[0].exercise_key = "demo_missing";
  const report = validate(plans, plans.map((plan) => plan.configuration_key));
  assert.equal(report.summary.valid_configurations, 99);
  assert.equal(report.summary.invalid_configurations, 1);
  assert.equal(report.status, "rejected");
  assert.equal(report.publication.published_configurations, 0);
  assert.equal(report.publication.active_data_changed, false);
});

test("panoul este admin-only, iar infrastructura dry-run nu conține scrieri sau activare", async () => {
  const [page, client, validator] = await Promise.all([
    readFile(new URL("../app/admin/import-planuri/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/import-planuri/plan-import-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/plan-import/batch-validator.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /const admin = await getAdminContext\(\)/);
  assert.match(page, /if \(!admin\.authorized\) notFound\(\)/);
  assert.match(page, /\.from\("exercises"\)[\s\S]*\.select\(/);
  assert.doesNotMatch(`${page}\n${client}\n${validator}`, /\.(?:insert|update|upsert|delete)\s*\(/);
  assert.doesNotMatch(client, /fetch\s*\(/);
  assert.match(validator, /published_configurations:\s*0/);
  assert.match(validator, /active_data_changed:\s*false/);
});

test("ruta internă nu este expusă fără sesiune admin", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("admin-plan-import", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/admin/import-planuri", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.doesNotMatch(html, /Validarea loturilor de planuri/);
});
