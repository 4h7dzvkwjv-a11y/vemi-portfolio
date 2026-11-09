const OWNER_IDENTIFIER = /^[A-Za-z0-9_-]{3,128}$/;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

const freeze = (value) => Object.freeze(value);

export class Amv2OwnerScopeCoordinatorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "Amv2OwnerScopeCoordinatorError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new Amv2OwnerScopeCoordinatorError(code, message);
}

function assertOpaqueIdentifier(value, label) {
  if (typeof value !== "string" || !OWNER_IDENTIFIER.test(value) || value.includes("@")) {
    fail("INVALID_OWNER_SCOPE", `${label} trebuie să fie un identificator opac.`);
  }
}

function normalizeOwnerScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    fail("INVALID_OWNER_SCOPE", "Partiția locală AMV2 este invalidă.");
  }

  if (scope.kind === "authenticated") {
    assertOpaqueIdentifier(scope.ownerUserId, "Identitatea contului");
    if (scope.installationId !== null || scope.key !== `user:${scope.ownerUserId}`) {
      fail("INVALID_OWNER_SCOPE", "Partiția autentificată AMV2 nu corespunde identității contului.");
    }
    return freeze({
      kind: "authenticated",
      ownerUserId: scope.ownerUserId,
      installationId: null,
      key: scope.key,
    });
  }

  if (scope.kind === "anonymous") {
    assertOpaqueIdentifier(scope.installationId, "Identitatea instalării anonime");
    if (scope.ownerUserId !== null || scope.key !== `anon:${scope.installationId}`) {
      fail("INVALID_OWNER_SCOPE", "Partiția anonimă AMV2 nu corespunde identității instalării.");
    }
    return freeze({
      kind: "anonymous",
      ownerUserId: null,
      installationId: scope.installationId,
      key: scope.key,
    });
  }

  fail("INVALID_OWNER_SCOPE", "Tipul partiției locale AMV2 este invalid.");
}

function createState({ epoch, scope, status, projection, errorCode = null }) {
  return freeze({
    epoch,
    scope,
    scopeKey: scope?.key ?? null,
    status,
    projection,
    errorCode,
  });
}

function createResult(accepted, state) {
  return freeze({ accepted, state });
}

/**
 * Coordinates trusted auth/installation scopes without performing storage or
 * network I/O. A scoped projection may be committed only through the current,
 * unforgeable transition token and only when its scope key matches that token.
 */
export function createOwnerScopeCoordinator({ createEmptyProjection }) {
  if (typeof createEmptyProjection !== "function") {
    fail("INVALID_EMPTY_PROJECTION_FACTORY", "Coordinatorul AMV2 necesită o proiecție locală goală.");
  }

  let epoch = 0;
  let currentToken = null;
  let state = createState({ epoch, scope: null, status: "idle", projection: null });
  const issuedTokens = new WeakSet();

  const isCurrent = (token) => Boolean(
    token
      && typeof token === "object"
      && issuedTokens.has(token)
      && token === currentToken
      && token.epoch === state.epoch
      && token.scopeKey === state.scopeKey,
  );

  const rejectStale = () => createResult(false, state);

  function beginScopeTransition(scope) {
    const normalizedScope = normalizeOwnerScope(scope);
    epoch += 1;
    const token = freeze({ epoch, scopeKey: normalizedScope.key });
    issuedTokens.add(token);
    currentToken = token;

    // Clear synchronously before invoking any user-provided factory. If that
    // factory fails, no projection from the previous owner remains reachable.
    state = createState({ epoch, scope: normalizedScope, status: "loading", projection: null });
    try {
      state = createState({
        epoch,
        scope: normalizedScope,
        status: "loading",
        projection: createEmptyProjection(normalizedScope),
      });
    } catch (error) {
      state = createState({
        epoch,
        scope: normalizedScope,
        status: "error",
        projection: null,
        errorCode: "EMPTY_PROJECTION_FAILED",
      });
      throw error;
    }

    return freeze({ token, state });
  }

  function commitScopedProjection(token, candidate, requiredStatus) {
    if (!isCurrent(token) || state.status !== requiredStatus) return rejectStale();
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      fail("INVALID_SCOPED_PROJECTION", "Rezultatul încărcării AMV2 este invalid.");
    }
    if (candidate.scopeKey !== token.scopeKey) {
      return rejectStale();
    }
    if (!("projection" in candidate)) {
      fail("INVALID_SCOPED_PROJECTION", "Rezultatul încărcării AMV2 nu conține proiecția locală.");
    }
    state = createState({
      epoch,
      scope: state.scope,
      status: "ready",
      projection: candidate.projection,
    });
    return createResult(true, state);
  }

  function completeHydration(token, candidate) {
    return commitScopedProjection(token, candidate, "loading");
  }

  function applyAcknowledgement(token, candidate) {
    return commitScopedProjection(token, candidate, "ready");
  }

  function failHydration(token, { code = "LOAD_FAILED", cancelled = false } = {}) {
    if (!isCurrent(token) || state.status !== "loading") return rejectStale();
    if (typeof code !== "string" || !ERROR_CODE.test(code)) {
      fail("INVALID_LOAD_ERROR", "Codul erorii de încărcare AMV2 este invalid.");
    }
    state = createState({
      epoch,
      scope: state.scope,
      status: cancelled ? "cancelled" : "error",
      projection: state.projection,
      errorCode: code,
    });
    return createResult(true, state);
  }

  function clearActiveScope() {
    epoch += 1;
    currentToken = null;
    state = createState({ epoch, scope: null, status: "idle", projection: null });
    return state;
  }

  return freeze({
    beginScopeTransition,
    completeHydration,
    applyAcknowledgement,
    failHydration,
    clearActiveScope,
    getState: () => state,
    isCurrent,
  });
}
