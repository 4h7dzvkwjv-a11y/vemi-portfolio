"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VemiNavigationDrawer } from "./vemi-navigation-drawer";
import { VemiHomepageMobile } from "./vemi-homepage-mobile";
import { WorkoutNavigationLink } from "./workout-navigation-link";
import Link from "next/link";
import { ExerciseVideo } from "./exercise-video";
import Image from "next/image";
import { ExerciseLibraryCard } from "./exercise-library-card";
import {
  EXERCISE_COLLECTION_LABELS,
  exerciseHasCollection,
  exerciseMatchesSearch,
  resolveCatalogExerciseKey,
  sortCatalogExercises,
  type CatalogExercise,
  type ExerciseCatalogPayload,
  type ExerciseCollectionKey,
  type ExerciseKind,
  type TrainingPlace,
} from "../lib/exercises/catalog-model";
import {
  ACTIVE_CATALOG_CONTRACT_VERSION,
  createCatalogRequestGate,
  fetchActiveCatalog,
  validateActiveCatalogPayload,
} from "../lib/exercises/catalog-delivery.mjs";
import point2RegistryData from "../data/plan-engine/v2/exercise-rules.json";
import {
  type V2RuleRegistry,
} from "../lib/plan-engine/v2-runtime.mjs";
import {
  publicProgramsForAge,
  projectPublicV2Week,
  resolvePublicV2Plan,
} from "../lib/plan-engine/public-v2-integration.mjs";
import {
  cancelPendingFreePlanMutations,
  clearAuthenticatedFreePlanResetMarker,
  deleteCloudCustomWorkout,
  finishCloudCustomWorkout,
  flushPendingProgressMutations,
  loadCloudProgress,
  markAuthenticatedFreePlanResetPending,
  onProgressSessionChange,
  pendingProgressMutationCount,
  readAuthenticatedProgressCache,
  readAuthenticatedFreePlanResetMarker,
  saveCloudCustomWorkout,
  saveCloudFreePlan,
  saveCloudFreeWorkout,
  unlockCloudCustomWorkout,
  writeAuthenticatedProgressCache,
} from "../utils/progress/client";
import {
  ensureLocalProgressMigration,
  readPendingAnonymousProgress,
  saveAnonymousProgress,
} from "../utils/progress/anonymous";
import {
  createFreePlanGenerationGate,
  createPlanInstanceId,
  finalizeFreePlanSelections,
  invalidateFinalFreePlanSelection,
  normalizeFreePlanSelectionsForCurrentContent,
  resetActiveFreePlanSnapshot,
  shouldApplyFreePlanHydration,
} from "../utils/progress/free-plan-state.mjs";

type Choice = { label: string; value: string; note?: string };
type Selections = {
  gender?: string;
  age?: string;
  goal?: string;
  program?: string;
  place?: "acasa" | "sala";
  engineVersion?: "v1" | "v2";
  planInstanceId?: string;
  contentVersion?: string;
};

type SelectionStepKey = "gender" | "age" | "goal" | "place" | "program";

type LibraryExercise = CatalogExercise;

type PlannedExercise = {
  exerciseKey: string;
  name: string;
  target: string;
  rest?: string;
};

type BuilderExercise = {
  id: string;
  uid: string;
  name: string;
  group: string;
  kind: ExerciseKind;
  places: TrainingPlace[];
  sets: number;
  reps: number;
  weight: number;
  minutes: number;
};

type SavedWorkout = {
  id: string;
  name: string;
  place: TrainingPlace;
  exercises: BuilderExercise[];
  completions: number;
  lastCompleted?: string;
};

type WorkoutLog = {
  id: string;
  workoutId?: string;
  workoutName: string;
  place?: TrainingPlace;
  completedAt: string;
  exerciseCount: number;
  cardioMinutes: number;
  exercises?: Array<{ name: string; group: string; details: string }>;
};

type AccountPromptState = {
  version: 3;
  shownMilestones: string[];
};

function formatWorkoutActivityDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

const ACCOUNT_PROMPT_KEY = "vemi-account-prompt";
const point2Registry = point2RegistryData as V2RuleRegistry;

function hasFinishedWeek(items: string[], place: TrainingPlace, week: number, days: string[]) {
  return days.every((day) => items.includes(`w${week}-${place}-${day}`));
}

function getAccountPromptMilestone(selections: Selections, week: number) {
  const profile = [selections.gender, selections.age, selections.goal, selections.program, selections.place];
  if (profile.some((value) => !value)) return null;
  return `${profile.join(":")}:week-${week}`;
}

function readAccountPromptState(): AccountPromptState {
  try {
    const saved = localStorage.getItem(ACCOUNT_PROMPT_KEY);
    const parsed = saved ? JSON.parse(saved) as Partial<AccountPromptState> : null;
    if (parsed?.version === 3 && Array.isArray(parsed.shownMilestones)) {
      return {
        version: 3,
        shownMilestones: parsed.shownMilestones.filter((milestone) => typeof milestone === "string"),
      };
    }
  } catch {
    localStorage.removeItem(ACCOUNT_PROMPT_KEY);
  }
  return { version: 3, shownMilestones: [] };
}

function saveAccountPromptState(state: AccountPromptState) {
  localStorage.setItem(ACCOUNT_PROMPT_KEY, JSON.stringify(state));
}

const steps: Array<{
  key: SelectionStepKey;
  eyebrow: string;
  title: string;
  choices: Choice[];
}> = [
  {
    key: "gender",
    eyebrow: "Pasul 1 din 5",
    title: "Alege categoria",
    choices: [
      { label: "Masculin", value: "masculin", note: "Programe adaptate profilului masculin" },
      { label: "Feminin", value: "feminin", note: "Programe adaptate profilului feminin" },
    ],
  },
  {
    key: "age",
    eyebrow: "Pasul 2 din 5",
    title: "Selectează vârsta",
    choices: [
      { label: "18–29", value: "cat1" },
      { label: "30–44", value: "cat2" },
      { label: "45–60", value: "cat3" },
      { label: "60+", value: "cat4" },
    ],
  },
  {
    key: "goal",
    eyebrow: "Pasul 3 din 5",
    title: "Care este obiectivul tău?",
    choices: [
      { label: "Masă musculară", value: "masa", note: "Forță, volum și progresie" },
      { label: "Slăbire", value: "slabire", note: "Mișcare eficientă și consecvență" },
      { label: "Menținere", value: "forma", note: "Energie, mobilitate și tonus" },
    ],
  },
  {
    key: "place",
    eyebrow: "Pasul 4 din 5",
    title: "Unde vrei să te antrenezi?",
    choices: [
      { label: "Acasă", value: "acasa", note: "Exerciții simple, fără aparate" },
      { label: "La sală", value: "sala", note: "Exerciții cu aparate și greutăți" },
    ],
  },
  {
    key: "program",
    eyebrow: "Pasul 5 din 5",
    title: "Alege nivelul și ritmul potrivit",
    choices: [
      { label: "Începător — 3 zile", value: "incepator-3", note: "Un început simplu și sustenabil" },
      { label: "Începător — 4 zile", value: "incepator-4", note: "Mai multă varietate, ritm moderat" },
      { label: "Avansat — 4 zile", value: "avansat-4", note: "Volum și progresie structurată" },
      { label: "Avansat — 5 zile", value: "avansat-5", note: "Frecvență ridicată și focus precis" },
    ],
  },
];

const v2AgeCategoryByStoredValue: Record<string, string> = {
  cat1: "cat1",
  cat2: "cat2",
  cat3: "cat3",
  cat4: "cat4",
  "18-29": "cat1",
  "18-30": "cat1",
  "30-44": "cat2",
  "30-45": "cat2",
  "45-59": "cat3",
  "45-60": "cat3",
  "60+": "cat4",
};

function normalizePersistedSelections(input: Selections | undefined): Selections {
  let parsed = { ...(input ?? {}) };
  if (parsed.engineVersion === "v2" && parsed.age) {
    parsed.age = v2AgeCategoryByStoredValue[parsed.age] ?? parsed.age;
  } else if (parsed.age) {
    const legacyAgeRanges: Record<string, string> = {
      "18-30": "18-29",
      "30-45": "30-44",
      "45-60": "45-59",
    };
    parsed.age = legacyAgeRanges[parsed.age] ?? parsed.age;
  }
  if (parsed.engineVersion === "v2" && parsed.program) {
    const allowedPrograms = new Set<string>(publicProgramsForAge(parsed.age));
    if (!allowedPrograms.has(parsed.program)) {
      parsed.program = undefined;
      parsed.planInstanceId = undefined;
      parsed.contentVersion = undefined;
    }
  }
  parsed = normalizeFreePlanSelectionsForCurrentContent(parsed);
  return parsed;
}

function selectedChoiceLabel(step: (typeof steps)[number], value: string) {
  const normalizedValue = step.key === "age" ? v2AgeCategoryByStoredValue[value] ?? value : value;
  return step.choices.find((choice) => choice.value === normalizedValue)?.label;
}

const gymWorkouts: Array<{ day: string; focus: string; duration: string; exercises: PlannedExercise[] }> = [
  {
    day: "Ziua 1",
    focus: "Piept, umeri și triceps",
    duration: "48 min",
    exercises: [
      { exerciseKey: "impins-gantere", name: "Împins cu gantere la bancă", target: "4 × 10", rest: "90 sec" },
      { exerciseKey: "impins-inclinat-aparat", name: "Împins înclinat la aparat", target: "3 × 12", rest: "75 sec" },
      { exerciseKey: "laterale", name: "Ridicări laterale", target: "3 × 15", rest: "60 sec" },
      { exerciseKey: "triceps-cablu", name: "Extensii triceps la cablu", target: "3 × 12", rest: "60 sec" },
    ],
  },
  {
    day: "Ziua 2",
    focus: "Spate și biceps",
    duration: "52 min",
    exercises: [
      { exerciseKey: "helcometru", name: "Tracțiuni la helcometru", target: "4 × 10", rest: "90 sec" },
      { exerciseKey: "ramat-cablu", name: "Ramat la cablu", target: "3 × 12", rest: "75 sec" },
      { exerciseKey: "pullover-cablu", name: "Pullover la cablu", target: "3 × 12", rest: "60 sec" },
      { exerciseKey: "flexii-gantere", name: "Flexii cu gantere", target: "3 × 12", rest: "60 sec" },
    ],
  },
  {
    day: "Ziua 3",
    focus: "Picioare și abdomen",
    duration: "55 min",
    exercises: [
      { exerciseKey: "presa", name: "Presă pentru picioare", target: "4 × 10", rest: "90 sec" },
      { exerciseKey: "indreptari-romanesti", name: "Îndreptări românești", target: "3 × 10", rest: "90 sec" },
      { exerciseKey: "flexii-femurali", name: "Flexii femurali", target: "3 × 12", rest: "60 sec" },
      { exerciseKey: "plank", name: "Plank", target: "3 × 40 sec", rest: "45 sec" },
    ],
  },
];

const homeWorkouts: Array<{ day: string; focus: string; duration: string; exercises: PlannedExercise[] }> = [
  {
    day: "Ziua 1",
    focus: "Tot corpul",
    duration: "35 min",
    exercises: [
      { exerciseKey: "genuflexiuni", name: "Genuflexiuni", target: "3 × 12", rest: "60 sec" },
      { exerciseKey: "flotari", name: "Flotări", target: "3 × 8", rest: "60 sec" },
      { exerciseKey: "podul", name: "Podul fesier", target: "3 × 15", rest: "45 sec" },
      { exerciseKey: "plank", name: "Plank", target: "3 × 30 sec", rest: "45 sec" },
    ],
  },
  {
    day: "Ziua 2",
    focus: "Picioare și cardio",
    duration: "40 min",
    exercises: [
      { exerciseKey: "fandari-pe-loc", name: "Fandări pe loc", target: "3 × 10", rest: "60 sec" },
      { exerciseKey: "genuflexiuni-sumo", name: "Genuflexiuni sumo", target: "3 × 12", rest: "60 sec" },
      { exerciseKey: "ridicari-varfuri", name: "Ridicări pe vârfuri", target: "3 × 18", rest: "45 sec" },
      { exerciseKey: "mers", name: "Mers alert", target: "20 min", rest: "Ritm moderat" },
    ],
  },
  {
    day: "Ziua 3",
    focus: "Partea superioară și abdomen",
    duration: "35 min",
    exercises: [
      { exerciseKey: "flotari-genunchi", name: "Flotări cu sprijin", target: "3 × 10", rest: "60 sec" },
      { exerciseKey: "ramat-rucsac", name: "Ramat cu rucsacul", target: "3 × 12", rest: "60 sec" },
      { exerciseKey: "dips-banca", name: "Extensii triceps la scaun", target: "3 × 10", rest: "60 sec" },
      { exerciseKey: "dead-bug", name: "Dead bug", target: "3 × 10", rest: "45 sec" },
    ],
  },
];

const goalLabels: Record<string, string> = {
  masa: "Masă musculară",
  slabire: "Slăbire",
  forma: "Menținere",
};

const ageLabels: Record<string, string> = {
  cat1: "18–29",
  cat2: "30–44",
  cat3: "45–60",
  cat4: "60+",
  "18-29": "18–29",
  "30-44": "30–44",
  "45-59": "45–60",
  "60+": "60+",
};

const programLabels: Record<string, string> = {
  "incepator-3": "Începător · 3 zile/săptămână",
  "incepator-4": "Începător · 4 zile/săptămână",
  "avansat-4": "Avansat · 4 zile/săptămână",
  "avansat-5": "Avansat · 5 zile/săptămână",
};

const placeLabels: Record<TrainingPlace, string> = {
  acasa: "Acasă",
  sala: "La sală",
};

const demoWorkout: SavedWorkout = {
  id: "vemi-demo",
  name: "Full body · Start ușor",
  place: "acasa",
  completions: 0,
  exercises: [
    { id: "genuflexiuni", uid: "demo-genuflexiuni", name: "Genuflexiuni", group: "Picioare", kind: "forta", places: ["acasa", "sala"], sets: 3, reps: 12, weight: 0, minutes: 0 },
    { id: "flotari", uid: "demo-flotari", name: "Flotări", group: "Piept", kind: "forta", places: ["acasa", "sala"], sets: 3, reps: 10, weight: 0, minutes: 0 },
    { id: "ramat-banda", uid: "demo-ramat", name: "Ramat cu bandă elastică", group: "Spate", kind: "forta", places: ["acasa"], sets: 3, reps: 12, weight: 0, minutes: 0 },
    { id: "plank", uid: "demo-plank", name: "Plank", group: "Abdomen", kind: "forta", places: ["acasa", "sala"], sets: 3, reps: 30, weight: 0, minutes: 0 },
    { id: "mers", uid: "demo-mers", name: "Mers alert", group: "Cardio", kind: "cardio", places: ["acasa"], sets: 0, reps: 0, weight: 0, minutes: 15 },
  ],
};

const notebookDays = [
  {
    day: "Ziua 1",
    title: "Partea superioară",
    level: "Începător",
    duration: "45 min",
    rest: "60–90 sec",
    purpose: "Dezvoltarea părții superioare și creșterea forței generale.",
    groups: "Piept, spate, umeri, biceps și triceps.",
    recommendation: "Alege greutăți moderate și concentrează-te pe execuția corectă.",
    tip: "Hidratează-te, odihnește-te și păstrează un ritm constant.",
    exercises: [
      { exerciseKey: "impins-gantere", name: "Împins la piept cu gantere", target: "3 × 10" },
      { exerciseKey: "ramat-aparat", name: "Ramat la aparat", target: "3 × 12" },
      { exerciseKey: "presa-umeri", name: "Presă pentru umeri", target: "3 × 10" },
      { exerciseKey: "tractiuni-asistate", name: "Tracțiuni asistate", target: "3 × 10" },
      { exerciseKey: "biceps", name: "Flexii biceps", target: "2 × 12" },
      { exerciseKey: "triceps-cablu", name: "Extensii triceps la cablu", target: "2 × 12" },
    ] satisfies PlannedExercise[],
  },
  {
    day: "Ziua 2",
    title: "Partea inferioară",
    level: "Începător",
    duration: "48 min",
    rest: "60–90 sec",
    purpose: "Întărirea picioarelor și construirea unei baze stabile pentru progres.",
    groups: "Cvadricepși, fesieri, femurali, gambe și abdomen.",
    recommendation: "Lucrează controlat și oprește setul dacă forma începe să se piardă.",
    tip: "Mișcă-te în ritmul tău. Repetările curate contează mai mult decât viteza.",
    exercises: [
      { exerciseKey: "genuflexiuni-goblet", name: "Genuflexiuni goblet", target: "3 × 12" },
      { exerciseKey: "presa", name: "Presă pentru picioare", target: "3 × 12" },
      { exerciseKey: "fandari-pe-loc", name: "Fandări pe loc", target: "3 × 10" },
      { exerciseKey: "flexii-femurali", name: "Flexii femurali", target: "3 × 12" },
      { exerciseKey: "ridicari-varfuri", name: "Ridicări pe vârfuri", target: "3 × 15" },
      { exerciseKey: "plank", name: "Plank", target: "3 × 30 sec" },
    ] satisfies PlannedExercise[],
  },
  {
    day: "Ziua 3",
    title: "Partea superioară",
    level: "Avansat",
    duration: "58 min",
    rest: "75–120 sec",
    purpose: "Creșterea forței și a volumului prin mișcări compuse și controlate.",
    groups: "Piept, spate, umeri, biceps și triceps.",
    recommendation: "Păstrează una sau două repetări în rezervă la seturile grele.",
    tip: "Calitatea fiecărui set îți susține progresul pe termen lung.",
    exercises: [
      { exerciseKey: "impins-banca-haltera", name: "Împins la bancă", target: "4 × 8" },
      { exerciseKey: "tractiuni-bara", name: "Tracțiuni", target: "4 × 8" },
      { exerciseKey: "ramat-haltera", name: "Ramat cu haltera", target: "4 × 10" },
      { exerciseKey: "presa-militara", name: "Presă militară", target: "3 × 8" },
      { exerciseKey: "dips-paralele", name: "Dips", target: "3 × 10" },
      { exerciseKey: "face-pull", name: "Face pull", target: "3 × 15" },
    ] satisfies PlannedExercise[],
  },
  {
    day: "Ziua 4",
    title: "Partea inferioară",
    level: "Avansat",
    duration: "62 min",
    rest: "90–120 sec",
    purpose: "Dezvoltarea forței picioarelor și îmbunătățirea stabilității întregului corp.",
    groups: "Cvadricepși, fesieri, femurali, gambe și trunchi.",
    recommendation: "Începe cu o încălzire completă și păstrează trunchiul stabil.",
    tip: "Nu grăbi greutățile. Progresul bun rămâne controlat și repetabil.",
    exercises: [
      { exerciseKey: "genuflexiuni-haltera", name: "Genuflexiuni cu haltera", target: "4 × 8" },
      { exerciseKey: "indreptari-romanesti", name: "Îndreptări românești", target: "4 × 10" },
      { exerciseKey: "presa", name: "Presă pentru picioare", target: "3 × 12" },
      { exerciseKey: "fandari-bulgaresti", name: "Fandări bulgărești", target: "3 × 10" },
      { exerciseKey: "flexii-femurali", name: "Flexii femurali", target: "3 × 12" },
      { exerciseKey: "ridicari-varfuri", name: "Ridicări pentru gambe", target: "4 × 15" },
    ] satisfies PlannedExercise[],
  },
] as const;

function normalizeSavedWorkout(workout: SavedWorkout, exerciseLibrary: LibraryExercise[]): SavedWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      id: resolveCatalogExerciseKey(exerciseLibrary, exercise.id, exercise.name) ?? exercise.id,
    })),
  };
}

type VemiPageProps = {
  plansOnly?: boolean;
  workoutOnly?: boolean;
  exerciseOnly?: boolean;
  subscriptionsOnly?: boolean;
  exerciseCatalog: ExerciseCatalogPayload | null;
};

export function VemiPage({
  plansOnly = false,
  workoutOnly = false,
  exerciseOnly = false,
  subscriptionsOnly = false,
  exerciseCatalog: initialExerciseCatalog,
}: VemiPageProps) {
  const requiresActiveCatalog = plansOnly || workoutOnly || exerciseOnly;
  const validatedInitialCatalog = useMemo(() => {
    if (!requiresActiveCatalog) return initialExerciseCatalog;
    const validation = validateActiveCatalogPayload(initialExerciseCatalog);
    return validation.valid ? validation.payload : null;
  }, [initialExerciseCatalog, requiresActiveCatalog]);
  const [exerciseCatalog, setExerciseCatalog] = useState<ExerciseCatalogPayload | null>(validatedInitialCatalog);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">(
    validatedInitialCatalog ? "ready" : requiresActiveCatalog ? "loading" : "ready",
  );
  const [catalogError, setCatalogError] = useState("");
  const catalogRequestGateRef = useRef(createCatalogRequestGate());
  const catalogAbortRef = useRef<AbortController | null>(null);
  const catalogReadyForV2 = catalogStatus === "ready"
    && exerciseCatalog?.source === "live"
    && exerciseCatalog.contractVersion === ACTIVE_CATALOG_CONTRACT_VERSION;
  const exerciseLibrary = useMemo(() => exerciseCatalog?.exercises ?? [], [exerciseCatalog]);
  const liveExerciseLibrary = useMemo(
    () => catalogReadyForV2 ? exerciseLibrary : [],
    [catalogReadyForV2, exerciseLibrary],
  );
  const catalogLoading = requiresActiveCatalog && catalogStatus === "loading";
  const catalogUnavailable = requiresActiveCatalog && catalogStatus === "error";
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Selections>({});
  const [v2Resolution, setV2Resolution] = useState<ReturnType<typeof resolvePublicV2Plan> | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [activeWeek, setActiveWeek] = useState(1);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [notebookDayIndex, setNotebookDayIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [trainingPlace, setTrainingPlace] = useState<TrainingPlace>("sala");
  const [workoutName, setWorkoutName] = useState("");
  const [builderExercises, setBuilderExercises] = useState<BuilderExercise[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseGroup, setExerciseGroup] = useState<"toate" | ExerciseCollectionKey>("toate");
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [builderMessage, setBuilderMessage] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "quarterly">("monthly");
  const [selectedSubscription, setSelectedSubscription] = useState<"go" | "plus" | null>(null);
  const [publicExerciseGroup, setPublicExerciseGroup] = useState<"toate" | ExerciseCollectionKey>("toate");
  const [publicExerciseSearch, setPublicExerciseSearch] = useState("");
  const [cloudAuthenticated, setCloudAuthenticated] = useState<boolean | null>(null);
  const [cloudSyncMessage, setCloudSyncMessage] = useState("");
  const generationGateRef = useRef(createFreePlanGenerationGate());
  const freePlanHydrationEpochRef = useRef(0);
  const selectionFlowActiveRef = useRef(false);

  const loadCatalogFromSameOrigin = useCallback(async () => {
    const token = catalogRequestGateRef.current.begin();
    catalogAbortRef.current?.abort();
    const controller = new AbortController();
    catalogAbortRef.current = controller;
    setCatalogStatus("loading");
    setCatalogError("");
    try {
      const nextCatalog = await fetchActiveCatalog({
        maxAttempts: 2,
        signal: controller.signal,
      });
      if (!catalogRequestGateRef.current.isCurrent(token)) return false;
      setExerciseCatalog(nextCatalog);
      setCatalogStatus("ready");
      return true;
    } catch (error) {
      if (controller.signal.aborted || !catalogRequestGateRef.current.isCurrent(token)) return false;
      setExerciseCatalog(null);
      setCatalogStatus("error");
      setCatalogError(error instanceof Error ? error.message : "Catalogul activ nu poate fi încărcat.");
      return false;
    } finally {
      if (catalogAbortRef.current === controller) catalogAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!requiresActiveCatalog || validatedInitialCatalog) return;
    const requestGate = catalogRequestGateRef.current;
    const startRequest = window.setTimeout(() => void loadCatalogFromSameOrigin(), 0);
    return () => {
      window.clearTimeout(startRequest);
      requestGate.invalidate();
      catalogAbortRef.current?.abort();
    };
  }, [loadCatalogFromSameOrigin, requiresActiveCatalog, validatedInitialCatalog]);

  /* Browser-saved plans are restored only after the client mounts. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    ensureLocalProgressMigration();
    const query = new URLSearchParams(window.location.search);
    const requestedWeek = Number(query.get("week"));

    const applyHydratedFreePlan = (
      rawSelections: Selections | undefined,
      savedWeek: number,
      savedCompleted: string[],
    ) => {
      const parsed = normalizePersistedSelections(rawSelections);
      const resetStaleProgress = Boolean(rawSelections?.program && !parsed.program);
      const firstIncompleteStep = steps.findIndex((step) => !parsed[step.key]);
      const hasCompleteSelection = firstIncompleteStep === -1 && Boolean(parsed.place && parsed.program);
      setSelections(parsed);
      setStepIndex(hasCompleteSelection ? 0 : Math.max(0, firstIncompleteStep));
      setActiveWeek(requestedWeek || savedWeek || 1);
      setCompleted(resetStaleProgress ? [] : savedCompleted);
      if (!hasCompleteSelection) {
        setV2Resolution(null);
        setShowPlan(false);
        return;
      }
      if (parsed.engineVersion === "v2") {
        const restoredResolution = resolvePublicV2Plan(
          parsed,
          liveExerciseLibrary,
          point2Registry,
        );
        setV2Resolution(restoredResolution);
        setShowPlan(restoredResolution.status === "found");
      } else {
        setV2Resolution(null);
        setShowPlan(true);
      }
    };

    const anonymous = readPendingAnonymousProgress();
    if (anonymous) {
      applyHydratedFreePlan(anonymous.selections as Selections | undefined, anonymous.activeWeek, anonymous.completed);
      setSavedWorkouts(anonymous.workouts.map((workout) => normalizeSavedWorkout(workout, exerciseLibrary)));
      setWorkoutLogs(anonymous.logs);
    }
    if (workoutOnly && new URLSearchParams(window.location.search).get("creator") === "1") {
      setBuilderOpen(true);
      window.setTimeout(() => document.getElementById("creator")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
    if (plansOnly && requestedWeek >= 1 && requestedWeek <= 4) setActiveWeek(requestedWeek);

    let disposed = false;
    let synchronizing = false;

    const synchronizeProgress = async () => {
      if (synchronizing) return;
      synchronizing = true;
      const requestEpoch = freePlanHydrationEpochRef.current;
      try {
        let cloud = await loadCloudProgress();
        if (disposed) return;
        setCloudAuthenticated(cloud.authenticated);
        if (!cloud.authenticated) {
          const guest = readPendingAnonymousProgress();
          if (shouldApplyFreePlanHydration(
            requestEpoch,
            freePlanHydrationEpochRef.current,
            selectionFlowActiveRef.current,
          )) {
            applyHydratedFreePlan(guest?.selections as Selections | undefined, guest?.activeWeek ?? 1, guest?.completed ?? []);
          }
          applyHydratedWorkouts(guest?.workouts ?? []);
          setWorkoutLogs(guest?.logs ?? []);
          setCloudSyncMessage("");
          return;
        }

        await flushPendingProgressMutations();
        cloud = await loadCloudProgress();
        if (disposed) return;
        const pending = pendingProgressMutationCount();
        const cached = readAuthenticatedProgressCache();
        const resetMarker = readAuthenticatedFreePlanResetMarker();
        const resetConfirmed = Boolean(
          resetMarker?.planInstanceId
          && resetMarker.planInstanceId === cloud.selections?.planInstanceId,
        );
        if (resetConfirmed) {
          clearAuthenticatedFreePlanResetMarker(resetMarker?.planInstanceId);
          selectionFlowActiveRef.current = false;
        }
        if (resetMarker && !resetConfirmed) {
          selectionFlowActiveRef.current = true;
          applyHydratedFreePlan(
            cached?.selections as Selections | undefined,
            cached?.activeWeek ?? 1,
            cached?.completed ?? [],
          );
          applyHydratedWorkouts(cloud.workouts);
          setWorkoutLogs(cloud.logs);
          setCloudSyncMessage("Noul plan este păstrat local și va fi sincronizat fără a restaura progresul vechi.");
          return;
        }
        const visible = pending > 0 && cached ? cached : cloud;
        if (shouldApplyFreePlanHydration(
          requestEpoch,
          freePlanHydrationEpochRef.current,
          selectionFlowActiveRef.current,
        )) {
          applyHydratedFreePlan(visible.selections as Selections | undefined, visible.activeWeek, visible.completed);
        }
        applyHydratedWorkouts(visible.workouts);
        setWorkoutLogs(visible.logs);
        if (!pending) {
          writeAuthenticatedProgressCache({
            selections: cloud.selections,
            activeWeek: cloud.activeWeek,
            completed: cloud.completed,
            workouts: cloud.workouts,
            logs: cloud.logs,
          });
        }
        setCloudSyncMessage(pending
          ? "Salvarea în cloud va fi reîncercată automat. Datele tale autentificate au rămas păstrate în siguranță."
          : "");
      } catch {
        if (!disposed) {
          const cached = readAuthenticatedProgressCache();
          if (cached) {
            setCloudAuthenticated(true);
            const resetMarker = readAuthenticatedFreePlanResetMarker();
            if (resetMarker || shouldApplyFreePlanHydration(
              requestEpoch,
              freePlanHydrationEpochRef.current,
              selectionFlowActiveRef.current,
            )) {
              applyHydratedFreePlan(cached.selections as Selections | undefined, cached.activeWeek, cached.completed);
            }
            applyHydratedWorkouts(cached.workouts);
            setWorkoutLogs(cached.logs);
          } else {
            applyHydratedWorkouts(readPendingAnonymousProgress()?.workouts ?? []);
          }
          setCloudSyncMessage("Salvarea în cloud nu este disponibilă momentan. Operațiunile contului au rămas în coadă și vor fi reîncercate.");
        }
      } finally {
        synchronizing = false;
        if (!disposed) setProgressHydrated(true);
      }
    };

    const applyHydratedWorkouts = (workouts: SavedWorkout[]) => {
      const normalized = workouts.map((workout) => normalizeSavedWorkout(workout, exerciseLibrary));
      setSavedWorkouts(normalized);
      if (workoutOnly && normalized.length === 0) setBuilderOpen(true);
    };

    void synchronizeProgress();
    const resumeSync = () => {
      if (document.visibilityState === "visible") void synchronizeProgress();
    };
    const unsubscribeAuth = onProgressSessionChange(() => void synchronizeProgress());
    document.addEventListener("visibilitychange", resumeSync);
    window.addEventListener("pageshow", resumeSync);
    window.addEventListener("focus", resumeSync);
    return () => {
      disposed = true;
      unsubscribeAuth();
      document.removeEventListener("visibilitychange", resumeSync);
      window.removeEventListener("pageshow", resumeSync);
      window.removeEventListener("focus", resumeSync);
    };
  }, [exerciseLibrary, liveExerciseLibrary, plansOnly, workoutOnly]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!programModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProgramModalOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [programModalOpen]);

  useEffect(() => {
    if (!workoutOnly || !savedWorkouts.length) return;
    const requestedWorkout = new URLSearchParams(window.location.search).get("workout");
    if (!requestedWorkout || !savedWorkouts.some((workout) => workout.id === requestedWorkout)) return;
    window.setTimeout(() => {
      setSelectedWorkoutId(requestedWorkout);
      document.getElementById("carnet-antrenament")?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 60);
  }, [savedWorkouts, workoutOnly]);

  const planEngineVersion = selections.engineVersion === "v2" ? "v2" : "v1";
  const legacyPlanWorkouts = selections.place === "acasa" ? homeWorkouts : gymWorkouts;
  const planWorkouts = v2Resolution?.status === "found"
    ? projectPublicV2Week(v2Resolution.plan, activeWeek)
    : planEngineVersion === "v1" ? legacyPlanWorkouts : [];
  const planGenerationUnavailable = planEngineVersion === "v2" && v2Resolution?.status !== "found";

  const progress = useMemo(
    () => planWorkouts.length
      ? Math.min(100, Math.round((completed.filter((item) => {
        const match = item.match(/^w[1-4]-(acasa|sala)-Ziua ([1-5])$/);
        return match?.[1] === selections.place && Number(match[2]) <= planWorkouts.length;
      }).length / (planWorkouts.length * 4)) * 100))
      : 0,
    [completed, planWorkouts.length, selections.place],
  );

  function persistAnonymousState(overrides: Partial<{
    selections: Selections;
    activeWeek: number;
    completed: string[];
    workouts: SavedWorkout[];
    logs: WorkoutLog[];
  }> = {}) {
    saveAnonymousProgress({
      selections: overrides.selections ?? selections,
      activeWeek: overrides.activeWeek ?? activeWeek,
      completed: overrides.completed ?? completed,
      workouts: overrides.workouts ?? savedWorkouts,
      logs: overrides.logs ?? workoutLogs,
    });
  }

  function persistAuthenticatedState(overrides: Partial<{
    selections: Selections;
    activeWeek: number;
    completed: string[];
    workouts: SavedWorkout[];
    logs: WorkoutLog[];
  }> = {}) {
    writeAuthenticatedProgressCache({
      selections: overrides.selections ?? selections,
      activeWeek: overrides.activeWeek ?? activeWeek,
      completed: overrides.completed ?? completed,
      workouts: overrides.workouts ?? savedWorkouts,
      logs: overrides.logs ?? workoutLogs,
    });
  }

  function persistSelectionState(
    nextSelections: Selections,
    nextActiveWeek = activeWeek,
    nextCompleted = completed,
  ) {
    if (cloudAuthenticated === true) {
      persistAuthenticatedState({ selections: nextSelections, activeWeek: nextActiveWeek, completed: nextCompleted });
    } else {
      persistAnonymousState({ selections: nextSelections, activeWeek: nextActiveWeek, completed: nextCompleted });
    }
  }

  function beginManualSelectionFlow() {
    selectionFlowActiveRef.current = true;
    freePlanHydrationEpochRef.current += 1;
    generationGateRef.current.invalidate();
    setIsGeneratingPlan(false);
    setV2Resolution(null);
    setShowPlan(false);
  }

  function clearWeekNavigation() {
    const url = new URL(window.location.href);
    url.searchParams.delete("week");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function choose(key: SelectionStepKey, value: string) {
    if (key === "program") {
      if (!catalogReadyForV2) return;
      const token = generationGateRef.current.begin();
      if (token === null) return;
      setIsGeneratingPlan(true);
      setShowPlan(false);
      setV2Resolution(null);
      const next = finalizeFreePlanSelections(selections, value, createPlanInstanceId()) as Selections | null;
      if (!next) {
        generationGateRef.current.fail(token);
        setIsGeneratingPlan(false);
        return;
      }
      const nextPlan = resolvePublicV2Plan(
        next,
        liveExerciseLibrary,
        point2Registry,
      );
      if (!generationGateRef.current.isCurrent(token)) return;
      setSelections(next);
      setActiveWeek(1);
      setCompleted([]);
      setV2Resolution(nextPlan);
      setShowPlan(true);
      setIsGeneratingPlan(false);
      clearWeekNavigation();

      if (nextPlan.status === "found") {
        persistSelectionState(next, 1, []);
        if (cloudAuthenticated === true) {
          markAuthenticatedFreePlanResetPending(next.planInstanceId);
          void saveCloudFreePlan(next, [], 1).then((saved) => {
            if (!generationGateRef.current.isCurrent(token)) return;
            if (saved) {
              clearAuthenticatedFreePlanResetMarker(next.planInstanceId);
              selectionFlowActiveRef.current = false;
            }
            setCloudSyncMessage(saved ? "" : "Planul nou este în coada de siguranță și progresul vechi rămâne invalidat.");
          });
        } else {
          selectionFlowActiveRef.current = false;
        }
      } else {
        generationGateRef.current.fail(token);
      }

      if (!plansOnly) window.location.assign("/planuri-gratuite");
      else window.setTimeout(() => document.getElementById("program")?.scrollIntoView({ behavior: "smooth" }), 80);
      return;
    }

    beginManualSelectionFlow();
    const next = invalidateFinalFreePlanSelection(selections, key, value) as Selections;
    setSelections(next);
    persistSelectionState(next);
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }

  function editStep(index: number) {
    beginManualSelectionFlow();
    const next = { ...selections, program: undefined, planInstanceId: undefined, contentVersion: undefined };
    setSelections(next);
    persistSelectionState(next);
    setStepIndex(index);
    setTimeout(() => document.getElementById("selector")?.scrollIntoView({ behavior: "smooth" }), 40);
  }

  function resetFreePlanSelection() {
    beginManualSelectionFlow();
    cancelPendingFreePlanMutations();
    const reset = resetActiveFreePlanSnapshot({
      selections,
      activeWeek,
      completed,
      workouts: savedWorkouts,
      logs: workoutLogs,
    });
    setSelections({});
    setStepIndex(0);
    setActiveWeek(1);
    setCompleted([]);
    setShowAccountPrompt(false);
    setCloudSyncMessage("");
    clearWeekNavigation();
    if (cloudAuthenticated === true) {
      persistAuthenticatedState({ selections: {}, activeWeek: 1, completed: [] });
      markAuthenticatedFreePlanResetPending();
    } else {
      saveAnonymousProgress(reset);
    }
    window.setTimeout(() => document.getElementById("selector")?.scrollIntoView({ behavior: "smooth" }), 40);
  }

  function retryFreePlanCatalog() {
    beginManualSelectionFlow();
    const next = { ...selections, program: undefined, planInstanceId: undefined, contentVersion: undefined };
    setSelections(next);
    persistSelectionState(next);
    setStepIndex(steps.length - 1);
    void loadCatalogFromSameOrigin();
    window.setTimeout(() => document.getElementById("selector")?.scrollIntoView({ behavior: "smooth" }), 40);
  }

  function selectWeek(week: number) {
    setActiveWeek(week);
    const url = new URL(window.location.href);
    if (week === 1) url.searchParams.delete("week");
    else url.searchParams.set("week", String(week));
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (cloudAuthenticated === true) persistAuthenticatedState({ activeWeek: week });
    else persistAnonymousState({ activeWeek: week });
  }

  function openHeroProgram() {
    setNotebookDayIndex(0);
    setProgramModalOpen(true);
  }

  function toggleWorkout(day: string) {
    const key = `w${activeWeek}-${selections.place}-${day}`;
    const isCompleting = !completed.includes(key);
    const next = !isCompleting
      ? completed.filter((item) => item !== key)
      : [...completed, key];
    setCompleted(next);
    if (cloudAuthenticated === true) persistAuthenticatedState({ completed: next });
    else persistAnonymousState({ completed: next });

    const workout = planWorkouts.find((item) => item.day === day);
    if (workout && selections.place && cloudAuthenticated === true) {
      void saveCloudFreeWorkout({
        selections,
        completed: next,
        activeWeek,
        day,
        focus: workout.focus,
        duration: workout.duration,
        exercises: workout.exercises.map((exercise, order) => ({
          exerciseKey: exercise.exerciseKey,
          name: exercise.name,
          target: exercise.target,
          order,
        })),
        isCompleted: isCompleting,
      }).then((saved) => {
        setCloudSyncMessage(saved ? "" : "Progresul contului este în coada de siguranță și va fi sincronizat automat.");
      });
    }

    if (!selections.place || !isCompleting || cloudAuthenticated === true) return;
    if (!hasFinishedWeek(next, selections.place, activeWeek, planWorkouts.map((item) => item.day))) return;

    const milestone = getAccountPromptMilestone(selections, activeWeek);
    if (!milestone) return;

    const promptState = readAccountPromptState();
    if (promptState.shownMilestones.includes(milestone)) return;

    saveAccountPromptState({
      version: 3,
      shownMilestones: [...promptState.shownMilestones, milestone],
    });
    setShowAccountPrompt(true);
  }

  const availableExercises = useMemo(() => {
    const filtered = exerciseLibrary.filter((exercise) =>
      exercise.places.includes(trainingPlace)
      && (exerciseGroup === "toate" || exerciseHasCollection(exercise, exerciseGroup))
      && exerciseMatchesSearch(exercise, exerciseSearch),
    );
    return sortCatalogExercises(filtered, exerciseGroup === "toate" ? undefined : exerciseGroup);
  }, [exerciseGroup, exerciseLibrary, exerciseSearch, trainingPlace]);

  const exerciseGroups = useMemo(
    () => (exerciseCatalog?.collections ?? []).filter((collectionKey) =>
      collectionKey !== "acasa"
      && exerciseLibrary.some((exercise) =>
        exercise.places.includes(trainingPlace) && exerciseHasCollection(exercise, collectionKey)
      )
    ),
    [exerciseCatalog, exerciseLibrary, trainingPlace],
  );

  const publicExerciseGroups = useMemo(
    () => exerciseCatalog?.collections ?? [],
    [exerciseCatalog],
  );

  const publicLibraryExercises = useMemo(() => {
    const filtered = exerciseLibrary.filter((exercise) =>
      (publicExerciseGroup === "toate" || exerciseHasCollection(exercise, publicExerciseGroup))
      && exerciseMatchesSearch(exercise, publicExerciseSearch),
    );
    return sortCatalogExercises(filtered, publicExerciseGroup === "toate" ? undefined : publicExerciseGroup);
  }, [exerciseLibrary, publicExerciseGroup, publicExerciseSearch]);

  function startBuilder() {
    setBuilderOpen(true);
    setBuilderMessage("");
    setTimeout(() => document.getElementById("creator")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  function openWorkoutCreator() {
    if (!workoutOnly) {
      window.location.assign("/antrenamentul-meu?creator=1");
      return;
    }
    startBuilder();
  }

  function changeTrainingPlace(place: TrainingPlace) {
    setTrainingPlace(place);
    setExerciseGroup("toate");
    setExerciseSearch("");
    setBuilderExercises((current) => current.filter((exercise) => exercise.places.includes(place)));
  }

  function addExercise(exercise: LibraryExercise) {
    setBuilderExercises((current) => [...current, {
      ...exercise,
      uid: `${exercise.id}-${Date.now()}-${current.length}`,
      sets: exercise.kind === "forta" ? 3 : 0,
      reps: exercise.kind === "forta" ? 10 : 0,
      weight: 0,
      minutes: exercise.kind === "cardio" ? 15 : 0,
    }]);
    setLibraryOpen(false);
    setExerciseSearch("");
  }

  function updateBuilderExercise(uid: string, field: "sets" | "reps" | "weight" | "minutes", value: number) {
    setBuilderExercises((current) => current.map((exercise) =>
      exercise.uid === uid ? { ...exercise, [field]: Math.max(0, value || 0) } : exercise,
    ));
  }

  function moveBuilderExercise(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= builderExercises.length) return;
    setBuilderExercises((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function loadVemiExample() {
    const collectionSequence: ExerciseCollectionKey[] = trainingPlace === "sala"
      ? ["piept", "spate", "picioare", "umeri", "cardio"]
      : ["picioare", "piept", "spate", "picioare", "abdomen", "cardio"];
    const examples: LibraryExercise[] = [];
    for (const collectionKey of collectionSequence) {
      const next = sortCatalogExercises(
        exerciseLibrary.filter((exercise) =>
          exercise.places.includes(trainingPlace)
          && exerciseHasCollection(exercise, collectionKey)
          && !examples.some((selected) => selected.id === exercise.id)
        ),
        collectionKey,
      )[0];
      if (next) examples.push(next);
    }
    setBuilderExercises(examples.map((exercise, index) => ({
      ...exercise,
      uid: `${exercise.id}-example-${index}`,
      sets: exercise.kind === "forta" ? 3 : 0,
      reps: exercise.kind === "forta" ? 10 : 0,
      weight: 0,
      minutes: exercise.kind === "cardio" ? 15 : 0,
    })));
    if (!workoutName) setWorkoutName(trainingPlace === "sala" ? "Full body la sală" : "Full body acasă");
  }

  function saveCustomWorkout() {
    if (!builderExercises.length) {
      setBuilderMessage("Adaugă cel puțin un exercițiu înainte de salvare.");
      return;
    }
    const workout: SavedWorkout = {
      id: `plan-${Date.now()}`,
      name: workoutName.trim() || "Antrenamentul meu",
      place: trainingPlace,
      exercises: builderExercises,
      completions: 0,
    };
    const next = [workout, ...savedWorkouts];
    setSavedWorkouts(next);
    if (cloudAuthenticated === true) {
      persistAuthenticatedState({ workouts: next });
      void saveCloudCustomWorkout(workout).then((saved) => {
        setBuilderMessage(saved
          ? "Antrenamentul a fost salvat în contul tău și este disponibil pe toate dispozitivele."
          : "Antrenamentul contului este în coada de siguranță și va fi sincronizat automat.");
        setCloudSyncMessage(saved ? "" : "Salvarea în cloud nu a fost confirmată. Antrenamentul va fi reîncercat automat.");
      });
    } else {
      persistAnonymousState({ workouts: next });
      setBuilderMessage("Antrenamentul a fost salvat pe acest dispozitiv.");
    }
    setWorkoutName("");
    setBuilderExercises([]);
    setLibraryOpen(false);
    setBuilderOpen(false);
  }

  function selectCustomWorkout(id: string) {
    setSelectedWorkoutId(id);
    setBuilderMessage("");
  }

  function openWorkoutInNotebook(id: string) {
    if (!savedWorkouts.some((workout) => workout.id === id)) return;
    selectCustomWorkout(id);
    window.setTimeout(() => {
      document.getElementById("carnet-antrenament")?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 60);
  }

  function finishCustomWorkout(workout: SavedWorkout) {
    const now = new Date().toISOString();
    const completedUids = workout.exercises.map((exercise) => exercise.uid);
    const completedExercises = workout.exercises;
    const nextWorkouts = savedWorkouts.map((item) => item.id === workout.id
      ? { ...item, completions: item.completions + 1, lastCompleted: now }
      : item);
    const log: WorkoutLog = {
      id: `log-${now}`,
      workoutId: workout.id,
      workoutName: workout.name,
      place: workout.place,
      completedAt: now,
      exerciseCount: completedUids.length,
      cardioMinutes: completedExercises
        .filter((exercise) => exercise.kind === "cardio")
        .reduce((sum, exercise) => sum + exercise.minutes, 0),
      exercises: completedExercises.map((exercise) => ({
        name: exercise.name,
        group: exercise.group,
        details: exercise.kind === "cardio"
          ? `${exercise.minutes} min`
          : `${exercise.sets} × ${exercise.reps}${exercise.weight ? ` · ${exercise.weight} kg` : ""}`,
      })),
    };
    const nextLogs = [log, ...workoutLogs].slice(0, 12);
    setSavedWorkouts(nextWorkouts);
    setWorkoutLogs(nextLogs);
    if (cloudAuthenticated === true) {
      persistAuthenticatedState({ workouts: nextWorkouts, logs: nextLogs });
      void finishCloudCustomWorkout(workout, completedUids, log).then((saved) => {
        setBuilderMessage(saved
          ? "Antrenament finalizat. Seriile, repetările, greutățile și durata sunt sincronizate."
          : "Finalizarea contului este în coada de siguranță și va fi sincronizată automat.");
        setCloudSyncMessage(saved ? "" : "Finalizarea nu a fost încă confirmată în cloud. Operațiunea va fi reîncercată automat.");
      });
    } else {
      persistAnonymousState({ workouts: nextWorkouts, logs: nextLogs });
      setBuilderMessage("Antrenamentul a fost finalizat și păstrat pe acest dispozitiv.");
    }
    setSelectedWorkoutId(workout.id);
  }

  function unlockCustomWorkout(workout: SavedWorkout) {
    const nextWorkouts = savedWorkouts.map((item) => item.id === workout.id
      ? { ...item, completions: Math.max(0, item.completions - 1), lastCompleted: undefined }
      : item);
    const completedLogIndex = workoutLogs.findIndex((log) => log.workoutId === workout.id);
    const nextLogs = completedLogIndex === -1
      ? workoutLogs
      : workoutLogs.filter((_, index) => index !== completedLogIndex);
    setSavedWorkouts(nextWorkouts);
    setWorkoutLogs(nextLogs);
    if (cloudAuthenticated === true) {
      persistAuthenticatedState({ workouts: nextWorkouts, logs: nextLogs });
      void unlockCloudCustomWorkout(workout.id).then((saved) => {
        setBuilderMessage(saved
          ? "Antrenamentul a revenit la starea activă."
          : "Deblocarea este în coada de siguranță și va fi sincronizată automat.");
        setCloudSyncMessage(saved ? "" : "Deblocarea nu a fost încă confirmată în cloud. Operațiunea va fi reîncercată automat.");
      });
    } else {
      persistAnonymousState({ workouts: nextWorkouts, logs: nextLogs });
      setBuilderMessage("Antrenamentul a revenit la starea activă pe acest dispozitiv.");
    }
  }

  function deleteCustomWorkout(id: string) {
    const workout = savedWorkouts.find((item) => item.id === id);
    if (!workout) return;
    const nextWorkouts = savedWorkouts.filter((item) => item.id !== id);
    setSavedWorkouts(nextWorkouts);
    if (workoutOnly && nextWorkouts.length === 0) setBuilderOpen(true);
    if (cloudAuthenticated === true) {
      persistAuthenticatedState({ workouts: nextWorkouts });
      void deleteCloudCustomWorkout(id).then((saved) => {
        setCloudSyncMessage(saved ? "" : "Ștergerea este în coada de siguranță și va fi sincronizată automat.");
      });
    } else {
      persistAnonymousState({ workouts: nextWorkouts });
    }
    if (selectedWorkoutId === id) setSelectedWorkoutId(null);
    setBuilderMessage(`„${workout.name}” a fost șters.`);
  }

  const currentStep = steps[stepIndex];
  const currentStepChoices = currentStep.key === "program"
    ? currentStep.choices.filter((choice) => new Set<string>(publicProgramsForAge(selections.age)).has(choice.value))
    : currentStep.choices;
  const selectedSavedWorkout = selectedWorkoutId
    ? savedWorkouts.find((workout) => workout.id === selectedWorkoutId)
    : undefined;
  const featuredWorkout = selectedSavedWorkout ?? savedWorkouts[0] ?? demoWorkout;
  const featuredIsDemo = featuredWorkout.id === demoWorkout.id;
  const featuredIsCompleted = Boolean(featuredWorkout.lastCompleted);
  const otherWorkouts = savedWorkouts.filter((workout) => workout.id !== featuredWorkout.id);
  const featuredMinutes = featuredWorkout.exercises.reduce(
    (total, exercise) => total + (exercise.kind === "cardio" ? exercise.minutes : 7),
    0,
  );
  const completedWorkoutCount = savedWorkouts.reduce(
    (total, workout) => total + (workout.lastCompleted ? 1 : 0),
    0,
  );
  const recentWorkouts = savedWorkouts.slice(0, 3);
  const latestWorkoutActivity = savedWorkouts.reduce<string | undefined>((latest, workout) => {
    if (!workout.lastCompleted || Number.isNaN(new Date(workout.lastCompleted).getTime())) return latest;
    if (!latest || new Date(workout.lastCompleted).getTime() > new Date(latest).getTime()) return workout.lastCompleted;
    return latest;
  }, undefined);
  const latestWorkoutActivityLabel = formatWorkoutActivityDate(latestWorkoutActivity);

  const standalonePage = plansOnly || workoutOnly || exerciseOnly || subscriptionsOnly;
  const homeLink = (anchor: string) => standalonePage ? `/${anchor}` : anchor;
  const knownHasWorkout = progressHydrated ? savedWorkouts.length > 0 : null;

  return (
    <main
      className={plansOnly ? `plans-only${showPlan ? " plan-ready" : ""}` : workoutOnly ? "workout-only" : exerciseOnly ? "exercise-only" : subscriptionsOnly ? "subscriptions-only" : "home-page"}
      data-catalog-source={exerciseCatalog?.source ?? "unavailable"}
      data-catalog-status={catalogStatus}
      data-catalog-version={exerciseCatalog?.contractVersion}
      data-catalog-error={catalogUnavailable ? catalogError : undefined}
      data-catalog-active={exerciseCatalog?.metrics.activeExercises ?? 0}
      data-catalog-memberships={exerciseCatalog?.metrics.memberships ?? 0}
    >
      {!standalonePage ? (
        <VemiHomepageMobile
          billingPeriod={billingPeriod}
          selectedSubscription={selectedSubscription}
          onBillingPeriodChange={setBillingPeriod}
          onOpenProgram={openHeroProgram}
          onOpenWorkoutCreator={openWorkoutCreator}
          onSelectSubscription={setSelectedSubscription}
        />
      ) : null}
      <header className="site-header">
        <a className="brand" href={standalonePage ? "/" : "#top"} aria-label="VEMI - Acasă">
          {standalonePage ? (
            <img className="brand-logo" src="/vemi-logo.png" alt="VEMI" />
          ) : (
            <>
              <Image className="brand-symbol" src="/vemi-symbol-2026.png" alt="" width={42} height={42} priority unoptimized />
              <span className="brand-wordmark">VEMI</span>
            </>
          )}
        </a>
        <VemiNavigationDrawer knownHasWorkout={knownHasWorkout} />
        <nav className="nav">
          <Link href="/planuri-gratuite">Planuri gratuite</Link>
          <WorkoutNavigationLink knownHasWorkout={knownHasWorkout}>Antrenamentul meu</WorkoutNavigationLink>
          <Link href="/exercitii">Exerciții</Link>
          <Link href="/stil-de-viata">Stil de viață</Link>
          <Link href="/alimentatie">Alimentație</Link>
          <Link className="nav-cta" href="/abonamente">Abonamente</Link>
          <a className="nav-account" href="/contul-meu">
            <span className="nav-account-icon" aria-hidden="true" />
            Contul meu
          </a>
        </nav>
      </header>
      {cloudSyncMessage ? <p className="cloud-sync-message" role="status">{cloudSyncMessage}</p> : null}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">Viață · Energie · Mișcare</p>
          <h1>Un program clar.<br />Mai ușor de urmat.</h1>
          <p className="hero-text">
            Planuri de antrenament gratuite, organizate pe patru săptămâni și alese pentru categoria ta.
            Fără PDF-uri. Fără cont obligatoriu.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/planuri-gratuite">Alege programul gratuit</a>
            <a className="text-link" href="#antrenamentul-meu">Creează planul tău <span className="cta-arrow" aria-hidden="true">→</span></a>
          </div>
          <div className="hero-proof">
            <div><strong>96</strong><span>planuri gratuite</span></div>
            <div><strong>4</strong><span>săptămâni structurate</span></div>
            <div><strong>0</strong><span>cont necesar</span></div>
          </div>
        </div>
        <div className="hero-visual" aria-label="Prezentare vizuală program VEMI">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="motion-card main-card">
            <span className="card-label">Programul zilei</span>
            <div className="motion-figure" aria-hidden="true">
              <span className="head" />
              <span className="body" />
              <span className="arm left" />
              <span className="arm right" />
              <span className="leg left" />
              <span className="leg right" />
            </div>
            <div className="card-bottom">
              <div><strong>Ziua 1</strong><span>Partea superioară</span></div>
              <button className="hero-play-button" onClick={openHeroProgram} aria-label="Deschide carnetul de antrenament" title="Deschide carnetul">
                <span className="hero-play-icon" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="floating-card week-card"><span>Săptămâna 1</span><strong>3 antrenamente</strong></div>
          <div className="floating-card progress-card"><span>Progres</span><strong>25%</strong><i><b /></i></div>
        </div>
      </section>

      {plansOnly && (
        <section className="plans-page-intro">
          <Link href="/" className="plans-back">← Pagina principală</Link>
          <p className="section-kicker">Planuri gratuite VEMI</p>
          <h1>Alege programul<br />potrivit pentru tine.</h1>
          <p>Răspunde la cinci întrebări simple. Programul, progresul și toate modificările tale vor rămâne organizate aici.</p>
        </section>
      )}

      {subscriptionsOnly && (
        <section className="subscriptions-page-intro">
          <div className="subscriptions-page-copy">
            <Link href="/" className="plans-back">← Pagina principală</Link>
            <p className="section-kicker">Abonamente VEMI</p>
            <h1>Sprijinul potrivit.<br />În ritmul tău.</h1>
            <p>Alege libertatea de a urma planul independent sau sprijinul personal pe parcurs. În ambele variante, antrenamentele și progresul tău rămân clare, organizate și ușor de urmărit.</p>
          </div>
          <div className="subscriptions-page-promises" aria-label="Ce primești cu un abonament VEMI">
            <article><span>01</span><strong>Un plan adaptat</strong><p>Recomandări construite în jurul profilului și obiectivului tău.</p></article>
            <article><span>02</span><strong>Un parcurs clar</strong><p>Săptămâni structurate, demonstrații și progres păstrat într-un singur loc.</p></article>
            <article><span>03</span><strong>Sprijin la alegere</strong><p>Lucrezi independent sau alegi asistența personală atunci când o vrei.</p></article>
          </div>
        </section>
      )}

      {programModalOpen && (
        <div
          className="workout-book-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProgramModalOpen(false);
          }}
        >
          <section className="workout-book-modal" role="dialog" aria-modal="true" aria-labelledby="workout-book-title">
            <button className="workout-book-close" onClick={() => setProgramModalOpen(false)} aria-label="Închide carnetul" autoFocus>×</button>

            <div className="workout-book" aria-live="polite">
              <article className="workout-book-page workout-book-plan">
                <header className="workout-book-heading">
                  <p>{notebookDays[notebookDayIndex].day}</p>
                  <h2 id="workout-book-title">{notebookDays[notebookDayIndex].title}</h2>
                </header>

                <div className="workout-book-exercises">
                  {notebookDays[notebookDayIndex].exercises.map((exercise, index) => (
                    <div className="workout-book-exercise" key={exercise.exerciseKey}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{exercise.name}</strong>
                      <b>{exercise.target}</b>
                      <ExerciseVideo exerciseKey={exercise.exerciseKey} exerciseName={exercise.name} className="compact" />
                    </div>
                  ))}
                </div>

                <div className="workout-book-meta">
                  <p><span aria-hidden="true">◷</span><b>Durată:</b> {notebookDays[notebookDayIndex].duration}</p>
                  <p><span aria-hidden="true">▥</span><b>Nivel:</b> {notebookDays[notebookDayIndex].level}</p>
                  <p><span aria-hidden="true">◴</span><b>Pauze:</b> {notebookDays[notebookDayIndex].rest}</p>
                </div>
              </article>

              <article className="workout-book-page workout-book-info">
                <p className="workout-book-eyebrow">Despre acest<br />antrenament</p>
                <div className="workout-book-info-list">
                  <div><span aria-hidden="true">◎</span><p><strong>Scop</strong>{notebookDays[notebookDayIndex].purpose}</p></div>
                  <div><span aria-hidden="true">◒</span><p><strong>Grupe lucrate</strong>{notebookDays[notebookDayIndex].groups}</p></div>
                  <div><span aria-hidden="true">☼</span><p><strong>Recomandare</strong>{notebookDays[notebookDayIndex].recommendation}</p></div>
                </div>
                <div className="workout-book-tip">
                  <p><strong>Simte-te bine.</strong>{notebookDays[notebookDayIndex].tip}</p>
                  <span aria-hidden="true">♡</span>
                </div>
              </article>
            </div>

            <footer className="workout-book-navigation">
              <button onClick={() => setNotebookDayIndex((day) => Math.max(0, day - 1))} disabled={notebookDayIndex === 0} aria-label="Ziua anterioară">← <span>Ziua anterioară</span></button>
              <div className="workout-book-dots" aria-label={`Ziua ${notebookDayIndex + 1} din 4`}>
                {notebookDays.map((day, index) => (
                  <button key={day.day} className={index === notebookDayIndex ? "active" : ""} onClick={() => setNotebookDayIndex(index)} aria-label={`Deschide ${day.day}`} aria-current={index === notebookDayIndex ? "step" : undefined} />
                ))}
              </div>
              <button onClick={() => setNotebookDayIndex((day) => Math.min(notebookDays.length - 1, day + 1))} disabled={notebookDayIndex === notebookDays.length - 1} aria-label="Ziua următoare"><span>Ziua următoare</span> →</button>
            </footer>
          </section>
        </div>
      )}

      <section className="how" id="cum-functioneaza">
        <p className="section-kicker">Simplu de la început</p>
        <div className="how-grid">
          <h2>Patru alegeri.<br />Programul tău.</h2>
          <div className="how-steps">
            <div><span>01</span><p>Alegi categoria și vârsta.</p></div>
            <div><span>02</span><p>Selectezi obiectivul.</p></div>
            <div><span>03</span><p>Alegi nivelul, ritmul și locul.</p></div>
            <div><span>04</span><p>Începi direct, fără cont.</p></div>
          </div>
        </div>
        <a className="how-cta" href="/planuri-gratuite">
          <span>Alege planul gratuit</span>
          <i className="cta-arrow" aria-hidden="true">→</i>
        </a>
      </section>

      <section className="custom-workout-section" id="antrenamentul-meu">
        <div className="custom-intro">
          <div>
            <p className="section-kicker">Instrument gratuit</p>
            <h2>Antrenamentul meu.</h2>
          </div>
          <div className="custom-intro-copy">
            <p>Alege exercițiile, scrie seriile și repetările, apoi păstrează totul într-un singur loc.</p>
            {!builderOpen && (!workoutOnly || savedWorkouts.length > 0) && <button className="button primary" onClick={openWorkoutCreator}>Creează un antrenament</button>}
          </div>
        </div>

        {workoutOnly && savedWorkouts.length > 0 && (
          <section className="workout-activity-summary" aria-labelledby="workout-activity-title">
            <header className="workout-activity-head">
              <div>
                <p className="workout-activity-kicker">Rezumat personal</p>
                <h3 id="workout-activity-title">Antrenamentul meu</h3>
              </div>
              <div className="workout-activity-total" aria-label={`${savedWorkouts.length} ${savedWorkouts.length === 1 ? "antrenament" : "antrenamente"}`}>
                <strong>{savedWorkouts.length}</strong>
                <span>{savedWorkouts.length === 1 ? "antrenament" : "antrenamente"}</span>
              </div>
            </header>

            <div className="workout-activity-facts" aria-label="Statistici antrenamente">
              <span>
                <strong>{completedWorkoutCount}</strong>
                <small>{completedWorkoutCount === 1 ? "finalizat" : "finalizate"}</small>
              </span>
              {latestWorkoutActivityLabel && (
                <span>
                  <strong>{latestWorkoutActivityLabel}</strong>
                  <small>ultima finalizare</small>
                </span>
              )}
            </div>

            <div className="workout-activity-recent">
              <p>Activitate recentă</p>
              <div className="workout-activity-list" role="list">
                {recentWorkouts.map((workout, index) => {
                  const completedDate = formatWorkoutActivityDate(workout.lastCompleted);
                  const completed = Boolean(workout.lastCompleted);
                  return (
                    <article className="workout-activity-item" role="listitem" key={workout.id}>
                      <span className="workout-activity-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="workout-activity-name">
                        <strong>{workout.name}</strong>
                        {completedDate && <small>{completedDate}</small>}
                      </span>
                      <span className={completed ? "workout-activity-status completed" : "workout-activity-status"}>
                        {completed ? "Finalizat" : "Nefinalizat"}
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {builderMessage && <div className="builder-message" role="status"><span>✓</span>{builderMessage}</div>}

        {!featuredIsDemo && <div className="workout-notebook" id="carnet-antrenament">
          <article
            className={featuredIsCompleted ? "notebook-card completed" : "notebook-card"}
            data-completed={featuredIsCompleted ? "true" : "false"}
            role={featuredIsCompleted ? "button" : undefined}
            tabIndex={featuredIsCompleted ? 0 : undefined}
            aria-label={featuredIsCompleted ? "Antrenament finalizat. Apasă pentru a reveni la starea activă." : undefined}
            onClick={(event) => {
              if (!featuredIsCompleted || !(event.target instanceof Element)) return;
              const interactiveTarget = event.target.closest("button, a, input, select, textarea, [role='button']");
              if (interactiveTarget && interactiveTarget !== event.currentTarget) return;
              unlockCustomWorkout(featuredWorkout);
            }}
            onKeyDown={(event) => {
              if (!featuredIsCompleted || event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                unlockCustomWorkout(featuredWorkout);
              }
            }}
          >
            <header className="notebook-card-head">
              <div className="notebook-card-title">
                <div className="notebook-card-kicker">
                  <span>{placeLabels[featuredWorkout.place]}</span>
                  <button
                    className="delete-plan-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteCustomWorkout(featuredWorkout.id);
                    }}
                  >
                    Șterge planul
                  </button>
                </div>
                <h3>{featuredWorkout.name}</h3>
              </div>
              <div className="notebook-summary" aria-label="Sumarul antrenamentului">
                <span>
                  <i className="notebook-summary-icon dumbbell" aria-hidden="true" />
                  <span><strong>{featuredWorkout.exercises.length}</strong><small>exerciții</small></span>
                </span>
                <span>
                  <i className="notebook-summary-icon clock" aria-hidden="true" />
                  <span><strong>≈ {featuredMinutes}</strong><small>minute</small></span>
                </span>
              </div>
            </header>

            <div className="notebook-exercise-list">
              {featuredWorkout.exercises.map((exercise) => (
                <div className="notebook-exercise" key={exercise.uid}>
                  <ExerciseVideo exerciseKey={exercise.id} exerciseName={exercise.name} className="notebook-video" />
                  <span className="notebook-exercise-copy"><strong>{exercise.name}</strong><small>{exercise.group}</small></span>
                  <b className="notebook-exercise-target">{exercise.kind === "cardio" ? `${exercise.minutes} min` : `${exercise.sets} × ${exercise.reps}`}</b>
                </div>
              ))}
            </div>

            {featuredIsCompleted ? (
              <footer className="notebook-card-footer completed-actions">
                <div className="completed-message"><i>✓</i><span><strong>Antrenament finalizat</strong><small>Apasă pe card pentru a reveni la starea activă.</small></span></div>
              </footer>
            ) : (
              <footer className="notebook-card-footer">
                <button
                  className="complete-workout"
                  onClick={(event) => {
                    event.stopPropagation();
                    finishCustomWorkout(featuredWorkout);
                  }}
                >
                  <span aria-hidden="true">✓</span>
                  <strong>Marchează ca finalizat</strong>
                </button>
              </footer>
            )}
          </article>
        </div>}

        {builderOpen && (
          <div className="workout-builder" id="creator">
            <div className="builder-heading">
              <div><span>01</span><h3>Unde te antrenezi?</h3></div>
              <button className="builder-close" onClick={() => setBuilderOpen(false)} aria-label="Închide creatorul">×</button>
            </div>

            <div className="place-toggle" aria-label="Locul antrenamentului">
              {(["acasa", "sala"] as TrainingPlace[]).map((place) => (
                <button
                  key={place}
                  className={trainingPlace === place ? "active" : ""}
                  onClick={() => changeTrainingPlace(place)}
                  aria-pressed={trainingPlace === place}
                >
                  <span>{place === "acasa" ? "⌂" : "●"}</span>
                  <strong>{placeLabels[place]}</strong>
                </button>
              ))}
            </div>

            <label className="workout-name-field">
              <span>Numele antrenamentului</span>
              <input
                value={workoutName}
                onChange={(event) => setWorkoutName(event.target.value)}
                placeholder={trainingPlace === "sala" ? "Ex: Ziua 1" : "Ex: Full body acasă"}
                maxLength={50}
              />
            </label>

            <div className="builder-exercises-head">
              <div><span>02</span><h3>Exercițiile tale</h3></div>
              {builderExercises.length === 0 && <button className="example-link" onClick={loadVemiExample}>Folosește un exemplu VEMI</button>}
            </div>

            <div className="builder-exercise-list">
              {builderExercises.length === 0 && (
                <button className="empty-builder" onClick={() => setLibraryOpen(true)}>
                  <span>＋</span><strong>Adaugă primul exercițiu</strong><small>Din biblioteca pentru {placeLabels[trainingPlace].toLocaleLowerCase("ro")}</small>
                </button>
              )}

              {builderExercises.map((exercise, index) => (
                <article className="builder-exercise" key={exercise.uid}>
                  <div className="builder-exercise-title">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{exercise.name}</strong><small>{exercise.group}</small></div>
                  </div>

                  {exercise.kind === "forta" ? (
                    <div className="exercise-fields">
                      <label><span>Serii</span><input aria-label={`Serii pentru ${exercise.name}`} type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateBuilderExercise(exercise.uid, "sets", Number(event.target.value))} /></label>
                      <label><span>Repetări</span><input aria-label={`Repetări pentru ${exercise.name}`} type="number" min="1" max="100" value={exercise.reps} onChange={(event) => updateBuilderExercise(exercise.uid, "reps", Number(event.target.value))} /></label>
                      <label><span>Kg <i>opțional</i></span><input aria-label={`Greutate pentru ${exercise.name}`} type="number" min="0" max="500" value={exercise.weight || ""} placeholder="—" onChange={(event) => updateBuilderExercise(exercise.uid, "weight", Number(event.target.value))} /></label>
                    </div>
                  ) : (
                    <div className="exercise-fields cardio-field">
                      <label><span>Minute</span><input aria-label={`Minute pentru ${exercise.name}`} type="number" min="1" max="300" value={exercise.minutes} onChange={(event) => updateBuilderExercise(exercise.uid, "minutes", Number(event.target.value))} /></label>
                    </div>
                  )}

                  <div className="exercise-actions">
                    <button onClick={() => moveBuilderExercise(index, -1)} disabled={index === 0} aria-label={`Mută ${exercise.name} mai sus`}>↑</button>
                    <button onClick={() => moveBuilderExercise(index, 1)} disabled={index === builderExercises.length - 1} aria-label={`Mută ${exercise.name} mai jos`}>↓</button>
                    <button className="remove-exercise" onClick={() => setBuilderExercises((current) => current.filter((item) => item.uid !== exercise.uid))} aria-label={`Șterge ${exercise.name}`}>×</button>
                  </div>
                </article>
              ))}
            </div>

            {builderExercises.length > 0 && <button className="add-exercise-button" onClick={() => setLibraryOpen(true)}>＋ Adaugă exercițiu</button>}

            {libraryOpen && (
              <div className="exercise-picker">
                <div className="picker-head"><div><span>Bibliotecă</span><strong>Alege un exercițiu</strong></div><button onClick={() => setLibraryOpen(false)} aria-label="Închide biblioteca">×</button></div>
                <input className="exercise-search" value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder="Caută un exercițiu..." aria-label="Caută un exercițiu" />
                <div className="group-filters">
                  <button className={exerciseGroup === "toate" ? "active" : ""} onClick={() => setExerciseGroup("toate")}>Toate</button>
                  {exerciseGroups.map((collectionKey) => (
                    <button
                      key={collectionKey}
                      className={exerciseGroup === collectionKey ? "active" : ""}
                      onClick={() => setExerciseGroup(collectionKey)}
                    >
                      {EXERCISE_COLLECTION_LABELS[collectionKey]}
                    </button>
                  ))}
                </div>
                <div className="picker-list">
                  {availableExercises.map((exercise) => (
                    <button key={exercise.id} onClick={() => addExercise(exercise)}>
                      <span><strong>{exercise.name}</strong><small>{exercise.group} · {exercise.kind === "cardio" ? "minute" : "serii și repetări"}</small></span><i>＋</i>
                    </button>
                  ))}
                  {availableExercises.length === 0 && catalogLoading && (
                    <p>Încărcăm catalogul activ…</p>
                  )}
                  {availableExercises.length === 0 && catalogUnavailable && (
                    <p>Biblioteca nu poate fi încărcată momentan. <button onClick={() => void loadCatalogFromSameOrigin()}>Reîncearcă</button></p>
                  )}
                  {availableExercises.length === 0 && !catalogLoading && !catalogUnavailable && (
                    <p>Niciun exercițiu găsit.</p>
                  )}
                </div>
              </div>
            )}

            <div className="builder-footer">
              <p><strong>Gratuit.</strong> Planul și progresul se salvează pe acest dispozitiv.</p>
              <button className="button primary" onClick={saveCustomWorkout}>Salvează antrenamentul</button>
            </div>
          </div>
        )}

        {otherWorkouts.length > 0 && (
          <div className="saved-workouts">
            <div className="saved-title"><div><p className="section-kicker">Planurile tale</p><h3>Alege ce urmează.</h3></div>{!builderOpen && <button className="add-plan-link" onClick={startBuilder}>＋ Plan nou</button>}</div>
            <div className="saved-grid">
              {otherWorkouts.map((workout) => {
                const cardioMinutes = workout.exercises.filter((exercise) => exercise.kind === "cardio").reduce((sum, exercise) => sum + exercise.minutes, 0);
                return (
                  <article className="saved-workout-mini" key={workout.id}>
                    <div className="saved-workout-head">
                      <div><span>{placeLabels[workout.place]}</span><h4>{workout.name}</h4></div>
                      <strong>{workout.exercises.length} exerciții</strong>
                    </div>
                    <div className="saved-meta"><span>{workout.completions} finalizate</span>{cardioMinutes > 0 && <span>{cardioMinutes} min cardio</span>}</div>
                    <div className="saved-workout-actions">
                      <button className="start-workout" onClick={() => openWorkoutInNotebook(workout.id)}>Vezi antrenamentul <span className="cta-arrow" aria-hidden="true">→</span></button>
                      <button className="delete-workout-mini" onClick={() => deleteCustomWorkout(workout.id)}>Șterge</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {workoutLogs.length > 0 && (
          <div className="workout-journal">
            <div><p className="section-kicker">Jurnalul rezultatelor</p><h3>Ultimele antrenamente</h3></div>
            <div className="journal-list">
              {workoutLogs.slice(0, 4).map((log) => {
                const isExpanded = expandedLogId === log.id;
                const linkedWorkout = savedWorkouts.find((workout) => workout.id === log.workoutId)
                  ?? savedWorkouts.find((workout) => workout.name === log.workoutName);
                const visibleExercises = log.exercises?.length
                  ? log.exercises
                  : linkedWorkout?.exercises.map((exercise) => ({
                    name: exercise.name,
                    group: exercise.group,
                    details: exercise.kind === "cardio"
                      ? `${exercise.minutes} min`
                      : `${exercise.sets} × ${exercise.reps}${exercise.weight ? ` · ${exercise.weight} kg` : ""}`,
                  }));
                return (
                  <article className={isExpanded ? "journal-entry open" : "journal-entry"} key={log.id}>
                    <button className="journal-row" onClick={() => setExpandedLogId(isExpanded ? null : log.id)} aria-expanded={isExpanded}>
                      <span className="journal-check">✓</span>
                      <strong>{log.workoutName}</strong>
                      <small>{new Date(log.completedAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} · {log.exerciseCount} exerciții{log.cardioMinutes ? ` · ${log.cardioMinutes} min cardio` : ""}</small>
                      <i>{isExpanded ? "−" : "+"}</i>
                    </button>
                    {isExpanded && (
                      <div className="journal-details">
                        <div className="journal-summary">
                          <span><strong>{log.exerciseCount}</strong> exerciții finalizate</span>
                          {log.cardioMinutes > 0 && <span><strong>{log.cardioMinutes}</strong> minute cardio</span>}
                          {log.place && <span><strong>{placeLabels[log.place]}</strong> locul sesiunii</span>}
                        </div>
                        {visibleExercises?.length ? (
                          <>
                            {!log.exercises?.length && <p className="journal-legacy-note">Exercițiile planului asociat acestei sesiuni:</p>}
                            <div className="journal-exercises">
                              {visibleExercises.map((exercise, index) => (
                                <div key={`${exercise.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{exercise.name}<small>{exercise.group}</small></strong><b>{exercise.details}</b></div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="journal-legacy-note">Pentru această sesiune mai veche a fost salvat doar rezumatul de mai sus.</p>
                        )}
                        {linkedWorkout && <button className="journal-open-workout" onClick={() => openWorkoutInNotebook(linkedWorkout.id)}>Vezi antrenamentul <span className="cta-arrow" aria-hidden="true">→</span></button>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

      </section>

      {plansOnly && <section className="selector-section" id="selector">
        <div className="selector-head">
          <div>
            <p className="section-kicker dark">Planuri gratuite</p>
            <h2>{currentStep.title}</h2>
          </div>
          <div className="step-count">{currentStep.eyebrow}</div>
        </div>

        <div className="selected-path" aria-label="Selecțiile curente">
          {steps.map((step, index) => {
            const value = selections[step.key];
            if (!value || index >= stepIndex) return null;
            const label = selectedChoiceLabel(step, value);
            return <button key={step.key} onClick={() => editStep(index)}>{label}<span>×</span></button>;
          })}
        </div>

        <div className={`choice-grid choices-${currentStepChoices.length}`}>
          {currentStepChoices.map((choice, index) => (
            <button
              className="choice-card"
              key={choice.value}
              onClick={() => choose(currentStep.key, choice.value)}
              disabled={currentStep.key === "program" && (isGeneratingPlan || !catalogReadyForV2)}
              aria-busy={currentStep.key === "program" && (isGeneratingPlan || catalogLoading)}
            >
              <span className="choice-number">0{index + 1}</span>
              <strong>{choice.label}</strong>
              {choice.note && <small>{choice.note}</small>}
              <i className="cta-arrow" aria-hidden="true">→</i>
            </button>
          ))}
        </div>
        {currentStep.key === "program" && catalogLoading && (
          <div className="catalog-delivery-status" role="status">
            <strong>Pregătim catalogul activ.</strong>
            <span>Cardurile devin disponibile imediat ce cele 114 exerciții și regulile V2 sunt sincronizate.</span>
          </div>
        )}
        {currentStep.key === "program" && catalogUnavailable && (
          <div className="catalog-delivery-status error" role="alert">
            <strong>Catalogul nu a putut fi încărcat.</strong>
            <span>Selecțiile tale au rămas păstrate. Reîncarcă apoi alege din nou cardul final.</span>
            <button className="button small" onClick={() => void loadCatalogFromSameOrigin()}>Reîncarcă catalogul</button>
          </div>
        )}
        {stepIndex > 0 && <button className="back-button" onClick={() => editStep(stepIndex - 1)}>← Înapoi</button>}
      </section>}

      {showPlan && (
        <section
          className="program-section"
          id="program"
          data-plan-engine={planEngineVersion}
          data-plan-resolver={v2Resolution?.status === "found" ? v2Resolution.resolver : planEngineVersion}
          data-plan-key={v2Resolution?.status === "found" ? v2Resolution.canonicalKey : undefined}
          data-plan-instance={selections.planInstanceId}
        >
          <div className="program-header">
            <div>
              <p className="section-kicker">Programul selectat pentru tine</p>
              <h2>{goalLabels[selections.goal ?? ""]}</h2>
              <p className="program-subtitle">
                {selections.gender === "masculin" ? "Masculin" : "Feminin"} · {ageLabels[selections.age ?? ""]} ani · {programLabels[selections.program ?? ""]} · {selections.place === "acasa" ? "Acasă" : "La sală"}
              </p>
            </div>
            <button className="edit-selection" onClick={resetFreePlanSelection}>Modifică selecția</button>
          </div>

          {planGenerationUnavailable ? (
            <div className="plan-generation-error" role="alert">
              <strong>Planul nu poate fi generat în siguranță momentan.</strong>
              <p>Catalogul activ și regulile programului trebuie să fie complet sincronizate. Reîncearcă în câteva momente.</p>
              <button className="button small" onClick={retryFreePlanCatalog}>Reîncarcă catalogul</button>
            </div>
          ) : <div className="program-dashboard">
            <aside className="week-panel">
              <div className="body-progress" role="img" aria-label={`${progress}% din program completat`}>
                <div className="body-progress-figure" aria-hidden="true">
                  <div className="body-progress-silhouette body-progress-base">
                    <span className="head" />
                    <span className="body" />
                    <span className="arm left" />
                    <span className="arm right" />
                    <span className="leg left" />
                    <span className="leg right" />
                  </div>
                  <div className="body-progress-fill" style={{ "--progress-fill": `${progress}%` } as React.CSSProperties}>
                    <div className="body-progress-silhouette body-progress-active">
                      <span className="head" />
                      <span className="body" />
                      <span className="arm left" />
                      <span className="arm right" />
                      <span className="leg left" />
                      <span className="leg right" />
                    </div>
                  </div>
                </div>
                <div className="body-progress-label"><strong>{progress}%</strong><span>completat</span></div>
              </div>
              <h3>Planul tău</h3>
              <p>Progresul este salvat automat în acest browser.</p>
              <div className="week-tabs">
                {[1, 2, 3, 4].map((week) => (
                  <button key={week} className={activeWeek === week ? "active" : ""} onClick={() => selectWeek(week)}>
                    <span>Săptămâna</span><strong>{week}</strong>
                  </button>
                ))}
              </div>
            </aside>

            <div className="workouts-list">
              <div className="week-title"><span>Săptămâna {activeWeek}</span><strong>{selections.place === "acasa" ? "Program pentru acasă" : "Program pentru sală"}</strong></div>
              {planWorkouts.map((workout) => {
                const completedKey = `w${activeWeek}-${selections.place}-${workout.day}`;
                const isDone = completed.includes(completedKey);
                return (
                  <article className={isDone ? "workout-card completed" : "workout-card"} key={workout.day}>
                    <div className="workout-top">
                      <div><span>{workout.day}</span><h3>{workout.focus}</h3></div>
                      <span className="duration">{workout.duration}</span>
                    </div>
                    <div className="exercise-list">
                      {workout.exercises.map((exercise, index) => (
                        <div className="exercise" key={exercise.exerciseKey}>
                          <ExerciseVideo exerciseKey={exercise.exerciseKey} exerciseName={exercise.name} className="play" />
                          <div><strong>{exercise.name}</strong><span>Exercițiul {index + 1}</span></div>
                          <b>{exercise.target}</b><small>{exercise.rest}</small>
                        </div>
                      ))}
                    </div>
                    <button className="complete-button" onClick={() => toggleWorkout(workout.day)}>
                      {isDone ? "✓ Antrenament finalizat" : "Marchează ca finalizat"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>}
        </section>
      )}

      {showAccountPrompt && (
        <div className="account-toast" role="status">
          <button className="toast-close" onClick={() => setShowAccountPrompt(false)} aria-label="Închide">×</button>
          <span className="toast-icon">✓</span>
          <div><strong>Vrei să-ți păstrezi progresul pe orice dispozitiv?</strong><p>Creează gratuit un cont, apoi alegi dacă imporți progresul salvat în acest browser.</p></div>
          <button className="button small" onClick={() => window.location.assign("/contul-meu")}>Creează cont</button>
        </div>
      )}

      {exerciseOnly && <section className="exercise-library-section" id="biblioteca">
        <header className="exercise-library-header">
          <div>
            <p className="section-kicker">Biblioteca VEMI</p>
            <h2>Alege grupa.<br />Învață mișcarea.</h2>
          </div>
          <p>Toate exercițiile folosite în planurile și antrenamentele VEMI, organizate simplu într-un singur loc.</p>
        </header>

        <div className="exercise-library-toolbar">
          <label className="public-exercise-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={publicExerciseSearch}
              onChange={(event) => setPublicExerciseSearch(event.target.value)}
              placeholder="Caută un exercițiu..."
              aria-label="Caută în biblioteca de exerciții"
            />
            {publicExerciseSearch && <button onClick={() => setPublicExerciseSearch("")} aria-label="Șterge căutarea">×</button>}
          </label>
          <span className="exercise-library-count">
            {catalogLoading
              ? "Se încarcă…"
              : catalogUnavailable
                ? "Indisponibil momentan"
                : `${publicLibraryExercises.length} ${publicLibraryExercises.length === 1 ? "exercițiu" : "exerciții"}`}
          </span>
        </div>

        {!catalogLoading && !catalogUnavailable && <nav className="public-group-filters" aria-label="Filtrează după colecția de exerciții">
          <button
            className={publicExerciseGroup === "toate" ? "active" : ""}
            onClick={() => setPublicExerciseGroup("toate")}
            aria-pressed={publicExerciseGroup === "toate"}
          >
            Toate<span>{exerciseLibrary.length}</span>
          </button>
          {publicExerciseGroups.map((collectionKey) => {
            const count = exerciseLibrary.filter((exercise) => exerciseHasCollection(exercise, collectionKey)).length;
            return (
              <button
                key={collectionKey}
                className={publicExerciseGroup === collectionKey ? "active" : ""}
                onClick={() => setPublicExerciseGroup(collectionKey)}
                aria-pressed={publicExerciseGroup === collectionKey}
              >
                {EXERCISE_COLLECTION_LABELS[collectionKey]}<span>{count}</span>
              </button>
            );
          })}
        </nav>}

        <div className="public-exercise-grid">
          {!catalogLoading && !catalogUnavailable && publicLibraryExercises.map((exercise, index) => (
              <ExerciseLibraryCard
                key={exercise.id}
                index={index}
                exerciseKey={exercise.id}
                name={exercise.name}
                category={exercise.group}
                places={exercise.places}
                memberships={exercise.memberships}
                recommendedTarget={exercise.recommendedTarget}
                guidance1={exercise.guidance1}
                guidance2={exercise.guidance2}
                videoAction={exercise.videoState === "not-required"
                  ? null
                  : <ExerciseVideo exerciseKey={exercise.id} exerciseName={exercise.name} label="Demonstrație" className="library-video" />}
              />
          ))}
          {catalogLoading && (
            <div className="public-exercise-empty" role="status">
              <strong>Încărcăm biblioteca VEMI.</strong>
              <p>Verificăm catalogul activ și ordinea colecțiilor.</p>
            </div>
          )}
          {catalogUnavailable && (
            <div className="public-exercise-empty">
              <strong>Biblioteca nu este disponibilă momentan.</strong>
              <p>Reîncarcă în siguranță catalogul activ.</p>
              <button onClick={() => void loadCatalogFromSameOrigin()}>Reîncearcă</button>
            </div>
          )}
          {!catalogLoading && !catalogUnavailable && publicLibraryExercises.length === 0 && (
            <div className="public-exercise-empty">
              <strong>Niciun exercițiu găsit.</strong>
              <p>Încearcă un alt cuvânt sau alege o altă colecție.</p>
              <button onClick={() => { setPublicExerciseSearch(""); setPublicExerciseGroup("toate"); }}>Vezi toate exercițiile</button>
            </div>
          )}
        </div>
      </section>}

      <section className="content-grid">
        <a className="content-card library-card" href="/exercitii">
          <p className="section-kicker">Biblioteca VEMI</p>
          <h2>Învață mișcarea.<br />Execută sigur.</h2>
          <p>Demonstrații clare, repere simple și cele mai frecvente greșeli pentru fiecare exercițiu.</p>
          <span className="content-card-cta">Descoperă exercițiile <span className="cta-arrow" aria-hidden="true">→</span></span>
        </a>
        <Link className="content-card lifestyle-card" id="lifestyle" href="/stil-de-viata">
          <span className="card-index">01</span><p className="section-kicker">Stil de viață</p><h3>Somnul și stresul. Doi factori esențiali pentru progres.</h3><span className="content-card-cta">Citește articolele <span className="cta-arrow" aria-hidden="true">→</span></span>
        </Link>
        <Link className="content-card nutrition-card" id="nutritie" href="/alimentatie">
          <span className="card-index">02</span><p className="section-kicker">Alimentație</p><h3>Recomandări simple și explicate.</h3><span className="content-card-cta">Vezi ghidurile <span className="cta-arrow" aria-hidden="true">→</span></span>
        </Link>
      </section>

      <section className="pricing-section" id="coaching">
        <div className="pricing-header">
          <div>
            <p className="section-kicker">Abonamentele VEMI</p>
            <h2>Alege cât sprijin<br />vrei pe parcurs.</h2>
          </div>
          <div className="pricing-intro">
            <p>Un plan adaptat profilului tău, cu libertatea de a lucra independent sau de a primi asistență personală.</p>
            <div className="billing-toggle" role="group" aria-label="Alege durata abonamentului">
              <button
                className={billingPeriod === "monthly" ? "active" : ""}
                onClick={() => { setBillingPeriod("monthly"); setSelectedSubscription(null); }}
                aria-pressed={billingPeriod === "monthly"}
              >
                1 lună
              </button>
              <button
                className={billingPeriod === "quarterly" ? "active" : ""}
                onClick={() => { setBillingPeriod("quarterly"); setSelectedSubscription(null); }}
                aria-pressed={billingPeriod === "quarterly"}
              >
                3 luni <span>−17%</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pricing-grid">
          <article className="pricing-card pricing-go">
            <div className="pricing-card-top">
              <span className="pricing-number">01</span>
              <span className="pricing-badge">Independent</span>
            </div>
            <div>
              <p className="pricing-name">VEMI</p>
              <h3>Go</h3>
              <p className="pricing-tagline">Planul tău. Ritmul tău.</p>
            </div>
            <div className="pricing-price" aria-label={`${billingPeriod === "monthly" ? "99,99" : "249,99"} lei pentru ${billingPeriod === "monthly" ? "o lună" : "trei luni"}`}>
              <strong>{billingPeriod === "monthly" ? "99" : "249"}</strong><sup>,99 lei</sup>
              <small>{billingPeriod === "monthly" ? "pentru 1 lună" : "pentru 3 luni"}</small>
            </div>
            <ul className="pricing-features">
              <li><span>✓</span> Plan adaptat profilului tău</li>
              <li><span>✓</span> {billingPeriod === "monthly" ? "4 săptămâni structurate" : "12 săptămâni în trei etape"}</li>
              <li><span>✓</span> Demonstrații și explicații pentru exerciții</li>
              <li><span>✓</span> Progres și jurnal în contul VEMI</li>
              <li className="muted"><span>—</span> Fără asistență personală</li>
            </ul>
            <button className="pricing-cta" onClick={() => setSelectedSubscription("go")}>Alege VEMI Go <span className="cta-arrow" aria-hidden="true">→</span></button>
          </article>

          <article className="pricing-card pricing-plus">
            <div className="pricing-card-top">
              <span className="pricing-number">02</span>
              <span className="pricing-badge">Cu asistență</span>
            </div>
            <div>
              <p className="pricing-name">VEMI</p>
              <h3>Plus</h3>
              <p className="pricing-tagline">Planul tău, cu sprijin pe parcurs.</p>
            </div>
            <div className="pricing-price" aria-label={`${billingPeriod === "monthly" ? "199,99" : "499,99"} lei pentru ${billingPeriod === "monthly" ? "o lună" : "trei luni"}`}>
              <strong>{billingPeriod === "monthly" ? "199" : "499"}</strong><sup>,99 lei</sup>
              <small>{billingPeriod === "monthly" ? "pentru 1 lună" : "pentru 3 luni"}</small>
            </div>
            <ul className="pricing-features">
              <li><span>✓</span> Tot ce este inclus în VEMI Go</li>
              <li><span>✓</span> Asistență personală pe durata planului</li>
              <li><span>✓</span> Întrebări despre program și progres</li>
              <li><span>✓</span> Alegi canalul preferat la plată</li>
            </ul>
            <div className="pricing-channels" aria-label="Canale de asistență disponibile">
              <span>Asistență prin Chat</span>
              <span>Asistență prin WhatsApp</span>
            </div>
            <button className="pricing-cta" onClick={() => setSelectedSubscription("plus")}>Alege VEMI Plus <span className="cta-arrow" aria-hidden="true">→</span></button>
          </article>
        </div>

        {selectedSubscription && (
          <div className="pricing-selection" role="status">
            <span className="pricing-selection-icon">✓</span>
            <div>
              <strong>Ai ales VEMI {selectedSubscription === "go" ? "Go" : "Plus"} · {billingPeriod === "monthly" ? "1 lună" : "3 luni"}</strong>
              <p>
                {selectedSubscription === "plus" && "La plată vei alege între Asistență prin Chat și Asistență prin WhatsApp. "}
                Plata online și activarea abonamentului vor fi conectate în etapa următoare.
              </p>
            </div>
            <button onClick={() => setSelectedSubscription(null)} aria-label="Închide confirmarea">×</button>
          </div>
        )}
      </section>

      <footer>
        <div className="footer-brand"><img className="brand-logo footer-logo" src="/vemi-logo.png" alt="VEMI" /><p>Viață · Energie · Mișcare</p></div>
        <div className="footer-links"><a href={plansOnly ? "#selector" : "/planuri-gratuite"}>Planuri</a><a href={workoutOnly ? "#antrenamentul-meu" : homeLink("#antrenamentul-meu")}>Antrenamentul meu</a><a href={exerciseOnly ? "#biblioteca" : "/exercitii"}>Exerciții</a><Link href="/stil-de-viata">Stil de viață</Link><Link href="/alimentatie">Alimentație</Link><Link href="/abonamente">Abonamente</Link><a href="/contul-meu">Contul meu</a></div>
        <p className="copyright">© 2026 VEMI. Prototip funcțional.</p>
      </footer>
    </main>
  );
}
