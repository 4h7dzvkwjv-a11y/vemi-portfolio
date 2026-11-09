import type {
  ExerciseRegistryEntry,
  PlanConfiguration,
  PlanProfile,
  PlanResolution,
  ProfileConfigurationKey,
  ValidationResult,
} from "./contracts";

export function makeProfileConfigurationKey(profile: PlanProfile): ProfileConfigurationKey;
export function validatePlanProfile(profile: unknown): ValidationResult;
export function validateExerciseRegistry(registry: unknown): ValidationResult;
export function validatePlanConfiguration(configuration: unknown, exerciseRegistry: ExerciseRegistryEntry[]): ValidationResult;
export function resolvePlanConfiguration(
  profile: PlanProfile,
  configurations: PlanConfiguration[],
  exerciseRegistry: ExerciseRegistryEntry[],
): PlanResolution;
