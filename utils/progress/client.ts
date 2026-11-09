import { createClient as createSupabaseBrowserClient } from "../supabase/client";
import { normalizePlanInstanceId } from "./free-plan-state.mjs";

export type CloudSelections = {
  gender?: string;
  age?: string;
  goal?: string;
  program?: string;
  place?: "acasa" | "sala";
  engineVersion?: "v1" | "v2";
  planInstanceId?: string;
  contentVersion?: string;
};

export type CloudExercise = {
  id: string;
  uid: string;
  name: string;
  group: string;
  kind: "forta" | "cardio";
  places: Array<"acasa" | "sala">;
  sets: number;
  reps: number;
  weight: number;
  minutes: number;
};

export type CloudWorkout = {
  id: string;
  name: string;
  place: "acasa" | "sala";
  exercises: CloudExercise[];
  completions: number;
  lastCompleted?: string;
};

export type CloudWorkoutLog = {
  id: string;
  workoutId?: string;
  workoutName: string;
  place?: "acasa" | "sala";
  completedAt: string;
  exerciseCount: number;
  cardioMinutes: number;
  exercises?: Array<{ name: string; group: string; details: string }>;
};

export type CloudProgress = {
  authenticated: boolean;
  selections?: CloudSelections;
  activeWeek: number;
  completed: string[];
  workouts: CloudWorkout[];
  logs: CloudWorkoutLog[];
};

type FreeExerciseInput = { exerciseKey: string; name: string; target: string; order: number };
type ProgressAction =
  | "save_free_plan"
  | "save_free_workout"
  | "save_custom_workout"
  | "delete_custom_workout"
  | "finish_custom_workout"
  | "unlock_custom_workout"
  | "import_workout_logs";

type PendingProgressMutation = {
  id: string;
  ownerUserId: string;
  action: ProgressAction;
  payload: Record<string, unknown>;
  queuedAt: string;
};

const PROGRESS_QUEUE_KEY = "vemi-authenticated-sync-queue-v2";
const AUTHENTICATED_CACHE_KEY = "vemi-authenticated-progress-cache-v2";
const AUTHENTICATED_FREE_PLAN_RESET_KEY = "vemi-authenticated-free-plan-reset-v1";
const retryDelays = [0, 250, 700];
const inFlightMutations = new Map<string, Promise<boolean>>();
const inFlightMutationControllers = new Map<string, AbortController>();
const anonymousImportInFlight = new Map<string, Promise<{ saved: boolean; cloud?: CloudProgress; userId?: string }>>();
let knownUserId: string | null = null;

type AuthenticatedFreePlanResetMarker = {
  version: 1;
  ownerUserId: string;
  planInstanceId?: string;
  resetAt: string;
};

function readQueue(): PendingProgressMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingProgressMutation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROGRESS_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueMutation(mutation: PendingProgressMutation) {
  const queue = readQueue();
  const existingIndex = queue.findIndex((item) => item.id === mutation.id);
  if (existingIndex >= 0) queue[existingIndex] = mutation;
  else queue.push(mutation);
  writeQueue(queue);
}

function removeMutation(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id || item.ownerUserId !== knownUserId));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function restoreProgressSession() {
  if (typeof window === "undefined") return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    knownUserId = null;
    return null;
  }

  const expiresSoon = (data.session.expires_at ?? 0) * 1000 < Date.now() + 60_000;
  if (expiresSoon) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    knownUserId = !refreshError ? refreshed.session?.user.id ?? null : null;
    return knownUserId;
  }
  knownUserId = data.session.user.id;
  return knownUserId;
}

async function fetchProgress(input: RequestInfo | URL, init?: RequestInit) {
  let response: Response | null = null;
  for (let index = 0; index < retryDelays.length; index += 1) {
    if (retryDelays[index]) await wait(retryDelays[index]);
    response = await fetch(input, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...init?.headers,
        "cache-control": "no-store",
      },
    });
    if (response.status !== 401) return response;
    await restoreProgressSession();
  }
  return response!;
}

async function sendMutation(mutation: PendingProgressMutation) {
  if (!knownUserId || mutation.ownerUserId !== knownUserId) return false;
  const existing = inFlightMutations.get(mutation.id);
  if (existing) return existing;
  const controller = new AbortController();
  const request = (async () => {
    try {
      const response = await fetchProgress("/api/progress", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: mutation.action,
          mutationId: mutation.id,
          payload: mutation.payload,
        }),
      });
      if (!response.ok) return false;
      const result = await response.json().catch(() => null) as { ok?: boolean } | null;
      return result?.ok === true;
    } catch {
      return false;
    }
  })();
  inFlightMutations.set(mutation.id, request);
  inFlightMutationControllers.set(mutation.id, controller);
  try {
    return await request;
  } finally {
    inFlightMutations.delete(mutation.id);
    inFlightMutationControllers.delete(mutation.id);
  }
}

async function progressRequest(
  id: string,
  action: ProgressAction,
  payload: Record<string, unknown>,
) {
  if (!knownUserId) return false;
  const mutation: PendingProgressMutation = {
    id,
    ownerUserId: knownUserId,
    action,
    payload,
    queuedAt: new Date().toISOString(),
  };
  enqueueMutation(mutation);
  const saved = await sendMutation(mutation);
  if (saved) removeMutation(id);
  return saved;
}

export async function flushPendingProgressMutations() {
  const userId = await restoreProgressSession();
  if (!userId) return { confirmed: 0, pending: 0 };
  const queue = readQueue().filter((mutation) => mutation.ownerUserId === userId);
  let confirmed = 0;
  for (const mutation of queue) {
    if (await sendMutation(mutation)) {
      removeMutation(mutation.id);
      confirmed += 1;
    } else {
      break;
    }
  }
  return { confirmed, pending: readQueue().filter((mutation) => mutation.ownerUserId === userId).length };
}

export function pendingProgressMutationCount() {
  if (!knownUserId) return 0;
  return readQueue().filter((mutation) => mutation.ownerUserId === knownUserId).length;
}

export function cancelPendingFreePlanMutations() {
  if (!knownUserId || typeof window === "undefined") return 0;
  const queue = readQueue();
  const canceled = queue.filter((mutation) =>
    mutation.ownerUserId === knownUserId
    && (mutation.action === "save_free_plan" || mutation.action === "save_free_workout")
  );
  for (const mutation of canceled) inFlightMutationControllers.get(mutation.id)?.abort();
  writeQueue(queue.filter((mutation) => !canceled.some((item) => item.id === mutation.id)));
  return canceled.length;
}

export function markAuthenticatedFreePlanResetPending(planInstanceId?: string) {
  if (!knownUserId || typeof window === "undefined") return false;
  const normalizedInstanceId = normalizePlanInstanceId(planInstanceId);
  localStorage.setItem(AUTHENTICATED_FREE_PLAN_RESET_KEY, JSON.stringify({
    version: 1,
    ownerUserId: knownUserId,
    planInstanceId: normalizedInstanceId,
    resetAt: new Date().toISOString(),
  } satisfies AuthenticatedFreePlanResetMarker));
  return true;
}

export function readAuthenticatedFreePlanResetMarker(): AuthenticatedFreePlanResetMarker | null {
  if (!knownUserId || typeof window === "undefined") return null;
  try {
    const marker = JSON.parse(localStorage.getItem(AUTHENTICATED_FREE_PLAN_RESET_KEY) ?? "null") as Partial<AuthenticatedFreePlanResetMarker> | null;
    if (marker?.version !== 1 || marker.ownerUserId !== knownUserId || typeof marker.resetAt !== "string") return null;
    return {
      version: 1,
      ownerUserId: knownUserId,
      planInstanceId: normalizePlanInstanceId(marker.planInstanceId),
      resetAt: marker.resetAt,
    };
  } catch {
    return null;
  }
}

export function clearAuthenticatedFreePlanResetMarker(planInstanceId?: string) {
  const marker = readAuthenticatedFreePlanResetMarker();
  if (!marker) return false;
  const expected = normalizePlanInstanceId(planInstanceId);
  if (expected && marker.planInstanceId !== expected) return false;
  localStorage.removeItem(AUTHENTICATED_FREE_PLAN_RESET_KEY);
  return true;
}

export function onProgressSessionChange(callback: () => void) {
  const supabase = createSupabaseBrowserClient();
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") knownUserId = null;
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      window.setTimeout(callback, 0);
    }
  });
  return () => data.subscription.unsubscribe();
}

export async function loadCloudProgress(): Promise<CloudProgress> {
  await restoreProgressSession();
  const response = await fetchProgress("/api/progress");
  if (response.status === 401) {
    return { authenticated: false, activeWeek: 1, completed: [], workouts: [], logs: [] };
  }
  if (!response.ok) throw new Error("Progresul nu a putut fi încărcat.");
  return await response.json() as CloudProgress;
}

export async function saveCloudFreePlan(selections: CloudSelections, completed: string[], activeWeek: number) {
  const place = selections.place ?? "neales";
  const instance = normalizePlanInstanceId(selections.planInstanceId) ?? "legacy";
  return progressRequest(`free-plan:${place}:${instance}`, "save_free_plan", { selections, completed, activeWeek });
}

export async function saveCloudFreeWorkout(args: {
  selections: CloudSelections;
  completed: string[];
  activeWeek: number;
  day: string;
  focus: string;
  duration: string;
  exercises: FreeExerciseInput[];
  isCompleted: boolean;
}) {
  const key = `free-workout:${args.selections.place ?? "neales"}:${args.activeWeek}:${args.day}`;
  return progressRequest(key, "save_free_workout", args);
}

export async function saveCloudCustomWorkout(workout: CloudWorkout) {
  return progressRequest(`custom-workout:${workout.id}`, "save_custom_workout", { workout });
}

export async function deleteCloudCustomWorkout(clientKey: string) {
  const queue = readQueue().filter((item) =>
    item.ownerUserId !== knownUserId || item.id !== `custom-workout:${clientKey}`,
  );
  writeQueue(queue);
  return progressRequest(`delete-custom-workout:${clientKey}`, "delete_custom_workout", { clientKey });
}

export async function finishCloudCustomWorkout(
  workout: CloudWorkout,
  completedUids: string[],
  log: CloudWorkoutLog,
) {
  return progressRequest(`finish-custom-workout:${log.id}`, "finish_custom_workout", {
    workout,
    completedUids,
    completedAt: log.completedAt,
    mutationId: log.id,
  });
}

export async function unlockCloudCustomWorkout(clientKey: string) {
  return progressRequest(`unlock-custom-workout:${clientKey}`, "unlock_custom_workout", { clientKey });
}

export async function importCloudWorkoutLogs(logs: CloudWorkoutLog[], workouts: CloudWorkout[]) {
  if (!logs.length) return true;
  const ids = logs.map((log) => log.id).sort().join(":");
  return progressRequest(`import-workout-logs:${ids}`, "import_workout_logs", { logs, workouts });
}

export function writeAuthenticatedProgressCache(progress: Omit<CloudProgress, "authenticated">) {
  if (!knownUserId || typeof window === "undefined") return;
  localStorage.setItem(AUTHENTICATED_CACHE_KEY, JSON.stringify({
    version: 2,
    ownerUserId: knownUserId,
    updatedAt: new Date().toISOString(),
    progress,
  }));
}

export function readAuthenticatedProgressCache(): CloudProgress | null {
  if (!knownUserId || typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(localStorage.getItem(AUTHENTICATED_CACHE_KEY) ?? "null") as {
      ownerUserId?: string;
      progress?: Omit<CloudProgress, "authenticated">;
    } | null;
    return cached?.ownerUserId === knownUserId && cached.progress
      ? { authenticated: true, ...cached.progress }
      : null;
  } catch {
    return null;
  }
}

export async function importAnonymousProgressByChoice(
  importId: string,
  snapshot: unknown,
) {
  const existing = anonymousImportInFlight.get(importId);
  if (existing) return existing;
  const request = (async () => {
    const userId = await restoreProgressSession();
    if (!userId) return { saved: false };
    try {
      const response = await fetchProgress("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "import_anonymous_progress",
          mutationId: importId,
          payload: { importId, snapshot },
        }),
      });
      if (!response.ok) {
        console.warn("VEMI anonymous import request failed", { status: response.status });
        return { saved: false, userId };
      }
      const result = await response.json().catch(() => null) as { ok?: boolean; importId?: string } | null;
      if (result?.ok !== true || result.importId !== importId) return { saved: false, userId };
      const cloud = await loadCloudProgress();
      return { saved: cloud.authenticated, cloud, userId };
    } catch (error) {
      console.warn("VEMI anonymous import could not be confirmed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { saved: false, userId };
    }
  })();
  anonymousImportInFlight.set(importId, request);
  try {
    return await request;
  } finally {
    anonymousImportInFlight.delete(importId);
  }
}
