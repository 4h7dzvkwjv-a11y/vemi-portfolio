export type Amv2CanonicalMetricType =
  | "repetitions_weight"
  | "repetitions_only"
  | "time_per_set"
  | "total_duration";

export type CanonicalExerciseMetricRow = Readonly<{
  exercise_key: string;
  metric_type: Amv2CanonicalMetricType;
  default_source: "GENERIC_FALLBACK";
  default_sets: 3 | null;
  default_repetitions: 0 | null;
  default_weight_kg: 0 | null;
  default_time_per_set_seconds: 0 | null;
  default_total_duration_seconds: 0 | null;
}>;

export const AMV2_CANONICAL_METRIC_TYPES: readonly Amv2CanonicalMetricType[];
export const CANONICAL_EXERCISE_METRIC_ROWS: readonly CanonicalExerciseMetricRow[];

export class CanonicalExerciseMetricMapError extends Error {
  code: string;
}

export function resolveCanonicalExerciseMetric(exerciseKey: string): CanonicalExerciseMetricRow;
