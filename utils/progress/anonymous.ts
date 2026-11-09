import type {
  CloudProgress,
  CloudSelections,
  CloudWorkout,
  CloudWorkoutLog,
} from "./client";
import {
  normalizeFreePlanContentVersion,
  normalizePlanInstanceId,
} from "./free-plan-state.mjs";

export type AnonymousProgressSnapshot = {
  version: 2;
  importId: string;
  capturedAt: string;
  selections?: CloudSelections;
  activeWeek: number;
  completed: string[];
  workouts: CloudWorkout[];
  logs: CloudWorkoutLog[];
};

type AnonymousImportStatus = {
  version: 2;
  importId: string;
  status: "pending" | "imported";
  importedAt?: string;
  importedByUserId?: string;
};

const LOCAL_SCHEMA_VERSION_KEY = "vemi-local-progress-schema-version";
const ANONYMOUS_PROGRESS_KEY = "vemi-anonymous-progress-v2";
const ANONYMOUS_IMPORT_STATUS_KEY = "vemi-anonymous-import-status-v2";
const LEGACY_BACKUP_KEY = "vemi-local-progress-legacy-backup-v2";
const LEGACY_QUEUE_KEY = "vemi-progress-sync-queue-v1";
const DISMISS_PREFIX = "vemi-anonymous-import-dismissed:";

const legacyKeys = [
  "vemi-selections",
  "vemi-progress",
  "vemi-custom-workouts",
  "vemi-workout-logs",
] as const;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function stableImportId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `anonymous-${crypto.randomUUID()}`;
  }
  return `anonymous-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeSelections(value: unknown): CloudSelections | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const place = input.place === "acasa" || input.place === "sala" ? input.place : undefined;
  const engineVersion = input.engineVersion === "v2" ? "v2"
    : input.engineVersion === "v1" || place ? "v1" : undefined;
  return {
    gender: typeof input.gender === "string" ? input.gender.slice(0, 40) : undefined,
    age: typeof input.age === "string" ? input.age.slice(0, 40) : undefined,
    goal: typeof input.goal === "string" ? input.goal.slice(0, 40) : undefined,
    program: typeof input.program === "string" ? input.program.slice(0, 60) : undefined,
    place,
    engineVersion,
    planInstanceId: normalizePlanInstanceId(input.planInstanceId),
    contentVersion: normalizeFreePlanContentVersion(input.contentVersion),
  };
}

function normalizeWorkouts(value: unknown): CloudWorkout[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CloudWorkout => {
    if (!item || typeof item !== "object") return false;
    const workout = item as Partial<CloudWorkout>;
    return typeof workout.id === "string"
      && typeof workout.name === "string"
      && (workout.place === "acasa" || workout.place === "sala")
      && Array.isArray(workout.exercises);
  }).slice(0, 100);
}

function normalizeLogs(value: unknown): CloudWorkoutLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CloudWorkoutLog => {
    if (!item || typeof item !== "object") return false;
    const log = item as Partial<CloudWorkoutLog>;
    return typeof log.id === "string"
      && typeof log.workoutName === "string"
      && typeof log.completedAt === "string"
      && !Number.isNaN(new Date(log.completedAt).getTime());
  }).slice(0, 250);
}

export function normalizeAnonymousProgress(input: Partial<AnonymousProgressSnapshot>): AnonymousProgressSnapshot {
  const selections = normalizeSelections(input.selections);
  const completed = Array.isArray(input.completed)
    ? Array.from(new Set(input.completed.filter((key): key is string =>
      typeof key === "string" && /^w[1-4]-(acasa|sala)-Ziua [1-5]$/.test(key),
    )))
    : [];
  return {
    version: 2,
    importId: typeof input.importId === "string" && /^anonymous-[a-zA-Z0-9-]+$/.test(input.importId)
      ? input.importId
      : stableImportId(),
    capturedAt: typeof input.capturedAt === "string" ? input.capturedAt : new Date().toISOString(),
    selections,
    activeWeek: Math.max(1, Math.min(4, Number(input.activeWeek) || 1)),
    completed,
    workouts: normalizeWorkouts(input.workouts),
    logs: normalizeLogs(input.logs),
  };
}

export function hasAnonymousProgress(snapshot: AnonymousProgressSnapshot | null) {
  return Boolean(snapshot && (
    snapshot.selections?.place
    || snapshot.completed.length
    || snapshot.workouts.length
    || snapshot.logs.length
  ));
}

function legacySnapshot(): AnonymousProgressSnapshot {
  const base = normalizeAnonymousProgress({
    importId: stableImportId(),
    capturedAt: new Date().toISOString(),
    selections: readJson<CloudSelections | undefined>("vemi-selections", undefined),
    activeWeek: 1,
    completed: readJson<string[]>("vemi-progress", []),
    workouts: readJson<CloudWorkout[]>("vemi-custom-workouts", []),
    logs: readJson<CloudWorkoutLog[]>("vemi-workout-logs", []),
  });
  const legacyQueue = readJson<Array<{ action?: string; payload?: Record<string, unknown> }>>(LEGACY_QUEUE_KEY, []);
  for (const mutation of legacyQueue) {
    const payload = mutation?.payload ?? {};
    if (mutation.action === "save_free_plan" || mutation.action === "save_free_workout") {
      base.selections = normalizeSelections(payload.selections) ?? base.selections;
      base.activeWeek = Math.max(base.activeWeek, Math.min(4, Number(payload.activeWeek) || 1));
      if (Array.isArray(payload.completed)) {
        base.completed = Array.from(new Set([...base.completed, ...payload.completed.filter((key): key is string => typeof key === "string")]));
      }
    } else if (mutation.action === "save_custom_workout" || mutation.action === "finish_custom_workout") {
      const workout = normalizeWorkouts([payload.workout])[0];
      if (workout && !base.workouts.some((item) => item.id === workout.id)) base.workouts.push(workout);
      if (mutation.action === "finish_custom_workout" && workout) {
        const completedAt = typeof payload.completedAt === "string" && !Number.isNaN(new Date(payload.completedAt).getTime())
          ? payload.completedAt
          : base.capturedAt;
        const completedUids = Array.isArray(payload.completedUids) ? payload.completedUids : [];
        const exercises = workout.exercises.filter((exercise) => completedUids.includes(exercise.uid));
        const id = typeof payload.mutationId === "string" ? payload.mutationId : `legacy-${workout.id}-${completedAt}`;
        if (!base.logs.some((item) => item.id === id)) base.logs.push({
          id,
          workoutId: workout.id,
          workoutName: workout.name,
          place: workout.place,
          completedAt,
          exerciseCount: exercises.length,
          cardioMinutes: exercises.filter((exercise) => exercise.kind === "cardio")
            .reduce((total, exercise) => total + exercise.minutes, 0),
          exercises: exercises.map((exercise) => ({
            name: exercise.name,
            group: exercise.group,
            details: exercise.kind === "cardio"
              ? `${exercise.minutes} min`
              : `${exercise.sets} × ${exercise.reps}${exercise.weight ? ` · ${exercise.weight} kg` : ""}`,
          })),
        });
      }
    } else if (mutation.action === "delete_custom_workout") {
      base.workouts = base.workouts.filter((workout) => workout.id !== payload.clientKey);
    } else if (mutation.action === "import_workout_logs") {
      for (const workout of normalizeWorkouts(payload.workouts)) {
        if (!base.workouts.some((item) => item.id === workout.id)) base.workouts.push(workout);
      }
      for (const log of normalizeLogs(payload.logs)) {
        if (!base.logs.some((item) => item.id === log.id)) base.logs.push(log);
      }
    }
  }
  return normalizeAnonymousProgress(base);
}

export function ensureLocalProgressMigration() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(LOCAL_SCHEMA_VERSION_KEY) === "2") return;

  if (!localStorage.getItem(LEGACY_BACKUP_KEY)) {
    const legacyValues = Object.fromEntries(legacyKeys.map((key) => [key, localStorage.getItem(key)]));
    localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify({
      version: 2,
      backedUpAt: new Date().toISOString(),
      legacyValues,
      legacyPendingQueue: localStorage.getItem(LEGACY_QUEUE_KEY),
    }));
  }

  if (!localStorage.getItem(ANONYMOUS_PROGRESS_KEY)) {
    const snapshot = legacySnapshot();
    if (hasAnonymousProgress(snapshot)) {
      localStorage.setItem(ANONYMOUS_PROGRESS_KEY, JSON.stringify(snapshot));
      localStorage.setItem(ANONYMOUS_IMPORT_STATUS_KEY, JSON.stringify({
        version: 2,
        importId: snapshot.importId,
        status: "pending",
      } satisfies AnonymousImportStatus));
    }
  }

  // Versiunea veche nu conținea identitatea proprietarului. O arhivăm și o
  // tratăm conservator drept progres anonim, nu drept coadă autentificată.
  localStorage.removeItem(LEGACY_QUEUE_KEY);
  localStorage.setItem(LOCAL_SCHEMA_VERSION_KEY, "2");
}

export function readAnonymousProgress() {
  ensureLocalProgressMigration();
  const snapshot = readJson<AnonymousProgressSnapshot | null>(ANONYMOUS_PROGRESS_KEY, null);
  return snapshot ? normalizeAnonymousProgress(snapshot) : null;
}

export function readPendingAnonymousProgress() {
  const snapshot = readAnonymousProgress();
  if (!hasAnonymousProgress(snapshot)) return null;
  const status = readJson<AnonymousImportStatus | null>(ANONYMOUS_IMPORT_STATUS_KEY, null);
  if (status?.importId === snapshot!.importId && status.status === "imported") return null;
  return snapshot;
}

export function saveAnonymousProgress(input: {
  selections?: CloudSelections;
  activeWeek: number;
  completed: string[];
  workouts: CloudWorkout[];
  logs: CloudWorkoutLog[];
}) {
  ensureLocalProgressMigration();
  const current = readJson<AnonymousProgressSnapshot | null>(ANONYMOUS_PROGRESS_KEY, null);
  const status = readJson<AnonymousImportStatus | null>(ANONYMOUS_IMPORT_STATUS_KEY, null);
  const needsNewImport = !current || (status?.importId === current.importId && status.status === "imported");
  const snapshot = normalizeAnonymousProgress({
    ...input,
    importId: needsNewImport ? stableImportId() : current.importId,
    capturedAt: new Date().toISOString(),
  });

  localStorage.setItem("vemi-selections", JSON.stringify(snapshot.selections ?? {}));
  localStorage.setItem("vemi-progress", JSON.stringify(snapshot.completed));
  localStorage.setItem("vemi-custom-workouts", JSON.stringify(snapshot.workouts));
  localStorage.setItem("vemi-workout-logs", JSON.stringify(snapshot.logs));

  if (hasAnonymousProgress(snapshot)) {
    localStorage.setItem(ANONYMOUS_PROGRESS_KEY, JSON.stringify(snapshot));
    localStorage.setItem(ANONYMOUS_IMPORT_STATUS_KEY, JSON.stringify({
      version: 2,
      importId: snapshot.importId,
      status: "pending",
    } satisfies AnonymousImportStatus));
  } else {
    localStorage.removeItem(ANONYMOUS_PROGRESS_KEY);
    localStorage.removeItem(ANONYMOUS_IMPORT_STATUS_KEY);
  }
  return snapshot;
}

export function markAnonymousProgressImported(importId: string, userId: string) {
  const snapshot = readAnonymousProgress();
  if (!snapshot || snapshot.importId !== importId) return false;
  localStorage.setItem(ANONYMOUS_IMPORT_STATUS_KEY, JSON.stringify({
    version: 2,
    importId,
    status: "imported",
    importedAt: new Date().toISOString(),
    importedByUserId: userId,
  } satisfies AnonymousImportStatus));
  return true;
}

export function dismissAnonymousImportForSession(importId: string) {
  sessionStorage.setItem(`${DISMISS_PREFIX}${importId}`, "1");
}

export function isAnonymousImportDismissed(importId: string) {
  return typeof window !== "undefined" && sessionStorage.getItem(`${DISMISS_PREFIX}${importId}`) === "1";
}

export function cloudProgressConfirmsImport(snapshot: AnonymousProgressSnapshot, cloud: CloudProgress) {
  if (!cloud.authenticated) return false;
  if (snapshot.selections?.place && !cloud.selections?.place) return false;
  const cloudOrdinals = new Set(cloud.completed.map((key) => key.match(/^w([1-4])-(?:acasa|sala)-(Ziua [1-5])$/)?.slice(1).join(":")));
  const anonymousOrdinals = new Set(snapshot.completed.map((key) => key.match(/^w([1-4])-(?:acasa|sala)-(Ziua [1-5])$/)?.slice(1).join(":")));
  if ([...anonymousOrdinals].some((key) => !key || !cloudOrdinals.has(key))) return false;
  if (snapshot.workouts.some((workout) => !cloud.workouts.some((item) => item.id === workout.id))) return false;
  if (snapshot.logs.some((log) => !cloud.logs.some((item) =>
    item.workoutName === log.workoutName && new Date(item.completedAt).toISOString() === new Date(log.completedAt).toISOString(),
  ))) return false;
  return true;
}
