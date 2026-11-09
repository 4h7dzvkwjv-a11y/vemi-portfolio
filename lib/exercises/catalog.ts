import { normalizeExerciseSearchText } from "./catalog-model";

export type { ExerciseKind, TrainingPlace } from "./catalog-model";
import type { ExerciseKind, TrainingPlace } from "./catalog-model";

export type CanonicalExercise = {
  exerciseKey: string;
  name: string;
  group: string;
  kind: ExerciseKind;
  places: TrainingPlace[];
};

export type ExerciseAlias = {
  alias: string;
  exerciseKey: string;
};

export const EXERCISE_CATALOG: CanonicalExercise[] = [
  // Piept · 13 exerciții
  { exerciseKey: "flotari", name: "Flotări", group: "Piept", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "flotari-genunchi", name: "Flotări cu sprijin pe genunchi", group: "Piept", kind: "forta", places: ["acasa"] },
  { exerciseKey: "impins-gantere", name: "Împins cu gantere", group: "Piept", kind: "forta", places: ["sala"] },
  { exerciseKey: "fluturari", name: "Fluturări la cablu", group: "Piept", kind: "forta", places: ["sala"] },
  { exerciseKey: "impins-banca-haltera", name: "Împins la bancă cu haltera", group: "Piept", kind: "forta", places: ["sala"] },
  { exerciseKey: "impins-inclinat-gantere", name: "Împins înclinat cu gantere", group: "Piept", kind: "forta", places: ["sala"] },
  { exerciseKey: "impins-inclinat-aparat", name: "Împins înclinat la aparat", group: "Piept", kind: "forta", places: ["sala"] },
  { exerciseKey: "impins-declinat-aparat", name: "Împins declinat la aparat", group: "Piept", kind: "forta", places: ["sala"] },
  { exerciseKey: "fluturari-gantere", name: "Fluturări cu gantere", group: "Piept", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "flotari-largi", name: "Flotări cu priză largă", group: "Piept", kind: "forta", places: ["acasa"] },
  { exerciseKey: "flotari-declinate", name: "Flotări declinate", group: "Piept", kind: "forta", places: ["acasa"] },
  { exerciseKey: "flotari-perete", name: "Flotări la perete", group: "Piept", kind: "forta", places: ["acasa"] },
  { exerciseKey: "chest-press", name: "Chest press la aparat", group: "Piept", kind: "forta", places: ["sala"] },

  // Spate · 13 exerciții
  { exerciseKey: "ramat-banda", name: "Ramat cu bandă elastică", group: "Spate", kind: "forta", places: ["acasa"] },
  { exerciseKey: "ramat-rucsac", name: "Ramat cu rucsacul", group: "Spate", kind: "forta", places: ["acasa"] },
  { exerciseKey: "superman", name: "Superman", group: "Spate", kind: "forta", places: ["acasa"] },
  { exerciseKey: "helcometru", name: "Tracțiuni la helcometru", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "ramat-cablu", name: "Ramat la cablu", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "ramat-aparat", name: "Ramat la aparat", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "tractiuni-bara", name: "Tracțiuni la bară", group: "Spate", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "tractiuni-asistate", name: "Tracțiuni asistate", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "ramat-gantera", name: "Ramat cu gantera", group: "Spate", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "ramat-haltera", name: "Ramat cu haltera", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "pullover-cablu", name: "Pullover la cablu", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "face-pull", name: "Face pull", group: "Spate", kind: "forta", places: ["sala"] },
  { exerciseKey: "reverse-snow-angels", name: "Reverse snow angels", group: "Spate", kind: "forta", places: ["acasa"] },

  // Picioare · 15 exerciții
  { exerciseKey: "genuflexiuni", name: "Genuflexiuni", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "genuflexiuni-goblet", name: "Genuflexiuni goblet", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "genuflexiuni-haltera", name: "Genuflexiuni cu haltera", group: "Picioare", kind: "forta", places: ["sala"] },
  { exerciseKey: "fandari", name: "Fandări", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "fandari-pe-loc", name: "Fandări pe loc", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "presa", name: "Presă pentru picioare", group: "Picioare", kind: "forta", places: ["sala"] },
  { exerciseKey: "podul", name: "Podul fesier", group: "Picioare", kind: "forta", places: ["acasa"] },
  { exerciseKey: "step-up", name: "Urcări pe treaptă", group: "Picioare", kind: "forta", places: ["acasa"] },
  { exerciseKey: "indreptari-romanesti", name: "Îndreptări românești", group: "Picioare", kind: "forta", places: ["sala"] },
  { exerciseKey: "genuflexiuni-sumo", name: "Genuflexiuni sumo", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "fandari-bulgaresti", name: "Fandări bulgărești", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "extensii-cvadriceps", name: "Extensii pentru cvadriceps", group: "Picioare", kind: "forta", places: ["sala"] },
  { exerciseKey: "flexii-femurali", name: "Flexii pentru femurali", group: "Picioare", kind: "forta", places: ["sala"] },
  { exerciseKey: "ridicari-varfuri", name: "Ridicări pe vârfuri", group: "Picioare", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "wall-sit", name: "Menținere la perete", group: "Picioare", kind: "forta", places: ["acasa"] },

  // Umeri · 9 exerciții
  { exerciseKey: "laterale", name: "Ridicări laterale", group: "Umeri", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "presa-pike", name: "Flotări Pike", group: "Umeri", kind: "forta", places: ["acasa"] },
  { exerciseKey: "presa-militara", name: "Presă militară cu haltera", group: "Umeri", kind: "forta", places: ["sala"] },
  { exerciseKey: "presa-umeri", name: "Presă pentru umeri", group: "Umeri", kind: "forta", places: ["sala"] },
  { exerciseKey: "presa-arnold", name: "Presă Arnold", group: "Umeri", kind: "forta", places: ["sala"] },
  { exerciseKey: "ridicari-frontale", name: "Ridicări frontale", group: "Umeri", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "fluturari-inverse", name: "Fluturări inverse", group: "Umeri", kind: "forta", places: ["sala"] },
  { exerciseKey: "tractiuni-verticale", name: "Tracțiuni verticale", group: "Umeri", kind: "forta", places: ["sala"] },
  { exerciseKey: "ytw-sol", name: "Y-T-W la sol", group: "Umeri", kind: "forta", places: ["acasa"] },

  // Biceps · 5 exerciții
  { exerciseKey: "biceps", name: "Flexii pentru biceps", group: "Biceps", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "flexii-gantere", name: "Flexii cu gantere", group: "Biceps", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "flexii-hammer", name: "Flexii hammer", group: "Biceps", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "flexii-cablu", name: "Flexii la cablu", group: "Biceps", kind: "forta", places: ["sala"] },
  { exerciseKey: "flexii-concentrate", name: "Flexii concentrate", group: "Biceps", kind: "forta", places: ["acasa", "sala"] },

  // Triceps · 6 exerciții
  { exerciseKey: "triceps", name: "Extensii pentru triceps", group: "Triceps", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "triceps-cablu", name: "Extensii triceps la cablu", group: "Triceps", kind: "forta", places: ["sala"] },
  { exerciseKey: "triceps-deasupra-capului", name: "Extensii deasupra capului", group: "Triceps", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "flotari-diamant", name: "Flotări diamant", group: "Triceps", kind: "forta", places: ["acasa"] },
  { exerciseKey: "dips-banca", name: "Dips la bancă", group: "Triceps", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "dips-paralele", name: "Dips la paralele", group: "Triceps", kind: "forta", places: ["sala"] },

  // Abdomen · 6 exerciții
  { exerciseKey: "plank", name: "Plank", group: "Abdomen", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "abdomene", name: "Abdomene", group: "Abdomen", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "dead-bug", name: "Dead bug", group: "Abdomen", kind: "forta", places: ["acasa"] },
  { exerciseKey: "crunch-bicicleta", name: "Crunch bicicletă", group: "Abdomen", kind: "forta", places: ["acasa"] },
  { exerciseKey: "ridicari-picioare", name: "Ridicări de picioare", group: "Abdomen", kind: "forta", places: ["acasa", "sala"] },
  { exerciseKey: "russian-twist", name: "Russian twist", group: "Abdomen", kind: "forta", places: ["acasa", "sala"] },

  // Cardio · 6 exerciții
  { exerciseKey: "bicicleta", name: "Bicicletă", group: "Cardio", kind: "cardio", places: ["acasa", "sala"] },
  { exerciseKey: "banda", name: "Bandă de alergare", group: "Cardio", kind: "cardio", places: ["sala"] },
  { exerciseKey: "mers", name: "Mers alert", group: "Cardio", kind: "cardio", places: ["acasa"] },
  { exerciseKey: "mountain-climbers", name: "Mountain climbers", group: "Cardio", kind: "cardio", places: ["acasa"] },
  { exerciseKey: "sarit-coarda", name: "Sărit coarda", group: "Cardio", kind: "cardio", places: ["acasa", "sala"] },
  { exerciseKey: "burpees", name: "Burpees", group: "Cardio", kind: "cardio", places: ["acasa", "sala"] },
];

export const EXERCISE_ALIASES: ExerciseAlias[] = [
  { alias: "Împins cu gantere la bancă", exerciseKey: "impins-gantere" },
  { alias: "Împins la piept cu gantere", exerciseKey: "impins-gantere" },
  { alias: "Flexii femurali", exerciseKey: "flexii-femurali" },
  { alias: "Flotări cu sprijin", exerciseKey: "flotari-genunchi" },
  { alias: "Extensii triceps la scaun", exerciseKey: "dips-banca" },
  { alias: "Flexii biceps", exerciseKey: "biceps" },
  { alias: "Împins la bancă", exerciseKey: "impins-banca-haltera" },
  { alias: "Tracțiuni", exerciseKey: "tractiuni-bara" },
  { alias: "Presă militară", exerciseKey: "presa-militara" },
  { alias: "Dips", exerciseKey: "dips-paralele" },
  { alias: "Ridicări pentru gambe", exerciseKey: "ridicari-varfuri" },
];

export function normalizeExerciseName(value: string) {
  return normalizeExerciseSearchText(value);
}

const catalogByKey = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.exerciseKey, exercise]));
const keyByName = new Map(EXERCISE_CATALOG.map((exercise) => [normalizeExerciseName(exercise.name), exercise.exerciseKey]));

for (const alias of EXERCISE_ALIASES) {
  keyByName.set(normalizeExerciseName(alias.alias), alias.exerciseKey);
}

export function getExerciseByKey(exerciseKey: string | null | undefined) {
  return exerciseKey ? catalogByKey.get(exerciseKey) : undefined;
}

export function resolveExerciseKey(exerciseKey?: string | null, exerciseName?: string | null) {
  if (exerciseKey && catalogByKey.has(exerciseKey)) return exerciseKey;
  if (!exerciseName) return undefined;
  return keyByName.get(normalizeExerciseName(exerciseName));
}
