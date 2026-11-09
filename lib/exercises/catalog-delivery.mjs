export const EXPECTED_ACTIVE_EXERCISES = 114;
export const ACTIVE_CATALOG_CONTRACT_VERSION =
  "vemi-plan-engine-rules-v2.0:90dbf41cb202089cc8e39f80c49b115cd8ca93904282802e841b64e21302f8de:114";
export const ACTIVE_CATALOG_ENDPOINT = "/api/exercise-catalog";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validExercise(exercise) {
  return Boolean(
    exercise
    && isNonEmptyString(exercise.id)
    && isNonEmptyString(exercise.name)
    && isNonEmptyString(exercise.group)
    && (exercise.kind === "forta" || exercise.kind === "cardio")
    && Array.isArray(exercise.places)
    && exercise.places.length > 0
    && exercise.places.every((place) => place === "acasa" || place === "sala")
    && isNonEmptyString(exercise.recommendedTarget)
    && isNonEmptyString(exercise.guidance1)
    && isNonEmptyString(exercise.guidance2)
    && Array.isArray(exercise.aliases)
    && exercise.aliases.every(isNonEmptyString)
    && Array.isArray(exercise.memberships)
    && exercise.memberships.length > 0
    && exercise.memberships.every((membership) =>
      membership
      && isNonEmptyString(membership.collectionKey)
      && Number.isInteger(membership.orderIndex)
      && membership.orderIndex > 0)
    && ["available", "missing", "not-required"].includes(exercise.videoState),
  );
}

export function validateActiveCatalogPayload(value) {
  const issues = [];
  if (!value || typeof value !== "object") {
    return { valid: false, issues: ["Răspunsul catalogului nu este un obiect."] };
  }
  if (value.source !== "live") issues.push("Catalogul nu provine din sursa live.");
  if (value.contractVersion !== ACTIVE_CATALOG_CONTRACT_VERSION) {
    issues.push("Versiunea catalogului nu corespunde regulilor V2.");
  }
  if (!Array.isArray(value.exercises)) issues.push("Lista exercițiilor lipsește.");
  else {
    if (value.exercises.length !== EXPECTED_ACTIVE_EXERCISES) {
      issues.push(`Catalogul trebuie să conțină exact ${EXPECTED_ACTIVE_EXERCISES} exerciții active.`);
    }
    if (!value.exercises.every(validExercise)) issues.push("Catalogul conține un exercițiu incomplet sau invalid.");
    const keys = value.exercises.map((exercise) => exercise?.id).filter(Boolean);
    if (new Set(keys).size !== keys.length) issues.push("Catalogul conține chei duplicate.");
  }
  if (!value.metrics || value.metrics.activeExercises !== EXPECTED_ACTIVE_EXERCISES) {
    issues.push("Metrica exercițiilor active nu este 114.");
  }
  if (!Array.isArray(value.collections) || value.collections.length === 0) {
    issues.push("Colecțiile publice lipsesc.");
  }
  return issues.length
    ? { valid: false, issues }
    : { valid: true, issues: [], payload: value };
}

export function requireActiveCatalogPayload(value) {
  const validation = validateActiveCatalogPayload(value);
  if (!validation.valid) throw new Error(validation.issues.join(" "));
  return validation.payload;
}

export function selectPlayableExerciseKeys(value) {
  const payload = requireActiveCatalogPayload(value);
  return new Set(payload.exercises.flatMap((exercise) => exercise.videoState === "available" ? [exercise.id] : []));
}

function retryEndpoint(endpoint, attempt) {
  if (attempt === 1) return endpoint;
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}catalog_contract=${encodeURIComponent(ACTIVE_CATALOG_CONTRACT_VERSION)}&catalog_attempt=${attempt}`;
}

export async function fetchActiveCatalog(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const endpoint = options.endpoint ?? ACTIVE_CATALOG_ENDPOINT;
  const maxAttempts = options.maxAttempts ?? 2;
  if (typeof fetchImpl !== "function") throw new Error("Fetch nu este disponibil pentru catalog.");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) {
    throw new Error("Catalogul permite numai una sau două încercări controlate.");
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(retryEndpoint(endpoint, attempt), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-VEMI-Catalog-Contract": ACTIVE_CATALOG_CONTRACT_VERSION,
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
      });
      if (!response.ok) throw new Error(`Catalogul a răspuns cu status ${response.status}.`);
      return requireActiveCatalogPayload(await response.json());
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Catalogul activ nu poate fi încărcat.");
}

export async function loadCatalogWithControlledRetry(loadCatalog, options = {}) {
  const maxAttempts = options.maxAttempts ?? 2;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) {
    throw new Error("Catalogul permite numai una sau două încercări controlate.");
  }
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return requireActiveCatalogPayload(await loadCatalog());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Catalogul activ nu poate fi încărcat.");
}

export function createCatalogRequestGate() {
  let epoch = 0;
  return {
    begin() {
      epoch += 1;
      return epoch;
    },
    isCurrent(token) {
      return token === epoch;
    },
    invalidate() {
      epoch += 1;
    },
  };
}
