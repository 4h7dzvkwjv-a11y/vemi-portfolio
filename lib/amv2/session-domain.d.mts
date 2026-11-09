import type {
  Amv2Location,
  RepetitionsOnlyExercise,
  RepetitionsWeightExercise,
  TimePerSetExercise,
  TotalDurationExercise,
  WorkoutDraft,
} from "./draft-domain.mjs";

export type WorkoutDefinitionSnapshot = {
  id: string;
  sourceDraftId: string;
  sourceDraftRevision: number;
  name: string;
  location: Amv2Location;
  exercises: WorkoutDraft["exercises"];
  savedAt: string;
};

type SessionExerciseBase = {
  id: string;
  orderIndex: number;
  reference: { source: "canonical"; exerciseKey: string };
  displayName: string;
  category: string;
};

export type SessionRepetitionsWeightExercise = SessionExerciseBase & {
  metricType: "repetitions_weight";
  sets: Array<RepetitionsWeightExercise["sets"][number] & {
    actualRepetitions: number;
    actualWeightKg: number;
  }>;
};

export type SessionRepetitionsOnlyExercise = SessionExerciseBase & {
  metricType: "repetitions_only";
  sets: Array<RepetitionsOnlyExercise["sets"][number] & { actualRepetitions: number }>;
};

export type SessionTimePerSetExercise = SessionExerciseBase & {
  metricType: "time_per_set";
  sets: Array<TimePerSetExercise["sets"][number] & { actualDurationSeconds: number }>;
};

export type SessionTotalDurationExercise = SessionExerciseBase & {
  metricType: "total_duration";
  targetTotalDurationSeconds: TotalDurationExercise["targetTotalDurationSeconds"];
  actualTotalDurationSeconds: number;
};

export type SessionExercise =
  | SessionRepetitionsWeightExercise
  | SessionRepetitionsOnlyExercise
  | SessionTimePerSetExercise
  | SessionTotalDurationExercise;

export type WorkoutSessionStatus = "in_progress" | "completed" | "abandoned";

export type WorkoutSession = {
  id: string;
  status: WorkoutSessionStatus;
  definitionId: string;
  definitionRevision: number;
  workoutName: string;
  location: Amv2Location;
  startedAt: string;
  lastUpdatedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  exercises: SessionExercise[];
};

export type SessionAction =
  | {
      type: "update_set_actuals";
      exerciseId: string;
      setId: string;
      actualRepetitions?: number;
      actualWeightKg?: number;
      actualDurationSeconds?: number;
      updatedAt: string;
    }
  | {
      type: "update_total_duration_actual";
      exerciseId: string;
      actualTotalDurationSeconds: number;
      updatedAt: string;
    };

export const AMV2_SESSION_STATUSES: readonly WorkoutSessionStatus[];
export function createWorkoutDefinitionSnapshot(draft: WorkoutDraft, savedAt: string): WorkoutDefinitionSnapshot;
export function validateWorkoutDefinition(value: unknown): { valid: boolean; issues: string[] };
export function createWorkoutSession(input: {
  id: string;
  definition: WorkoutDefinitionSnapshot;
  startedAt: string;
}): WorkoutSession;
export function validateWorkoutSession(value: unknown): { valid: boolean; issues: string[] };
export function reduceWorkoutSession(session: WorkoutSession, action: SessionAction): WorkoutSession;
export function sessionHasExecutedWork(session: WorkoutSession): boolean;
export function completeWorkoutSession(session: WorkoutSession, completedAt: string): WorkoutSession;
export function abandonWorkoutSession(session: WorkoutSession, abandonedAt: string): WorkoutSession;
export function getSessionElapsedSeconds(session: WorkoutSession): number;
