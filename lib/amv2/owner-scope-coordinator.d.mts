import type { Amv2OwnerScope } from "./durable-local-store.mjs";

export type OwnerScopeCoordinatorStatus = "idle" | "loading" | "ready" | "error" | "cancelled";

declare const ownerScopeTokenBrand: unique symbol;

export type OwnerScopeToken = Readonly<{
  epoch: number;
  scopeKey: string;
  readonly [ownerScopeTokenBrand]: true;
}>;

export type OwnerScopeState<Projection> = Readonly<{
  epoch: number;
  scope: Amv2OwnerScope | null;
  scopeKey: string | null;
  status: OwnerScopeCoordinatorStatus;
  projection: Projection | null;
  errorCode: string | null;
}>;

export type ScopedOwnerProjection<Projection> = Readonly<{
  scopeKey: string;
  projection: Projection;
}>;

export type OwnerScopeTransition<Projection> = Readonly<{
  token: OwnerScopeToken;
  state: OwnerScopeState<Projection>;
}>;

export type OwnerScopeCommit<Projection> = Readonly<{
  accepted: boolean;
  state: OwnerScopeState<Projection>;
}>;

export class Amv2OwnerScopeCoordinatorError extends Error {
  readonly code: string;
}

export function createOwnerScopeCoordinator<Projection>(options: Readonly<{
  createEmptyProjection: (scope: Amv2OwnerScope) => Projection;
}>): Readonly<{
  beginScopeTransition(scope: Amv2OwnerScope): OwnerScopeTransition<Projection>;
  completeHydration(
    token: OwnerScopeToken,
    candidate: ScopedOwnerProjection<Projection>,
  ): OwnerScopeCommit<Projection>;
  applyAcknowledgement(
    token: OwnerScopeToken,
    candidate: ScopedOwnerProjection<Projection>,
  ): OwnerScopeCommit<Projection>;
  failHydration(
    token: OwnerScopeToken,
    failure?: Readonly<{ code?: string; cancelled?: boolean }>,
  ): OwnerScopeCommit<Projection>;
  clearActiveScope(): OwnerScopeState<Projection>;
  getState(): OwnerScopeState<Projection>;
  isCurrent(token: OwnerScopeToken): boolean;
}>;
