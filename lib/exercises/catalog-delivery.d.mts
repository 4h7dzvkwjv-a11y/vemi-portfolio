import type { ExerciseCatalogPayload } from "./catalog-model";

export const EXPECTED_ACTIVE_EXERCISES: 114;
export const ACTIVE_CATALOG_CONTRACT_VERSION: string;
export const ACTIVE_CATALOG_ENDPOINT: "/api/exercise-catalog";

export function validateActiveCatalogPayload(value: unknown):
  | { valid: true; issues: []; payload: ExerciseCatalogPayload }
  | { valid: false; issues: string[] };
export function requireActiveCatalogPayload(value: unknown): ExerciseCatalogPayload;
export function selectPlayableExerciseKeys(value: unknown): ReadonlySet<string>;
export function fetchActiveCatalog(options?: {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  maxAttempts?: 1 | 2;
  signal?: AbortSignal;
}): Promise<ExerciseCatalogPayload>;
export function loadCatalogWithControlledRetry(
  loadCatalog: () => Promise<unknown>,
  options?: { maxAttempts?: 1 | 2 },
): Promise<ExerciseCatalogPayload>;
export function createCatalogRequestGate(): {
  begin(): number;
  isCurrent(token: number): boolean;
  invalidate(): void;
};
