import exerciseRulesPayload from "../../data/plan-engine/v2/exercise-rules.json" with { type: "json" };
import { AMV2_CATEGORY_ORDER } from "./category-presentation.mjs";
import { CANONICAL_EXERCISE_METRIC_ROWS } from "./exercise-metric-map.mjs";

const LOCATION_MAP = Object.freeze({
  acasa: "home",
  sala: "gym",
});

export class CanonicalExerciseCatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CanonicalExerciseCatalogError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new CanonicalExerciseCatalogError(code, message);
};

const isText = (value) => typeof value === "string" && value.trim().length > 0;

function validateCatalog(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("INVALID_CANONICAL_CATALOG", "Catalogul canonic trebuie să fie un obiect valid.");
  }
  if (payload.exercise_count !== 114 || !Array.isArray(payload.rules) || payload.rules.length !== 114) {
    fail("INVALID_CANONICAL_CATALOG", "Catalogul canonic trebuie să conțină exact 114 exerciții.");
  }

  const mappingKeys = new Set(CANONICAL_EXERCISE_METRIC_ROWS.map((row) => row.exercise_key));
  const catalogKeys = new Set();

  payload.rules.forEach((rule, index) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      fail("INVALID_CANONICAL_CATALOG", `Exercițiul canonic ${index + 1} este invalid.`);
    }
    if (!isText(rule.exercise_key)
      || !isText(rule.canonical_name)
      || !isText(rule.canonical_group)) {
      fail("INVALID_CANONICAL_CATALOG", `Exercițiul canonic ${index + 1} nu are identitatea completă.`);
    }
    if (catalogKeys.has(rule.exercise_key)) {
      fail("INVALID_CANONICAL_CATALOG", `exercise_key duplicat în catalog: ${rule.exercise_key}.`);
    }
    catalogKeys.add(rule.exercise_key);
    if (!mappingKeys.has(rule.exercise_key)) {
      fail("INVALID_CANONICAL_CATALOG", `exercise_key lipsește din Gate 0C: ${rule.exercise_key}.`);
    }
    if (!Array.isArray(rule.places)
      || rule.places.length === 0
      || rule.places.some((place) => !Object.hasOwn(LOCATION_MAP, place))) {
      fail("INVALID_CANONICAL_CATALOG", `Locațiile sunt invalide pentru ${rule.exercise_key}.`);
    }
  });

  if (catalogKeys.size !== mappingKeys.size
    || [...mappingKeys].some((exerciseKey) => !catalogKeys.has(exerciseKey))) {
    fail("INVALID_CANONICAL_CATALOG", "Catalogul și mappingul Gate 0C nu au același univers canonic.");
  }
}

validateCatalog(exerciseRulesPayload);

export const CANONICAL_EXERCISE_CATALOG = Object.freeze(
  exerciseRulesPayload.rules.map((rule) => Object.freeze({
    exerciseKey: rule.exercise_key,
    displayName: rule.canonical_name,
    category: rule.canonical_group,
    locations: Object.freeze(rule.places.map((place) => LOCATION_MAP[place])),
    collections: Object.freeze([
      rule.canonical_group,
      ...(rule.places.includes("acasa") ? ["Acasă"] : []),
    ]),
  })),
);

export const CANONICAL_EXERCISE_CATEGORIES = AMV2_CATEGORY_ORDER;

const exerciseByKey = new Map(
  CANONICAL_EXERCISE_CATALOG.map((exercise) => [exercise.exerciseKey, exercise]),
);

export function resolveCanonicalExerciseCatalogItem(exerciseKey) {
  if (!isText(exerciseKey)) {
    fail("UNKNOWN_EXERCISE_KEY", "exercise_key trebuie să fie un identificator canonic valid.");
  }
  const exercise = exerciseByKey.get(exerciseKey);
  if (!exercise) {
    fail("UNKNOWN_EXERCISE_KEY", `exercise_key necunoscut în catalog: ${exerciseKey}.`);
  }
  return exercise;
}

const normalizeSearch = (value) => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("ro-RO")
  .trim();

export function filterCanonicalExerciseCatalog({ query = "", category = null, location = null } = {}) {
  if (category !== null && !CANONICAL_EXERCISE_CATEGORIES.includes(category)) {
    fail("INVALID_CATALOG_FILTER", `Categoria canonică este necunoscută: ${String(category)}.`);
  }
  if (location !== null && location !== "home" && location !== "gym") {
    fail("INVALID_CATALOG_FILTER", `Locația catalogului este invalidă: ${String(location)}.`);
  }
  if (typeof query !== "string") {
    fail("INVALID_CATALOG_FILTER", "Căutarea din catalog trebuie să fie text.");
  }

  const normalizedQuery = normalizeSearch(query);
  return CANONICAL_EXERCISE_CATALOG.filter((exercise) => {
    if (category !== null && !exercise.collections.includes(category)) return false;
    if (location !== null && !exercise.locations.includes(location)) return false;
    if (normalizedQuery.length === 0) return true;
    return normalizeSearch(`${exercise.displayName} ${exercise.collections.join(" ")}`).includes(normalizedQuery);
  });
}
