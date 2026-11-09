import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  activeFreePlanSessions,
  createFreePlanGenerationGate,
  createPlanInstanceId,
  expectedFreePlanContentVersion,
  finalizeFreePlanSelections,
  hasCurrentFreePlanContentVersion,
  invalidateFinalFreePlanSelection,
  normalizeFreePlanSelectionsForCurrentContent,
  planContentVersionFromPlanKey,
  planInstanceIdFromPlanKey,
  resetActiveFreePlanSnapshot,
  shouldApplyFreePlanHydration,
  withPlanContentVersionKey,
  withPlanInstanceKey,
} from "../utils/progress/free-plan-state.mjs";
import { resolvePublicV2Plan } from "../lib/plan-engine/public-v2-integration.mjs";
import { catalog, registry } from "./helpers/plan-engine-v2-fixture.mjs";

const profile = {
  gender: "masculin",
  age: "cat2",
  goal: "masa",
  place: "sala",
  engineVersion: "v2",
};

const firstInstance = () => "11111111-1111-4111-8111-111111111111";
const secondInstance = () => "22222222-2222-4222-8222-222222222222";

test("resetarea izolează progresul și păstrează istoricul fără ștergere globală", () => {
  const snapshot = {
    selections: { ...profile, program: "avansat-4", planInstanceId: createPlanInstanceId(firstInstance) },
    activeWeek: 3,
    completed: ["w1-sala-Ziua 1", "w2-sala-Ziua 2"],
    workouts: [{ id: "custom-1" }],
    logs: [{ id: "history-1" }],
    unrelatedPreference: "preserved",
  };
  const reset = resetActiveFreePlanSnapshot(snapshot);
  assert.deepEqual(reset.selections, {});
  assert.equal(reset.activeWeek, 1);
  assert.deepEqual(reset.completed, []);
  assert.equal(reset.workouts, snapshot.workouts);
  assert.equal(reset.logs, snapshot.logs);
  assert.equal(reset.unrelatedPreference, "preserved");
});

test("același profil și un profil diferit pornesc cu instanțe noi și progres zero", () => {
  const reset = resetActiveFreePlanSnapshot({
    selections: { ...profile, program: "avansat-4" },
    activeWeek: 4,
    completed: ["w1-sala-Ziua 1"],
    workouts: [],
    logs: [],
  });
  const same = finalizeFreePlanSelections(profile, "avansat-4", createPlanInstanceId(firstInstance));
  const different = finalizeFreePlanSelections(
    { ...profile, gender: "feminin", goal: "slabire" },
    "incepator-3",
    createPlanInstanceId(secondInstance),
  );
  assert.ok(same);
  assert.ok(different);
  assert.notEqual(same.planInstanceId, different.planInstanceId);
  assert.deepEqual(reset.completed, []);
});

test("refresh-ul fără reset păstrează instanța și progresul activ", () => {
  const saved = {
    selections: {
      ...profile,
      program: "avansat-4",
      planInstanceId: createPlanInstanceId(firstInstance),
    },
    activeWeek: 2,
    completed: ["w1-sala-Ziua 1"],
    workouts: [],
    logs: [],
  };
  const hydrated = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(hydrated, saved);
  assert.equal(shouldApplyFreePlanHydration(4, 4, false), true);
});

test("resetarea invalidează un răspuns vechi, iar dublul click nu pornește două generări", async () => {
  const gate = createFreePlanGenerationGate();
  const staleToken = gate.begin();
  assert.ok(staleToken);
  assert.equal(gate.begin(), null);
  let staleApplied = false;
  const staleResponse = Promise.resolve().then(() => {
    if (gate.isCurrent(staleToken)) staleApplied = true;
  });
  gate.invalidate();
  await staleResponse;
  assert.equal(staleApplied, false);
  assert.equal(shouldApplyFreePlanHydration(3, 4, false), false);
  assert.equal(shouldApplyFreePlanHydration(4, 4, true), false);
});

test("timpul controlat nu generează nimic înaintea cardului final", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let resolverCalls = 0;
  let selections = {};
  for (const [key, value] of [
    ["gender", "feminin"],
    ["age", "cat4"],
    ["goal", "forma"],
    ["place", "acasa"],
  ]) {
    selections = invalidateFinalFreePlanSelection(selections, key, value);
    context.mock.timers.tick(120_000);
    assert.equal(resolverCalls, 0);
  }
  const final = finalizeFreePlanSelections(selections, "incepator-3", createPlanInstanceId(firstInstance));
  assert.ok(final);
  resolverCalls += 1;
  assert.equal(resolvePublicV2Plan(final, catalog, registry).status, "found");
  assert.equal(resolverCalls, 1);
});

test("cardurile finale expun matricea publică de 168 și resping variantele eliminate din CAT4", () => {
  const genders = ["masculin", "feminin"];
  const ages = ["cat1", "cat2", "cat3", "cat4"];
  const goals = ["slabire", "masa", "forma"];
  const places = ["acasa", "sala"];
  const programs = ["incepator-3", "incepator-4", "avansat-4", "avansat-5"];
  let valid = 0;
  const plans = new Set();
  for (const gender of genders)
    for (const age of ages)
      for (const goal of goals)
        for (const place of places)
          for (const program of programs) {
            const selection = finalizeFreePlanSelections(
              { gender, age, goal, place, engineVersion: "v2" },
              program,
              createPlanInstanceId(firstInstance),
            );
            const result = resolvePublicV2Plan(selection, catalog, registry);
            const allowed = age !== "cat4" || program === "incepator-3" || program === "avansat-4";
            assert.equal(result.status, allowed ? "found" : "invalid_profile", result.issues?.join("\n"));
            if (allowed) {
              valid += 1;
              plans.add(JSON.stringify(result.plan.weeks));
            }
          }
  assert.equal(valid, 168);
  assert.ok(plans.size > 0 && plans.size <= 168);
});

test("versiunea editorială CAT4 × Acasă izolează cheia planului și persistă la refresh", () => {
  const instanceId = createPlanInstanceId(firstInstance);
  const selections = finalizeFreePlanSelections({
    gender: "feminin",
    age: "cat4",
    goal: "forma",
    place: "acasa",
    engineVersion: "v2",
  }, "incepator-3", instanceId);
  assert.ok(selections);
  assert.equal(selections.contentVersion, expectedFreePlanContentVersion(selections));
  assert.equal(hasCurrentFreePlanContentVersion(selections), true);
  assert.equal(hasCurrentFreePlanContentVersion({ ...selections, contentVersion: undefined }), false);
  const versioned = withPlanContentVersionKey(
    "plan:v2:feminin:60+:forma:acasa:incepator-3",
    selections.contentVersion,
  );
  const planKey = withPlanInstanceKey(versioned, instanceId);
  assert.equal(planContentVersionFromPlanKey(planKey), selections.contentVersion);
  assert.equal(planInstanceIdFromPlanKey(planKey), instanceId);
  assert.deepEqual(JSON.parse(JSON.stringify(selections)), selections);
});

test("stările CAT4 × Acasă pre-editoriale nu pot rehidrata planul generic cu 5–6 exerciții", () => {
  const base = {
    gender: "masculin",
    age: "cat4",
    goal: "slabire",
    place: "acasa",
    program: "incepator-3",
  };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat4-home-batch-1-v1" },
    { ...base, engineVersion: "v2", contentVersion: "cat4-home-batch-1-v2-count-contract" },
  ]) {
    const normalized = normalizeFreePlanSelectionsForCurrentContent(stale);
    assert.equal(normalized.engineVersion, "v2");
    assert.equal(normalized.program, undefined);
    assert.equal(normalized.planInstanceId, undefined);
    assert.equal(normalized.contentVersion, undefined);
  }
  const current = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "incepator-3",
    createPlanInstanceId(firstInstance),
  );
  assert.ok(current);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);
});

test("versiunea editorială CAT4 × La sală pornește o instanță nouă și persistă numai conținutul curent", () => {
  const base = {
    gender: "feminin",
    age: "cat4",
    goal: "masa",
    place: "sala",
    program: "avansat-4",
  };
  const stale = normalizeFreePlanSelectionsForCurrentContent({ ...base, engineVersion: "v2" });
  assert.equal(stale.program, undefined);
  assert.equal(stale.planInstanceId, undefined);
  assert.equal(stale.contentVersion, undefined);

  const instanceId = createPlanInstanceId(secondInstance);
  const current = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "avansat-4",
    instanceId,
  );
  assert.ok(current);
  assert.equal(current.contentVersion, "cat4-gym-editorial-v1");
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);

  const planKey = withPlanInstanceKey(withPlanContentVersionKey(
    "plan:v2:feminin:60+:masa:sala:avansat-4",
    current.contentVersion,
  ), instanceId);
  assert.equal(planContentVersionFromPlanKey(planKey), current.contentVersion);
  assert.equal(planInstanceIdFromPlanKey(planKey), instanceId);
});

test("versiunea editorială CAT3 × Acasă izolează planul nou și păstrează refresh-ul curent", () => {
  const base = {
    gender: "feminin",
    age: "cat3",
    goal: "masa",
    place: "acasa",
    program: "avansat-5",
  };
  for (const stale of [
    { ...base, engineVersion: "v1" },
    { ...base, engineVersion: "v2" },
    { ...base, engineVersion: "v2", contentVersion: "cat3-home-editorial-pre-v1" },
  ]) {
    const normalized = normalizeFreePlanSelectionsForCurrentContent(stale);
    assert.equal(normalized.engineVersion, "v2");
    assert.equal(normalized.program, undefined);
    assert.equal(normalized.planInstanceId, undefined);
    assert.equal(normalized.contentVersion, undefined);
  }

  const instanceId = createPlanInstanceId(secondInstance);
  const current = finalizeFreePlanSelections(
    { ...base, program: undefined, engineVersion: "v2" },
    "avansat-5",
    instanceId,
  );
  assert.ok(current);
  assert.equal(current.contentVersion, "cat3-home-editorial-v1");
  assert.equal(hasCurrentFreePlanContentVersion(current), true);
  assert.deepEqual(normalizeFreePlanSelectionsForCurrentContent(current), current);

  const planKey = withPlanInstanceKey(withPlanContentVersionKey(
    "plan:v2:feminin:45-59:masa:acasa:avansat-5",
    current.contentVersion,
  ), instanceId);
  assert.equal(planContentVersionFromPlanKey(planKey), current.contentVersion);
  assert.equal(planInstanceIdFromPlanKey(planKey), instanceId);
});

test("identitatea activă filtrează progresul fără să elimine sesiunile istorice", () => {
  const instanceId = createPlanInstanceId(firstInstance);
  const plan = {
    id: "active-plan",
    plan_key: withPlanInstanceKey("plan:v2:masculin:30-44:masa:sala:avansat-4", instanceId),
    started_at: "2026-08-09T10:00:00.000Z",
  };
  const sessions = [
    { id: "old", source: "free_plan", free_plan_id: "active-plan", workout_key: "w1-sala-Ziua 1", week_number: 1, day_number: 1, completed_at: "2026-08-09T09:00:00.000Z" },
    { id: "current", source: "free_plan", free_plan_id: "active-plan", workout_key: "w1-sala-Ziua 1", week_number: null, day_number: null, completed_at: "2026-08-09T10:01:00.000Z" },
    { id: "other", source: "free_plan", free_plan_id: "other-plan", workout_key: "w1-sala-Ziua 1", week_number: null, day_number: null, completed_at: "2026-08-09T10:02:00.000Z" },
  ];
  assert.equal(planInstanceIdFromPlanKey(plan.plan_key), instanceId);
  assert.deepEqual(activeFreePlanSessions(plan, sessions).map((session) => session.id), ["current"]);
  assert.equal(sessions.length, 3);
});

test("interfața conține cardurile originale combinate și nu conține selectoare separate", async () => {
  const page = await readFile(new URL("../components/vemi-page.tsx", import.meta.url), "utf8");
  for (const label of [
    "Începător — 3 zile",
    "Începător — 4 zile",
    "Avansat — 4 zile",
    "Avansat — 5 zile",
  ]) assert.equal(page.split(label).length - 1, 1);
  for (const ageKey of ["cat1", "cat2", "cat3", "cat4"]) assert.match(page, new RegExp(`value: "${ageKey}"`));
  assert.ok(page.indexOf('key: "place"') < page.indexOf('key: "program"'));
  assert.doesNotMatch(page, /programLevelDraft|chooseProgramLevel|chooseProgramFrequency|Alege frecvența/);
  assert.doesNotMatch(page, /const v2Resolution = useMemo/);
  assert.match(page, /if \(key === "program"\)[\s\S]*resolvePublicV2Plan/);
  assert.match(page, /publicProgramsForAge\(selections\.age\)/);
  assert.match(page, /currentStepChoices/);
  assert.match(page, /normalizeFreePlanSelectionsForCurrentContent\(parsed\)/);
  assert.match(page, /setCompleted\(resetStaleProgress \? \[\] : savedCompleted\)/);
});

test("resetarea nu folosește clear global sau ștergeri DB și anulează numai coada planului activ", async () => {
  const [page, client, route] = await Promise.all([
    readFile(new URL("../components/vemi-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../utils/progress/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/progress/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function resetFreePlanSelection\(\)/);
  assert.match(page, /setCompleted\(\[\]\)/);
  assert.match(page, /cancelPendingFreePlanMutations\(\)/);
  assert.doesNotMatch(page, /localStorage\.clear\(\)/);
  assert.match(client, /mutation\.action === "save_free_plan" \|\| mutation\.action === "save_free_workout"/);
  assert.doesNotMatch(client, /localStorage\.clear\(\)/);
  assert.match(route, /savedPlan\.instanceAware \? null : activeWeek/);
  assert.match(route, /eq\("workout_key", workoutKey\)\.gte\("completed_at", savedPlan\.startedAt\)/);
  assert.match(route, /withPlanContentVersionKey\(canonicalKey, selections\.contentVersion\)/);
  assert.match(route, /planContentVersionFromPlanKey\(plan\.plan_key\)/);
  assert.doesNotMatch(route, /reset_active_free_plan[\s\S]*\.delete\(/);
});
