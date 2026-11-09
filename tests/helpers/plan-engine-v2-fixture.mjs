import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifestUrl = new URL(
  "../../data/plan-engine/v2/VEMI_Manifest_Content_Complete_2026-08-08.json",
  import.meta.url,
);
const registryUrl = new URL("../../data/plan-engine/v2/exercise-rules.json", import.meta.url);

export const manifestBytes = readFileSync(manifestUrl);
export const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
export const manifest = JSON.parse(manifestBytes.toString("utf8"));
export const registry = JSON.parse(readFileSync(registryUrl, "utf8"));

export const catalog = manifest.exercises.map((exercise) => ({
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

export const catalogByKey = new Map(catalog.map((exercise) => [exercise.id, exercise]));
export const ruleByKey = new Map(registry.rules.map((rule) => [rule.exercise_key, rule]));

export function exerciseSignature(plan) {
  return plan.weeks.map((week) => week.days.map((day) =>
    day.exercises.map((exercise) => exercise.exerciseKey).join(","),
  ).join("|")).join("||");
}

export function parameterSignature(plan) {
  return plan.weeks.map((week) => week.days.map((day) =>
    day.exercises.map((exercise) => [
      exercise.exerciseKey,
      exercise.sets,
      exercise.target.kind,
      exercise.target.min,
      exercise.target.max,
      exercise.restSeconds,
    ].join(":")).join(","),
  ).join("|")).join("||");
}
