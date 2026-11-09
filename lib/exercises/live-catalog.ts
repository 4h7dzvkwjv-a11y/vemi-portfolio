import "server-only";

import point2RegistryData from "../../data/plan-engine/v2/exercise-rules.json";
import { createPublicCatalogClient } from "../../utils/supabase/public-server";
import {
  ACTIVE_CATALOG_CONTRACT_VERSION,
  loadCatalogWithControlledRetry,
} from "./catalog-delivery.mjs";
import { normalizeAuthoritativeVideoEligibility } from "./video-eligibility.mjs";
import {
  validateV2Registry,
  type V2RuleRegistry,
} from "../plan-engine/v2-runtime.mjs";
import {
  PUBLIC_COLLECTION_ORDER,
  isExerciseCollectionKey,
  type CatalogExercise,
  type ExerciseCatalogPayload,
  type ExerciseCollectionMembership,
  type ExerciseKind,
  type TrainingPlace,
} from "./catalog-model";

type ExerciseRow = {
  id: string;
  exercise_key: string;
  canonical_name: string;
  muscle_group: string;
  exercise_kind: string;
  places: string[];
  is_active: boolean;
  recommended_display: string | null;
  instruction_1: string | null;
  instruction_2: string | null;
};

type MembershipRow = {
  exercise_key: string;
  collection_key: string;
  order_index: number;
};

type AliasRow = {
  exercise_id: string;
  alias_name: string;
  normalized_alias: string;
};

type VideoRow = {
  exercise_key: string;
  video_object_key: string | null;
  poster_object_key: string | null;
  mime_type: string | null;
  duration_seconds: number | string | null;
  width_pixels: number | null;
  height_pixels: number | null;
  file_size_bytes: number | string | null;
  is_active: boolean;
};

const point2Registry = point2RegistryData as V2RuleRegistry;

function requiredText(value: string | null, field: string, exerciseKey: string) {
  const text = value?.trim();
  if (!text) throw new Error(`Catalog invalid: ${field} lipsește pentru ${exerciseKey}.`);
  return text;
}

function validPlaces(places: string[], exerciseKey: string): TrainingPlace[] {
  if (!Array.isArray(places) || places.length === 0 || places.some((place) => place !== "acasa" && place !== "sala")) {
    throw new Error(`Catalog invalid: places este invalid pentru ${exerciseKey}.`);
  }
  return places as TrainingPlace[];
}

function validKind(kind: string, exerciseKey: string): ExerciseKind {
  if (kind !== "forta" && kind !== "cardio") {
    throw new Error(`Catalog invalid: exercise_kind este invalid pentru ${exerciseKey}.`);
  }
  return kind;
}

async function loadLiveExerciseCatalogAttempt(): Promise<ExerciseCatalogPayload> {
  const supabase = createPublicCatalogClient();
  const [exerciseResult, membershipResult, aliasResult, videoResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, exercise_key, canonical_name, muscle_group, exercise_kind, places, is_active, recommended_display, instruction_1, instruction_2")
      .eq("is_active", true)
      .order("exercise_key"),
    supabase
      .from("exercise_collection_memberships")
      .select("exercise_key, collection_key, order_index")
      .order("collection_key")
      .order("order_index"),
    supabase
      .from("exercise_aliases")
      .select("exercise_id, alias_name, normalized_alias")
      .order("normalized_alias"),
    supabase
      .from("exercise_videos")
      .select("exercise_key, video_object_key, poster_object_key, mime_type, duration_seconds, width_pixels, height_pixels, file_size_bytes, is_active")
      .order("exercise_key"),
  ]);

  const firstError = [exerciseResult, membershipResult, aliasResult, videoResult]
    .find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const exerciseRows = (exerciseResult.data ?? []) as ExerciseRow[];
  const membershipRows = (membershipResult.data ?? []) as MembershipRow[];
  const aliasRows = (aliasResult.data ?? []) as AliasRow[];
  const videoRows = (videoResult.data ?? []) as VideoRow[];
  if (!exerciseRows.length) throw new Error("Catalogul activ nu a returnat niciun exercițiu.");

  const exerciseByKey = new Map<string, ExerciseRow>();
  const exerciseKeyById = new Map<string, string>();
  for (const exercise of exerciseRows) {
    if (!exercise.is_active || exerciseByKey.has(exercise.exercise_key)) {
      throw new Error(`Catalog invalid: exercise_key duplicat sau inactiv (${exercise.exercise_key}).`);
    }
    exerciseByKey.set(exercise.exercise_key, exercise);
    exerciseKeyById.set(exercise.id, exercise.exercise_key);
  }

  const membershipsByExercise = new Map<string, ExerciseCollectionMembership[]>();
  const membershipPairs = new Set<string>();
  const membershipOrders = new Set<string>();
  const ordersByCollection = new Map<string, number[]>();
  for (const membership of membershipRows) {
    if (!exerciseByKey.has(membership.exercise_key) || !isExerciseCollectionKey(membership.collection_key)) {
      throw new Error(`Catalog invalid: membership nerecunoscut pentru ${membership.exercise_key}.`);
    }
    const pair = `${membership.exercise_key}:${membership.collection_key}`;
    const order = `${membership.collection_key}:${membership.order_index}`;
    if (membershipPairs.has(pair) || membershipOrders.has(order) || membership.order_index < 1) {
      throw new Error(`Catalog invalid: membership/order duplicat pentru ${pair}.`);
    }
    membershipPairs.add(pair);
    membershipOrders.add(order);
    const item: ExerciseCollectionMembership = {
      collectionKey: membership.collection_key,
      orderIndex: membership.order_index,
    };
    membershipsByExercise.set(membership.exercise_key, [
      ...(membershipsByExercise.get(membership.exercise_key) ?? []),
      item,
    ]);
    ordersByCollection.set(membership.collection_key, [
      ...(ordersByCollection.get(membership.collection_key) ?? []),
      membership.order_index,
    ]);
  }

  for (const [collectionKey, orders] of ordersByCollection) {
    const sorted = [...orders].sort((left, right) => left - right);
    if (sorted.some((order, index) => order !== index + 1)) {
      throw new Error(`Catalog invalid: order_index nu este continuu în ${collectionKey}.`);
    }
  }

  const aliasesByExercise = new Map<string, string[]>();
  for (const alias of aliasRows) {
    const exerciseKey = exerciseKeyById.get(alias.exercise_id);
    if (!exerciseKey || !alias.alias_name.trim() || !alias.normalized_alias.trim()) {
      throw new Error("Catalog invalid: alias fără exercițiu activ sau text valid.");
    }
    aliasesByExercise.set(exerciseKey, [
      ...(aliasesByExercise.get(exerciseKey) ?? []),
      alias.alias_name.trim(),
    ]);
  }

  const videoStateByKey = normalizeAuthoritativeVideoEligibility({
    canonicalExerciseKeys: exerciseRows.map((exercise) => exercise.exercise_key),
    videoRows,
  });

  const exercises: CatalogExercise[] = exerciseRows.map((exercise) => {
    const memberships = membershipsByExercise.get(exercise.exercise_key) ?? [];
    if (!memberships.length) throw new Error(`Catalog invalid: ${exercise.exercise_key} nu aparține niciunei colecții.`);
    return {
      id: exercise.exercise_key,
      name: requiredText(exercise.canonical_name, "canonical_name", exercise.exercise_key),
      group: requiredText(exercise.muscle_group, "muscle_group", exercise.exercise_key),
      kind: validKind(exercise.exercise_kind, exercise.exercise_key),
      places: validPlaces(exercise.places, exercise.exercise_key),
      recommendedTarget: requiredText(exercise.recommended_display, "recommended_display", exercise.exercise_key),
      guidance1: requiredText(exercise.instruction_1, "instruction_1", exercise.exercise_key),
      guidance2: requiredText(exercise.instruction_2, "instruction_2", exercise.exercise_key),
      aliases: aliasesByExercise.get(exercise.exercise_key) ?? [],
      memberships: memberships.sort((left, right) => left.orderIndex - right.orderIndex),
      videoState: videoStateByKey.get(exercise.exercise_key) ?? "missing",
    };
  });

  const registryValidation = validateV2Registry(exercises, point2Registry);
  if (!registryValidation.valid) {
    throw new Error(`Catalogul activ și regulile V2 nu sunt sincronizate: ${registryValidation.issues.join(" ")}`);
  }

  return {
    source: "live",
    contractVersion: ACTIVE_CATALOG_CONTRACT_VERSION,
    exercises,
    collections: PUBLIC_COLLECTION_ORDER.filter((collectionKey) => ordersByCollection.has(collectionKey)),
    metrics: {
      activeExercises: exercises.length,
      memberships: membershipRows.length,
      aliases: aliasRows.length,
      videoAssociations: [...videoStateByKey.values()].filter((state) => state === "available").length,
    },
  };
}

export async function loadLiveExerciseCatalog(): Promise<ExerciseCatalogPayload> {
  return loadCatalogWithControlledRetry(loadLiveExerciseCatalogAttempt, { maxAttempts: 2 });
}
