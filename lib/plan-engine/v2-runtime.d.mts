import type { CatalogExercise } from "../exercises/catalog-model";

export type V2Gender = "masculin" | "feminin";
export type V2Age = "18-29" | "30-44" | "45-59" | "60+";
export type V2Goal = "masa" | "slabire" | "forma";
export type V2Place = "acasa" | "sala";
export type V2Program = "incepator-3" | "incepator-4" | "avansat-4" | "avansat-5";
export type V2Level = "incepator" | "avansat";

export type V2Profile = {
  gender: V2Gender;
  age: V2Age;
  goal: V2Goal;
  place: V2Place;
  program: V2Program;
};

export type V2Rule = {
  exercise_key: string;
  canonical_name: string;
  canonical_group: string;
  kind: "forta" | "cardio";
  places: V2Place[];
  male_priority: number;
  female_priority: number;
  min_rotation_days: { male: number; female: number };
  age_60_plus: { selection: "preferred" | "allowed" | "reduced_priority" | "not_default"; guidance: string };
  role: { tier: "principal" | "secundar" | "auxiliar"; description: string };
  level: { eligible: Array<"incepator" | "intermediar" | "avansat">; preferred: Array<"incepator" | "intermediar" | "avansat"> };
  alternatives: string[];
  exclusion_keys: string[];
  exclusions: string[];
  notes: string[];
  source: Record<string, unknown>;
};

export type V2RuleRegistry = {
  schema_version: "vemi-plan-engine-rules-v2.0";
  source_manifest: { filename: string; sha256: string; point_2_schema_version: string };
  exercise_count: 114;
  rules: V2Rule[];
};

export type V2PlanExercise = {
  order: number;
  exerciseKey: string;
  name: string;
  group: string;
  kind: "forta" | "cardio";
  role: "principal" | "secundar" | "auxiliar";
  sets: number;
  target: { kind: "repetitions" | "duration_seconds"; min: number; max: number };
  targetDisplay: string;
  restSeconds: number;
  restDisplay: string;
  sourceRecommendation: string;
};

export type V2PlanDay = {
  dayNumber: number;
  day: string;
  title: string;
  focus: string;
  estimatedMinutes: number;
  duration: string;
  exercises: V2PlanExercise[];
};

export type V2PlanWeek = {
  weekNumber: number;
  label: string;
  progression: string;
  days: V2PlanDay[];
};

export type V2Plan = {
  engineVersion: "v2";
  planKey: string;
  profile: V2Profile & { level: V2Level; daysPerWeek: 3 | 4 | 5 };
  structureTemplate: string;
  weeks: V2PlanWeek[];
};

export const PLAN_ENGINE_V2: "v2";
export const VALID_PROGRAMS: Readonly<Record<V2Program, Readonly<{ level: V2Level; daysPerWeek: 3 | 4 | 5 }>>>;
export const CAT4_VALID_PROGRAMS: readonly ["incepator-3", "avansat-4"];
export const PROFILE_DOMAINS: Readonly<{
  gender: readonly V2Gender[];
  age: readonly V2Age[];
  goal: readonly V2Goal[];
  place: readonly V2Place[];
  program: readonly V2Program[];
}>;
export const SCORE_WEIGHTS: Readonly<Record<string, unknown>>;

export function v2ProgramsForAge(age: unknown): readonly V2Program[];
export function isV2ProgramAllowedForAge(age: unknown, program: unknown): boolean;
export function validateV2Profile(profile: unknown): { valid: boolean; issues: string[] };
export function validateV2Registry(catalog: CatalogExercise[], registry: V2RuleRegistry): { valid: boolean; issues: string[] };
export function auditGeneratedPlanV2(plan: V2Plan, catalog: CatalogExercise[], registry: V2RuleRegistry): { valid: boolean; issues: string[] };
export function generatePlanV2(
  profile: V2Profile,
  catalog: CatalogExercise[],
  registry: V2RuleRegistry,
):
  | { status: "found"; plan: V2Plan }
  | { status: "invalid_profile" | "invalid_registry" | "invalid_configuration" | "configuration_error"; issues: string[] };
export function enumerateValidV2Profiles(): V2Profile[];
