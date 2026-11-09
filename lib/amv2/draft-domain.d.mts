import type { Amv2CanonicalMetricType } from "./exercise-metric-map.mjs";

export type Amv2SliceMetricType = Amv2CanonicalMetricType;
export type Amv2Location = "home" | "gym";

export type CanonicalExerciseReference = {
  source: "canonical";
  exerciseKey: string;
};

export type PersonalExerciseReference = {
  source: "personal";
  personalExerciseId: string;
  templateExerciseKey: string;
};

export type WorkoutExerciseReference = CanonicalExerciseReference | PersonalExerciseReference;

export type RepetitionsWeightSet = {
  id: string;
  orderIndex: number;
  targetRepetitions: number;
  targetWeightKg: number;
};

export type RepetitionsOnlySet = {
  id: string;
  orderIndex: number;
  targetRepetitions: number;
};

export type TimePerSet = {
  id: string;
  orderIndex: number;
  targetDurationSeconds: number;
};

export type WorkoutSet = RepetitionsWeightSet | RepetitionsOnlySet | TimePerSet;

type WorkoutExerciseBase = {
  id: string;
  orderIndex: number;
  reference: WorkoutExerciseReference;
  displayName: string;
  category: string;
};

export type RepetitionsWeightExercise = WorkoutExerciseBase & {
  metricType: "repetitions_weight";
  sets: RepetitionsWeightSet[];
};

export type RepetitionsOnlyExercise = WorkoutExerciseBase & {
  metricType: "repetitions_only";
  sets: RepetitionsOnlySet[];
};

export type TimePerSetExercise = WorkoutExerciseBase & {
  metricType: "time_per_set";
  sets: TimePerSet[];
};

export type TotalDurationExercise = WorkoutExerciseBase & {
  metricType: "total_duration";
  targetTotalDurationSeconds: number;
};

export type WorkoutExercise =
  | RepetitionsWeightExercise
  | RepetitionsOnlyExercise
  | TimePerSetExercise
  | TotalDurationExercise;

export type WorkoutDraft = {
  id: string;
  name: string;
  location: Amv2Location;
  exercises: WorkoutExercise[];
  revision: number;
  updatedAt: string;
};

export type DraftAction =
  | { type: "rename"; name: string; updatedAt: string }
  | { type: "set_location"; location: Amv2Location; updatedAt: string }
  | {
      type: "add_exercises";
      selections: ReadonlyArray<{ exerciseKey: string; exerciseId: string }>;
      updatedAt: string;
    }
  | { type: "add_set"; exerciseId: string; setId: string; updatedAt: string }
  | { type: "remove_set"; exerciseId: string; setId: string; updatedAt: string }
  | { type: "move_set"; exerciseId: string; setId: string; toIndex: number; updatedAt: string }
  | {
      type: "update_set_targets";
      exerciseId: string;
      setId: string;
      targetRepetitions?: number;
      targetWeightKg?: number;
      targetDurationSeconds?: number;
      updatedAt: string;
    }
  | {
      type: "update_total_duration_target";
      exerciseId: string;
      targetTotalDurationSeconds: number;
      updatedAt: string;
    };

export type ExecutedWorkActuals =
  | {
      metricType: "repetitions_weight";
      sets: ReadonlyArray<{ actualRepetitions: number; actualWeightKg: number }>;
    }
  | {
      metricType: "repetitions_only";
      sets: ReadonlyArray<{ actualRepetitions: number }>;
    }
  | {
      metricType: "time_per_set";
      sets: ReadonlyArray<{ actualDurationSeconds: number }>;
    }
  | {
      metricType: "total_duration";
      actualTotalDurationSeconds: number;
    };

export const AMV2_SLICE_METRIC_TYPES: readonly Amv2SliceMetricType[];
export const AMV2_LIMITS: Readonly<{
  exercisesPerWorkout: Readonly<{ min: 1; max: 20 }>;
  setsPerExercise: Readonly<{ min: 1; max: 20 }>;
  repetitions: Readonly<{ min: 0; max: 100 }>;
  weightKg: Readonly<{ min: 0; max: 500 }>;
  timePerSetSeconds: Readonly<{ min: 0; max: 3600 }>;
  totalDurationSeconds: Readonly<{ min: 0; max: 18000 }>;
  semanticSetRows: 400;
  semanticPayloadBytes: number;
}>;

export class Amv2DomainError extends Error {
  code: string;
}

export function createDefaultSet(
  exerciseKey: string,
  input: { id: string; orderIndex: number },
): WorkoutSet;

export function createWorkoutExercise(input: {
  id: string;
  orderIndex: number;
  exerciseKey: string;
  displayName: string;
  category: string;
  setIds?: readonly string[];
}): WorkoutExercise;

export function createPersonalWorkoutExercise(input: {
  id: string;
  orderIndex: number;
  personalExerciseId: string;
  templateExerciseKey: string;
  displayName: string;
  category: string;
  setIds?: readonly string[];
}): WorkoutExercise;

export function getWorkoutExerciseIdentity(exercise: unknown): string | null;
export function getWorkoutExerciseTemplateKey(exercise: unknown): string | null;

export function createWorkoutDraft(input: {
  id: string;
  name: string;
  location: Amv2Location;
  exercises: WorkoutExercise[];
  updatedAt: string;
}): WorkoutDraft;

export type AddExercisesCapacityState = Readonly<{
  existingCount: number;
  pendingCount: number;
  total: number;
  remaining: number;
  status: "normal" | "warning" | "full";
}>;

export function getAddExercisesCapacityState(
  existingCount: number,
  pendingCount: number,
): AddExercisesCapacityState;

export function togglePendingCanonicalExercise(input: {
  pendingExerciseKeys: readonly string[];
  existingExerciseKeys: readonly string[];
  exerciseKey: string;
}): string[];

export function validateWorkoutDraft(
  draft: unknown,
  options?: { requireName?: boolean },
): { valid: boolean; issues: string[] };

export function reduceWorkoutDraft(draft: WorkoutDraft, action: DraftAction): WorkoutDraft;

export function hasExecutedWork(actuals: ExecutedWorkActuals): boolean;
