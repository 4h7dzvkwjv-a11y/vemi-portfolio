import mappingPayload from "../../data/amv2/gate-0c/exercise-metric-map.v1.4.json" with { type: "json" };

export const AMV2_CANONICAL_METRIC_TYPES = Object.freeze([
  "repetitions_weight",
  "repetitions_only",
  "time_per_set",
  "total_duration",
]);

const ROW_FIELDS = Object.freeze([
  "exercise_key",
  "metric_type",
  "default_source",
  "default_sets",
  "default_repetitions",
  "default_weight_kg",
  "default_time_per_set_seconds",
  "default_total_duration_seconds",
]);

const EXPECTED_DISTRIBUTION = Object.freeze({
  repetitions_weight: 75,
  repetitions_only: 29,
  time_per_set: 7,
  total_duration: 3,
});

export class CanonicalExerciseMetricMapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CanonicalExerciseMetricMapError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new CanonicalExerciseMetricMapError(code, message);
};

const hasExactFields = (row) => {
  const fields = Object.keys(row);
  return fields.length === ROW_FIELDS.length
    && fields.every((field, index) => field === ROW_FIELDS[index]);
};

const hasExactDefaults = (row) => {
  if (row.default_source !== "GENERIC_FALLBACK") return false;

  if (row.metric_type === "repetitions_weight") {
    return row.default_sets === 3
      && row.default_repetitions === 0
      && row.default_weight_kg === 0
      && row.default_time_per_set_seconds === null
      && row.default_total_duration_seconds === null;
  }
  if (row.metric_type === "repetitions_only") {
    return row.default_sets === 3
      && row.default_repetitions === 0
      && row.default_weight_kg === null
      && row.default_time_per_set_seconds === null
      && row.default_total_duration_seconds === null;
  }
  if (row.metric_type === "time_per_set") {
    return row.default_sets === 3
      && row.default_repetitions === null
      && row.default_weight_kg === null
      && row.default_time_per_set_seconds === 0
      && row.default_total_duration_seconds === null;
  }
  if (row.metric_type === "total_duration") {
    return row.default_sets === null
      && row.default_repetitions === null
      && row.default_weight_kg === null
      && row.default_time_per_set_seconds === null
      && row.default_total_duration_seconds === 0;
  }
  return false;
};

function validateMapping(rows) {
  if (!Array.isArray(rows) || rows.length !== 114) {
    fail("INVALID_CANONICAL_MAPPING", "Mappingul Gate 0C trebuie să conțină exact 114 rânduri.");
  }

  const keys = new Set();
  const distribution = Object.fromEntries(AMV2_CANONICAL_METRIC_TYPES.map((metric) => [metric, 0]));
  let previousKey = null;

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || !hasExactFields(row)) {
      fail("INVALID_CANONICAL_MAPPING", `Rândul Gate 0C ${index + 1} nu respectă schema canonică.`);
    }
    if (typeof row.exercise_key !== "string" || row.exercise_key.length === 0) {
      fail("INVALID_CANONICAL_MAPPING", `Rândul Gate 0C ${index + 1} nu are exercise_key valid.`);
    }
    if (previousKey !== null && previousKey >= row.exercise_key) {
      fail("INVALID_CANONICAL_MAPPING", "Mappingul Gate 0C nu este sortat ordinal după exercise_key.");
    }
    previousKey = row.exercise_key;
    if (keys.has(row.exercise_key)) {
      fail("INVALID_CANONICAL_MAPPING", `Cheia ${row.exercise_key} este duplicată în Gate 0C.`);
    }
    keys.add(row.exercise_key);
    if (!Object.hasOwn(distribution, row.metric_type) || !hasExactDefaults(row)) {
      fail("INVALID_CANONICAL_MAPPING", `Rândul ${row.exercise_key} nu respectă metrica/defaulturile Final V1.4.`);
    }
    distribution[row.metric_type] += 1;
  });

  for (const metric of AMV2_CANONICAL_METRIC_TYPES) {
    if (distribution[metric] !== EXPECTED_DISTRIBUTION[metric]) {
      fail("INVALID_CANONICAL_MAPPING", `Distribuția Gate 0C este invalidă pentru ${metric}.`);
    }
  }
}

validateMapping(mappingPayload);

export const CANONICAL_EXERCISE_METRIC_ROWS = Object.freeze(
  mappingPayload.map((row) => Object.freeze({ ...row })),
);

const rowByExerciseKey = new Map(
  CANONICAL_EXERCISE_METRIC_ROWS.map((row) => [row.exercise_key, row]),
);

export function resolveCanonicalExerciseMetric(exerciseKey) {
  if (typeof exerciseKey !== "string" || exerciseKey.length === 0) {
    fail("UNKNOWN_EXERCISE_KEY", "exercise_key trebuie să fie un identificator canonic valid.");
  }
  const row = rowByExerciseKey.get(exerciseKey);
  if (!row) {
    fail("UNKNOWN_EXERCISE_KEY", `exercise_key necunoscut în Gate 0C: ${exerciseKey}.`);
  }
  return row;
}
