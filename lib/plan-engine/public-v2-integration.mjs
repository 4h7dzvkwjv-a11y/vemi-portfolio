import {
  PLAN_ENGINE_V2,
  PROFILE_DOMAINS,
  VALID_PROGRAMS,
  generatePlanV2,
  isV2ProgramAllowedForAge,
  v2ProgramsForAge,
} from "./v2-runtime.mjs";

export const PUBLIC_V2_LEVELS = Object.freeze(["incepator", "avansat"]);
export const PUBLIC_V2_FREQUENCIES_BY_LEVEL = Object.freeze({
  incepator: Object.freeze([3, 4]),
  avansat: Object.freeze([4, 5]),
});

export const PUBLIC_V2_AGE_CATEGORIES = Object.freeze({
  cat1: Object.freeze({ label: "18–29", engineValue: "18-29" }),
  cat2: Object.freeze({ label: "30–44", engineValue: "30-44" }),
  cat3: Object.freeze({ label: "45–59", engineValue: "45-59" }),
  cat4: Object.freeze({ label: "60+", engineValue: "60+" }),
});

const AGE_ALIASES = Object.freeze({
  cat1: "18-29",
  cat2: "30-44",
  cat3: "45-59",
  cat4: "60+",
  "18-29": "18-29",
  "18-30": "18-29",
  "30-44": "30-44",
  "30-45": "30-44",
  "45-59": "45-59",
  "45-60": "45-59",
  "60+": "60+",
});

const PROGRAM_BY_LEVEL_FREQUENCY = Object.freeze({
  "incepator:3": "incepator-3",
  "incepator:4": "incepator-4",
  "avansat:4": "avansat-4",
  "avansat:5": "avansat-5",
});

const VALUE_SETS = Object.freeze({
  gender: new Set(PROFILE_DOMAINS.gender),
  age: new Set(PROFILE_DOMAINS.age),
  goal: new Set(PROFILE_DOMAINS.goal),
  place: new Set(PROFILE_DOMAINS.place),
  program: new Set(PROFILE_DOMAINS.program),
  level: new Set(PUBLIC_V2_LEVELS),
});

export function publicProgramForLevelFrequency(level, frequency) {
  return PROGRAM_BY_LEVEL_FREQUENCY[`${level}:${Number(frequency)}`] ?? null;
}

export function publicProgramDetails(program) {
  const details = VALID_PROGRAMS[program];
  return details ? { level: details.level, frequency: details.daysPerWeek } : null;
}

export function publicFrequenciesForLevel(level) {
  return PUBLIC_V2_FREQUENCIES_BY_LEVEL[level] ?? [];
}

export function publicProgramsForAge(ageInput) {
  const age = AGE_ALIASES[ageInput] ?? ageInput;
  return VALUE_SETS.age.has(age) ? v2ProgramsForAge(age) : [];
}

export function publicV2ProfileKey(profile) {
  return `plan:v2:${profile.gender}:${profile.age}:${profile.goal}:${profile.place}:${profile.program}`;
}

export function normalizePublicV2Selections(input) {
  const issues = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { status: "invalid_profile", issues: ["Selecțiile publice trebuie să fie un obiect."], fallbackUsed: false };
  }

  if (input.engineVersion !== undefined && input.engineVersion !== PLAN_ENGINE_V2) {
    issues.push("Planurile publice noi trebuie să folosească V2.");
  }

  const gender = input.gender;
  const age = AGE_ALIASES[input.ageCategory ?? input.age];
  const goal = input.goal;
  const place = input.place;

  if (!VALUE_SETS.gender.has(gender)) issues.push("Categoria selectată nu este validă.");
  if (!VALUE_SETS.age.has(age)) issues.push("Categoria de vârstă selectată nu este validă.");
  if (!VALUE_SETS.goal.has(goal)) issues.push("Obiectivul selectat nu este valid.");
  if (!VALUE_SETS.place.has(place)) issues.push("Locația selectată nu este validă.");

  const programProvided = input.program !== undefined;
  let program = VALUE_SETS.program.has(input.program) ? input.program : null;
  if (programProvided && !program) issues.push("Programul selectat nu este valid.");
  const hasLevelFrequency = input.level !== undefined || input.frequency !== undefined;
  if (hasLevelFrequency) {
    if (!VALUE_SETS.level.has(input.level)) issues.push("Nivelul selectat nu este valid.");
    const requestedFrequency = Number(input.frequency);
    const normalizedProgram = publicProgramForLevelFrequency(input.level, requestedFrequency);
    if (!normalizedProgram) issues.push("Combinația dintre nivel și frecvență nu este disponibilă.");
    else if (program && program !== normalizedProgram) issues.push("Programul nu corespunde nivelului și frecvenței selectate.");
    else program = normalizedProgram;
  }
  if (!program) issues.push("Nivelul și frecvența nu formează un program valid.");
  if (VALUE_SETS.age.has(age) && program && !isV2ProgramAllowedForAge(age, program)) {
    issues.push("Programul selectat nu este disponibil pentru categoria 60+.");
  }

  if (issues.length) return { status: "invalid_profile", issues, fallbackUsed: false };
  const profile = { gender, age, goal, place, program };
  const details = publicProgramDetails(program);
  return {
    status: "valid",
    engineVersion: PLAN_ENGINE_V2,
    profile,
    level: details.level,
    frequency: details.frequency,
    canonicalKey: publicV2ProfileKey(profile),
    fallbackUsed: false,
  };
}

export function resolvePublicV2Plan(input, catalog, registry) {
  const normalized = normalizePublicV2Selections(input);
  if (normalized.status !== "valid") {
    return {
      status: "invalid_profile",
      issues: normalized.issues,
      engineVersion: PLAN_ENGINE_V2,
      resolver: "public-v2",
      fallbackUsed: false,
    };
  }

  const result = generatePlanV2(normalized.profile, catalog, registry);
  if (result.status !== "found") {
    return {
      ...result,
      engineVersion: PLAN_ENGINE_V2,
      resolver: "public-v2",
      normalizedProfile: normalized.profile,
      canonicalKey: normalized.canonicalKey,
      fallbackUsed: false,
    };
  }
  if (result.plan.engineVersion !== PLAN_ENGINE_V2 || result.plan.planKey !== normalized.canonicalKey) {
    return {
      status: "integration_error",
      issues: ["Resolverul public a întors un plan pentru alt profil."],
      engineVersion: PLAN_ENGINE_V2,
      resolver: "public-v2",
      normalizedProfile: normalized.profile,
      canonicalKey: normalized.canonicalKey,
      fallbackUsed: false,
    };
  }
  return {
    ...result,
    engineVersion: PLAN_ENGINE_V2,
    resolver: "public-v2",
    normalizedProfile: normalized.profile,
    canonicalKey: normalized.canonicalKey,
    fallbackUsed: false,
  };
}

export function projectPublicV2Week(plan, activeWeek) {
  const week = plan?.weeks?.[Number(activeWeek) - 1];
  if (!week) return [];
  return week.days.map((day) => ({
    day: day.day,
    focus: day.title,
    duration: day.duration,
    exercises: day.exercises.map((exercise) => ({
      exerciseKey: exercise.exerciseKey,
      name: exercise.name,
      target: exercise.targetDisplay,
      rest: exercise.restDisplay,
    })),
  }));
}

export function enumeratePublicV2Selections() {
  const selections = [];
  for (const gender of PROFILE_DOMAINS.gender)
    for (const age of PROFILE_DOMAINS.age)
      for (const goal of PROFILE_DOMAINS.goal)
        for (const place of PROFILE_DOMAINS.place)
          for (const program of v2ProgramsForAge(age))
            selections.push({ gender, age, goal, place, program, engineVersion: PLAN_ENGINE_V2 });
  return selections;
}
