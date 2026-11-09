import { EXERCISE_ALIASES, EXERCISE_CATALOG } from "./catalog";
import {
  EXERCISE_COLLECTION_LABELS,
  PUBLIC_COLLECTION_ORDER,
  type ExerciseCatalogPayload,
  type ExerciseCollectionKey,
} from "./catalog-model";

const collectionByLabel = new Map(
  Object.entries(EXERCISE_COLLECTION_LABELS).map(([key, label]) => [label, key as ExerciseCollectionKey]),
);

const aliasesByExercise = new Map<string, string[]>();
for (const alias of EXERCISE_ALIASES) {
  aliasesByExercise.set(alias.exerciseKey, [...(aliasesByExercise.get(alias.exerciseKey) ?? []), alias.alias]);
}

const collectionCounters = new Map<ExerciseCollectionKey, number>();

export const STATIC_EXERCISE_CATALOG: ExerciseCatalogPayload = {
  source: "static",
  exercises: EXERCISE_CATALOG.map((exercise) => {
    const canonicalCollection = collectionByLabel.get(exercise.group);
    const membershipKeys = [
      ...(canonicalCollection ? [canonicalCollection] : []),
      ...(exercise.places.includes("acasa") ? ["acasa" as const] : []),
    ];
    const memberships = membershipKeys.map((collectionKey) => {
      const orderIndex = (collectionCounters.get(collectionKey) ?? 0) + 1;
      collectionCounters.set(collectionKey, orderIndex);
      return { collectionKey, orderIndex };
    });
    return {
      id: exercise.exerciseKey,
      name: exercise.name,
      group: exercise.group,
      kind: exercise.kind,
      places: exercise.places,
      recommendedTarget: exercise.kind === "cardio" ? "20–30 minute" : "8–12 repetări",
      guidance1: exercise.kind === "cardio"
        ? "Păstrează un ritm constant și o respirație controlată."
        : "Execută mișcarea lent și controlat, fără să grăbești repetările.",
      guidance2: exercise.kind === "cardio"
        ? "Ajustează intensitatea astfel încât să menții o tehnică sigură."
        : "Menține poziția stabilă și controlează revenirea pe toată amplitudinea.",
      aliases: aliasesByExercise.get(exercise.exerciseKey) ?? [],
      memberships,
      videoState: "unknown" as const,
    };
  }),
  collections: [...PUBLIC_COLLECTION_ORDER],
  metrics: {
    activeExercises: EXERCISE_CATALOG.length,
    memberships: [...collectionCounters.values()].reduce((total, count) => total + count, 0),
    aliases: EXERCISE_ALIASES.length,
    videoAssociations: 0,
  },
};
