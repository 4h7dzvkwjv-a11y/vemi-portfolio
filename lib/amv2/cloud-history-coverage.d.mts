export const AMV2_HISTORY_COVERAGE_VERSION: 1;
export const AMV2_HISTORY_PAGE_SIZE: 3;

export type Amv2HistoryCoverageState = {
  version: 1;
  status: "incomplete" | "complete" | "stale" | "error";
  snapshotRevision: number | null;
  cursor: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  lastDurablePageAt: string | null;
  errorCode: string | null;
};

export type Amv2HistoryPage = {
  snapshotRevision: number;
  hasMore: boolean;
  nextCursor: string | null;
  days: Array<Record<string, unknown>>;
  exercises: Array<Record<string, unknown>>;
  sets: Array<Record<string, unknown>>;
  personalExercises: Array<Record<string, unknown>>;
  tombstones: Array<Record<string, unknown>>;
  dates: string[];
};

export class Amv2HistoryCoverageError extends Error { code: string }
export function createHistoryCoverageState(): Amv2HistoryCoverageState;
export function validateHistoryCoverageState(value: unknown): value is Amv2HistoryCoverageState;
export function readHistoryCoverage(coverage: unknown): Amv2HistoryCoverageState;
export function withHistoryCoverage(coverage: unknown, history: Amv2HistoryCoverageState): Record<string, unknown>;
export function isHistoryCoverageComplete(coverage: unknown): boolean;
export function normalizeHistoryPage(value: unknown, options?: {
  requestedCursor?: string | null;
  requestedSnapshotRevision?: number | null;
}): Amv2HistoryPage;
export function advanceHistoryCoverage(
  current: Amv2HistoryCoverageState,
  page: Amv2HistoryPage,
  timestamp: string,
): Amv2HistoryCoverageState;
export function restartHistoryCoverage(): Amv2HistoryCoverageState;
export function markHistoryCoverageStale(current: Amv2HistoryCoverageState): Amv2HistoryCoverageState;
export function markHistoryCoverageError(current: Amv2HistoryCoverageState, errorCode: string): Amv2HistoryCoverageState;
