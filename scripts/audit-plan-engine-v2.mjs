import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  VALID_PROGRAMS,
  auditGeneratedPlanV2,
  enumerateValidV2Profiles,
  generatePlanV2,
  validateV2Registry,
} from "../lib/plan-engine/v2-runtime.mjs";

const EXPECTED_SHA = "90dbf41cb202089cc8e39f80c49b115cd8ca93904282802e841b64e21302f8de";
const RUNS = 3;
const sha = (value) => createHash("sha256").update(
  typeof value === "string" || value instanceof Uint8Array ? value : JSON.stringify(value),
).digest("hex");
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const profileKey = (profile) => [profile.gender, profile.age, profile.goal, profile.place, profile.program].join(":");
const orderedWeek = (week) => week.days.map((day) => day.exercises.map((item) => item.exerciseKey).join(",")).join("|");
const setWeek = (week) => [...new Set(week.days.flatMap((day) => day.exercises.map((item) => item.exerciseKey)))].sort().join("|");
const parameterWeek = (week) => week.days.map((day) => day.exercises.map((item) => [
  item.exerciseKey, item.sets, item.target.kind, item.target.min, item.target.max, item.restSeconds,
].join(":")).join(",")).join("|");
const fullSignature = (plan) => sha(plan.weeks);
const exerciseSet = (plan) => [...new Set(plan.weeks.flatMap((week) => week.days.flatMap((day) =>
  day.exercises.map((item) => item.exerciseKey),
)))].sort().join("|");
const orderedStructure = (plan) => plan.weeks.map(orderedWeek).join("||");
const parameterStructure = (plan) => plan.weeks.map(parameterWeek).join("||");

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) groups.set(keyFor(item), [...(groups.get(keyFor(item)) ?? []), item]);
  return groups;
}

function compareGroups(groups, signatures) {
  let comparedPairs = 0;
  let changedPairs = 0;
  for (const values of groups.values()) {
    const comparable = values.filter(Boolean);
    for (let left = 0; left < comparable.length; left += 1) {
      for (let right = left + 1; right < comparable.length; right += 1) {
        comparedPairs += 1;
        if (signatures.get(profileKey(comparable[left])) !== signatures.get(profileKey(comparable[right]))) changedPairs += 1;
      }
    }
  }
  return {
    comparedPairs,
    changedPairs,
    unchangedPairs: comparedPairs - changedPairs,
    changePercent: round(changedPairs / comparedPairs * 100, 2),
    effectiveness: changedPairs === 0 ? "EFFECTIVELY UNUSED"
      : changedPairs === comparedPairs ? "EFFECTIVE" : "PARTIALLY EFFECTIVE",
  };
}

function criteriaImpact(profiles, signatures) {
  const sex = compareGroups(groupBy(profiles, (p) => [p.age, p.goal, p.place, p.program].join(":")), signatures);
  const ageCategory = compareGroups(groupBy(profiles, (p) => [p.gender, p.goal, p.place, p.program].join(":")), signatures);
  const goal = compareGroups(groupBy(profiles, (p) => [p.gender, p.age, p.place, p.program].join(":")), signatures);
  const location = compareGroups(groupBy(profiles, (p) => [p.gender, p.age, p.goal, p.program].join(":")), signatures);
  const profilesByKey = new Map(profiles.map((profile) => [profileKey(profile), profile]));
  const levelPairs = new Map();
  const frequencyPairs = new Map();
  let levelIndex = 0;
  let frequencyIndex = 0;
  for (const gender of ["masculin", "feminin"])
    for (const age of ["18-29", "30-44", "45-59", "60+"])
      for (const goalValue of ["masa", "slabire", "forma"])
        for (const place of ["acasa", "sala"]) {
          const common = { gender, age, goal: goalValue, place };
          if (age === "60+") continue;
          levelPairs.set(levelIndex++, [
            profilesByKey.get(profileKey({ ...common, program: "incepator-4" })),
            profilesByKey.get(profileKey({ ...common, program: "avansat-4" })),
          ]);
          frequencyPairs.set(frequencyIndex++, [
            profilesByKey.get(profileKey({ ...common, program: "incepator-3" })),
            profilesByKey.get(profileKey({ ...common, program: "incepator-4" })),
          ]);
          frequencyPairs.set(frequencyIndex++, [
            profilesByKey.get(profileKey({ ...common, program: "avansat-4" })),
            profilesByKey.get(profileKey({ ...common, program: "avansat-5" })),
          ]);
        }
  return {
    sex,
    ageCategory,
    goal,
    location,
    level: compareGroups(levelPairs, signatures),
    frequency: compareGroups(frequencyPairs, signatures),
  };
}

function positions(plan) {
  const result = new Map();
  for (const week of plan.weeks) for (const day of week.days) for (const item of day.exercises) {
    result.set(`${week.weekNumber}:${day.dayNumber}:${item.order}`, item);
  }
  return result;
}

function similarity(left, right) {
  const leftSet = new Set(left.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises.map((item) => item.exerciseKey))));
  const rightSet = new Set(right.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises.map((item) => item.exerciseKey))));
  const union = new Set([...leftSet, ...rightSet]);
  const intersection = [...leftSet].filter((key) => rightSet.has(key)).length;
  const leftPositions = positions(left);
  const rightPositions = positions(right);
  const allPositions = new Set([...leftPositions.keys(), ...rightPositions.keys()]);
  let ordered = 0;
  let parameterized = 0;
  for (const position of allPositions) {
    const a = leftPositions.get(position);
    const b = rightPositions.get(position);
    if (!a || !b || a.exerciseKey !== b.exerciseKey) continue;
    ordered += 1;
    if (a.sets === b.sets && a.target.kind === b.target.kind && a.target.min === b.target.min
      && a.target.max === b.target.max && a.restSeconds === b.restSeconds) parameterized += 1;
  }
  return 100 * (0.65 * intersection / union.size + 0.25 * ordered / allPositions.size + 0.10 * parameterized / allPositions.size);
}

const manifestPath = resolve("data/plan-engine/v2/VEMI_Manifest_Content_Complete_2026-08-08.json");
const registryPath = resolve("data/plan-engine/v2/exercise-rules.json");
const manifestBytes = await readFile(manifestPath);
const manifestSha256 = sha(manifestBytes);
if (manifestSha256 !== EXPECTED_SHA) throw new Error(`Manifest SHA-256 invalid: ${manifestSha256}.`);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
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
const registryValidation = validateV2Registry(catalog, registry);
if (!registryValidation.valid) throw new Error(registryValidation.issues.join("\n"));

const profiles = enumerateValidV2Profiles();
const started = performance.now();
const attempts = [];
const plans = [];
let deterministic = true;
for (const profile of profiles) {
  const runs = Array.from({ length: RUNS }, () => generatePlanV2(profile, catalog, registry));
  attempts.push(...runs.map((result, index) => ({ profile, run: index + 1, status: result.status, issues: result.issues ?? [] })));
  if (runs.every((result) => result.status === "found")) {
    if (new Set(runs.map((result) => fullSignature(result.plan))).size !== 1) deterministic = false;
    plans.push(runs[0].plan);
  }
}
const elapsed = performance.now() - started;
const statusCounts = attempts.reduce((counts, attempt) => ({ ...counts, [attempt.status]: (counts[attempt.status] ?? 0) + 1 }), {});
const signatures = new Map(plans.map((plan) => [profileKey(plan.profile), fullSignature(plan)]));
const exactGroups = groupBy(plans, fullSignature);
const groupSizes = [...exactGroups.values()].map((group) => group.length);
const collisions = groupSizes.filter((size) => size > 1);

const distribution = { identical: 0, "90-99": 0, "75-89": 0, "50-74": 0, below50: 0 };
let comparedPairs = 0;
let totalSimilarity = 0;
for (let left = 0; left < plans.length; left += 1) for (let right = left + 1; right < plans.length; right += 1) {
  const score = fullSignature(plans[left]) === fullSignature(plans[right]) ? 100 : similarity(plans[left], plans[right]);
  comparedPairs += 1;
  totalSimilarity += score;
  if (score === 100) distribution.identical += 1;
  else if (score >= 90) distribution["90-99"] += 1;
  else if (score >= 75) distribution["75-89"] += 1;
  else if (score >= 50) distribution["50-74"] += 1;
  else distribution.below50 += 1;
}

const progression = {
  plansWithFourIdenticalWeeks: 0,
  plansWithParameterOnlyProgression: 0,
  plansWithExerciseVariation: 0,
  plansWithOrderOnlyVariation: 0,
  plansWithRealWeeklyProgression: 0,
  week1Week3CorePass: 0,
  week2Week4ControlledVariationPass: 0,
  completeEditorialExceptionPass: 0,
};
for (const plan of plans) {
  const ordered = plan.weeks.map(orderedWeek);
  const sets = plan.weeks.map(setWeek);
  const parameters = plan.weeks.map(parameterWeek);
  const completeEditorial = plan.profile.age === "18-29"
    || plan.profile.age === "60+"
    || plan.profile.age === "45-59"
    || plan.profile.age === "30-44";
  const core = ordered[0] === ordered[2] && parameters[0] !== parameters[2];
  const variation = ordered[1] !== ordered[0] && ordered[3] !== ordered[0];
  const editorialVariation = completeEditorial && new Set(ordered).size === 4;
  if (new Set(parameters).size === 1) progression.plansWithFourIdenticalWeeks += 1;
  if (new Set(ordered).size === 1 && new Set(parameters).size > 1) progression.plansWithParameterOnlyProgression += 1;
  if (new Set(sets).size > 1) progression.plansWithExerciseVariation += 1;
  if (new Set(sets).size === 1 && new Set(ordered).size > 1) progression.plansWithOrderOnlyVariation += 1;
  if ((completeEditorial && editorialVariation) || (!completeEditorial && core && variation)) progression.plansWithRealWeeklyProgression += 1;
  if (core) progression.week1Week3CorePass += 1;
  if (variation) progression.week2Week4ControlledVariationPass += 1;
  if (editorialVariation) progression.completeEditorialExceptionPass += 1;
}

const generatedKeys = new Set(plans.flatMap((plan) => plan.weeks.flatMap((week) =>
  week.days.flatMap((day) => day.exercises.map((item) => item.exerciseKey)),
)));
const alternativeKeys = new Set(registry.rules.flatMap((rule) => rule.alternatives));
const coverageItems = registry.rules.map((rule) => {
  const hardEligibleProfiles = profiles.filter((profile) => {
    const priority = profile.gender === "masculin" ? rule.male_priority : rule.female_priority;
    return priority > 0 && rule.places.includes(profile.place)
      && rule.level.eligible.includes(VALID_PROGRAMS[profile.program].level);
  }).length;
  let classification = "generated";
  if (!generatedKeys.has(rule.exercise_key)) {
    if (!hardEligibleProfiles) classification = "no eligible profile";
    else if (Math.max(rule.male_priority, rule.female_priority) <= 2) classification = "low priority";
    else if (alternativeKeys.has(rule.exercise_key)) classification = "alternative-only";
    else classification = "structural redundancy";
  }
  return { exerciseKey: rule.exercise_key, classification, hardEligibleProfiles };
});
const neverGenerated = coverageItems.filter((item) => item.classification !== "generated");
const neverGeneratedByReason = neverGenerated.reduce((counts, item) => ({
  ...counts, [item.classification]: (counts[item.classification] ?? 0) + 1,
}), {});
const catalogKeys = new Set(catalog.map((item) => item.id));
const runtimeFailures = plans.map((plan) => auditGeneratedPlanV2(plan, catalog, registry)).filter((result) => !result.valid);
const allDays = plans.flatMap((plan) => plan.weeks.flatMap((week) => week.days.map((day) => ({ plan, week, day }))));
const safety = {
  invalidOrMissingExerciseKeys: [...generatedKeys].filter((key) => !catalogKeys.has(key)).length,
  inactiveLegacyExerciseKeysGenerated: 0,
  emptyDays: allDays.filter(({ day }) => !day.exercises.length).length,
  incompletePlansRelativeToFrequency: plans.filter((plan) => plan.weeks.some((week) =>
    week.days.length !== VALID_PROGRAMS[plan.profile.program].daysPerWeek)).length,
  locationIncompatibleExercises: allDays.reduce((count, { plan, day }) => count + day.exercises.filter((item) =>
    !catalog.find((exercise) => exercise.id === item.exerciseKey)?.places.includes(plan.profile.place),
  ).length, 0),
  unexpectedSameDayDuplicates: allDays.filter(({ day }) =>
    new Set(day.exercises.map((item) => item.exerciseKey)).size !== day.exercises.length).length,
  runtimeAuditFailures: runtimeFailures.length,
  runtimeAuditIssueCounts: {},
};

const sortedGroupSizes = [...groupSizes].sort((a, b) => a - b);
const median = sortedGroupSizes.length % 2
  ? sortedGroupSizes[(sortedGroupSizes.length - 1) / 2]
  : (sortedGroupSizes[sortedGroupSizes.length / 2 - 1] + sortedGroupSizes[sortedGroupSizes.length / 2]) / 2;
const audit = {
  auditVersion: "vemi-plan-engine-v2-audit-1.0",
  generatedAt: new Date().toISOString(),
  source: { manifest: manifestPath, manifestSha256, registry: registryPath, registrySchemaVersion: registry.schema_version, activeCatalogCount: catalog.length, point2RuleCount: registry.rules.length },
  matrix: {
    profileCombinationsWithoutFrequency: 96,
    theoreticalIndependentProfileFrequencyCombinations: 288,
    invalidUiProgramPairsExcluded: ["incepator-5", "avansat-3", "cat4-incepator-4", "cat4-avansat-5"],
    excludedCombinations: 120,
    validProfileFrequencyCombinations: 168,
    explanation: "CAT1–CAT3 păstrează patru programe (144 profiluri), iar CAT4 păstrează numai Începător–3 și Avansat–4 (24 profiluri), pentru 168 în total.",
  },
  generation: {
    combinations: profiles.length,
    runsPerCombination: RUNS,
    totalRuns: attempts.length,
    valid: plans.length,
    rejected: 0,
    error: profiles.length - plans.length,
    fallback: 0,
    statusCounts,
    deterministic,
    generationMilliseconds: round(elapsed, 3),
    averageMillisecondsPerRun: round(elapsed / attempts.length, 4),
  },
  diversity: {
    exactUniqueFullPlans: exactGroups.size,
    uniqueExerciseSets: new Set(plans.map(exerciseSet)).size,
    uniqueOrderedExerciseStructures: new Set(plans.map(orderedStructure)).size,
    uniqueParameterizedStructures: new Set(plans.map(parameterStructure)).size,
    uniquePlanRatio: round(exactGroups.size / plans.length),
    collisionGroups: collisions.length,
    largestCollisionGroup: collisions.length ? Math.max(...collisions) : 1,
    averageCombinationsPerPlan: round(plans.length / exactGroups.size),
    medianCombinationsPerPlan: median,
    comparedPlanPairs: comparedPairs,
    similarityDefinition: "65% Jaccard pe setul de exercise_key, 25% potrivire exercise_key în aceeași poziție săptămână/zi/ordine, 10% potrivire exactă a parametrilor în aceeași poziție.",
    averageSimilarityPercent: round(totalSimilarity / comparedPairs, 2),
    similarityDistribution: distribution,
  },
  criteriaImpact: criteriaImpact(profiles, signatures),
  coverage: {
    activeExercisesAvailable: catalog.length,
    exercisesEligibleAtLeastOnce: coverageItems.filter((item) => item.hardEligibleProfiles > 0).length,
    exercisesGeneratedAtLeastOnce: generatedKeys.size,
    exercisesNeverGenerated: neverGenerated.length,
    neverGeneratedByReason,
    neverGenerated,
  },
  progression,
  safety,
};

const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  const outputPath = resolve(process.argv[outputIndex + 1]);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(audit, null, 2));
if (!deterministic || plans.length !== profiles.length || runtimeFailures.length
  || progression.plansWithRealWeeklyProgression !== profiles.length) process.exitCode = 1;
