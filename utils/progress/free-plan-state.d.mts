import type { CloudSelections, CloudWorkout, CloudWorkoutLog } from "./client";

export type FreePlanSnapshot = {
  selections?: CloudSelections;
  activeWeek: number;
  completed: string[];
  workouts: CloudWorkout[];
  logs: CloudWorkoutLog[];
  [key: string]: unknown;
};

export type GenerationGate = {
  begin(): number | null;
  isCurrent(token: number): boolean;
  fail(token: number): void;
  invalidate(): number;
  snapshot(): { epoch: number; locked: boolean };
};

export function normalizePlanInstanceId(value: unknown): string | undefined;
export function normalizeFreePlanContentVersion(value: unknown): string | undefined;
export function expectedFreePlanContentVersion(selections: CloudSelections | undefined): string | undefined;
export function hasCurrentFreePlanContentVersion(selections: CloudSelections | undefined): boolean;
export function normalizeFreePlanSelectionsForCurrentContent(selections: CloudSelections | undefined): CloudSelections;
export function createPlanInstanceId(randomUUID?: () => string): string;
export function hasRequiredFreePlanSelections(selections: CloudSelections): boolean;
export function invalidateFinalFreePlanSelection(
  selections: CloudSelections,
  key: "gender" | "age" | "goal" | "place",
  value: string,
): CloudSelections;
export function finalizeFreePlanSelections(
  selections: CloudSelections,
  program: string,
  planInstanceId: string,
): CloudSelections | null;
export function resetActiveFreePlanSnapshot<T extends FreePlanSnapshot>(snapshot: T): T & {
  selections: Record<string, never>;
  activeWeek: 1;
  completed: [];
};
export function createFreePlanGenerationGate(): GenerationGate;
export function shouldApplyFreePlanHydration(
  requestEpoch: number,
  currentEpoch: number,
  selectionFlowActive: boolean,
): boolean;
export function withPlanInstanceKey(canonicalPlanKey: string, planInstanceId?: string): string;
export function withPlanContentVersionKey(canonicalPlanKey: string, contentVersion?: string): string;
export function planContentVersionFromPlanKey(planKey: unknown): string | undefined;
export function planInstanceIdFromPlanKey(planKey: unknown): string | undefined;
export function activeFreePlanSessions<
  P extends { id: string; plan_key: string; started_at?: string | null },
  S extends { source: string; free_plan_id?: string | null; completed_at?: string | null; updated_at?: string | null },
>(plan: P | null | undefined, sessions: S[]): S[];
