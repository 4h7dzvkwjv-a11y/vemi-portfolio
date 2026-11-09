import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import { resolveExerciseKey as resolveLegacyExerciseKey } from "../../../lib/exercises/catalog";
import { normalizeExerciseSearchText } from "../../../lib/exercises/catalog-model";
import { normalizePublicV2Selections } from "../../../lib/plan-engine/public-v2-integration.mjs";
import type {
  CloudProgress,
  CloudSelections,
  CloudWorkout,
  CloudWorkoutLog,
} from "../../../utils/progress/client";
import type { AnonymousProgressSnapshot } from "../../../utils/progress/anonymous";
import {
  activeFreePlanSessions,
  expectedFreePlanContentVersion,
  normalizePlanInstanceId,
  planContentVersionFromPlanKey,
  planInstanceIdFromPlanKey,
  withPlanContentVersionKey,
  withPlanInstanceKey,
} from "../../../utils/progress/free-plan-state.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStoreHeaders = { "cache-control": "private, no-store, max-age=0" };
const ACTIONS_USING_EXERCISE_CATALOG = new Set([
  "import_anonymous_progress",
  "save_free_workout",
  "save_custom_workout",
  "finish_custom_workout",
  "import_workout_logs",
]);

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type FreeExerciseInput = { exerciseKey: string; name: string; target: string; order: number };
type ExerciseKeyResolver = (exerciseKey: string | null | undefined, exerciseName: string) => string;

class InvalidFreePlanProfileError extends Error {}

function requireLegacyExerciseKey(exerciseKey: string | null | undefined, exerciseName: string) {
  const canonicalKey = resolveLegacyExerciseKey(exerciseKey, exerciseName);
  if (!canonicalKey) throw new Error("Exercițiul nu există în catalogul VEMI.");
  return canonicalKey;
}

async function createProgressExerciseKeyResolver(supabase: SupabaseServerClient): Promise<ExerciseKeyResolver> {
  const [exerciseResult, aliasResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, exercise_key, canonical_name")
      .eq("is_active", true),
    supabase
      .from("exercise_aliases")
      .select("exercise_id, alias_name"),
  ]);
  if (exerciseResult.error) throw exerciseResult.error;
  if (aliasResult.error) throw aliasResult.error;

  const activeKeys = new Set<string>();
  const exerciseKeyById = new Map<string, string>();
  const keyByName = new Map<string, string>();
  for (const exercise of exerciseResult.data ?? []) {
    activeKeys.add(exercise.exercise_key);
    exerciseKeyById.set(exercise.id, exercise.exercise_key);
    keyByName.set(normalizeExerciseSearchText(exercise.canonical_name), exercise.exercise_key);
  }
  for (const alias of aliasResult.data ?? []) {
    const exerciseKey = exerciseKeyById.get(alias.exercise_id);
    if (exerciseKey) keyByName.set(normalizeExerciseSearchText(alias.alias_name), exerciseKey);
  }

  return (exerciseKey, exerciseName) => {
    if (exerciseKey && activeKeys.has(exerciseKey)) return exerciseKey;
    const liveKey = keyByName.get(normalizeExerciseSearchText(exerciseName));
    if (liveKey) return liveKey;
    return requireLegacyExerciseKey(exerciseKey, exerciseName);
  };
}

function parseNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function parseTarget(target: string) {
  const values = target.match(/\d+(?:[.,]\d+)?/g)?.map((value) => Number(value.replace(",", "."))) ?? [];
  const isTimed = /sec|min/i.test(target);
  return {
    sets: isTimed ? (values.length > 1 ? values[0] : 0) : (values[0] ?? 0),
    reps: isTimed ? 0 : (values[1] ?? values[0] ?? 0),
    weight: /kg/i.test(target) ? (values.at(-1) ?? 0) : 0,
    durationSeconds: isTimed ? Math.round((values.at(-1) ?? 0) * (/min/i.test(target) ? 60 : 1)) : 0,
  };
}

function validDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseAnonymousSnapshot(value: unknown): AnonymousProgressSnapshot {
  if (!value || typeof value !== "object") throw new Error("Pachetul anonim lipsește.");
  const input = value as Partial<AnonymousProgressSnapshot>;
  if (input.version !== 2 || typeof input.importId !== "string" || !/^anonymous-[a-zA-Z0-9-]+$/.test(input.importId)) {
    throw new Error("Pachetul anonim nu are un identificator valid.");
  }
  const workouts = Array.isArray(input.workouts) ? input.workouts.slice(0, 100) : [];
  const logs = Array.isArray(input.logs) ? input.logs.slice(0, 250) : [];
  const completed = Array.isArray(input.completed)
    ? Array.from(new Set(input.completed.filter((key): key is string =>
      typeof key === "string" && /^w[1-4]-(acasa|sala)-Ziua [1-5]$/.test(key),
    )))
    : [];
  return {
    version: 2,
    importId: input.importId,
    capturedAt: validDate(input.capturedAt) ?? new Date().toISOString(),
    selections: input.selections,
    activeWeek: Math.max(1, Math.min(4, Number(input.activeWeek) || 1)),
    completed,
    workouts,
    logs: logs.filter((log) => Boolean(validDate(log.completedAt))),
  };
}

async function authenticatedContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
}

const V2_PROGRAM_DAYS: Record<string, number> = {
  "incepator-3": 3,
  "incepator-4": 4,
  "avansat-4": 4,
  "avansat-5": 5,
};

function freePlanEngineVersion(selections: CloudSelections) {
  return selections.engineVersion === "v2" ? "v2" : "v1";
}

function requireFreePlanSelections(selections: CloudSelections): CloudSelections {
  if (freePlanEngineVersion(selections) === "v1") return selections;
  const normalized = normalizePublicV2Selections(selections);
  if (normalized.status !== "valid") throw new InvalidFreePlanProfileError("Profilul V2 nu este valid.");
  return {
    ...normalized.profile,
    engineVersion: "v2",
    planInstanceId: normalizePlanInstanceId(selections.planInstanceId),
    contentVersion: expectedFreePlanContentVersion(normalized.profile),
  };
}

function freePlanDays(selections: CloudSelections) {
  if (freePlanEngineVersion(selections) === "v1") return 3;
  const days = selections.program ? V2_PROGRAM_DAYS[selections.program] : undefined;
  if (!days) throw new Error("Programul V2 nu are o frecvență validă.");
  return days;
}

function freePlanKey(selections: CloudSelections) {
  const legacyParts = [selections.gender, selections.age, selections.goal, selections.program, selections.place]
    .filter(Boolean).join(":");
  const v2Parts = [selections.gender, selections.age, selections.goal, selections.place, selections.program]
    .filter(Boolean).join(":");
  const canonicalKey = freePlanEngineVersion(selections) === "v2" ? `plan:v2:${v2Parts}` : legacyParts;
  const versionedKey = freePlanEngineVersion(selections) === "v2"
    ? withPlanContentVersionKey(canonicalKey, selections.contentVersion)
    : canonicalKey;
  return freePlanEngineVersion(selections) === "v2"
    ? withPlanInstanceKey(versionedKey, selections.planInstanceId)
    : versionedKey;
}

function completedFreePlanOrdinals(selections: CloudSelections, completed: string[]) {
  const daysPerWeek = freePlanDays(selections);
  const place = selections.place;
  return Array.from(new Set(completed.flatMap((key) => {
    const match = key.match(/^w([1-4])-(acasa|sala)-Ziua ([1-5])$/);
    if (!match || match[2] !== place || Number(match[3]) > daysPerWeek) return [];
    return [`${match[1]}:${match[3]}`];
  })));
}

function freePlanSessionOrdinal(session: {
  workout_key?: string | null;
  week_number?: number | null;
  day_number?: number | null;
}) {
  const keyMatch = String(session.workout_key ?? "").match(/^w([1-4])-(?:acasa|sala)-Ziua ([1-5])$/);
  if (keyMatch) return `${keyMatch[1]}:${keyMatch[2]}`;
  const week = Number(session.week_number);
  const day = Number(session.day_number);
  return week >= 1 && week <= 4 && day >= 1 && day <= 5 ? `${week}:${day}` : null;
}

function freePlanSessionCompletedKey(
  place: "acasa" | "sala",
  session: { workout_key?: string | null; week_number?: number | null; day_number?: number | null },
) {
  const storedKey = String(session.workout_key ?? "");
  if (/^w[1-4]-(?:acasa|sala)-Ziua [1-5]$/.test(storedKey)) return storedKey;
  const ordinal = freePlanSessionOrdinal(session);
  if (!ordinal) return null;
  const [week, day] = ordinal.split(":");
  return `w${week}-${place}-Ziua ${day}`;
}

function freePlanSchedule(daysPerWeek: number) {
  return Array.from({ length: daysPerWeek * 4 }, (_, index) => ({
    week: Math.floor(index / daysPerWeek) + 1,
    day: (index % daysPerWeek) + 1,
  }));
}

async function saveFreePlan(
  supabase: SupabaseServerClient,
  userId: string,
  selections: CloudSelections,
  completed: string[],
  activeWeek: number,
) {
  const validSelections = requireFreePlanSelections(selections);
  if (!validSelections.place) throw new Error("Planul nu are locul de antrenament selectat.");
  const planKey = freePlanKey(validSelections);
  const { data: existingPlan, error: existingPlanError } = await supabase.from("user_free_plans")
    .select("id, plan_key, started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingPlanError) throw existingPlanError;
  const incomingInstanceId = normalizePlanInstanceId(validSelections.planInstanceId);
  const existingInstanceId = planInstanceIdFromPlanKey(existingPlan?.plan_key);
  const startsNewInstance = Boolean(incomingInstanceId && incomingInstanceId !== existingInstanceId);
  const nextStartedAt = startsNewInstance ? new Date().toISOString() : undefined;
  const daysPerWeek = freePlanDays(validSelections);
  const completedOrdinals = new Set(completedFreePlanOrdinals(validSelections, startsNewInstance ? [] : completed));
  const firstMissing = freePlanSchedule(daysPerWeek)
    .find(({ week, day }) => !completedOrdinals.has(`${week}:${day}`));
  const { data, error } = await supabase.from("user_free_plans").upsert({
    user_id: userId,
    plan_key: planKey,
    gender: validSelections.gender ?? null,
    age_group: validSelections.age ?? null,
    goal: validSelections.goal ?? null,
    program_level: validSelections.program ?? null,
    place: validSelections.place,
    current_week: firstMissing?.week ?? Math.max(1, Math.min(4, startsNewInstance ? 1 : activeWeek)),
    current_day: firstMissing?.day ?? daysPerWeek,
    completed_workouts: completedOrdinals.size,
    total_workouts: daysPerWeek * 4,
    ...(nextStartedAt ? { started_at: nextStartedAt } : {}),
  }, { onConflict: "user_id" }).select("id, plan_key, started_at").single();
  if (error) throw error;
  return {
    id: data.id as string,
    planKey: data.plan_key as string,
    startedAt: data.started_at as string,
    instanceAware: Boolean(planInstanceIdFromPlanKey(data.plan_key)),
  };
}

async function saveCustomWorkout(
  supabase: SupabaseServerClient,
  userId: string,
  workout: CloudWorkout,
  resolveExerciseKey: ExerciseKeyResolver,
) {
  const { data, error } = await supabase.from("custom_workouts").upsert({
    user_id: userId,
    client_key: workout.id,
    name: workout.name,
    place: workout.place,
    completions: workout.completions,
    last_completed_at: workout.lastCompleted ?? null,
  }, { onConflict: "user_id,client_key" }).select("id").single();
  if (error) throw error;

  const { error: deleteError } = await supabase.from("custom_workout_exercises").delete().eq("workout_id", data.id);
  if (deleteError) throw deleteError;
  if (workout.exercises.length) {
    const { error: exerciseError } = await supabase.from("custom_workout_exercises").insert(workout.exercises.map((exercise, index) => ({
      user_id: userId,
      workout_id: data.id,
      client_key: exercise.uid,
      exercise_key: resolveExerciseKey(exercise.id, exercise.name),
      name: exercise.name,
      muscle_group: exercise.group,
      exercise_kind: exercise.kind,
      places: exercise.places,
      order_index: index,
      target_sets: exercise.sets,
      target_reps: exercise.reps,
      target_weight_kg: exercise.weight,
      target_duration_seconds: exercise.minutes * 60,
    })));
    if (exerciseError) throw exerciseError;
  }
  return data.id as string;
}

async function mergeAnonymousWorkout(
  supabase: SupabaseServerClient,
  userId: string,
  workout: CloudWorkout,
  resolveExerciseKey: ExerciseKeyResolver,
) {
  const { data: existing, error: existingError } = await supabase.from("custom_workouts")
    .select("id,completions,last_completed_at").eq("user_id", userId).eq("client_key", workout.id).maybeSingle();
  if (existingError) throw existingError;
  let workoutId: string;
  if (!existing) {
    workoutId = await saveCustomWorkout(supabase, userId, workout, resolveExerciseKey);
  } else {
    workoutId = existing.id;
    const existingCompleted = validDate(existing.last_completed_at);
    const incomingCompleted = validDate(workout.lastCompleted);
    const { error } = await supabase.from("custom_workouts").update({
      completions: Math.max(Number(existing.completions) || 0, Math.max(0, Number(workout.completions) || 0)),
      last_completed_at: [existingCompleted, incomingCompleted].filter(Boolean).sort().at(-1) ?? null,
    }).eq("id", workoutId).eq("user_id", userId);
    if (error) throw error;
    const { data: existingExercises, error: exerciseReadError } = await supabase.from("custom_workout_exercises")
      .select("client_key").eq("user_id", userId).eq("workout_id", workoutId);
    if (exerciseReadError) throw exerciseReadError;
    const existingKeys = new Set((existingExercises ?? []).map((item) => item.client_key));
    const missing = workout.exercises.filter((exercise) => !existingKeys.has(exercise.uid));
    if (missing.length) {
      const { error: insertError } = await supabase.from("custom_workout_exercises").insert(missing.map((exercise, index) => ({
        user_id: userId,
        workout_id: workoutId,
        client_key: exercise.uid,
        exercise_key: resolveExerciseKey(exercise.id, exercise.name),
        name: exercise.name,
        muscle_group: exercise.group,
        exercise_kind: exercise.kind,
        places: exercise.places,
        order_index: (existingExercises?.length ?? 0) + index,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        target_weight_kg: exercise.weight,
        target_duration_seconds: exercise.minutes * 60,
      })));
      if (insertError) throw insertError;
    }
  }
  return workoutId;
}

async function importAnonymousProgress(
  supabase: SupabaseServerClient,
  userId: string,
  snapshot: AnonymousProgressSnapshot,
  resolveExerciseKey: ExerciseKeyResolver,
) {
  const place = snapshot.selections?.place;
  let planId: string | null = null;
  if (place) {
    const { data: existingPlan, error: planReadError } = await supabase.from("user_free_plans")
      .select("*, workout_sessions(id,source,free_plan_id,workout_key,week_number,day_number,completed_at,updated_at)").eq("user_id", userId).maybeSingle();
    if (planReadError) throw planReadError;
    const existingCompleted = Number(existingPlan?.completed_workouts) || 0;
    const shouldAdoptAnonymousPlan = !existingPlan;
    const mergedSelections = shouldAdoptAnonymousPlan ? snapshot.selections! : {
      gender: existingPlan.gender ?? undefined,
      age: existingPlan.age_group ?? undefined,
      goal: existingPlan.goal ?? undefined,
      program: existingPlan.program_level ?? undefined,
      place: existingPlan.place,
      engineVersion: String(existingPlan.plan_key).startsWith("plan:v2:") ? "v2" as const : "v1" as const,
      contentVersion: planContentVersionFromPlanKey(existingPlan.plan_key),
    };
    const daysPerWeek = freePlanDays(mergedSelections);
    const incomingCompleted = shouldAdoptAnonymousPlan
      ? completedFreePlanOrdinals(mergedSelections, snapshot.completed).length
      : 0;
    const existingActiveSessions = activeFreePlanSessions(existingPlan, existingPlan?.workout_sessions ?? []);
    const existingCompletedKeys = existingActiveSessions.flatMap((session) => {
      const key = freePlanSessionCompletedKey(existingPlan?.place ?? place, session);
      return key ? [key] : [];
    });
    const savedPlan = await saveFreePlan(
      supabase,
      userId,
      mergedSelections,
      shouldAdoptAnonymousPlan ? snapshot.completed : existingCompletedKeys,
      shouldAdoptAnonymousPlan ? snapshot.activeWeek : Number(existingPlan.current_week),
    );
    planId = savedPlan.id;
    const { data: existingSessions, error: sessionReadError } = await supabase.from("workout_sessions")
      .select("id,source,free_plan_id,workout_key,week_number,day_number,completed_at,updated_at")
      .eq("user_id", userId).eq("free_plan_id", planId).eq("source", "free_plan");
    if (sessionReadError) throw sessionReadError;
    const activeExistingSessions = activeFreePlanSessions({
      id: savedPlan.id,
      plan_key: savedPlan.planKey,
      started_at: savedPlan.startedAt,
    }, existingSessions ?? []);
    const ordinals = new Set(activeExistingSessions.flatMap((item) => {
      const ordinal = freePlanSessionOrdinal(item);
      return ordinal ? [ordinal] : [];
    }));
    const rows = snapshot.completed.flatMap((key) => {
      const match = key.match(/^w([1-4])-(acasa|sala)-Ziua ([1-5])$/);
      if (!match || Number(match[3]) > daysPerWeek || ordinals.has(`${match[1]}:${match[3]}`)) return [];
      const now = snapshot.capturedAt;
      const mergedPlace = existingPlan?.place ?? match[2];
      return [{
        user_id: userId, source: "free_plan", free_plan_id: planId,
        workout_key: `w${match[1]}-${mergedPlace}-Ziua ${match[3]}`, workout_name: `Ziua ${match[3]}`,
        week_number: savedPlan.instanceAware ? null : Number(match[1]),
        day_number: savedPlan.instanceAware ? null : Number(match[3]), place: mergedPlace, status: "completed",
        started_at: now, completed_at: now, duration_seconds: 0,
      }];
    });
    if (rows.length) {
      const { error } = await supabase.from("workout_sessions").insert(rows);
      if (error) throw error;
    }
    const mergedOrdinals = new Set([
      ...activeExistingSessions.flatMap((item) => {
        const ordinal = freePlanSessionOrdinal(item);
        return ordinal ? [ordinal] : [];
      }),
      ...rows.flatMap((item) => {
        const ordinal = freePlanSessionOrdinal(item);
        return ordinal ? [ordinal] : [];
      }),
    ].filter((ordinal) => Number(ordinal.split(":")[1]) <= daysPerWeek));
    const firstMissing = freePlanSchedule(daysPerWeek)
      .find(({ week, day }) => !mergedOrdinals.has(`${week}:${day}`));
    const { error: updateError } = await supabase.from("user_free_plans").update({
      completed_workouts: Math.max(existingCompleted, incomingCompleted, mergedOrdinals.size),
      current_week: firstMissing?.week ?? 4,
      current_day: firstMissing?.day ?? daysPerWeek,
    }).eq("id", planId).eq("user_id", userId);
    if (updateError) throw updateError;
  }

  const workoutIds = new Map<string, string>();
  for (const workout of snapshot.workouts) {
    workoutIds.set(workout.id, await mergeAnonymousWorkout(supabase, userId, workout, resolveExerciseKey));
  }
  for (const log of snapshot.logs) {
    if (!log.workoutId) continue;
    const workout = snapshot.workouts.find((item) => item.id === log.workoutId);
    const customId = workoutIds.get(log.workoutId);
    const completedAt = validDate(log.completedAt);
    if (!workout || !customId || !completedAt) continue;
    const importKey = `anonymous:${snapshot.importId}:${log.id}`;
    const { data: existing, error: existingError } = await supabase.from("workout_sessions").select("id")
      .eq("user_id", userId).in("workout_key", [importKey, `import:${log.id}`]).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) continue;
    const { data: sameSession, error: sameSessionError } = await supabase.from("workout_sessions").select("id")
      .eq("user_id", userId).eq("custom_workout_id", customId).eq("workout_name", log.workoutName)
      .eq("completed_at", completedAt).limit(1).maybeSingle();
    if (sameSessionError) throw sameSessionError;
    if (sameSession?.id) continue;
    const preparedRows = (log.exercises ?? []).map((exercise, index) => {
      const definition = workout.exercises.find((item) => item.name === exercise.name);
      const actual = parseTarget(exercise.details);
      return {
        user_id: userId, exercise_key: resolveExerciseKey(definition?.id, exercise.name),
        exercise_name: exercise.name, muscle_group: exercise.group, order_index: index, completed: true,
        actual_sets: actual.sets, actual_reps: actual.reps, actual_weight_kg: actual.weight,
        actual_duration_seconds: actual.durationSeconds, completed_at: completedAt,
      };
    });
    const { data: session, error: sessionError } = await supabase.from("workout_sessions").insert({
      user_id: userId, source: "custom", custom_workout_id: customId, workout_key: importKey,
      workout_name: log.workoutName, place: log.place ?? workout.place, status: "completed",
      started_at: completedAt, completed_at: completedAt, duration_seconds: Math.max(0, Number(log.cardioMinutes) || 0) * 60,
    }).select("id").single();
    if (sessionError) throw sessionError;
    if (preparedRows.length) {
      const { error } = await supabase.from("workout_exercise_logs").insert(preparedRows.map((row) => ({ ...row, session_id: session.id })));
      if (error) throw error;
    }
  }
}

async function loadProgress(supabase: SupabaseServerClient, userId: string): Promise<CloudProgress> {
  const [planResult, customResult, exerciseResult, sessionResult, logResult] = await Promise.all([
    supabase.from("user_free_plans").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("custom_workouts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("custom_workout_exercises").select("*").eq("user_id", userId).order("order_index"),
    supabase.from("workout_sessions").select("*").eq("user_id", userId).eq("status", "completed").order("completed_at", { ascending: false }),
    supabase.from("workout_exercise_logs").select("*").eq("user_id", userId).eq("completed", true).order("order_index"),
  ]);
  const firstError = [planResult, customResult, exerciseResult, sessionResult, logResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const plan = planResult.data;
  const customRows = customResult.data ?? [];
  const exerciseRows = exerciseResult.data ?? [];
  const sessionRows = sessionResult.data ?? [];
  const logRows = logResult.data ?? [];
  const activePlanSessionRows = activeFreePlanSessions(plan, sessionRows);
  const workouts: CloudWorkout[] = customRows.map((workout) => ({
    id: workout.client_key,
    name: workout.name,
    place: workout.place,
    completions: workout.completions,
    lastCompleted: workout.last_completed_at ?? undefined,
    exercises: exerciseRows.filter((exercise) => exercise.workout_id === workout.id).map((exercise) => ({
      id: exercise.exercise_key,
      uid: exercise.client_key,
      name: exercise.name,
      group: exercise.muscle_group,
      kind: exercise.exercise_kind,
      places: exercise.places,
      sets: exercise.target_sets,
      reps: exercise.target_reps,
      weight: parseNumber(exercise.target_weight_kg),
      minutes: Math.round(exercise.target_duration_seconds / 60),
    })),
  }));
  const logs: CloudWorkoutLog[] = sessionRows.map((session) => {
    const exercises = logRows.filter((exercise) => exercise.session_id === session.id);
    return {
      id: session.id,
      workoutId: session.custom_workout_id ? customRows.find((workout) => workout.id === session.custom_workout_id)?.client_key : undefined,
      workoutName: session.workout_name,
      place: session.place,
      completedAt: session.completed_at ?? session.updated_at,
      exerciseCount: exercises.length,
      cardioMinutes: Math.round(exercises.reduce((sum, exercise) => sum + exercise.actual_duration_seconds, 0) / 60),
      exercises: exercises.map((exercise) => ({
        name: exercise.exercise_name,
        group: exercise.muscle_group ?? "Exercițiu",
        details: exercise.actual_duration_seconds
          ? `${Math.round(exercise.actual_duration_seconds / 60)} min`
          : `${exercise.actual_sets} × ${exercise.actual_reps}${parseNumber(exercise.actual_weight_kg) ? ` · ${parseNumber(exercise.actual_weight_kg)} kg` : ""}`,
      })),
    };
  });
  return {
    authenticated: true,
    selections: plan ? {
      gender: plan.gender ?? undefined,
      age: plan.age_group ?? undefined,
      goal: plan.goal ?? undefined,
      program: plan.program_level ?? undefined,
      place: plan.place,
      engineVersion: String(plan.plan_key).startsWith("plan:v2:") ? "v2" : "v1",
      planInstanceId: planInstanceIdFromPlanKey(plan.plan_key),
      contentVersion: planContentVersionFromPlanKey(plan.plan_key),
    } : undefined,
    activeWeek: plan?.current_week ?? 1,
    completed: activePlanSessionRows.map((session) => session.workout_key),
    workouts,
    logs,
  };
}

export async function GET() {
  const { supabase, userId } = await authenticatedContext();
  if (!userId) return NextResponse.json({ authenticated: false }, { status: 401, headers: noStoreHeaders });
  try {
    return NextResponse.json(await loadProgress(supabase, userId), { headers: noStoreHeaders });
  } catch (error) {
    console.error("VEMI progress load failed", error);
    return NextResponse.json({ error: "Progresul nu a putut fi încărcat." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: NextRequest) {
  const { supabase, userId } = await authenticatedContext();
  if (!userId) return NextResponse.json({ error: "Autentificare necesară." }, { status: 401, headers: noStoreHeaders });
  try {
    const body = await request.json() as { action?: string; payload?: Record<string, unknown> };
    const payload = body.payload ?? {};
    const resolveExerciseKey = ACTIONS_USING_EXERCISE_CATALOG.has(body.action ?? "")
      ? await createProgressExerciseKeyResolver(supabase)
      : requireLegacyExerciseKey;

    if (body.action === "import_anonymous_progress") {
      const snapshot = parseAnonymousSnapshot(payload.snapshot);
      if (payload.importId !== snapshot.importId) {
        return NextResponse.json({ error: "Identificatorul importului nu corespunde." }, { status: 400, headers: noStoreHeaders });
      }
      await importAnonymousProgress(supabase, userId, snapshot, resolveExerciseKey);
      return NextResponse.json({ ok: true, importId: snapshot.importId }, { headers: noStoreHeaders });
    } else if (body.action === "save_free_plan") {
      await saveFreePlan(supabase, userId, payload.selections as CloudSelections, payload.completed as string[], Number(payload.activeWeek));
    } else if (body.action === "save_free_workout") {
      const selections = requireFreePlanSelections(payload.selections as CloudSelections);
      const completed = payload.completed as string[];
      const activeWeek = Number(payload.activeWeek);
      const day = String(payload.day);
      const dayNumber = Number(day.replace(/\D/g, ""));
      if (dayNumber < 1 || dayNumber > freePlanDays(selections)) {
        return NextResponse.json({ error: "Ziua nu aparține frecvenței planului." }, { status: 400, headers: noStoreHeaders });
      }
      const savedPlan = await saveFreePlan(supabase, userId, selections, completed, activeWeek);
      const planId = savedPlan.id;
      const workoutKey = `w${activeWeek}-${selections.place}-${day}`;
      let existingSessionQuery = supabase.from("workout_sessions").select("id")
        .eq("user_id", userId).eq("free_plan_id", planId).eq("source", "free_plan");
      existingSessionQuery = savedPlan.instanceAware
        ? existingSessionQuery.eq("workout_key", workoutKey).gte("completed_at", savedPlan.startedAt)
        : existingSessionQuery.eq("week_number", activeWeek).eq("day_number", dayNumber);
      const { data: existing, error: existingError } = await existingSessionQuery
        .order("completed_at", { ascending: false }).limit(1).maybeSingle();
      if (existingError) throw existingError;
      if (!payload.isCompleted) {
        if (existing?.id) {
          const { error } = await supabase.from("workout_sessions").delete().eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const now = new Date().toISOString();
        const durationSeconds = (Number(String(payload.duration).match(/\d+/)?.[0]) || 0) * 60;
        let sessionId = existing?.id as string | undefined;
        if (sessionId) {
          const { error } = await supabase.from("workout_sessions").update({ workout_key: workoutKey, workout_name: String(payload.focus), status: "completed", completed_at: now, duration_seconds: durationSeconds }).eq("id", sessionId);
          if (error) throw error;
          const { error: deleteError } = await supabase.from("workout_exercise_logs").delete().eq("session_id", sessionId);
          if (deleteError) throw deleteError;
        } else {
          const { data, error } = await supabase.from("workout_sessions").insert({
            user_id: userId, source: "free_plan", free_plan_id: planId, workout_key: workoutKey,
            workout_name: String(payload.focus),
            week_number: savedPlan.instanceAware ? null : activeWeek,
            day_number: savedPlan.instanceAware ? null : dayNumber,
            place: selections.place, status: "completed", started_at: now, completed_at: now, duration_seconds: durationSeconds,
          }).select("id").single();
          if (error) throw error;
          sessionId = data.id;
        }
        const exercises = payload.exercises as FreeExerciseInput[];
        const { error } = await supabase.from("workout_exercise_logs").insert(exercises.map((exercise) => {
          const target = parseTarget(exercise.target);
          return {
            user_id: userId, session_id: sessionId,
            exercise_key: resolveExerciseKey(exercise.exerciseKey, exercise.name),
            exercise_name: exercise.name, muscle_group: String(payload.focus), order_index: exercise.order,
            completed: true, actual_sets: target.sets, actual_reps: target.reps,
            actual_weight_kg: target.weight, actual_duration_seconds: target.durationSeconds, completed_at: now,
          };
        }));
        if (error) throw error;
      }
    } else if (body.action === "save_custom_workout") {
      await saveCustomWorkout(supabase, userId, payload.workout as CloudWorkout, resolveExerciseKey);
    } else if (body.action === "delete_custom_workout") {
      const { error } = await supabase.from("custom_workouts").delete().eq("user_id", userId).eq("client_key", String(payload.clientKey));
      if (error) throw error;
    } else if (body.action === "unlock_custom_workout") {
      const clientKey = String(payload.clientKey ?? "");
      const { data: customWorkout, error: customWorkoutError } = await supabase
        .from("custom_workouts")
        .select("id,completions")
        .eq("user_id", userId)
        .eq("client_key", clientKey)
        .maybeSingle();
      if (customWorkoutError) throw customWorkoutError;
      if (customWorkout?.id) {
        const { data: latestSession, error: latestSessionError } = await supabase
          .from("workout_sessions")
          .select("id")
          .eq("user_id", userId)
          .eq("source", "custom")
          .eq("custom_workout_id", customWorkout.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestSessionError) throw latestSessionError;
        if (latestSession?.id) {
          const { error: exerciseLogError } = await supabase
            .from("workout_exercise_logs")
            .delete()
            .eq("user_id", userId)
            .eq("session_id", latestSession.id);
          if (exerciseLogError) throw exerciseLogError;
          const { error: sessionError } = await supabase
            .from("workout_sessions")
            .delete()
            .eq("user_id", userId)
            .eq("id", latestSession.id);
          if (sessionError) throw sessionError;
        }
        const { error: resetError } = await supabase
          .from("custom_workouts")
          .update({
            completions: Math.max(0, (Number(customWorkout.completions) || 0) - 1),
            last_completed_at: null,
          })
          .eq("user_id", userId)
          .eq("id", customWorkout.id);
        if (resetError) throw resetError;
      }
    } else if (body.action === "finish_custom_workout") {
      const workout = payload.workout as CloudWorkout;
      const completedUids = payload.completedUids as string[];
      const customId = await saveCustomWorkout(supabase, userId, workout, resolveExerciseKey);
      const completedExercises = workout.exercises.filter((exercise) => completedUids.includes(exercise.uid));
      const requestedCompletedAt = new Date(String(payload.completedAt ?? new Date().toISOString()));
      const now = Number.isNaN(requestedCompletedAt.getTime()) ? new Date().toISOString() : requestedCompletedAt.toISOString();
      const completedAt = new Date(now);
      const mutationId = String(payload.mutationId ?? `${workout.id}:${now}`);
      const workoutKey = `custom:${mutationId}`;
      const durationSeconds = completedExercises.reduce((total, exercise) => total + (exercise.kind === "cardio" ? exercise.minutes * 60 : 420), 0);
      const { data: existingSession, error: existingError } = await supabase.from("workout_sessions")
        .select("id").eq("user_id", userId).eq("workout_key", workoutKey).maybeSingle();
      if (existingError) throw existingError;
      let sessionId = existingSession?.id as string | undefined;
      const sessionValues = {
        custom_workout_id: customId,
        workout_key: workoutKey,
        workout_name: workout.name,
        place: workout.place,
        status: "completed",
        started_at: new Date(completedAt.getTime() - durationSeconds * 1000).toISOString(),
        completed_at: now,
        duration_seconds: durationSeconds,
      };
      if (sessionId) {
        const { error } = await supabase.from("workout_sessions").update(sessionValues).eq("id", sessionId);
        if (error) throw error;
        const { error: deleteError } = await supabase.from("workout_exercise_logs").delete().eq("session_id", sessionId);
        if (deleteError) throw deleteError;
      } else {
        const { data: session, error: sessionError } = await supabase.from("workout_sessions").insert({
          ...sessionValues, user_id: userId, source: "custom",
        }).select("id").single();
        if (sessionError) throw sessionError;
        sessionId = session.id;
      }
      if (completedExercises.length) {
        const { error } = await supabase.from("workout_exercise_logs").insert(completedExercises.map((exercise, index) => ({
          user_id: userId, session_id: sessionId,
          exercise_key: resolveExerciseKey(exercise.id, exercise.name), exercise_name: exercise.name,
          muscle_group: exercise.group, order_index: index, completed: true, actual_sets: exercise.sets,
          actual_reps: exercise.reps, actual_weight_kg: exercise.weight,
          actual_duration_seconds: exercise.kind === "cardio" ? exercise.minutes * 60 : 0, completed_at: now,
        })));
        if (error) throw error;
      }
      const { error: updateError } = await supabase.from("custom_workouts").update({ completions: workout.completions + 1, last_completed_at: now }).eq("id", customId);
      if (updateError) throw updateError;
    } else if (body.action === "import_workout_logs") {
      const logs = payload.logs as CloudWorkoutLog[];
      const workouts = payload.workouts as CloudWorkout[];
      for (const log of logs) {
        if (!log.workoutId) continue;
        const workout = workouts.find((item) => item.id === log.workoutId);
        if (!workout) continue;
        const customId = await saveCustomWorkout(supabase, userId, workout, resolveExerciseKey);
        const importKey = `import:${log.id}`;
        const { data: existing, error: existingError } = await supabase.from("workout_sessions").select("id").eq("user_id", userId).eq("workout_key", importKey).maybeSingle();
        if (existingError) throw existingError;
        if (existing?.id) continue;
        const completedAt = new Date(log.completedAt).toISOString();
        const preparedRows = (log.exercises ?? []).map((exercise, index) => {
          const definition = workout.exercises.find((item) => item.name === exercise.name);
          const actual = parseTarget(exercise.details);
          return {
            exercise_key: resolveExerciseKey(definition?.id, exercise.name),
            exercise_name: exercise.name, muscle_group: exercise.group, order_index: index, completed: true,
            actual_sets: actual.sets, actual_reps: actual.reps, actual_weight_kg: actual.weight,
            actual_duration_seconds: actual.durationSeconds, completed_at: completedAt,
          };
        });
        const { data: session, error: sessionError } = await supabase.from("workout_sessions").insert({
          user_id: userId, source: "custom", custom_workout_id: customId, workout_key: importKey,
          workout_name: log.workoutName, place: log.place ?? workout.place, status: "completed",
          started_at: completedAt, completed_at: completedAt, duration_seconds: log.cardioMinutes * 60,
        }).select("id").single();
        if (sessionError) throw sessionError;
        const rows = preparedRows.map((row) => ({ ...row, user_id: userId, session_id: session.id }));
        if (rows.length) {
          const { error } = await supabase.from("workout_exercise_logs").insert(rows);
          if (error) throw error;
        }
      }
    } else {
      return NextResponse.json({ error: "Acțiune necunoscută." }, { status: 400, headers: noStoreHeaders });
    }
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("VEMI progress write failed", error);
    if (error instanceof InvalidFreePlanProfileError) {
      return NextResponse.json({ error: "Selecția planului nu este validă." }, { status: 400, headers: noStoreHeaders });
    }
    return NextResponse.json({ error: "Progresul nu a putut fi salvat." }, { status: 500, headers: noStoreHeaders });
  }
}
