export type TrainingPlace = "acasa" | "sala";
export type ExerciseKind = "forta" | "cardio";

export const CANONICAL_COLLECTION_ORDER = [
  "piept",
  "spate",
  "picioare",
  "umeri",
  "biceps",
  "triceps",
  "abdomen",
  "cardio",
] as const;

export const PUBLIC_COLLECTION_ORDER = [
  "acasa",
  ...CANONICAL_COLLECTION_ORDER,
] as const;

export type ExerciseCollectionKey = typeof PUBLIC_COLLECTION_ORDER[number];

export const EXERCISE_COLLECTION_LABELS: Record<ExerciseCollectionKey, string> = {
  acasa: "Acasă",
  piept: "Piept",
  spate: "Spate",
  picioare: "Picioare",
  umeri: "Umeri",
  biceps: "Biceps",
  triceps: "Triceps",
  abdomen: "Abdomen",
  cardio: "Cardio",
};

const COLLECTION_BY_MUSCLE_GROUP: Record<string, ExerciseCollectionKey> = {
  Piept: "piept",
  Spate: "spate",
  Picioare: "picioare",
  Umeri: "umeri",
  Biceps: "biceps",
  Triceps: "triceps",
  Abdomen: "abdomen",
  Cardio: "cardio",
};

export type ExerciseCollectionMembership = {
  collectionKey: ExerciseCollectionKey;
  orderIndex: number;
};

export type ExerciseVideoState = "available" | "missing" | "not-required" | "unknown";

export type CatalogExercise = {
  id: string;
  name: string;
  group: string;
  kind: ExerciseKind;
  places: TrainingPlace[];
  recommendedTarget: string;
  guidance1: string;
  guidance2: string;
  aliases: string[];
  memberships: ExerciseCollectionMembership[];
  videoState: ExerciseVideoState;
};

export type ExerciseCatalogPayload = {
  source: "live" | "static";
  contractVersion?: string;
  exercises: CatalogExercise[];
  collections: ExerciseCollectionKey[];
  metrics: {
    activeExercises: number;
    memberships: number;
    aliases: number;
    videoAssociations: number;
  };
};

export function isExerciseCollectionKey(value: string): value is ExerciseCollectionKey {
  return (PUBLIC_COLLECTION_ORDER as readonly string[]).includes(value);
}

export function normalizeExerciseSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function exerciseHasCollection(exercise: CatalogExercise, collectionKey: ExerciseCollectionKey) {
  return exercise.memberships.some((membership) => membership.collectionKey === collectionKey);
}

export function exerciseMembershipOrder(exercise: CatalogExercise, collectionKey: ExerciseCollectionKey) {
  return exercise.memberships.find((membership) => membership.collectionKey === collectionKey)?.orderIndex
    ?? Number.MAX_SAFE_INTEGER;
}

function canonicalCollection(exercise: CatalogExercise) {
  return COLLECTION_BY_MUSCLE_GROUP[exercise.group];
}

function canonicalSortTuple(exercise: CatalogExercise) {
  const collectionKey = canonicalCollection(exercise);
  if (collectionKey && exerciseHasCollection(exercise, collectionKey)) {
    return [
      CANONICAL_COLLECTION_ORDER.indexOf(collectionKey as typeof CANONICAL_COLLECTION_ORDER[number]),
      exerciseMembershipOrder(exercise, collectionKey),
    ] as const;
  }

  const firstMembership = [...exercise.memberships].sort((left, right) => {
    const rank = PUBLIC_COLLECTION_ORDER.indexOf(left.collectionKey) - PUBLIC_COLLECTION_ORDER.indexOf(right.collectionKey);
    return rank || left.orderIndex - right.orderIndex;
  })[0];
  return [
    firstMembership ? PUBLIC_COLLECTION_ORDER.indexOf(firstMembership.collectionKey) : Number.MAX_SAFE_INTEGER,
    firstMembership?.orderIndex ?? Number.MAX_SAFE_INTEGER,
  ] as const;
}

export function sortCatalogExercises(exercises: CatalogExercise[], collectionKey?: ExerciseCollectionKey) {
  return [...exercises].sort((left, right) => {
    if (collectionKey) {
      const order = exerciseMembershipOrder(left, collectionKey) - exerciseMembershipOrder(right, collectionKey);
      if (order) return order;
    } else {
      const leftTuple = canonicalSortTuple(left);
      const rightTuple = canonicalSortTuple(right);
      const groupOrder = leftTuple[0] - rightTuple[0];
      if (groupOrder) return groupOrder;
      const exerciseOrder = leftTuple[1] - rightTuple[1];
      if (exerciseOrder) return exerciseOrder;
    }
    return left.name.localeCompare(right.name, "ro");
  });
}

export function exerciseMatchesSearch(exercise: CatalogExercise, searchValue: string) {
  const search = normalizeExerciseSearchText(searchValue);
  if (!search) return true;
  return [exercise.name, ...exercise.aliases]
    .some((value) => normalizeExerciseSearchText(value).includes(search));
}

export function resolveCatalogExerciseKey(
  exercises: CatalogExercise[],
  exerciseKey?: string | null,
  exerciseName?: string | null,
) {
  if (exerciseKey && exercises.some((exercise) => exercise.id === exerciseKey)) return exerciseKey;
  if (!exerciseName) return undefined;
  const normalizedName = normalizeExerciseSearchText(exerciseName);
  return exercises.find((exercise) =>
    normalizeExerciseSearchText(exercise.name) === normalizedName
    || exercise.aliases.some((alias) => normalizeExerciseSearchText(alias) === normalizedName)
  )?.id;
}
