export type CanonicalExerciseCatalogItem = Readonly<{
  exerciseKey: string;
  displayName: string;
  category: string;
  locations: readonly ("home" | "gym")[];
  collections: readonly string[];
}>;

export class CanonicalExerciseCatalogError extends Error {
  code: string;
}

export const CANONICAL_EXERCISE_CATALOG: readonly CanonicalExerciseCatalogItem[];
export const CANONICAL_EXERCISE_CATEGORIES: readonly string[];

export function resolveCanonicalExerciseCatalogItem(exerciseKey: string): CanonicalExerciseCatalogItem;

export function filterCanonicalExerciseCatalog(filters?: {
  query?: string;
  category?: string | null;
  location?: "home" | "gym" | null;
}): readonly CanonicalExerciseCatalogItem[];
