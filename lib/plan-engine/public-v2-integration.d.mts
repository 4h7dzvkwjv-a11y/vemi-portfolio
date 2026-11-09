import type { CatalogExercise } from "../exercises/catalog-model";
import type {
  V2Age,
  V2Gender,
  V2Goal,
  V2Place,
  V2Plan,
  V2Profile,
  V2Program,
  V2RuleRegistry,
} from "./v2-runtime.mjs";

export type PublicV2Level = "incepator" | "avansat";
export type PublicV2Frequency = 3 | 4 | 5;
export type PublicV2Selections = Partial<{
  gender: V2Gender | string;
  age: V2Age | string;
  ageCategory: "cat1" | "cat2" | "cat3" | "cat4" | string;
  goal: V2Goal | string;
  place: V2Place | string;
  program: V2Program | string;
  level: PublicV2Level | string;
  frequency: PublicV2Frequency | number | string;
  engineVersion: "v1" | "v2" | string;
}>;

export const PUBLIC_V2_LEVELS: readonly PublicV2Level[];
export const PUBLIC_V2_FREQUENCIES_BY_LEVEL: Readonly<Record<PublicV2Level, readonly PublicV2Frequency[]>>;
export const PUBLIC_V2_AGE_CATEGORIES: Readonly<Record<"cat1" | "cat2" | "cat3" | "cat4", Readonly<{ label: string; engineValue: V2Age }>>>;

export function publicProgramForLevelFrequency(level: unknown, frequency: unknown): V2Program | null;
export function publicProgramDetails(program: unknown): { level: PublicV2Level; frequency: PublicV2Frequency } | null;
export function publicFrequenciesForLevel(level: unknown): readonly PublicV2Frequency[];
export function publicProgramsForAge(age: unknown): readonly V2Program[];
export function publicV2ProfileKey(profile: V2Profile): string;
export function normalizePublicV2Selections(input: unknown):
  | { status: "valid"; engineVersion: "v2"; profile: V2Profile; level: PublicV2Level; frequency: PublicV2Frequency; canonicalKey: string; fallbackUsed: false }
  | { status: "invalid_profile"; issues: string[]; fallbackUsed: false };
export function resolvePublicV2Plan(input: unknown, catalog: CatalogExercise[], registry: V2RuleRegistry):
  | { status: "found"; plan: V2Plan; engineVersion: "v2"; resolver: "public-v2"; normalizedProfile: V2Profile; canonicalKey: string; fallbackUsed: false }
  | { status: "invalid_profile" | "invalid_registry" | "invalid_configuration" | "configuration_error" | "integration_error"; issues: string[]; engineVersion: "v2"; resolver: "public-v2"; normalizedProfile?: V2Profile; canonicalKey?: string; fallbackUsed: false };
export function projectPublicV2Week(plan: V2Plan, activeWeek: number): Array<{
  day: string;
  focus: string;
  duration: string;
  exercises: Array<{ exerciseKey: string; name: string; target: string; rest: string }>;
}>;
export function enumeratePublicV2Selections(): Array<V2Profile & { engineVersion: "v2" }>;
