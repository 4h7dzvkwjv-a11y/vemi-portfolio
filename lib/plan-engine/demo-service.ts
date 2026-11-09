import {
  MOCK_EXERCISE_REGISTRY,
  MOCK_PLAN_CONFIGURATIONS,
} from "../../data/plan-engine/mock-data";
import type { PlanProfile } from "./contracts";
import { resolvePlanConfiguration } from "./runtime.mjs";

const exerciseByKey = new Map(MOCK_EXERCISE_REGISTRY.map((exercise) => [exercise.exercise_key, exercise]));

export function resolveDemoPlan(profile: PlanProfile) {
  return resolvePlanConfiguration(profile, MOCK_PLAN_CONFIGURATIONS, MOCK_EXERCISE_REGISTRY);
}

export function getDemoExercise(exerciseKey: string) {
  return exerciseByKey.get(exerciseKey);
}
