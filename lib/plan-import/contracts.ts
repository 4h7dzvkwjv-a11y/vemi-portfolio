import type {
  ExerciseRegistryEntry,
  PlanConfiguration,
  ProfileConfigurationKey,
  ValidationIssue,
} from "../plan-engine/contracts";

export type PlanBatchEnvelope = {
  batch_version?: 1;
  source?: {
    kind: "normalized_json" | "admin_tool" | "word_adapter" | "other";
    reference?: string;
  };
  expected_configuration_keys?: ProfileConfigurationKey[];
  configurations: PlanConfiguration[];
};

export type BatchIssueCategory =
  | "json"
  | "structural"
  | "profile"
  | "configuration_key"
  | "duplicate"
  | "ambiguous"
  | "exercise_reference"
  | "inactive_exercise"
  | "retired_exercise"
  | "coverage";

export type BatchValidationIssue = ValidationIssue & {
  severity: "blocking";
  category: BatchIssueCategory;
  configuration_index: number | null;
  configuration_key: string | null;
  week_number?: number | null;
  day_number?: number | null;
  exercise_order?: number | null;
  value?: unknown;
};

export type BatchValidationReport = {
  mode: "dry-run";
  status: "valid" | "rejected";
  generated_at: string;
  summary: {
    total_configurations: number;
    valid_configurations: number;
    invalid_configurations: number;
    missing_configurations: number;
    duplicate_keys: number;
    unknown_exercise_keys: number;
    inactive_exercises: number;
    retired_exercises: number;
    structural_errors: number;
    ambiguous_configurations: number;
    extra_configurations: number;
  };
  coverage: {
    expected_count: number;
    present_count: number;
    missing_keys: string[];
    extra_keys: string[];
  };
  publication: {
    attempted: false;
    published_configurations: 0;
    active_data_changed: false;
  };
  configurations: Array<{
    index: number;
    configuration_key: string | null;
    status: "valid" | "invalid";
    issue_count: number;
  }>;
  issues: BatchValidationIssue[];
};

export type BatchValidationOptions = {
  schema: Record<string, unknown>;
  exerciseRegistry: ExerciseRegistryEntry[];
  expectedConfigurationKeys?: string[];
  now?: () => Date;
};

/**
 * Contractul viitorului adaptor de sursă. Un parser Word va produce numai
 * date normalizate; nu va valida, publica sau activa planuri.
 */
export interface PlanSourceAdapter<TSource> {
  readonly sourceKind: PlanBatchEnvelope["source"] extends infer T
    ? T extends { kind: infer K } ? K : never
    : never;
  normalize(source: TSource): Promise<PlanBatchEnvelope>;
}
