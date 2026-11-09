export type Gender = "male" | "female";
export type AgeGroup = "18_29" | "30_44" | "45_59" | "60_plus";
export type TrainingGoal = "weight_loss" | "muscle_gain" | "general_fitness";
export type TrainingLocation = "home" | "gym";
export type TrainingLevel = "beginner" | "intermediate" | "advanced";

export type PlanProfile = {
  gender: Gender;
  age_group: AgeGroup;
  goal: TrainingGoal;
  location: TrainingLocation;
  level: TrainingLevel;
  days_per_week: number;
};

export type ProfileConfigurationKey =
  `plan:v1:${Gender}:${AgeGroup}:${TrainingGoal}:${TrainingLocation}:${TrainingLevel}:${number}`;

export type ExerciseRegistryEntry = {
  exercise_key: string;
  display_name: string;
  status: "active" | "inactive" | "retired";
  available_locations: TrainingLocation[];
  video_reference?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ExerciseTarget = {
  kind: "repetitions" | "duration_seconds";
  min: number;
  max: number;
};

export type PlanExercise = {
  order: number;
  exercise_key: string;
  sets: number;
  target: ExerciseTarget;
  rest_seconds: number;
  instructions?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PlanDay = {
  day_number: number;
  display_label: string;
  title: string;
  focus?: string;
  estimated_minutes?: number;
  instructions?: string;
  exercises: PlanExercise[];
};

export type PlanWeek = {
  week_number: number;
  display_label: string;
  progression: { summary: string; load_guidance?: string };
  days: PlanDay[];
};

export type PlanConfiguration = {
  schema_version: 1;
  configuration_key: ProfileConfigurationKey;
  profile: PlanProfile;
  number_of_weeks: number;
  metadata: {
    title: string;
    summary: string;
    language: string;
    content_status: "mock" | "draft" | "published";
    source_reference?: string;
    import_batch?: string;
  };
  weeks: PlanWeek[];
};

export type ValidationIssue = { code: string; path: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

export type PlanResolution =
  | { status: "found"; configuration_key: ProfileConfigurationKey; plan: PlanConfiguration }
  | { status: "not_found"; configuration_key: ProfileConfigurationKey; message: string }
  | { status: "invalid_profile"; configuration_key: null; message: string; issues: ValidationIssue[] }
  | {
      status: "invalid_configuration" | "ambiguous_configuration";
      configuration_key: ProfileConfigurationKey;
      message: string;
      issues: ValidationIssue[];
    };
