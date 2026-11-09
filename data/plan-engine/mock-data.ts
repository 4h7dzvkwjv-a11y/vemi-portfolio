import type {
  ExerciseRegistryEntry,
  PlanConfiguration,
  PlanDay,
  PlanProfile,
  PlanWeek,
  ProfileConfigurationKey,
  TrainingLocation,
} from "../../lib/plan-engine/contracts";

export const MOCK_EXERCISE_REGISTRY: ExerciseRegistryEntry[] = [
  { exercise_key: "demo_exercise_a", display_name: "Exercițiu demonstrativ A", status: "active", available_locations: ["home", "gym"], video_reference: null, metadata: { placeholder: true } },
  { exercise_key: "demo_exercise_b", display_name: "Exercițiu demonstrativ B", status: "active", available_locations: ["home", "gym"], video_reference: null, metadata: { placeholder: true } },
  { exercise_key: "demo_exercise_c", display_name: "Exercițiu demonstrativ C", status: "active", available_locations: ["gym"], video_reference: null, metadata: { placeholder: true } },
  { exercise_key: "demo_exercise_d", display_name: "Exercițiu demonstrativ D", status: "active", available_locations: ["home"], video_reference: null, metadata: { placeholder: true } },
  { exercise_key: "demo_exercise_inactive", display_name: "Exercițiu demonstrativ inactiv", status: "inactive", available_locations: ["home", "gym"], video_reference: null, metadata: { placeholder: true } },
];

function createMockDay(dayNumber: number, weekNumber: number, location: TrainingLocation): PlanDay {
  const gymKeys = ["demo_exercise_a", "demo_exercise_b", "demo_exercise_c"];
  const homeKeys = ["demo_exercise_a", "demo_exercise_d", "demo_exercise_b"];
  const exerciseKey = (location === "gym" ? gymKeys : homeKeys)[(dayNumber - 1) % 3];
  const durationTarget = dayNumber % 2 === 0;
  return {
    day_number: dayNumber,
    display_label: `Ziua ${dayNumber}`,
    title: `Sesiune demonstrativă ${dayNumber}`,
    focus: weekNumber === 1 ? "Test structură" : "Test progresie",
    estimated_minutes: 24 + dayNumber + weekNumber,
    exercises: [{
      order: 1,
      exercise_key: exerciseKey,
      sets: weekNumber === 1 ? 2 : 3,
      target: durationTarget
        ? { kind: "duration_seconds", min: 25 + weekNumber * 5, max: 35 + weekNumber * 5 }
        : { kind: "repetitions", min: 8 + weekNumber, max: 10 + weekNumber },
      rest_seconds: durationTarget ? 45 : 60,
      instructions: "Instrucțiune placeholder — fără recomandare fitness.",
    }],
  };
}

function createMockWeeks(daysPerWeek: number, location: TrainingLocation): PlanWeek[] {
  return [1, 2].map((weekNumber) => ({
    week_number: weekNumber,
    display_label: `Săptămâna ${weekNumber}`,
    progression: {
      summary: weekNumber === 1 ? "Săptămână demonstrativă de bază." : "Progresie demonstrativă controlată.",
      load_guidance: "Date placeholder folosite numai pentru verificarea contractului.",
    },
    days: Array.from({ length: daysPerWeek }, (_, index) => createMockDay(index + 1, weekNumber, location)),
  }));
}

function mockPlan(
  configurationKey: ProfileConfigurationKey,
  profile: PlanProfile,
  title: string,
): PlanConfiguration {
  return {
    schema_version: 1,
    configuration_key: configurationKey,
    profile,
    number_of_weeks: 2,
    metadata: {
      title,
      summary: "Configurație placeholder folosită exclusiv pentru testarea infrastructurii.",
      language: "ro",
      content_status: "mock",
      source_reference: "infrastructure-fixture-v1",
      import_batch: "mock-2026-08",
    },
    weeks: createMockWeeks(profile.days_per_week, profile.location),
  };
}

export const MOCK_PLAN_CONFIGURATIONS: PlanConfiguration[] = [
  mockPlan(
    "plan:v1:male:18_29:weight_loss:gym:advanced:5",
    { gender: "male", age_group: "18_29", goal: "weight_loss", location: "gym", level: "advanced", days_per_week: 5 },
    "Structură demonstrativă · 5 zile",
  ),
  mockPlan(
    "plan:v1:female:30_44:general_fitness:home:beginner:3",
    { gender: "female", age_group: "30_44", goal: "general_fitness", location: "home", level: "beginner", days_per_week: 3 },
    "Structură demonstrativă · 3 zile",
  ),
];
