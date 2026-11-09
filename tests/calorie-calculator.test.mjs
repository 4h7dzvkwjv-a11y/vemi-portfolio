import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateCalorieEstimate,
  calculateMifflinRmr,
  deriveGoalRange,
  estimateMaintenance,
  formatKcalRange,
  roundTo50,
} from "../lib/calorie-calculator/formulas.ts";
import {
  parseLocalizedDecimal,
  validateCalculatorInput,
} from "../lib/calorie-calculator/validation.ts";

process.env.NEXT_PUBLIC_SITE_URL ??= "https://example.test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";

const projectRoot = new URL("../", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("calorie-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const workerEnv = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const workerContext = { waitUntil() {}, passThroughOnException() {} };

function request(path) {
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), workerEnv, workerContext);
}

const fixtures = [
  { id: "M1", input: { sex: "male", age: 30, weightKg: 80, heightCm: 180, activity: "1.4", goal: "maintenance" }, rmr: 1780, maintenance: 2492, expected: [2250, 2750] },
  { id: "M2", input: { sex: "male", age: 40, weightKg: 90.5, heightCm: 182.3, activity: "1.6", goal: "loss" }, rmr: 1849.375, maintenance: 2959, expected: [2350, 2650] },
  { id: "M3", input: { sex: "male", age: 25, weightKg: 75, heightCm: 178, activity: "1.8", goal: "gain" }, rmr: 1742.5, maintenance: 3136.5, expected: [3300, 3450] },
  { id: "M4", input: { sex: "male", age: 78, weightKg: 143, heightCm: 201, activity: "2.0", goal: "loss" }, rmr: 2301.25, maintenance: 4602.5, expected: [3700, 4150] },
  { id: "F1", input: { sex: "female", age: 30, weightKg: 60, heightCm: 165, activity: "1.4", goal: "maintenance" }, rmr: 1320.25, maintenance: 1848.35, expected: [1650, 2050] },
  { id: "F2", input: { sex: "female", age: 35, weightKg: 70.5, heightCm: 168.2, activity: "1.6", goal: "loss" }, rmr: 1420.25, maintenance: 2272.4, expected: [1800, 2050] },
  { id: "F3", input: { sex: "female", age: 28, weightKg: 62.3, heightCm: 170.5, activity: "1.8", goal: "gain" }, rmr: 1387.625, maintenance: 2497.725, expected: [2600, 2750] },
  { id: "F4", input: { sex: "female", age: 78, weightKg: 46, heightCm: 146, activity: "1.4", goal: "loss" }, rmr: 821.5, maintenance: 1150.1, expected: null },
  { id: "B1", input: { sex: "male", age: 19, weightKg: 46, heightCm: 146, activity: "1.4", goal: "maintenance" }, rmr: 1282.5, maintenance: 1795.5, expected: [1600, 2000] },
  { id: "B2", input: { sex: "female", age: 19, weightKg: 143, heightCm: 201, activity: "2.0", goal: "gain" }, rmr: 2430.25, maintenance: 4860.5, expected: [5100, 5350] },
];

test("M1–B2 literal mathematical fixtures pass 10/10", () => {
  for (const fixture of fixtures) {
    const before = structuredClone(fixture.input);
    const result = calculateCalorieEstimate(Object.freeze({ ...fixture.input }));
    assert.ok(result, `${fixture.id}: result`);
    assert.equal(result.rmr, fixture.rmr, `${fixture.id}: RMR`);
    assert.ok(Math.abs(result.maintenance - fixture.maintenance) < 1e-9, `${fixture.id}: maintenance`);
    assert.deepEqual(fixture.input, before, `${fixture.id}: input remains immutable`);
    if (fixture.expected) {
      assert.equal(result.weightLossTargetBlocked, false, `${fixture.id}: safety gate`);
      assert.deepEqual([result.goalRange.minimum, result.goalRange.maximum], fixture.expected, `${fixture.id}: range`);
    } else {
      assert.equal(result.goalRange, null, `${fixture.id}: no loss target`);
      assert.equal(result.weightLossTargetBlocked, true, `${fixture.id}: safety gate`);
    }
  }
});

test("F4 blocks the raw loss range before rounding and preserves maintenance", () => {
  const fixture = fixtures.find(({ id }) => id === "F4");
  const result = calculateCalorieEstimate(fixture.input);
  assert.ok(result);
  assert.ok(result.rawGoalRange.minimum < 1200);
  assert.ok(Math.abs(result.rawGoalRange.minimum - 920.08) < 1e-9);
  assert.equal(result.goalRange, null);
  assert.equal(result.weightLossTargetBlocked, true);
  assert.deepEqual(result.maintenanceRange, { minimum: 1050, maximum: 1250 });
});

test("Mifflin branches, all PAL values and all goal factors remain exact", () => {
  assert.equal(calculateMifflinRmr({ sex: "male", age: 30, weightKg: 80, heightCm: 180 }), 1780);
  assert.equal(calculateMifflinRmr({ sex: "female", age: 30, weightKg: 60, heightCm: 165 }), 1320.25);
  assert.deepEqual(["1.4", "1.6", "1.8", "2.0"].map((pal) => estimateMaintenance(1000, pal)), [1400, 1600, 1800, 2000]);
  assert.deepEqual(deriveGoalRange(2000, "maintenance"), { minimum: 1800, maximum: 2200 });
  assert.deepEqual(deriveGoalRange(2000, "loss"), { minimum: 1600, maximum: 1800 });
  assert.deepEqual(deriveGoalRange(2000, "gain"), { minimum: 2100, maximum: 2200 });
});

test("localized decimal parser accepts the contract and rejects unsafe strings", () => {
  for (const [raw, expected] of [["70,5", 70.5], ["70.5", 70.5], [" 70,5 ", 70.5], ["070,5", 70.5]]) {
    assert.equal(parseLocalizedDecimal(raw), expected, raw);
  }
  for (const raw of ["70 kg", "70kg", "1e2", "70,5.2", "--70", "Infinity", "NaN", "", "0", "-0", "-1", "70,55", "70.", "+70"]) {
    assert.equal(parseLocalizedDecimal(raw), null, raw);
  }
});

const validRaw = {
  sex: "female",
  age: "30",
  heightCm: "165",
  weightKg: "60",
  activity: "1.4",
  goal: "maintenance",
};

test("age, weight and height boundaries are inclusive and exact", () => {
  for (const age of ["19", "78"]) assert.equal(validateCalculatorInput({ ...validRaw, age }).valid, true, `age ${age}`);
  for (const age of ["18", "79", "30,5"]) assert.equal(validateCalculatorInput({ ...validRaw, age }).valid, false, `age ${age}`);
  for (const weightKg of ["46", "143"]) assert.equal(validateCalculatorInput({ ...validRaw, weightKg }).valid, true, `weight ${weightKg}`);
  for (const weightKg of ["45,9", "143,1"]) assert.equal(validateCalculatorInput({ ...validRaw, weightKg }).valid, false, `weight ${weightKg}`);
  for (const heightCm of ["146", "201"]) assert.equal(validateCalculatorInput({ ...validRaw, heightCm }).valid, true, `height ${heightCm}`);
  for (const heightCm of ["145,9", "201,1"]) assert.equal(validateCalculatorInput({ ...validRaw, heightCm }).valid, false, `height ${heightCm}`);
});

test("injected enum values are rejected independently of the DOM", () => {
  assert.equal(validateCalculatorInput({ ...validRaw, sex: "other" }).valid, false);
  assert.equal(validateCalculatorInput({ ...validRaw, activity: "1.7" }).valid, false);
  assert.equal(validateCalculatorInput({ ...validRaw, goal: "perfect" }).valid, false);
});

test("rounding uses Math.round at, below and above the 50 kcal midpoint", () => {
  assert.equal(roundTo50(1224.999), 1200);
  assert.equal(roundTo50(1225), 1250);
  assert.equal(roundTo50(1225.001), 1250);
  assert.equal(formatKcalRange({ minimum: 2350, maximum: 2650 }), "2.350–2.650 kcal/zi");
});

test("calculator route renders server content, native controls and released SEO", async () => {
  const response = await request("/alimentatie/calculator-caloric");
  const html = (await response.text()).replaceAll("<!-- -->", "");
  assert.equal(response.status, 200);
  assert.match(html, /<h1>Calculator caloric<\/h1>/);
  assert.match(html, /<form[^>]*auto(?:c|C)omplete="off"/);
  assert.match(html, /<form[^>]*data-private="true"/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 9);
  assert.match(html, /<fieldset[^>]*>[\s\S]*?<legend>Sex biologic utilizat în ecuație<\/legend>/);
  assert.match(html, /<label for="calorie-age">Vârsta/);
  assert.match(html, /input(?:m|M)ode="decimal"/);
  assert.match(html, /Estimează necesarul caloric/);
  assert.match(html, /Metodologie și surse/);
  assert.match(html, /Articole recomandate/);
  assert.doesNotMatch(html, /name="robots" content="noindex/);
  assert.match(html, /rel="canonical" href="https:\/\/example\.test\/alimentatie\/calculator-caloric"/);
  assert.match(html, /property="og:title" content="Calculator caloric"/);
  assert.match(html, /property="og:url" content="https:\/\/example\.test\/alimentatie\/calculator-caloric"/);
  assert.match(html, /Estimează orientativ necesarul caloric/);
  assert.doesNotMatch(html, /Calculator caloric — în pregătire|Funcționalitate în pregătire/);
});

test("client island contains the complete focus and recalculation contract", async () => {
  const source = await readFile(new URL("components/editorial/calorie-calculator.tsx", projectRoot), "utf8");
  assert.match(source, /^"use client";/);
  assert.match(source, /Verifică următoarele câmpuri/);
  assert.match(source, /tabIndex=\{-1\}/);
  assert.match(source, /errorSummaryRef\.current\?\.focus/);
  assert.match(source, /resultTitleRef\.current\?\.focus/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Valorile s-au schimbat\. Estimează din nou\./);
  assert.match(source, /setResult\(null\)/);
  assert.match(source, /firstFieldRef\.current\?\.focus/);
});

test("calculator is local-only and has no sensitive telemetry or persistence hooks", async () => {
  const files = await Promise.all([
    "components/editorial/calorie-calculator.tsx",
    "lib/calorie-calculator/formulas.ts",
    "lib/calorie-calculator/validation.ts",
    "app/alimentatie/calculator-caloric/page.tsx",
  ].map((path) => readFile(new URL(path, projectRoot), "utf8")));
  const source = files.join("\n");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|console\.(?:log|info|debug)|URLSearchParams|history\.(?:pushState|replaceState)|location\.(?:hash|search)|supabase|analytics|posthog/i);
  assert.doesNotMatch(source, /\/api\//);
  assert.match(source, /data-private="true"/);
});

test("calculator responsive styles cover the contractual layouts without horizontal overflow patterns", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"), css.indexOf("@media (max-width: 600px)"));
  assert.match(css, /\.calorie-calculator-shell[^}]*width:\s*min\(980px, calc\(100% - 40px\)\)/);
  assert.match(css, /\.calorie-number-grid[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/);
  assert.match(mobileRules, /\.calorie-number-grid,[\s\S]*\.calorie-radio-grid\.goals\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /\.calorie-radio-card\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.calorie-result-range\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("calculator is indexable and appears exactly once in sitemap", async () => {
  const sitemap = await (await request("/sitemap.xml")).text();
  assert.equal((sitemap.match(/\/alimentatie\/calculator-caloric/g) ?? []).length, 1);
});
