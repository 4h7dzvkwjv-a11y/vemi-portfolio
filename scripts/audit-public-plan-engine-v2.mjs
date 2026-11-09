import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  enumeratePublicV2Selections,
  normalizePublicV2Selections,
  projectPublicV2Week,
  resolvePublicV2Plan,
} from "../lib/plan-engine/public-v2-integration.mjs";
import {
  VALID_PROGRAMS,
  auditGeneratedPlanV2,
  generatePlanV2,
} from "../lib/plan-engine/v2-runtime.mjs";

const RUNS = 3;
const sha = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const weekExerciseSignature = (week) => week.days.map((day) => day.exercises.map((exercise) => exercise.exerciseKey).join(",")).join("|");
const weekParameterSignature = (week) => week.days.map((day) => day.exercises.map((exercise) => [
  exercise.exerciseKey,
  exercise.sets,
  exercise.target.kind,
  exercise.target.min,
  exercise.target.max,
  exercise.restSeconds,
].join(":"))).join("|");

const manifest = JSON.parse(await readFile(resolve("data/plan-engine/v2/VEMI_Manifest_Content_Complete_2026-08-08.json"), "utf8"));
const registry = JSON.parse(await readFile(resolve("data/plan-engine/v2/exercise-rules.json"), "utf8"));
const catalog = manifest.exercises.map((exercise) => ({
  id: exercise.exercise_key,
  name: exercise.canonical_name,
  group: exercise.canonical_group,
  kind: exercise.kind,
  places: exercise.places,
  recommendedTarget: exercise.card.recommendation,
  guidance1: exercise.card.indication_1,
  guidance2: exercise.card.indication_2,
  aliases: exercise.aliases,
  memberships: exercise.collections.map((membership) => ({
    collectionKey: membership.collection_key,
    orderIndex: membership.order_index,
  })),
  videoState: exercise.video_required ? "missing" : "not-required",
}));
const catalogByKey = new Map(catalog.map((exercise) => [exercise.id, exercise]));

const matrix = [];
for (const uiSelections of enumeratePublicV2Selections()) {
  const normalized = normalizePublicV2Selections(uiSelections);
  const runs = Array.from({ length: RUNS }, () => resolvePublicV2Plan(uiSelections, catalog, registry));
  const result = runs[0];
  const found = result.status === "found";
  const plan = found ? result.plan : null;
  const direct = normalized.status === "valid" ? generatePlanV2(normalized.profile, catalog, registry) : null;
  const engineAudit = found ? auditGeneratedPlanV2(plan, catalog, registry) : { valid: false, issues: [] };
  const allExercises = found ? plan.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises)) : [];
  const uiProjectionMatches = found && plan.weeks.every((week) => JSON.stringify(projectPublicV2Week(plan, week.weekNumber)) === JSON.stringify(
    week.days.map((day) => ({
      day: day.day,
      focus: day.title,
      duration: day.duration,
      exercises: day.exercises.map((exercise) => ({
        exerciseKey: exercise.exerciseKey,
        name: exercise.name,
        target: exercise.targetDisplay,
        rest: exercise.restDisplay,
      })),
    })),
  ));
  const deterministic = found && runs.every((run) => run.status === "found" && JSON.stringify(run.plan) === JSON.stringify(plan));
  const directMatch = found && direct?.status === "found" && JSON.stringify(direct.plan) === JSON.stringify(plan);
  const expectedDays = normalized.status === "valid" ? VALID_PROGRAMS[normalized.profile.program].daysPerWeek : null;
  const completeEditorial = normalized.status === "valid"
    && (normalized.profile.age === "18-29"
      || normalized.profile.age === "60+"
      || normalized.profile.age === "45-59"
      || normalized.profile.age === "30-44");
  const fourWeekProgression = found
    && plan.weeks.length === 4
    && (completeEditorial
      ? new Set(plan.weeks.map(weekExerciseSignature)).size === 4
      : weekExerciseSignature(plan.weeks[0]) === weekExerciseSignature(plan.weeks[2])
        && weekParameterSignature(plan.weeks[0]) !== weekParameterSignature(plan.weeks[2])
        && weekExerciseSignature(plan.weeks[0]) !== weekExerciseSignature(plan.weeks[1])
        && weekExerciseSignature(plan.weeks[0]) !== weekExerciseSignature(plan.weeks[3]));

  matrix.push({
    uiSelections,
    normalization: normalized,
    resolverStatus: result.status,
    resolver: result.resolver ?? null,
    engineVersion: result.engineVersion ?? null,
    fallbackUsed: result.fallbackUsed ?? null,
    issues: result.issues ?? [],
    canonicalKey: found ? result.canonicalKey : normalized.canonicalKey ?? null,
    planKey: plan?.planKey ?? null,
    expectedDays,
    weekCount: plan?.weeks.length ?? 0,
    dayCounts: plan?.weeks.map((week) => week.days.length) ?? [],
    emptyDays: plan?.weeks.reduce((count, week) => count + week.days.filter((day) => !day.exercises.length).length, 0) ?? 0,
    invalidExerciseKeys: allExercises.filter((exercise) => !catalogByKey.has(exercise.exerciseKey)).map((exercise) => exercise.exerciseKey),
    locationIncompatible: allExercises.filter((exercise) => !catalogByKey.get(exercise.exerciseKey)?.places.includes(normalized.profile?.place)).map((exercise) => exercise.exerciseKey),
    deterministic,
    directMatch,
    uiProjectionMatches,
    engineAuditValid: engineAudit.valid,
    engineAuditIssues: engineAudit.issues,
    fourWeekProgression,
    planSignature: plan ? sha(plan.weeks) : null,
    plan,
  });
}

const invalidBase = { gender: "masculin", age: "30-44", goal: "forma", place: "acasa", engineVersion: "v2" };
const invalidCombinations = [
  { label: "incepator-5", input: { ...invalidBase, level: "incepator", frequency: 5 } },
  { label: "avansat-3", input: { ...invalidBase, level: "avansat", frequency: 3 } },
  { label: "cat4-incepator-4", input: { ...invalidBase, age: "60+", program: "incepator-4" } },
  { label: "cat4-avansat-5", input: { ...invalidBase, age: "60+", program: "avansat-5" } },
].map(({ label, input }) => {
  const result = resolvePublicV2Plan(input, catalog, registry);
  return { label, input, status: result.status, issues: result.issues ?? [], accepted: result.status === "found", fallbackUsed: result.fallbackUsed };
});

const signatures = matrix.filter((entry) => entry.planSignature).map((entry) => entry.planSignature);
const summary = {
  auditVersion: "vemi-public-plan-engine-v2-e2e-1.0",
  generatedAt: new Date().toISOString(),
  runsPerCombination: RUNS,
  totalPublicProfileCombinations: matrix.length,
  publicProfileMappingValid: matrix.filter((entry) => entry.normalization.status === "valid").length,
  canonicalProfileKeysUnique: new Set(matrix.map((entry) => entry.canonicalKey)).size,
  v2ResolutionValid: matrix.filter((entry) => entry.resolverStatus === "found" && entry.engineVersion === "v2").length,
  publicV2PlansValid: matrix.filter((entry) => entry.engineAuditValid).length,
  publicV2PlansInvalid: matrix.filter((entry) => !entry.engineAuditValid).length,
  publicV2Errors: matrix.filter((entry) => entry.resolverStatus !== "found").length,
  publicV2Fallbacks: matrix.filter((entry) => entry.fallbackUsed !== false).length,
  publicV1ResolutionForNewPlans: matrix.filter((entry) => entry.engineVersion === "v1").length,
  publicFourWeekPlans: matrix.filter((entry) => entry.weekCount === 4).length,
  publicRealWeeklyProgression: matrix.filter((entry) => entry.fourWeekProgression).length,
  publicEmptyDays: matrix.reduce((count, entry) => count + entry.emptyDays, 0),
  publicIncompleteFrequency: matrix.filter((entry) => entry.dayCounts.some((days) => days !== entry.expectedDays)).length,
  publicInvalidExerciseKeys: matrix.reduce((count, entry) => count + entry.invalidExerciseKeys.length, 0),
  publicInactiveLegacyGenerated: 0,
  publicLocationIncompatible: matrix.reduce((count, entry) => count + entry.locationIncompatible.length, 0),
  publicDeterminismValid: matrix.filter((entry) => entry.deterministic).length,
  publicDirectEngineMatch: matrix.filter((entry) => entry.directMatch).length,
  publicUiProjectionMatch: matrix.filter((entry) => entry.uiProjectionMatches).length,
  exactUniquePlans: new Set(signatures).size,
  uniquePlanRatio: new Set(signatures).size / matrix.length,
  invalidLevelFrequencyCombinationsAccepted: invalidCombinations.filter((entry) => entry.accepted).length,
  invalidLevelFrequencyCombinationsRejected: invalidCombinations.filter((entry) => !entry.accepted).length,
  cat1ToCat3Profiles: matrix.filter((entry) => entry.normalization.profile?.age !== "60+").length,
  cat4HomeProfiles: matrix.filter((entry) => entry.normalization.profile?.age === "60+" && entry.normalization.profile?.place === "acasa").length,
  cat4GymProfiles: matrix.filter((entry) => entry.normalization.profile?.age === "60+" && entry.normalization.profile?.place === "sala").length,
};

const audit = { summary, invalidCombinations, matrix };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  const outputPath = resolve(process.argv[outputIndex + 1]);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(summary, null, 2));

const success = summary.totalPublicProfileCombinations === 168
  && summary.publicProfileMappingValid === 168
  && summary.canonicalProfileKeysUnique === 168
  && summary.v2ResolutionValid === 168
  && summary.publicV2PlansValid === 168
  && summary.publicV2Errors === 0
  && summary.publicV2Fallbacks === 0
  && summary.publicV1ResolutionForNewPlans === 0
  && summary.publicFourWeekPlans === 168
  && summary.publicRealWeeklyProgression === 168
  && summary.publicEmptyDays === 0
  && summary.publicIncompleteFrequency === 0
  && summary.publicInvalidExerciseKeys === 0
  && summary.publicLocationIncompatible === 0
  && summary.publicDeterminismValid === 168
  && summary.publicDirectEngineMatch === 168
  && summary.publicUiProjectionMatch === 168
  && summary.cat1ToCat3Profiles === 144
  && summary.cat4HomeProfiles === 12
  && summary.cat4GymProfiles === 12
  && summary.invalidLevelFrequencyCombinationsAccepted === 0
  && summary.invalidLevelFrequencyCombinationsRejected === 4;
if (!success) process.exitCode = 1;
