import "server-only";

import type { AdminContext } from "../../utils/admin/server";

type AdminSupabaseClient = AdminContext["supabase"];

type ActiveExerciseRow = {
  exercise_key: string;
  canonical_name: string;
  muscle_group: string;
  is_active: boolean;
};

export type AdminCatalogExercise = {
  exerciseKey: string;
  name: string;
  group: string;
};

const safeExerciseKey = /^[a-z0-9][a-z0-9_-]{0,119}$/;

function normalizeActiveExercise(row: ActiveExerciseRow): AdminCatalogExercise {
  if (
    !row.is_active
    || !safeExerciseKey.test(row.exercise_key)
    || !row.canonical_name.trim()
    || !row.muscle_group.trim()
  ) {
    throw new Error("Catalogul canonic activ conține un exercițiu invalid.");
  }

  return {
    exerciseKey: row.exercise_key,
    name: row.canonical_name.trim(),
    group: row.muscle_group.trim(),
  };
}

export async function loadActiveAdminExerciseCatalog(
  supabase: AdminSupabaseClient,
): Promise<AdminCatalogExercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_key, canonical_name, muscle_group, is_active")
    .eq("is_active", true)
    .order("exercise_key");

  if (error) throw new Error("Catalogul canonic activ nu a putut fi citit în siguranță.");

  const exercises = ((data as ActiveExerciseRow[] | null) ?? []).map(normalizeActiveExercise);
  if (!exercises.length) throw new Error("Catalogul canonic activ este gol.");

  const keys = new Set(exercises.map((exercise) => exercise.exerciseKey));
  if (keys.size !== exercises.length) {
    throw new Error("Catalogul canonic activ conține identificatori duplicați.");
  }

  return exercises;
}

export async function getActiveAdminExerciseByKey(
  supabase: AdminSupabaseClient,
  exerciseKey: string,
): Promise<AdminCatalogExercise | null> {
  if (!safeExerciseKey.test(exerciseKey)) return null;

  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_key, canonical_name, muscle_group, is_active")
    .eq("exercise_key", exerciseKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("Exercițiul canonic activ nu a putut fi verificat în siguranță.");
  return data ? normalizeActiveExercise(data as ActiveExerciseRow) : null;
}
