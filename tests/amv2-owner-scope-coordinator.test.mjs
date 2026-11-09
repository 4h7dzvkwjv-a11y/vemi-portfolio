import assert from "node:assert/strict";
import test from "node:test";

import {
  Amv2OwnerScopeCoordinatorError,
  createOwnerScopeCoordinator,
} from "../lib/amv2/owner-scope-coordinator.mjs";
import {
  createAnonymousOwnerScope,
  createAuthenticatedOwnerScope,
} from "../lib/amv2/durable-local-store.mjs";

const scopeA = createAuthenticatedOwnerScope("owner-a");
const scopeB = createAuthenticatedOwnerScope("owner-b");
const anonScope = createAnonymousOwnerScope("installation-123");

const emptyProjection = (scope) => ({ scopeKey: scope.key, days: [], outbox: [], conflicts: [] });
const loaded = (scope, label) => ({
  scopeKey: scope.key,
  projection: { scopeKey: scope.key, days: [label], outbox: [`outbox-${label}`], conflicts: [] },
});

function createCoordinator() {
  return createOwnerScopeCoordinator({ createEmptyProjection: emptyProjection });
}

test("owner coordinator clears A synchronously through logout, anonymous state and B", () => {
  const coordinator = createCoordinator();

  const a = coordinator.beginScopeTransition(scopeA);
  coordinator.completeHydration(a.token, loaded(scopeA, "A"));
  assert.deepEqual(coordinator.getState().projection.days, ["A"]);

  const anonymous = coordinator.beginScopeTransition(anonScope);
  assert.equal(coordinator.getState().status, "loading");
  assert.deepEqual(coordinator.getState().projection.days, []);
  assert.equal(coordinator.getState().scopeKey, anonScope.key);
  coordinator.completeHydration(anonymous.token, loaded(anonScope, "anon"));

  const b = coordinator.beginScopeTransition(scopeB);
  assert.deepEqual(b.state.projection.days, []);
  assert.equal(b.state.scopeKey, scopeB.key);
  assert.equal(coordinator.completeHydration(b.token, loaded(scopeB, "B")).accepted, true);
  assert.deepEqual(coordinator.getState().projection.days, ["B"]);
  assert.equal(coordinator.completeHydration(a.token, loaded(scopeA, "late-A")).accepted, false);
  assert.deepEqual(coordinator.getState().projection.days, ["B"]);
});

test("direct A to B transition clears all owner-bound projections before B loads", () => {
  const coordinator = createCoordinator();
  const a = coordinator.beginScopeTransition(scopeA);
  coordinator.completeHydration(a.token, loaded(scopeA, "A"));

  const b = coordinator.beginScopeTransition(scopeB);
  assert.deepEqual(b.state.projection, emptyProjection(scopeB));
  assert.equal(coordinator.isCurrent(a.token), false);
  assert.equal(coordinator.isCurrent(b.token), true);
});

test("failed and cancelled loads remain empty and never restore the previous owner", () => {
  const coordinator = createCoordinator();
  const a = coordinator.beginScopeTransition(scopeA);
  coordinator.completeHydration(a.token, loaded(scopeA, "A"));

  const failedB = coordinator.beginScopeTransition(scopeB);
  const failed = coordinator.failHydration(failedB.token, { code: "OFFLINE_LOAD_FAILED" });
  assert.equal(failed.accepted, true);
  assert.equal(failed.state.status, "error");
  assert.equal(failed.state.errorCode, "OFFLINE_LOAD_FAILED");
  assert.deepEqual(failed.state.projection.days, []);

  const cancelledAnon = coordinator.beginScopeTransition(anonScope);
  const cancelled = coordinator.failHydration(cancelledAnon.token, { code: "LOGIN_CANCELLED", cancelled: true });
  assert.equal(cancelled.state.status, "cancelled");
  assert.deepEqual(cancelled.state.projection.days, []);
  assert.equal(coordinator.completeHydration(failedB.token, loaded(scopeB, "late-B")).accepted, false);
});

test("stale A hydration and acknowledgement cannot overwrite active B", async () => {
  const coordinator = createCoordinator();
  const a = coordinator.beginScopeTransition(scopeA);
  let resolveA;
  const delayedA = new Promise((resolve) => { resolveA = resolve; });

  const b = coordinator.beginScopeTransition(scopeB);
  coordinator.completeHydration(b.token, loaded(scopeB, "B"));

  resolveA(loaded(scopeA, "A-delayed"));
  assert.equal(coordinator.completeHydration(a.token, await delayedA).accepted, false);
  assert.equal(coordinator.applyAcknowledgement(a.token, loaded(scopeA, "A-ack")).accepted, false);
  assert.deepEqual(coordinator.getState().projection.days, ["B"]);
});

test("offline partition reads remain independent and return to A restores only A", () => {
  const partitions = new Map([
    [scopeA.key, loaded(scopeA, "A-offline")],
    [scopeB.key, loaded(scopeB, "B-offline")],
    [anonScope.key, loaded(anonScope, "anon-offline")],
  ]);
  const coordinator = createCoordinator();

  for (const scope of [scopeA, scopeB, anonScope, scopeA]) {
    const transition = coordinator.beginScopeTransition(scope);
    coordinator.completeHydration(transition.token, partitions.get(scope.key));
  }

  assert.equal(coordinator.getState().scopeKey, scopeA.key);
  assert.deepEqual(coordinator.getState().projection.days, ["A-offline"]);
  assert.deepEqual(coordinator.getState().projection.outbox, ["outbox-A-offline"]);
});

test("only the active token may install a matching scoped projection", () => {
  const coordinator = createCoordinator();
  const b = coordinator.beginScopeTransition(scopeB);

  assert.equal(coordinator.completeHydration(b.token, loaded(scopeA, "A")).accepted, false);
  assert.deepEqual(coordinator.getState().projection.days, []);
  assert.equal(coordinator.completeHydration({ epoch: b.token.epoch, scopeKey: scopeB.key }, loaded(scopeB, "forged")).accepted, false);
  assert.deepEqual(coordinator.getState().projection.days, []);
  assert.throws(
    () => coordinator.beginScopeTransition({ ...scopeB, key: "user:owner-a" }),
    (error) => error instanceof Amv2OwnerScopeCoordinatorError && error.code === "INVALID_OWNER_SCOPE",
  );
});

test("current acknowledgement adopts the canonical scoped projection and clear invalidates it", () => {
  const coordinator = createCoordinator();
  const a = coordinator.beginScopeTransition(scopeA);
  coordinator.completeHydration(a.token, loaded(scopeA, "A-local"));

  const acknowledgement = coordinator.applyAcknowledgement(a.token, loaded(scopeA, "A-server"));
  assert.equal(acknowledgement.accepted, true);
  assert.deepEqual(acknowledgement.state.projection.days, ["A-server"]);

  const cleared = coordinator.clearActiveScope();
  assert.equal(cleared.status, "idle");
  assert.equal(cleared.scopeKey, null);
  assert.equal(cleared.projection, null);
  assert.equal(coordinator.applyAcknowledgement(a.token, loaded(scopeA, "late-ack")).accepted, false);
});
