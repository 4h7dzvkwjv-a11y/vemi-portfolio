import {
  CAT1_HOME_ADVANCED_ONLY,
  CAT1_HOME_ALLOWLIST,
  CAT1_HOME_DUMBBELL_EXERCISES,
  cat1HomeDailyExerciseCount,
  cat1HomeDayFocus,
  cat1HomeDayMatchesStructure,
  cat1HomeDayTitle,
  cat1HomeEditorialTemplate,
  cat1HomeEquipmentClass,
  cat1HomeExerciseApprovedForGender,
  cat1HomeSameFamilyConflicts,
  isCat1HomeEditorialProfile,
} from "./cat1-home-editorial.mjs";
import {
  CAT1_GYM_ADVANCED_ONLY,
  CAT1_GYM_FEMALE_FREE_BAR_FORBIDDEN,
  CAT1_GYM_HOME_ONLY_FORBIDDEN,
  CAT1_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT1_GYM_MALE_CHEST_CABLE,
  cat1GymAllowlist,
  cat1GymDailyExerciseCount,
  cat1GymDayMatchesStructure,
  cat1GymDayTitle,
  cat1GymEditorialTemplate,
  cat1GymExerciseApproved,
  cat1GymSameFamilyConflicts,
  cat1GymShouldRotateFirst,
  isCat1GymEditorialProfile,
} from "./cat1-gym-editorial.mjs";
import {
  CAT2_HOME_ADVANCED_ONLY,
  CAT2_HOME_ALLOWLIST,
  CAT2_HOME_DAY_FOCUS,
  CAT2_HOME_DAY_GROUPS,
  CAT2_HOME_DAY_TITLES,
  CAT2_HOME_GROUP_BY_EXERCISE,
  cat2HomeDailyExerciseCount,
  cat2HomeDayMatchesStructure,
  cat2HomeEditorialTemplate,
  cat2HomeExerciseApprovedForGender,
  cat2HomeSameFamilyConflicts,
  isCat2HomeEditorialProfile,
} from "./cat2-home-editorial.mjs";
import {
  CAT2_GYM_ADVANCED_ONLY,
  CAT2_GYM_HOME_ONLY_FORBIDDEN,
  CAT2_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT2_GYM_MALE_CHEST_CABLE,
  cat2GymAllowlist,
  cat2GymDailyExerciseCount,
  cat2GymDayMatchesStructure,
  cat2GymDayTitle,
  cat2GymEditorialTemplate,
  cat2GymExerciseApproved,
  cat2GymSameFamilyConflicts,
  cat2GymShouldRotateFirst,
  isCat2GymEditorialProfile,
} from "./cat2-gym-editorial.mjs";
import {
  CAT3_HOME_ADVANCED_ONLY,
  CAT3_HOME_ALLOWLIST,
  CAT3_HOME_DAY_FOCUS,
  CAT3_HOME_DAY_TITLES,
  CAT3_HOME_GROUP_BY_EXERCISE,
  cat3HomeDailyExerciseCount,
  cat3HomeDayMatchesStructure,
  cat3HomeEditorialTemplate,
  cat3HomeExerciseApprovedForGender,
  cat3HomeSameFamilyConflicts,
  cat3HomeSurfaceTransitions,
  isCat3HomeEditorialProfile,
} from "./cat3-home-editorial.mjs";
import {
  CAT3_GYM_ADVANCED_ONLY,
  CAT3_GYM_DAY_FOCUS,
  CAT3_GYM_DAY_GROUPS,
  CAT3_GYM_DAY_TITLES,
  CAT3_GYM_HOME_ONLY_FORBIDDEN,
  CAT3_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT3_GYM_MALE_CHEST_CABLE,
  cat3GymAllowlist,
  cat3GymDailyExerciseCount,
  cat3GymEditorialTemplate,
  cat3GymExerciseApproved,
  cat3GymSameFamilyConflicts,
  cat3GymShouldRotateFirst,
  isCat3GymEditorialProfile,
} from "./cat3-gym-editorial.mjs";
import {
  CAT4_HOME_ALLOWLIST,
  CAT4_HOME_CRUNCH_PAIR,
  CAT4_HOME_FLOOR_EXERCISES,
  CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR,
  CAT4_HOME_STANDING_EXERCISES,
  cat4HomeDailyExerciseCount,
  cat4HomeEditorialTemplate,
  isCat4HomeEditorialProfile,
} from "./cat4-home-editorial.mjs";
import {
  CAT4_GYM_ALLOWLIST,
  CAT4_GYM_DAY_GROUPS,
  CAT4_GYM_DAY_TITLES,
  CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE,
  cat4GymDailyExerciseCount,
  cat4GymEditorialTemplate,
  isCat4GymEditorialProfile,
} from "./cat4-gym-editorial.mjs";

export const PLAN_ENGINE_V2 = "v2";

export const VALID_PROGRAMS = Object.freeze({
  "incepator-3": Object.freeze({ level: "incepator", daysPerWeek: 3 }),
  "incepator-4": Object.freeze({ level: "incepator", daysPerWeek: 4 }),
  "avansat-4": Object.freeze({ level: "avansat", daysPerWeek: 4 }),
  "avansat-5": Object.freeze({ level: "avansat", daysPerWeek: 5 }),
});

export const PROFILE_DOMAINS = Object.freeze({
  gender: Object.freeze(["masculin", "feminin"]),
  age: Object.freeze(["18-29", "30-44", "45-59", "60+"]),
  goal: Object.freeze(["masa", "slabire", "forma"]),
  place: Object.freeze(["acasa", "sala"]),
  program: Object.freeze(Object.keys(VALID_PROGRAMS)),
});

export const CAT4_VALID_PROGRAMS = Object.freeze(["incepator-3", "avansat-4"]);

export function v2ProgramsForAge(age) {
  return age === "60+" ? CAT4_VALID_PROGRAMS : PROFILE_DOMAINS.program;
}

export function isV2ProgramAllowedForAge(age, program) {
  return v2ProgramsForAge(age).includes(program);
}

export const SCORE_WEIGHTS = Object.freeze({
  role: Object.freeze({ principal: 30, secundar: 21, auxiliar: 12 }),
  genderPriority: 5,
  requestedRole: 9,
  levelPreferred: 6,
  advancedSpecific: 15,
  locationSpecific: 6,
  age60: Object.freeze({ preferred: 13, allowed: 4, reduced_priority: -9, not_default: -20 }),
  goal: Object.freeze({ strength: 7, cardio: 12, principalForMass: 6, auxiliaryForFitness: 3 }),
  variationAlternative: 28,
  variationDifferent: 5,
  variationCorePenalty: -30,
  previousVariationPenalty: -18,
  membershipOrderStep: 0.04,
  deterministicTieRange: 4,
});

const PROFILE_VALUE_SETS = Object.fromEntries(
  Object.entries(PROFILE_DOMAINS).map(([key, values]) => [key, new Set(values)]),
);
const ROLE_VALUES = new Set(["principal", "secundar", "auxiliar"]);
const LEVEL_VALUES = new Set(["incepator", "intermediar", "avansat"]);
const AGE_60_VALUES = new Set(["preferred", "allowed", "reduced_priority", "not_default"]);
const TRAINING_DAY_POSITIONS = Object.freeze({
  3: Object.freeze([1, 3, 5]),
  4: Object.freeze([1, 2, 4, 6]),
  5: Object.freeze([1, 2, 3, 5, 6]),
});

const slot = (slotKey, groups, roles, mode = "strength") => ({ slotKey, groups, roles, mode });
const legsMain = (key) => slot(key, ["Picioare"], ["principal"]);
const legsSupport = (key) => slot(key, ["Picioare"], ["secundar", "auxiliar"]);
const chestMain = (key) => slot(key, ["Piept"], ["principal"]);
const chestSupport = (key) => slot(key, ["Piept"], ["secundar", "auxiliar"]);
const backMain = (key) => slot(key, ["Spate"], ["principal"]);
const backSupport = (key) => slot(key, ["Spate"], ["secundar", "auxiliar"]);
const shoulder = (key, roles = ["principal", "secundar", "auxiliar"]) => slot(key, ["Umeri"], roles);
const core = (key) => slot(key, ["Abdomen"], ["principal", "secundar", "auxiliar"]);
const coreMain = (key) => slot(key, ["Abdomen"], ["principal", "secundar"]);
const coreSupport = (key) => slot(key, ["Abdomen"], ["secundar", "auxiliar"]);
const biceps = (key) => slot(key, ["Biceps"], ["principal", "secundar", "auxiliar"]);
const triceps = (key) => slot(key, ["Triceps"], ["principal", "secundar", "auxiliar"]);
const cardio = (key) => slot(key, ["Cardio", "Abdomen"], ["principal", "secundar"], "cardio");
const upperPool = (key) => slot(key, ["Piept", "Spate", "Umeri", "Biceps", "Triceps"], ["principal", "secundar", "auxiliar"]);

function goalSlot(goal, daysPerWeek, dayIndex) {
  if (goal === "masa") {
    if (daysPerWeek === 3) return [shoulder, legsSupport, legsSupport][dayIndex](`goal-mass-${dayIndex + 1}`);
    return upperPool(`goal-mass-${dayIndex + 1}`);
  }
  if (goal === "slabire") {
    const cardioDays = daysPerWeek === 3 ? new Set([0, 2]) : daysPerWeek === 4 ? new Set([0, 3]) : new Set([0, 2, 4]);
    if (cardioDays.has(dayIndex)) return cardio(`goal-cardio-${dayIndex + 1}`);
    return dayIndex % 2 === 0 ? core(`goal-density-${dayIndex + 1}`) : chestSupport(`goal-density-${dayIndex + 1}`);
  }
  const cardioDays = daysPerWeek === 3 ? new Set([0, 2]) : daysPerWeek === 4 ? new Set([1, 2]) : new Set([1, 4]);
  if (cardioDays.has(dayIndex)) return cardio(`goal-fitness-${dayIndex + 1}`);
  return dayIndex % 2 === 0 ? core(`goal-balance-${dayIndex + 1}`) : chestSupport(`goal-balance-${dayIndex + 1}`);
}

function structureTemplate(profile) {
  const program = VALID_PROGRAMS[profile.program];
  if (!program) return null;
  const goal = profile.goal;

  if (program.daysPerWeek === 3) {
    const days = [
      {
        title: "Tot corpul · Bază",
        focus: "Picioare, împins, tras și trunchi",
        slots: [legsMain("d1-legs"), chestMain("d1-chest"), backMain("d1-back"), coreMain("d1-core")],
      },
      {
        title: "Tot corpul · Control",
        focus: "Picioare, umeri, spate și brațe",
        slots: [legsMain("d2-legs"), shoulder("d2-shoulders", ["principal", "secundar"]), backSupport("d2-back"), biceps("d2-biceps"), coreSupport("d2-core")],
      },
      {
        title: "Tot corpul · Consolidare",
        focus: "Picioare, piept, spate și trunchi",
        slots: [legsMain("d3-legs"), chestMain("d3-chest"), backMain("d3-back"), coreSupport("d3-core"), triceps("d3-triceps")],
      },
    ];
    return days.map((day, index) => ({ ...day, slots: [...day.slots, goalSlot(goal, 3, index)] }));
  }

  if (program.daysPerWeek === 4) {
    const days = [
      {
        title: "Partea superioară A",
        focus: "Piept, spate, umeri și brațe",
        slots: [chestMain("d1-chest"), backMain("d1-back"), shoulder("d1-shoulders", ["principal", "secundar"]), triceps("d1-triceps"), coreSupport("d1-core")],
      },
      {
        title: "Partea inferioară A",
        focus: "Picioare, lanț posterior și trunchi",
        slots: [legsMain("d2-legs-main"), legsSupport("d2-legs-support"), legsSupport("d2-legs-accessory"), slot("d2-posterior", ["Picioare", "Spate"], ["secundar", "auxiliar"]), coreMain("d2-core")],
      },
      {
        title: "Partea superioară B",
        focus: "Spate, piept, umeri și brațe",
        slots: [backMain("d3-back"), chestMain("d3-chest"), shoulder("d3-shoulders", ["secundar", "auxiliar"]), biceps("d3-biceps"), coreSupport("d3-core")],
      },
      {
        title: "Partea inferioară B",
        focus: "Picioare, stabilitate și abdomen",
        slots: [legsMain("d4-legs-main"), legsSupport("d4-legs-support"), legsSupport("d4-legs-accessory"), slot("d4-posterior", ["Picioare", "Spate"], ["secundar", "auxiliar"]), coreSupport("d4-core")],
      },
    ];
    const goalDays = goal === "masa" ? new Set([0])
      : goal === "slabire" ? new Set([0, 3])
        : new Set([1, 2]);
    return days.map((day, index) => ({
      ...day,
      slots: goalDays.has(index)
        ? [...day.slots, goal === "masa"
          ? (index === 0 ? chestSupport("goal-mass-upper-a") : backSupport("goal-mass-upper-b"))
          : cardio(`goal-${goal}-${index + 1}`)]
        : day.slots,
    }));
  }

  const days = [
    {
      title: "Împins",
      focus: "Piept, umeri și triceps",
      slots: [chestMain("d1-chest-main"), chestSupport("d1-chest-support"), shoulder("d1-shoulder-main", ["principal", "secundar"]), shoulder("d1-shoulder-support", ["auxiliar", "secundar"]), slot("d1-triceps", ["Triceps"], ["principal", "secundar"])],
    },
    {
      title: "Tras",
      focus: "Spate, biceps și trunchi",
      slots: [backMain("d2-back-main"), backSupport("d2-back-support"), backSupport("d2-back-accessory"), biceps("d2-biceps"), coreSupport("d2-core")],
    },
    {
      title: "Picioare",
      focus: "Picioare și abdomen",
      slots: [legsMain("d3-legs-main"), legsMain("d3-legs-second"), legsSupport("d3-legs-support"), legsSupport("d3-legs-accessory"), coreMain("d3-core")],
    },
    {
      title: "Partea superioară",
      focus: "Împins, tras și stabilitate",
      slots: [chestMain("d4-chest"), backMain("d4-back"), coreSupport("d4-core"), slot("d4-balance", ["Piept", "Spate", "Biceps", "Triceps", "Abdomen"], ["secundar", "auxiliar"])],
    },
    {
      title: "Picioare și condiționare",
      focus: "Picioare, trunchi și efort controlat",
      slots: [legsMain("d5-legs-main"), legsSupport("d5-legs-support"), legsSupport("d5-legs-accessory"), coreSupport("d5-core"), cardio("d5-cardio")],
    },
  ];
  if (goal === "slabire") {
    days[0].slots[4] = cardio("goal-weight-day-1");
    days[2].slots[4] = cardio("goal-weight-day-3");
  } else if (goal === "forma") {
    days[1].slots[4] = cardio("goal-fitness-day-2");
  } else {
    days[4].slots[4] = coreSupport("goal-mass-day-5");
  }
  return days;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePlanKey(profile) {
  return `plan:v2:${profile.gender}:${profile.age}:${profile.goal}:${profile.place}:${profile.program}`;
}

export function validateV2Profile(profile) {
  const issues = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return { valid: false, issues: ["Profilul trebuie să fie un obiect."] };
  }
  for (const field of ["gender", "age", "goal", "place", "program"]) {
    if (!PROFILE_VALUE_SETS[field].has(profile[field])) issues.push(`Valoarea ${field} nu este acceptată.`);
  }
  if (PROFILE_VALUE_SETS.age.has(profile.age)
    && PROFILE_VALUE_SETS.program.has(profile.program)
    && !isV2ProgramAllowedForAge(profile.age, profile.program)) {
    issues.push("Programul selectat nu este disponibil pentru categoria 60+.");
  }
  return { valid: issues.length === 0, issues };
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && [...left].sort().join("|") === [...right].sort().join("|");
}

export function validateV2Registry(catalog, registry) {
  const issues = [];
  if (!Array.isArray(catalog)) return { valid: false, issues: ["Catalogul activ trebuie să fie o listă."] };
  if (!registry || registry.schema_version !== "vemi-plan-engine-rules-v2.0" || !Array.isArray(registry.rules)) {
    return { valid: false, issues: ["Registry-ul Punctul 2 nu are contractul V2 valid."] };
  }
  if (registry.exercise_count !== 114 || registry.rules.length !== 114 || catalog.length !== 114) {
    issues.push(`Plan Engine V2 cere exact 114 exerciții active și 114 reguli; catalog=${catalog.length}, reguli=${registry.rules.length}.`);
  }

  const catalogByKey = new Map();
  for (const exercise of catalog) {
    if (!exercise?.id || catalogByKey.has(exercise.id)) issues.push(`Cheie activă lipsă sau duplicată: ${exercise?.id ?? "lipsește"}.`);
    else catalogByKey.set(exercise.id, exercise);
  }
  const ruleByKey = new Map();
  for (const rule of registry.rules) {
    if (!rule?.exercise_key || ruleByKey.has(rule.exercise_key)) {
      issues.push(`Regulă lipsă sau duplicată: ${rule?.exercise_key ?? "lipsește"}.`);
      continue;
    }
    ruleByKey.set(rule.exercise_key, rule);
    const exercise = catalogByKey.get(rule.exercise_key);
    if (!exercise) {
      issues.push(`Regula ${rule.exercise_key} nu are exercițiu activ.`);
      continue;
    }
    if (exercise.name !== rule.canonical_name || exercise.group !== rule.canonical_group || exercise.kind !== rule.kind) {
      issues.push(`Identitatea live nu corespunde Punctului 2 pentru ${rule.exercise_key}.`);
    }
    if (!sameStringArray(exercise.places, rule.places)) issues.push(`Locațiile diferă pentru ${rule.exercise_key}.`);
    if (!Number.isInteger(rule.male_priority) || !Number.isInteger(rule.female_priority)
      || rule.male_priority < 0 || rule.female_priority < 0) issues.push(`Prioritate invalidă pentru ${rule.exercise_key}.`);
    if (!Number.isInteger(rule.min_rotation_days?.male) || !Number.isInteger(rule.min_rotation_days?.female)
      || rule.min_rotation_days.male < 1 || rule.min_rotation_days.male > 7
      || rule.min_rotation_days.female < 1 || rule.min_rotation_days.female > 7) {
      issues.push(`Rotație invalidă pentru ${rule.exercise_key}.`);
    }
    if (!ROLE_VALUES.has(rule.role?.tier)) issues.push(`Rol invalid pentru ${rule.exercise_key}.`);
    if (!Array.isArray(rule.level?.eligible) || rule.level.eligible.some((level) => !LEVEL_VALUES.has(level))) {
      issues.push(`Eligibilitate de nivel invalidă pentru ${rule.exercise_key}.`);
    }
    if (!AGE_60_VALUES.has(rule.age_60_plus?.selection)) issues.push(`Regulă 60+ invalidă pentru ${rule.exercise_key}.`);
    if (typeof exercise.recommendedTarget !== "string" || !exercise.recommendedTarget.trim()) {
      issues.push(`Recomandarea editorială lipsește pentru ${rule.exercise_key}.`);
    }
  }
  for (const key of catalogByKey.keys()) if (!ruleByKey.has(key)) issues.push(`Exercițiul activ ${key} nu are Punctul 2.`);
  for (const rule of registry.rules) {
    for (const alternative of rule.alternatives ?? []) {
      if (!ruleByKey.has(alternative)) issues.push(`Alternativa ${alternative} din ${rule.exercise_key} nu există.`);
    }
  }
  return { valid: issues.length === 0, issues };
}

function hasCardioContext(record) {
  return record.exercise.kind === "cardio"
    || record.exercise.group === "Cardio"
    || record.exercise.memberships?.some((membership) => membership.collectionKey === "cardio");
}

function membershipOrder(record) {
  const canonicalKey = record.exercise.group.toLocaleLowerCase("ro");
  return record.exercise.memberships?.find((membership) => membership.collectionKey === canonicalKey)?.orderIndex ?? 100;
}

function conflictsInDay(candidate, selectedRecords) {
  return selectedRecords.some((selected) =>
    candidate.rule.alternatives.includes(selected.exercise.id)
    || selected.rule.alternatives.includes(candidate.exercise.id)
    || candidate.rule.exclusion_keys.includes(selected.exercise.id)
    || selected.rule.exclusion_keys.includes(candidate.exercise.id),
  );
}

function candidateScore(candidate, context) {
  const { profile, requestedSlot, seed, coreKey, previousVariationKey } = context;
  const genderPriority = profile.gender === "masculin" ? candidate.rule.male_priority : candidate.rule.female_priority;
  let score = SCORE_WEIGHTS.role[candidate.rule.role.tier] + genderPriority * SCORE_WEIGHTS.genderPriority;
  if (requestedSlot.roles.includes(candidate.rule.role.tier)) score += SCORE_WEIGHTS.requestedRole;
  if (candidate.rule.level.preferred.includes(VALID_PROGRAMS[profile.program].level)) score += SCORE_WEIGHTS.levelPreferred;
  if (VALID_PROGRAMS[profile.program].level === "avansat"
    && candidate.rule.level.eligible.includes("avansat")
    && !candidate.rule.level.eligible.includes("incepator")) score += SCORE_WEIGHTS.advancedSpecific;
  if (profile.place === "sala" && candidate.rule.places.length === 1 && candidate.rule.places[0] === "sala") {
    score += SCORE_WEIGHTS.locationSpecific;
  }
  if (profile.age === "60+") score += SCORE_WEIGHTS.age60[candidate.rule.age_60_plus.selection];

  const cardioContext = hasCardioContext(candidate);
  if (profile.goal === "masa") {
    score += cardioContext ? -SCORE_WEIGHTS.goal.cardio : SCORE_WEIGHTS.goal.strength;
    if (candidate.rule.role.tier === "principal") score += SCORE_WEIGHTS.goal.principalForMass;
  } else if (profile.goal === "slabire") {
    score += cardioContext ? SCORE_WEIGHTS.goal.cardio : SCORE_WEIGHTS.goal.strength;
  } else {
    score += SCORE_WEIGHTS.goal.strength;
    if (candidate.rule.role.tier === "auxiliar") score += SCORE_WEIGHTS.goal.auxiliaryForFitness;
  }

  if (coreKey) {
    const coreRule = context.ruleByKey.get(coreKey);
    if (coreRule?.alternatives.includes(candidate.exercise.id)) score += SCORE_WEIGHTS.variationAlternative;
    else if (candidate.exercise.id !== coreKey) score += SCORE_WEIGHTS.variationDifferent;
    else score += SCORE_WEIGHTS.variationCorePenalty;
  }
  if (previousVariationKey && candidate.exercise.id === previousVariationKey) {
    score += SCORE_WEIGHTS.previousVariationPenalty;
  }
  score += Math.max(0, 100 - membershipOrder(candidate)) * SCORE_WEIGHTS.membershipOrderStep;
  score += (stableHash(`${seed}:${requestedSlot.slotKey}:${candidate.exercise.id}`) % 10_000) / 10_000
    * SCORE_WEIGHTS.deterministicTieRange;
  return score;
}

function selectForSlot(context) {
  const { records, profile, requestedSlot, selectedWeekKeys, selectedDayRecords } = context;
  const level = VALID_PROGRAMS[profile.program].level;
  const eligible = records.filter((record) => {
    const genderPriority = profile.gender === "masculin" ? record.rule.male_priority : record.rule.female_priority;
    if (genderPriority <= 0) return false;
    if (!record.exercise.places.includes(profile.place) || !record.rule.places.includes(profile.place)) return false;
    if (!record.rule.level.eligible.includes(level)) return false;
    if (!requestedSlot.groups.includes(record.exercise.group)) return false;
    if (requestedSlot.mode === "cardio" && !hasCardioContext(record)) return false;
    if (requestedSlot.mode === "strength" && record.exercise.kind === "cardio") return false;
    if (selectedDayRecords.some((selected) => selected.exercise.id === record.exercise.id)) return false;
    const minRotation = profile.gender === "masculin"
      ? record.rule.min_rotation_days.male
      : record.rule.min_rotation_days.female;
    const previousDay = context.lastUseByKey.get(record.exercise.id);
    if (previousDay && context.currentAbsoluteDay - previousDay < minRotation) return false;
    const corePositions = context.corePositions?.get(record.exercise.id);
    if (corePositions) {
      const schedule = TRAINING_DAY_POSITIONS[VALID_PROGRAMS[profile.program].daysPerWeek];
      for (const corePosition of corePositions) {
        const coreBaseDay = schedule[corePosition.dayIndex];
        if (context.weekNumber === 2
          && (context.currentAbsoluteDay - coreBaseDay < minRotation || coreBaseDay + 14 - context.currentAbsoluteDay < minRotation)) return false;
        if (context.weekNumber === 4 && context.currentAbsoluteDay - (coreBaseDay + 14) < minRotation) return false;
      }
    }
    if (conflictsInDay(record, selectedDayRecords)) return false;
    return true;
  });
  if (!eligible.length) return null;

  let contextPool = eligible;
  const auxiliaryLimit = Math.floor(context.daySlotCount / 2);
  const selectedAuxiliary = selectedDayRecords.filter((selected) => selected.rule.role.tier === "auxiliar").length;
  if (selectedAuxiliary >= auxiliaryLimit) {
    const nonAuxiliary = contextPool.filter((candidate) => candidate.rule.role.tier !== "auxiliar");
    if (nonAuxiliary.length) contextPool = nonAuxiliary;
  }

  if (context.variationMode === "retain") {
    const retained = contextPool.find((candidate) => candidate.exercise.id === context.coreKey);
    if (retained) return retained;
  }

  const requestedRolePool = contextPool.filter((candidate) => requestedSlot.roles.includes(candidate.rule.role.tier));
  const unusedRequestedRole = requestedRolePool.filter((candidate) => !selectedWeekKeys.has(candidate.exercise.id));
  const unusedAnyRole = contextPool.filter((candidate) => !selectedWeekKeys.has(candidate.exercise.id));
  const dayHasPrincipal = selectedDayRecords.some((selected) => selected.rule.role.tier === "principal");
  const principalPool = requestedSlot.roles.includes("principal") && !dayHasPrincipal
    ? contextPool.filter((candidate) => candidate.rule.role.tier === "principal")
    : [];
  const unusedPrincipal = principalPool.filter((candidate) => !selectedWeekKeys.has(candidate.exercise.id));
  let preferredPool = unusedPrincipal.length ? unusedPrincipal
    : principalPool.length ? principalPool
      : unusedRequestedRole.length ? unusedRequestedRole
        : unusedAnyRole.length ? unusedAnyRole
          : requestedRolePool.length ? requestedRolePool
            : contextPool;
  if (context.variationMode === "vary" && context.coreKey) {
    const roleRank = { auxiliar: 1, secundar: 2, principal: 3 };
    const coreRole = context.ruleByKey.get(context.coreKey)?.role.tier;
    const sameOrStrongerRole = preferredPool.filter((candidate) => roleRank[candidate.rule.role.tier] >= roleRank[coreRole]);
    if (sameOrStrongerRole.length) preferredPool = sameOrStrongerRole;
  }
  const unreserved = preferredPool.filter((candidate) =>
    !context.corePositions?.has(candidate.exercise.id) || candidate.exercise.id === context.coreKey,
  );
  if (unreserved.length) preferredPool = unreserved;

  const scored = preferredPool.map((candidate) => ({ candidate, score: candidateScore(candidate, context) }))
    .sort((left, right) => right.score - left.score || left.candidate.exercise.id.localeCompare(right.candidate.exercise.id));
  if (context.variationMode !== "vary") return scored[0].candidate;
  const withoutCoreAndPrevious = scored.find(({ candidate }) =>
    candidate.exercise.id !== context.coreKey && candidate.exercise.id !== context.previousVariationKey,
  );
  const withoutCore = scored.find(({ candidate }) => candidate.exercise.id !== context.coreKey);
  return (withoutCoreAndPrevious ?? withoutCore ?? scored[0]).candidate;
}

function parseRecommendation(value) {
  const recommendation = value.trim();
  const explicitSets = Number(recommendation.match(/^(\d+)\s*[×x]/i)?.[1] ?? 0);
  const range = recommendation.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!range) throw new Error(`Recomandarea nu poate fi interpretată: ${recommendation}.`);
  const min = Number(range[1]);
  const max = Number(range[2]);
  const suffix = /fiecare braț/i.test(recommendation) ? " / braț"
    : /fiecare picior/i.test(recommendation) ? " / picior"
      : /fiecare parte/i.test(recommendation) ? " / parte" : "";
  if (/minute/i.test(recommendation)) return { kind: "duration_seconds", min: min * 60, max: max * 60, explicitSets: explicitSets || 1, unit: "minute", suffix };
  if (/secunde/i.test(recommendation)) return { kind: "duration_seconds", min, max, explicitSets, unit: "secunde", suffix };
  return { kind: "repetitions", min, max, explicitSets, unit: "repetări", suffix };
}

function progressedRange(target, weekNumber) {
  const midpoint = Math.max(target.min, Math.min(target.max, Math.round((target.min + target.max) / 2)));
  if (weekNumber === 1) return { min: target.min, max: midpoint };
  if (weekNumber === 2) return { min: target.min, max: target.max };
  return { min: midpoint, max: target.max };
}

function planExercise(record, profile, weekNumber, order, options = {}) {
  const recommendation = parseRecommendation(record.exercise.recommendedTarget);
  const fixedVolume = options.fixedVolume === true;
  const target = fixedVolume
    ? { min: recommendation.min, max: recommendation.max }
    : progressedRange(recommendation, weekNumber);
  const role = record.rule.role.tier;
  const level = VALID_PROGRAMS[profile.program].level;
  let sets = recommendation.explicitSets || (level === "avansat"
    ? role === "principal" ? 4 : 3
    : role === "auxiliar" ? 2 : 3);
  if (profile.goal === "masa" && level === "avansat" && role === "principal" && recommendation.unit !== "minute") sets += 1;
  if (!fixedVolume && (weekNumber === 3 || weekNumber === 4) && role === "principal" && recommendation.unit !== "minute") sets += 1;
  sets = Math.max(1, Math.min(5, sets));

  let restSeconds = role === "principal" ? 90 : role === "secundar" ? 75 : 60;
  if (level === "incepator") restSeconds = Math.min(restSeconds, 75);
  if (profile.goal === "slabire") restSeconds = Math.max(40, restSeconds - 15);
  if (recommendation.unit === "minute") restSeconds = 60;

  const displayMin = recommendation.unit === "minute" ? Math.round(target.min / 60) : target.min;
  const displayMax = recommendation.unit === "minute" ? Math.round(target.max / 60) : target.max;
  const rangeDisplay = displayMin === displayMax ? `${displayMin}` : `${displayMin}–${displayMax}`;
  const targetDisplay = recommendation.unit === "minute"
    ? `${rangeDisplay} min`
    : recommendation.unit === "secunde"
      ? `${sets} × ${rangeDisplay} sec${recommendation.suffix}`
      : `${sets} × ${rangeDisplay}${recommendation.suffix}`;
  return {
    order,
    exerciseKey: record.exercise.id,
    name: record.exercise.name,
    group: record.exercise.group,
    kind: record.exercise.kind,
    role,
    sets,
    target: { kind: recommendation.kind, min: target.min, max: target.max },
    targetDisplay,
    restSeconds,
    restDisplay: `${restSeconds} sec`,
    sourceRecommendation: record.exercise.recommendedTarget,
  };
}

function buildCat1HomeEditorialPlan(profile, recordsByKey) {
  const template = cat1HomeEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT1 × Acasă nu există pentru profilul selectat.");
  const expectedExerciseCount = cat1HomeDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const exerciseByKey = new Map([...recordsByKey].map(([key, record]) => [key, record.exercise]));
  const ruleByKey = new Map([...recordsByKey].map(([key, record]) => [key, record.rule]));
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate obiectivului și distribuției de echipament.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT1 × Acasă trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const orderedExerciseKeys = orderCat1HomeExerciseKeys(
        exerciseKeys,
        exerciseByKey,
        ruleByKey,
        weekIndex,
        dayIndex,
      );
      const exercises = orderedExerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: cat1HomeDayTitle(profile, weekIndex, dayIndex),
        focus: cat1HomeDayFocus(profile, weekIndex, dayIndex),
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat1-home-editorial-complete",
    weeks,
  };
}

function buildCat1GymEditorialPlan(profile, recordsByKey) {
  const template = cat1GymEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT1 × La sală nu există pentru profilul selectat.");
  const expectedExerciseCount = cat1GymDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const exerciseByKey = new Map([...recordsByKey].map(([key, record]) => [key, record.exercise]));
  const ruleByKey = new Map([...recordsByKey].map(([key, record]) => [key, record.rule]));
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate obiectivului pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT1 × La sală trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const orderedExerciseKeys = orderCat1GymExerciseKeys(
        exerciseKeys,
        exerciseByKey,
        ruleByKey,
        weekIndex,
        dayIndex,
      );
      const exercises = orderedExerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: cat1GymDayTitle(profile, weekIndex, dayIndex),
        focus: [...new Set(exercises.map((exercise) => exercise.group))].join(", "),
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat1-gym-editorial-complete",
    weeks,
  };
}

function buildCat3HomeEditorialPlan(profile, recordsByKey) {
  const template = cat3HomeEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT3 × Acasă nu există pentru profilul selectat.");
  const expectedExerciseCount = cat3HomeDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const titles = CAT3_HOME_DAY_TITLES[profile.program];
  const focuses = CAT3_HOME_DAY_FOCUS[profile.program];
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT3 × Acasă trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const exercises = exerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: titles[dayIndex],
        focus: focuses[dayIndex],
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat3-home-editorial-complete",
    weeks,
  };
}

function buildCat2HomeEditorialPlan(profile, recordsByKey) {
  const template = cat2HomeEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT2 × Acasă nu există pentru profilul selectat.");
  const expectedExerciseCount = cat2HomeDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const titles = CAT2_HOME_DAY_TITLES[profile.program];
  const focuses = CAT2_HOME_DAY_FOCUS[profile.program];
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate obiectivului pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT2 × Acasă trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const exercises = exerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: titles[dayIndex],
        focus: focuses[dayIndex],
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat2-home-editorial-complete",
    weeks,
  };
}

function buildCat2GymEditorialPlan(profile, recordsByKey) {
  const template = cat2GymEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT2 × La sală nu există pentru profilul selectat.");
  const expectedExerciseCount = cat2GymDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const exerciseByKey = new Map([...recordsByKey].map(([key, record]) => [key, record.exercise]));
  const ruleByKey = new Map([...recordsByKey].map(([key, record]) => [key, record.rule]));
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate obiectivului pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT2 × La sală trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const orderedExerciseKeys = orderEditorialExerciseKeys(exerciseKeys, exerciseByKey, ruleByKey);
      const exercises = orderedExerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: cat2GymDayTitle(profile, weekIndex, dayIndex),
        focus: [...new Set(exercises.map((exercise) => exercise.group))].join(", "),
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat2-gym-editorial-complete",
    weeks,
  };
}

function buildCat3GymEditorialPlan(profile, recordsByKey) {
  const template = cat3GymEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT3 × La sală nu există pentru profilul selectat.");
  const program = VALID_PROGRAMS[profile.program];
  const titles = CAT3_GYM_DAY_TITLES[profile.program];
  const focuses = CAT3_GYM_DAY_FOCUS[profile.program];
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate obiectivului pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      const expectedExerciseCount = cat3GymDailyExerciseCount(profile, dayIndex);
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT3 × La sală trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const exercises = exerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: titles[dayIndex],
        focus: focuses[dayIndex],
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat3-gym-editorial-complete",
    weeks,
  };
}

function buildCat4HomeEditorialPlan(profile, recordsByKey) {
  const template = cat4HomeEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT4 × Acasă nu există pentru profilul selectat.");
  const expectedExerciseCount = cat4HomeDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT4 × Acasă trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const exercises = exerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: `Tot corpul · Ziua ${dayIndex + 1}`,
        focus: "Mișcare controlată pentru tot corpul",
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat4-home-editorial-batch-1",
    weeks,
  };
}

function buildCat4GymEditorialPlan(profile, recordsByKey) {
  const template = cat4GymEditorialTemplate(profile);
  if (!template) throw new Error("Șablonul editorial CAT4 × La sală nu există pentru profilul selectat.");
  const expectedExerciseCount = cat4GymDailyExerciseCount(profile);
  const program = VALID_PROGRAMS[profile.program];
  const titles = CAT4_GYM_DAY_TITLES[profile.program];
  const focusByProgram = profile.program === "incepator-3"
    ? ["Piept, umeri și triceps", "Picioare", "Spate, biceps și abdomen"]
    : ["Piept, umeri, triceps și abdomen", "Picioare și abdomen", "Spate, biceps și abdomen", "Picioare și abdomen"];
  const weeks = template.map((weekDays, weekIndex) => ({
    weekNumber: weekIndex + 1,
    label: `Săptămâna ${weekIndex + 1}`,
    progression: "Selecție și ordine adaptate pentru această săptămână.",
    days: weekDays.map((exerciseKeys, dayIndex) => {
      if (exerciseKeys.length !== expectedExerciseCount) {
        throw new Error(`Șablonul editorial CAT4 × La sală trebuie să aibă exact ${expectedExerciseCount} exerciții la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const exercises = exerciseKeys.map((exerciseKey, exerciseIndex) => {
        const record = recordsByKey.get(exerciseKey);
        if (!record) throw new Error(`Exercițiul editorial ${exerciseKey} nu există în catalogul activ.`);
        return planExercise(record, profile, weekIndex + 1, exerciseIndex + 1, { fixedVolume: true });
      });
      const estimatedMinutes = estimateMinutes(exercises);
      return {
        dayNumber: dayIndex + 1,
        day: `Ziua ${dayIndex + 1}`,
        title: titles[dayIndex],
        focus: focusByProgram[dayIndex],
        estimatedMinutes,
        duration: `${estimatedMinutes} min`,
        exercises,
      };
    }),
  }));
  return {
    engineVersion: PLAN_ENGINE_V2,
    planKey: stablePlanKey(profile),
    profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
    structureTemplate: "cat4-gym-editorial-complete",
    weeks,
  };
}

function estimateMinutes(exercises) {
  const seconds = exercises.reduce((total, exercise) => {
    if (exercise.target.kind === "duration_seconds") {
      const active = ((exercise.target.min + exercise.target.max) / 2) * exercise.sets;
      return total + active + Math.max(0, exercise.sets - 1) * exercise.restSeconds;
    }
    return total + exercise.sets * 42 + Math.max(0, exercise.sets - 1) * exercise.restSeconds;
  }, 7 * 60);
  return Math.max(20, Math.round(seconds / 300) * 5);
}

function shouldVarySlot(weekNumber, dayIndex, slotIndex, requestedSlot, profile) {
  if (weekNumber !== 2 && weekNumber !== 4) return false;
  if (requestedSlot.slotKey === "d4-posterior") return false;
  if (requestedSlot.groups.length === 1
    && requestedSlot.groups[0] === "Abdomen"
    && requestedSlot.roles.includes("principal")
    && VALID_PROGRAMS[profile.program].level === "avansat") return false;
  const phase = weekNumber === 2 ? 0 : 1;
  return (dayIndex + slotIndex + phase) % 3 === 0;
}

function buildSelectedWeek({ weekNumber, profile, template, records, ruleByKey, coreWeek, previousVariationWeek, lastUseByKey }) {
  const selectedWeekKeys = new Set();
  const corePositions = coreWeek ? new Map() : null;
  if (coreWeek) {
    for (let dayIndex = 0; dayIndex < coreWeek.days.length; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < coreWeek.days[dayIndex].exercises.length; slotIndex += 1) {
        const exerciseKey = coreWeek.days[dayIndex].exercises[slotIndex].exerciseKey;
        if (!corePositions.has(exerciseKey)) corePositions.set(exerciseKey, []);
        corePositions.get(exerciseKey).push({ dayIndex, slotIndex });
      }
    }
  }
  const seed = `vemi-plan-v2:week-family-${weekNumber}`;
  const schedule = TRAINING_DAY_POSITIONS[VALID_PROGRAMS[profile.program].daysPerWeek];
  const days = template.map((dayTemplate, dayIndex) => {
    const selectedDayRecords = [];
    const currentAbsoluteDay = (weekNumber - 1) * 7 + schedule[dayIndex];
    const exercises = dayTemplate.slots.map((requestedSlot, slotIndex) => {
      const coreKey = coreWeek?.days[dayIndex]?.exercises[slotIndex]?.exerciseKey;
      const previousVariationKey = previousVariationWeek?.days[dayIndex]?.exercises[slotIndex]?.exerciseKey;
      const variationMode = coreWeek
        ? shouldVarySlot(weekNumber, dayIndex, slotIndex, requestedSlot, profile) ? "vary" : "retain"
        : "base";
      const selected = selectForSlot({
        records,
        profile,
        requestedSlot,
        selectedWeekKeys,
        selectedDayRecords,
        seed,
        coreKey,
        previousVariationKey,
        variationMode,
        ruleByKey,
        corePositions,
        weekNumber,
        currentDayIndex: dayIndex,
        currentAbsoluteDay,
        lastUseByKey,
        daySlotCount: dayTemplate.slots.length,
      });
      if (!selected) throw new Error(`Nu există exercițiu eligibil pentru ${dayTemplate.title}, slot ${requestedSlot.slotKey}.`);
      selectedWeekKeys.add(selected.exercise.id);
      selectedDayRecords.push(selected);
      lastUseByKey.set(selected.exercise.id, currentAbsoluteDay);
      return planExercise(selected, profile, weekNumber, slotIndex + 1);
    });
    const estimatedMinutes = estimateMinutes(exercises);
    return {
      dayNumber: dayIndex + 1,
      day: `Ziua ${dayIndex + 1}`,
      title: dayTemplate.title,
      focus: dayTemplate.focus,
      estimatedMinutes,
      duration: `${estimatedMinutes} min`,
      exercises,
    };
  });
  return {
    weekNumber,
    label: `Săptămâna ${weekNumber}`,
    progression: weekNumber === 1 ? "Plan de bază și ritm controlat."
      : weekNumber === 2 ? "Variație controlată prin alternative eligibile."
        : weekNumber === 3 ? "Revenire la nucleul inițial, cu progresie moderată."
          : "A doua variație controlată și consolidarea progresului.",
    days,
  };
}

function buildCoreProgressionWeek(weekOne, profile, recordsByKey, lastUseByKey) {
  const schedule = TRAINING_DAY_POSITIONS[VALID_PROGRAMS[profile.program].daysPerWeek];
  return {
    weekNumber: 3,
    label: "Săptămâna 3",
    progression: "Revenire la nucleul inițial, cu progresie moderată.",
    days: weekOne.days.map((day, dayIndex) => {
      const exercises = day.exercises.map((exercise, index) => planExercise(recordsByKey.get(exercise.exerciseKey), profile, 3, index + 1));
      const currentAbsoluteDay = 14 + schedule[dayIndex];
      for (const exercise of exercises) lastUseByKey.set(exercise.exerciseKey, currentAbsoluteDay);
      const estimatedMinutes = estimateMinutes(exercises);
      return { ...day, estimatedMinutes, duration: `${estimatedMinutes} min`, exercises };
    }),
  };
}

function weekExerciseSignature(week) {
  return week.days.map((day) => day.exercises.map((exercise) => exercise.exerciseKey).join(",")).join("|");
}

function orderEditorialExerciseKeys(exerciseKeys, exerciseByKey, ruleByKey) {
  const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
  return exerciseKeys
    .map((key, index) => ({ key, index }))
    .sort((left, right) => {
      const leftGroup = exerciseByKey.get(left.key)?.group;
      const rightGroup = exerciseByKey.get(right.key)?.group;
      const leftEnding = leftGroup === "Abdomen" || leftGroup === "Cardio" ? 1 : 0;
      const rightEnding = rightGroup === "Abdomen" || rightGroup === "Cardio" ? 1 : 0;
      if (leftEnding !== rightEnding) return leftEnding - rightEnding;
      const leftRole = roleOrder[ruleByKey.get(left.key)?.role?.tier] ?? 3;
      const rightRole = roleOrder[ruleByKey.get(right.key)?.role?.tier] ?? 3;
      return leftRole - rightRole || left.index - right.index;
    })
    .map(({ key }) => key);
}

function orderCat1GymExerciseKeys(exerciseKeys, exerciseByKey, ruleByKey, weekIndex, dayIndex) {
  const ordered = orderEditorialExerciseKeys(exerciseKeys, exerciseByKey, ruleByKey);
  const endings = ordered.filter((key) => {
    const group = exerciseByKey.get(key)?.group;
    return group === "Abdomen" || group === "Cardio";
  });
  const strength = ordered.filter((key) => !endings.includes(key));
  const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
  const result = [];
  for (const roleIndex of [0, 1, 2, 3]) {
    const bucket = strength.filter((key) => (roleOrder[ruleByKey.get(key)?.role?.tier] ?? 3) === roleIndex);
    if (!bucket.length) continue;
    const offset = (weekIndex + dayIndex + 1) % bucket.length;
    result.push(...bucket.slice(offset), ...bucket.slice(0, offset));
  }
  return [...result, ...endings];
}

function orderCat1HomeExerciseKeys(exerciseKeys, exerciseByKey, ruleByKey, weekIndex, dayIndex) {
  const ordered = orderEditorialExerciseKeys(exerciseKeys, exerciseByKey, ruleByKey);
  const endings = ordered.filter((key) => {
    const group = exerciseByKey.get(key)?.group;
    return group === "Abdomen" || group === "Cardio";
  });
  const strength = ordered.filter((key) => !endings.includes(key));
  const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
  const result = [];
  for (const roleIndex of [0, 1, 2, 3]) {
    const bucket = strength.filter((key) => (roleOrder[ruleByKey.get(key)?.role?.tier] ?? 3) === roleIndex);
    if (!bucket.length) continue;
    const offset = (weekIndex + dayIndex) % bucket.length;
    result.push(...bucket.slice(offset), ...bucket.slice(0, offset));
  }
  return [...result, ...endings];
}

function auditCat1GymEditorialPlan(plan, exerciseByKey, ruleByKey) {
  const issues = [];
  const template = cat1GymEditorialTemplate(plan.profile);
  const expectedCount = cat1GymDailyExerciseCount(plan.profile);
  const allowlist = new Set(cat1GymAllowlist(plan.profile));
  const advancedOnlyKeys = new Set(CAT1_GYM_ADVANCED_ONLY);
  const homeOnlyForbidden = new Set(CAT1_GYM_HOME_ONLY_FORBIDDEN);
  const maleAdvancedForbidden = new Set(CAT1_GYM_MALE_ADVANCED_FORBIDDEN);
  const maleChestCable = new Set(CAT1_GYM_MALE_CHEST_CABLE);
  const femaleFreeBarForbidden = new Set(CAT1_GYM_FEMALE_FREE_BAR_FORBIDDEN);
  const beginner = VALID_PROGRAMS[plan.profile.program].level === "incepator";
  const maleAdvanced = plan.profile.gender === "masculin" && !beginner;
  const dailySignatures = new Set();
  let maleChestCableOccurrences = 0;
  for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
    const week = plan.weeks[weekIndex];
    for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
      const day = week.days[dayIndex];
      const keys = day.exercises.map((exercise) => exercise.exerciseKey);
      const selected = template?.[weekIndex]?.[dayIndex];
      const expected = selected
        ? orderCat1GymExerciseKeys(selected, exerciseByKey, ruleByKey, weekIndex, dayIndex)
        : null;
      if (keys.length !== expectedCount) {
        issues.push(`Volum editorial CAT1 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedCount}.`);
      }
      if (!expected || keys.join("|") !== expected.join("|")) {
        issues.push(`Structura editorială CAT1 × La sală diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      if (day.title !== cat1GymDayTitle(plan.profile, weekIndex, dayIndex)) {
        issues.push(`Titlu editorial CAT1 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const actualGroups = day.exercises.map((exercise) => exercise.group);
      if (!cat1GymDayMatchesStructure(plan.profile, weekIndex, dayIndex, actualGroups)) {
        issues.push(`Împărțire musculară CAT1 × La sală invalidă la S${weekIndex + 1} Z${dayIndex + 1}: ${actualGroups.join(", ")}.`);
      }
      if (!day.exercises.some((exercise) => exercise.role === "principal")) {
        issues.push(`Zi fără exercițiu principal în CAT1 × La sală la S${weekIndex + 1} Z${dayIndex + 1}.`);
      }
      const auxiliary = day.exercises.filter((exercise) => exercise.role === "auxiliar").length;
      if (auxiliary > day.exercises.length / 2) {
        issues.push(`Zi dominată de auxiliare în CAT1 × La sală la S${weekIndex + 1} Z${dayIndex + 1}: ${auxiliary}/${day.exercises.length}.`);
      }
      const signature = keys.join("|");
      if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT1 × La sală repetată: ${signature}.`);
      dailySignatures.add(signature);
      const familyConflicts = cat1GymSameFamilyConflicts(keys);
      if (familyConflicts.length) {
        issues.push(`Familii redundante CAT1 × La sală la S${weekIndex + 1} Z${dayIndex + 1}: ${familyConflicts.join(", ")}.`);
      }
      let endingStarted = false;
      let previousRoleOrder = -1;
      const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
      for (const exercise of day.exercises) {
        const ending = exercise.group === "Abdomen" || exercise.group === "Cardio";
        if (ending) endingStarted = true;
        else if (endingStarted) issues.push(`Abdomen/Cardio nu este la final în CAT1 × La sală: S${weekIndex + 1} Z${dayIndex + 1}.`);
        if (!ending) {
          const currentRoleOrder = roleOrder[exercise.role] ?? 3;
          if (currentRoleOrder < previousRoleOrder) {
            issues.push(`Ordinea principal/secundar/auxiliar este invalidă în CAT1 × La sală: S${weekIndex + 1} Z${dayIndex + 1}.`);
          }
          previousRoleOrder = currentRoleOrder;
        }
      }
      for (const key of keys) {
        if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT1 × La sală: ${key}.`);
        if (homeOnlyForbidden.has(key)) issues.push(`Exercițiu exclusiv Acasă generat în CAT1 × La sală: ${key}.`);
        if (beginner && advancedOnlyKeys.has(key)) issues.push(`Exercițiu exclusiv avansat generat la Începător: ${key}.`);
        if (maleAdvanced && maleAdvancedForbidden.has(key)) issues.push(`Flotare interzisă generată la Masculin Avansat: ${key}.`);
        if (key === "flotari-hindu") issues.push("Flotări Hindu nu sunt permise în CAT1 × La sală.");
        if (plan.profile.gender === "feminin" && femaleFreeBarForbidden.has(key)) {
          issues.push(`Bară/halteră liberă generată la Feminin: ${key}.`);
        }
        if (plan.profile.gender === "masculin" && maleChestCable.has(key)) maleChestCableOccurrences += 1;
      }
    }
    const lowerPair = plan.profile.program === "incepator-4" ? [1, 3]
      : plan.profile.program === "avansat-5" ? [2, 4] : null;
    if (lowerPair) {
      const firstLegs = new Set(week.days[lowerPair[0]].exercises
        .filter((exercise) => exercise.group === "Picioare")
        .map((exercise) => exercise.exerciseKey));
      const overlap = week.days[lowerPair[1]].exercises
        .filter((exercise) => exercise.group === "Picioare" && firstLegs.has(exercise.exerciseKey))
        .map((exercise) => exercise.exerciseKey);
      if (overlap.length) {
        issues.push(`Zilele de picioare CAT1 × La sală se suprapun la S${weekIndex + 1}: ${overlap.join(", ")}.`);
      }
    }
  }
  if (maleChestCableOccurrences > 2) {
    issues.push(`Limita cumulată pentru piept la cablu este depășită: ${maleChestCableOccurrences}/2.`);
  }
  if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
    issues.push("Săptămânile CAT1 × La sală trebuie să fie distincte.");
  }
  const expectedDays = VALID_PROGRAMS[plan.profile.program].daysPerWeek;
  for (let dayIndex = 0; dayIndex < expectedDays; dayIndex += 1) {
    if (!cat1GymShouldRotateFirst(plan.profile, dayIndex)) continue;
    const firstExercises = plan.weeks.map((week) => week.days[dayIndex].exercises[0]?.exerciseKey);
    if (new Set(firstExercises).size < 2) {
      issues.push(`Primul exercițiu CAT1 × La sală nu variază pentru Ziua ${dayIndex + 1}.`);
    }
  }
  return issues;
}

export function auditGeneratedPlanV2(plan, catalog, registry) {
  const issues = [];
  const profileValidation = validateV2Profile(plan?.profile);
  if (!profileValidation.valid) issues.push(...profileValidation.issues);
  const registryValidation = validateV2Registry(catalog, registry);
  if (!registryValidation.valid) issues.push(...registryValidation.issues);
  if (!plan || plan.engineVersion !== PLAN_ENGINE_V2 || !Array.isArray(plan.weeks) || plan.weeks.length !== 4) {
    return { valid: false, issues: [...issues, "Planul V2 trebuie să aibă exact patru săptămâni."] };
  }
  const expectedDays = VALID_PROGRAMS[plan.profile.program]?.daysPerWeek;
  const exerciseByKey = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const ruleByKey = new Map(registry.rules.map((rule) => [rule.exercise_key, rule]));
  const lastUseByKey = new Map();
  const cat1HomeEditorial = isCat1HomeEditorialProfile(plan.profile);
  const cat1GymEditorial = isCat1GymEditorialProfile(plan.profile);
  const cat2HomeEditorial = isCat2HomeEditorialProfile(plan.profile);
  const cat2GymEditorial = isCat2GymEditorialProfile(plan.profile);
  const cat3HomeEditorial = isCat3HomeEditorialProfile(plan.profile);
  const cat3GymEditorial = isCat3GymEditorialProfile(plan.profile);
  const cat4HomeEditorial = isCat4HomeEditorialProfile(plan.profile);
  const cat4GymEditorial = isCat4GymEditorialProfile(plan.profile);
  const cat4Editorial = cat4HomeEditorial || cat4GymEditorial;
  const completeEditorial = cat1HomeEditorial || cat1GymEditorial || cat2HomeEditorial || cat2GymEditorial || cat3HomeEditorial || cat3GymEditorial || cat4Editorial;
  for (const week of plan.weeks) {
    if (week.days.length !== expectedDays) issues.push(`Săptămâna ${week.weekNumber} nu are ${expectedDays} zile.`);
    for (const day of week.days) {
      if (!day.exercises.length) issues.push(`Zi goală: S${week.weekNumber} Z${day.dayNumber}.`);
      const dayKeys = new Set();
      const dayRecords = [];
      for (const exercise of day.exercises) {
        const catalogExercise = exerciseByKey.get(exercise.exerciseKey);
        const rule = ruleByKey.get(exercise.exerciseKey);
        if (!catalogExercise || !rule) issues.push(`Cheie necunoscută: ${exercise.exerciseKey}.`);
        else {
          if (!catalogExercise.places.includes(plan.profile.place) || !rule.places.includes(plan.profile.place)) issues.push(`Locație incompatibilă: ${exercise.exerciseKey}.`);
          if (!cat4GymEditorial && !rule.level.eligible.includes(VALID_PROGRAMS[plan.profile.program].level)) issues.push(`Nivel incompatibil: ${exercise.exerciseKey}.`);
          const priority = plan.profile.gender === "masculin" ? rule.male_priority : rule.female_priority;
          if (priority <= 0
            && !cat1HomeExerciseApprovedForGender(plan.profile, exercise.exerciseKey)
            && !cat1GymExerciseApproved(plan.profile, exercise.exerciseKey)
            && !cat2HomeExerciseApprovedForGender(plan.profile, exercise.exerciseKey)
            && !cat2GymExerciseApproved(plan.profile, exercise.exerciseKey)
            && !cat3HomeExerciseApprovedForGender(plan.profile, exercise.exerciseKey)
            && !cat3GymExerciseApproved(plan.profile, exercise.exerciseKey)) {
            issues.push(`Prioritate 0 generată: ${exercise.exerciseKey}.`);
          }
          const record = { exercise: catalogExercise, rule };
          if (!completeEditorial && conflictsInDay(record, dayRecords)) issues.push(`Alternative redundante în aceeași zi: ${exercise.exerciseKey}.`);
          dayRecords.push(record);
          const absoluteDay = (week.weekNumber - 1) * 7 + TRAINING_DAY_POSITIONS[expectedDays][day.dayNumber - 1];
          const previousDay = lastUseByKey.get(exercise.exerciseKey);
          const minRotation = plan.profile.gender === "masculin" ? rule.min_rotation_days.male : rule.min_rotation_days.female;
          if (!completeEditorial && previousDay && absoluteDay - previousDay < minRotation) {
            issues.push(`Rotație sub ${minRotation} zile pentru ${exercise.exerciseKey}.`);
          }
          lastUseByKey.set(exercise.exerciseKey, absoluteDay);
        }
        if (dayKeys.has(exercise.exerciseKey)) issues.push(`Duplicat în aceeași zi: ${exercise.exerciseKey}.`);
        dayKeys.add(exercise.exerciseKey);
      }
    }
  }
  if (cat1GymEditorial) {
    issues.push(...auditCat1GymEditorialPlan(plan, exerciseByKey, ruleByKey));
  } else if (cat1HomeEditorial) {
    const template = cat1HomeEditorialTemplate(plan.profile);
    const expectedExerciseCount = cat1HomeDailyExerciseCount(plan.profile);
    const allowlist = new Set(CAT1_HOME_ALLOWLIST);
    const advancedOnly = new Set(CAT1_HOME_ADVANCED_ONLY);
    const dumbbellKeys = new Set(CAT1_HOME_DUMBBELL_EXERCISES);
    const beginner = VALID_PROGRAMS[plan.profile.program].level === "incepator";
    const dailySignatures = new Set();
    let dumbbellOccurrences = 0;
    let totalOccurrences = 0;
    let beginner3BicepsDays = 0;
    let beginner3TricepsDays = 0;
    let beginner3CoreDays = 0;
    let beginner3CardioDays = 0;
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        const selected = template?.[weekIndex]?.[dayIndex];
        const expected = selected
          ? orderCat1HomeExerciseKeys(selected, exerciseByKey, ruleByKey, weekIndex, dayIndex)
          : null;
        totalOccurrences += keys.length;
        dumbbellOccurrences += keys.filter((key) => dumbbellKeys.has(key)).length;
        if (keys.length !== expectedExerciseCount) {
          issues.push(`Volum editorial CAT1 × Acasă invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedExerciseCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială CAT1 × Acasă diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (day.title !== cat1HomeDayTitle(plan.profile, weekIndex, dayIndex)) {
          issues.push(`Titlu editorial CAT1 × Acasă invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (!cat1HomeDayMatchesStructure(plan.profile, weekIndex, dayIndex, keys)) {
          issues.push(`Împărțire musculară CAT1 × Acasă invalidă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT1 × Acasă repetată: ${signature}.`);
        dailySignatures.add(signature);
        const familyConflicts = cat1HomeSameFamilyConflicts(keys);
        if (familyConflicts.length) {
          issues.push(`Familii redundante CAT1 × Acasă la S${weekIndex + 1} Z${dayIndex + 1}: ${familyConflicts.join(", ")}.`);
        }
        let endingStarted = false;
        let previousRoleOrder = -1;
        const roleOrder = { principal: 0, secundar: 1, auxiliar: 2 };
        for (const exercise of day.exercises) {
          const ending = exercise.group === "Abdomen" || exercise.group === "Cardio";
          if (ending) endingStarted = true;
          else if (endingStarted) issues.push(`Abdomen/Cardio nu este la final în CAT1 × Acasă: S${weekIndex + 1} Z${dayIndex + 1}.`);
          if (!ending) {
            const currentRoleOrder = roleOrder[exercise.role] ?? 3;
            if (currentRoleOrder < previousRoleOrder) {
              issues.push(`Ordinea principal/secundar/auxiliar este invalidă în CAT1 × Acasă: S${weekIndex + 1} Z${dayIndex + 1}.`);
            }
            previousRoleOrder = currentRoleOrder;
          }
        }
        for (const key of keys) {
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT1 × Acasă: ${key}.`);
          if (beginner && advancedOnly.has(key)) issues.push(`Exercițiu exclusiv avansat generat la Începător: ${key}.`);
          if (!cat1HomeEquipmentClass(key)) issues.push(`Clasificare de echipament CAT1 × Acasă lipsă: ${key}.`);
        }
        if (plan.profile.program === "incepator-3") {
          const groups = day.exercises.map((exercise) => exercise.group);
          if (groups.includes("Biceps")) beginner3BicepsDays += 1;
          if (groups.includes("Triceps")) beginner3TricepsDays += 1;
          if (groups.filter((group) => group === "Picioare").length === 3) {
            if (groups.includes("Abdomen")) beginner3CoreDays += 1;
            if (groups.includes("Cardio")) beginner3CardioDays += 1;
          }
        }
      }
      const lowerDayPair = plan.profile.program === "incepator-4" || plan.profile.program === "avansat-4"
        ? [1, 3]
        : plan.profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerDayPair) {
        const firstLegs = new Set(week.days[lowerDayPair[0]].exercises
          .filter((exercise) => exercise.group === "Picioare")
          .map((exercise) => exercise.exerciseKey));
        const overlap = week.days[lowerDayPair[1]].exercises
          .filter((exercise) => exercise.group === "Picioare" && firstLegs.has(exercise.exerciseKey));
        if (overlap.length) {
          issues.push(`Zilele inferioare CAT1 × Acasă se suprapun la S${weekIndex + 1}: ${overlap.map((exercise) => exercise.exerciseKey).join(", ")}.`);
        }
      }
    }
    if (plan.profile.gender === "masculin" && dumbbellOccurrences <= totalOccurrences - dumbbellOccurrences) {
      issues.push(`Gantere nepredominante în planul masculin CAT1 × Acasă: ${dumbbellOccurrences}/${totalOccurrences}.`);
    }
    if (plan.profile.gender === "feminin" && dumbbellOccurrences > totalOccurrences - dumbbellOccurrences) {
      issues.push(`Gantere predominante în planul feminin CAT1 × Acasă: ${dumbbellOccurrences}/${totalOccurrences}.`);
    }
    if (plan.profile.program === "incepator-3"
      && (beginner3BicepsDays !== 3 || beginner3TricepsDays !== 3
        || beginner3CoreDays !== 3 || beginner3CardioDays !== 3)) {
      issues.push(`Alternanța brațe/abdomen/cardio CAT1 × Acasă este invalidă: B${beginner3BicepsDays}/T${beginner3TricepsDays}/A${beginner3CoreDays}/C${beginner3CardioDays}.`);
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT1 × Acasă trebuie să fie distincte.");
    }
  } else if (cat2HomeEditorial) {
    const template = cat2HomeEditorialTemplate(plan.profile);
    const expectedExerciseCount = cat2HomeDailyExerciseCount(plan.profile);
    const expectedTitles = CAT2_HOME_DAY_TITLES[plan.profile.program];
    const expectedGroups = CAT2_HOME_DAY_GROUPS[plan.profile.program];
    const allowlist = new Set(CAT2_HOME_ALLOWLIST);
    const advancedOnly = new Set(CAT2_HOME_ADVANCED_ONLY);
    const beginner = VALID_PROGRAMS[plan.profile.program].level === "incepator";
    const dailySignatures = new Set();
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        const expected = template?.[weekIndex]?.[dayIndex];
        if (keys.length !== expectedExerciseCount) {
          issues.push(`Volum editorial CAT2 × Acasă invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedExerciseCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială CAT2 × Acasă diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (day.title !== expectedTitles[dayIndex]) {
          issues.push(`Titlu editorial CAT2 × Acasă invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const actualGroups = day.exercises.map((exercise) => exercise.group);
        if (actualGroups.join("|") !== expectedGroups[dayIndex].join("|")
          || !cat2HomeDayMatchesStructure(plan.profile.program, dayIndex, keys)) {
          issues.push(`Împărțire musculară CAT2 × Acasă invalidă la S${weekIndex + 1} Z${dayIndex + 1}: ${actualGroups.join(", ")}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT2 × Acasă repetată: ${signature}.`);
        dailySignatures.add(signature);
        const familyConflicts = cat2HomeSameFamilyConflicts(keys);
        if (familyConflicts.length) {
          issues.push(`Familii redundante CAT2 × Acasă la S${weekIndex + 1} Z${dayIndex + 1}: ${familyConflicts.join(", ")}.`);
        }
        for (const key of keys) {
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT2 × Acasă: ${key}.`);
          if (beginner && advancedOnly.has(key)) issues.push(`Exercițiu exclusiv avansat generat la Începător: ${key}.`);
        }
      }
      const lowerDayPair = plan.profile.program === "incepator-4" || plan.profile.program === "avansat-4"
        ? [1, 3]
        : plan.profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerDayPair) {
        const firstLegs = new Set(week.days[lowerDayPair[0]].exercises
          .map((exercise) => exercise.exerciseKey)
          .filter((key) => CAT2_HOME_GROUP_BY_EXERCISE[key] === "Picioare"));
        const overlap = week.days[lowerDayPair[1]].exercises
          .map((exercise) => exercise.exerciseKey)
          .filter((key) => CAT2_HOME_GROUP_BY_EXERCISE[key] === "Picioare" && firstLegs.has(key));
        if (overlap.length) {
          issues.push(`Zilele inferioare CAT2 × Acasă se suprapun la S${weekIndex + 1}: ${overlap.join(", ")}.`);
        }
      }
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT2 × Acasă trebuie să fie distincte.");
    }
  } else if (cat2GymEditorial) {
    const template = cat2GymEditorialTemplate(plan.profile);
    const expectedCount = cat2GymDailyExerciseCount(plan.profile);
    const allowlist = new Set(cat2GymAllowlist(plan.profile));
    const advancedOnlyKeys = new Set(CAT2_GYM_ADVANCED_ONLY);
    const homeOnlyForbidden = new Set(CAT2_GYM_HOME_ONLY_FORBIDDEN);
    const maleAdvancedForbidden = new Set(CAT2_GYM_MALE_ADVANCED_FORBIDDEN);
    const maleChestCable = new Set(CAT2_GYM_MALE_CHEST_CABLE);
    const beginner = VALID_PROGRAMS[plan.profile.program].level === "incepator";
    const maleAdvanced = plan.profile.gender === "masculin" && !beginner;
    const dailySignatures = new Set();
    let maleChestCableOccurrences = 0;
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        const selected = template?.[weekIndex]?.[dayIndex];
        const expected = selected ? orderEditorialExerciseKeys(selected, exerciseByKey, ruleByKey) : null;
        if (keys.length !== expectedCount) {
          issues.push(`Volum editorial CAT2 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială CAT2 × La sală diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (day.title !== cat2GymDayTitle(plan.profile, weekIndex, dayIndex)) {
          issues.push(`Titlu editorial CAT2 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const actualGroups = day.exercises.map((exercise) => exercise.group);
        if (!cat2GymDayMatchesStructure(plan.profile, weekIndex, dayIndex, actualGroups)) {
          issues.push(`Împărțire musculară CAT2 × La sală invalidă la S${weekIndex + 1} Z${dayIndex + 1}: ${actualGroups.join(", ")}.`);
        }
        const auxiliary = day.exercises.filter((exercise) => exercise.role === "auxiliar").length;
        if (auxiliary > day.exercises.length / 2) {
          issues.push(`Zi dominată de auxiliare în CAT2 × La sală la S${weekIndex + 1} Z${dayIndex + 1}: ${auxiliary}/${day.exercises.length}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT2 × La sală repetată: ${signature}.`);
        dailySignatures.add(signature);
        const familyConflicts = cat2GymSameFamilyConflicts(keys);
        if (familyConflicts.length) {
          issues.push(`Familii redundante CAT2 × La sală la S${weekIndex + 1} Z${dayIndex + 1}: ${familyConflicts.join(", ")}.`);
        }
        for (const key of keys) {
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT2 × La sală: ${key}.`);
          if (homeOnlyForbidden.has(key)) issues.push(`Exercițiu exclusiv Acasă generat în CAT2 × La sală: ${key}.`);
          if (beginner && advancedOnlyKeys.has(key)) issues.push(`Exercițiu exclusiv avansat generat la Începător: ${key}.`);
          if (maleAdvanced && maleAdvancedForbidden.has(key)) issues.push(`Flotare interzisă generată la Masculin Avansat: ${key}.`);
          if (key === "flotari-hindu") issues.push("Flotări Hindu nu sunt permise în CAT2 × La sală.");
          if (plan.profile.gender === "masculin" && maleChestCable.has(key)) maleChestCableOccurrences += 1;
        }
      }
      const lowerPair = plan.profile.program === "incepator-4" ? [1, 3]
        : plan.profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerPair) {
        const firstLegs = new Set(week.days[lowerPair[0]].exercises
          .filter((exercise) => exercise.group === "Picioare")
          .map((exercise) => exercise.exerciseKey));
        const overlap = week.days[lowerPair[1]].exercises
          .filter((exercise) => exercise.group === "Picioare" && firstLegs.has(exercise.exerciseKey))
          .map((exercise) => exercise.exerciseKey);
        if (overlap.length) {
          issues.push(`Zilele de picioare CAT2 × La sală se suprapun la S${weekIndex + 1}: ${overlap.join(", ")}.`);
        }
      }
    }
    if (maleChestCableOccurrences > 2) {
      issues.push(`Limita cumulată pentru piept la cablu este depășită: ${maleChestCableOccurrences}/2.`);
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT2 × La sală trebuie să fie distincte.");
    }
    for (let dayIndex = 0; dayIndex < expectedDays; dayIndex += 1) {
      if (!cat2GymShouldRotateFirst(plan.profile, dayIndex)) continue;
      const firstExercises = plan.weeks.map((week) => week.days[dayIndex].exercises[0]?.exerciseKey);
      if (new Set(firstExercises).size < 2) {
        issues.push(`Primul exercițiu CAT2 × La sală nu variază pentru Ziua ${dayIndex + 1}.`);
      }
    }
  } else if (cat3GymEditorial) {
    const template = cat3GymEditorialTemplate(plan.profile);
    const expectedTitles = CAT3_GYM_DAY_TITLES[plan.profile.program];
    const expectedGroups = CAT3_GYM_DAY_GROUPS[plan.profile.program];
    const allowlist = new Set(cat3GymAllowlist(plan.profile));
    const advancedOnlyKeys = new Set(CAT3_GYM_ADVANCED_ONLY);
    const homeOnlyForbidden = new Set(CAT3_GYM_HOME_ONLY_FORBIDDEN);
    const maleAdvancedForbidden = new Set(CAT3_GYM_MALE_ADVANCED_FORBIDDEN);
    const maleChestCable = new Set(CAT3_GYM_MALE_CHEST_CABLE);
    const beginner = VALID_PROGRAMS[plan.profile.program].level === "incepator";
    const maleAdvanced = plan.profile.gender === "masculin" && !beginner;
    const dailySignatures = new Set();
    let maleChestCableOccurrences = 0;
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        const expected = template?.[weekIndex]?.[dayIndex];
        const expectedCount = cat3GymDailyExerciseCount(plan.profile, dayIndex);
        if (keys.length !== expectedCount) {
          issues.push(`Volum editorial CAT3 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială CAT3 × La sală diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (day.title !== expectedTitles[dayIndex]) {
          issues.push(`Titlu editorial CAT3 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const actualGroups = day.exercises.map((exercise) => exercise.group);
        if (actualGroups.join("|") !== expectedGroups[dayIndex].join("|")) {
          issues.push(`Împărțire musculară CAT3 × La sală invalidă la S${weekIndex + 1} Z${dayIndex + 1}: ${actualGroups.join(", ")}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT3 × La sală repetată: ${signature}.`);
        dailySignatures.add(signature);
        const familyConflicts = cat3GymSameFamilyConflicts(keys);
        if (familyConflicts.length) {
          issues.push(`Familii redundante CAT3 × La sală la S${weekIndex + 1} Z${dayIndex + 1}: ${familyConflicts.join(", ")}.`);
        }
        for (const key of keys) {
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT3 × La sală: ${key}.`);
          if (homeOnlyForbidden.has(key)) issues.push(`Exercițiu exclusiv Acasă generat în CAT3 × La sală: ${key}.`);
          if (beginner && advancedOnlyKeys.has(key)) issues.push(`Exercițiu exclusiv avansat generat la Începător: ${key}.`);
          if (maleAdvanced && maleAdvancedForbidden.has(key)) issues.push(`Flotare interzisă generată la Masculin Avansat: ${key}.`);
          if (key === "flotari-hindu") issues.push("Flotări Hindu nu sunt permise în CAT3 × La sală.");
          if (plan.profile.gender === "masculin" && maleChestCable.has(key)) maleChestCableOccurrences += 1;
        }
      }
      const lowerPair = plan.profile.program === "incepator-4" ? [1, 3]
        : plan.profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerPair) {
        const firstLegs = new Set(week.days[lowerPair[0]].exercises
          .filter((exercise) => exercise.group === "Picioare")
          .map((exercise) => exercise.exerciseKey));
        const overlap = week.days[lowerPair[1]].exercises
          .filter((exercise) => exercise.group === "Picioare" && firstLegs.has(exercise.exerciseKey))
          .map((exercise) => exercise.exerciseKey);
        if (overlap.length) {
          issues.push(`Zilele de picioare CAT3 × La sală se suprapun la S${weekIndex + 1}: ${overlap.join(", ")}.`);
        }
      }
    }
    if (maleChestCableOccurrences > 2) {
      issues.push(`Limita cumulată pentru piept la cablu este depășită: ${maleChestCableOccurrences}/2.`);
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT3 × La sală trebuie să fie distincte.");
    }
    for (let dayIndex = 0; dayIndex < expectedDays; dayIndex += 1) {
      if (!cat3GymShouldRotateFirst(plan.profile, dayIndex)) continue;
      const firstExercises = plan.weeks.map((week) => week.days[dayIndex].exercises[0]?.exerciseKey);
      if (new Set(firstExercises).size !== 4) {
        issues.push(`Primul exercițiu CAT3 × La sală nu se rotește complet pentru Ziua ${dayIndex + 1}.`);
      }
    }
  } else if (cat3HomeEditorial) {
    const template = cat3HomeEditorialTemplate(plan.profile);
    const expectedExerciseCount = cat3HomeDailyExerciseCount(plan.profile);
    const expectedTitles = CAT3_HOME_DAY_TITLES[plan.profile.program];
    const allowlist = new Set(CAT3_HOME_ALLOWLIST);
    const advancedOnly = new Set(CAT3_HOME_ADVANCED_ONLY);
    const beginner = VALID_PROGRAMS[plan.profile.program].level === "incepator";
    const dailySignatures = new Set();
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        const expected = template?.[weekIndex]?.[dayIndex];
        if (keys.length !== expectedExerciseCount) {
          issues.push(`Volum editorial CAT3 × Acasă invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedExerciseCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială CAT3 × Acasă diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (day.title !== expectedTitles[dayIndex]) {
          issues.push(`Titlu editorial CAT3 × Acasă invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (!cat3HomeDayMatchesStructure(plan.profile.program, dayIndex, keys)) {
          issues.push(`Împărțire musculară CAT3 × Acasă invalidă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT3 × Acasă repetată: ${signature}.`);
        dailySignatures.add(signature);
        const familyConflicts = cat3HomeSameFamilyConflicts(keys);
        if (familyConflicts.length) {
          issues.push(`Familii redundante CAT3 × Acasă la S${weekIndex + 1} Z${dayIndex + 1}: ${familyConflicts.join(", ")}.`);
        }
        if (cat3HomeSurfaceTransitions(keys) > 1) {
          issues.push(`Ordine în picioare/podea CAT3 × Acasă fragmentată la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        for (const key of keys) {
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT3 × Acasă: ${key}.`);
          if (beginner && advancedOnly.has(key)) issues.push(`Exercițiu exclusiv avansat generat la Începător: ${key}.`);
        }
      }
      const lowerDayPair = plan.profile.program === "incepator-4" || plan.profile.program === "avansat-4"
        ? [1, 3]
        : plan.profile.program === "avansat-5" ? [2, 4] : null;
      if (lowerDayPair) {
        const firstLegs = new Set(week.days[lowerDayPair[0]].exercises
          .map((exercise) => exercise.exerciseKey)
          .filter((key) => CAT3_HOME_GROUP_BY_EXERCISE[key] === "Picioare"));
        const overlap = week.days[lowerDayPair[1]].exercises
          .map((exercise) => exercise.exerciseKey)
          .filter((key) => CAT3_HOME_GROUP_BY_EXERCISE[key] === "Picioare" && firstLegs.has(key));
        if (overlap.length) {
          issues.push(`Zilele inferioare CAT3 × Acasă se suprapun la S${weekIndex + 1}: ${overlap.join(", ")}.`);
        }
      }
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT3 × Acasă trebuie să fie distincte.");
    }
    const firstExercises = plan.weeks.map((week) => week.days[0].exercises[0]?.exerciseKey);
    if (new Set(firstExercises).size !== 4) {
      issues.push("Primul exercițiu din Ziua 1 CAT3 × Acasă trebuie să difere în toate săptămânile.");
    }
  } else if (cat4HomeEditorial) {
    const template = cat4HomeEditorialTemplate(plan.profile);
    const expectedExerciseCount = cat4HomeDailyExerciseCount(plan.profile);
    const allowlist = new Set(CAT4_HOME_ALLOWLIST);
    const crunchPair = new Set(CAT4_HOME_CRUNCH_PAIR);
    const standing = new Set(CAT4_HOME_STANDING_EXERCISES);
    const floor = new Set(CAT4_HOME_FLOOR_EXERCISES);
    const used = new Set();
    const dailySignatures = new Set();
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const keys = week.days[dayIndex].exercises.map((exercise) => exercise.exerciseKey);
        const expected = template?.[weekIndex]?.[dayIndex];
        if (keys.length !== expectedExerciseCount) {
          issues.push(`Volum editorial invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedExerciseCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică repetată: ${signature}.`);
        dailySignatures.add(signature);
        const sameDayCrunchPairCount = keys.filter((key) => crunchPair.has(key)).length;
        if (sameDayCrunchPairCount > CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR) {
          issues.push(`Pereche Crunch redundantă la S${weekIndex + 1} Z${dayIndex + 1}: ${sameDayCrunchPairCount}/${CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR}.`);
        }
        let floorStarted = false;
        for (const key of keys) {
          used.add(key);
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT4 × Acasă: ${key}.`);
          if (floor.has(key)) floorStarted = true;
          if (floorStarted && standing.has(key)) issues.push(`Ordine în picioare/podea invalidă: ${key}.`);
        }
      }
    }
    if (used.size !== CAT4_HOME_ALLOWLIST.length || CAT4_HOME_ALLOWLIST.some((key) => !used.has(key))) {
      issues.push("Planul CAT4 × Acasă nu folosește toate cele zece exerciții editoriale.");
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT4 × Acasă trebuie să fie distincte.");
    }
    for (let dayIndex = 0; dayIndex < expectedDays; dayIndex += 1) {
      const firstExercises = plan.weeks.map((week) => week.days[dayIndex].exercises[0]?.exerciseKey);
      if (new Set(firstExercises).size !== 4) {
        issues.push(`Primul exercițiu nu se rotește în toate săptămânile pentru Ziua ${dayIndex + 1}.`);
      }
    }
  } else if (cat4GymEditorial) {
    const template = cat4GymEditorialTemplate(plan.profile);
    const expectedExerciseCount = cat4GymDailyExerciseCount(plan.profile);
    const expectedGroups = CAT4_GYM_DAY_GROUPS[plan.profile.program];
    const expectedTitles = CAT4_GYM_DAY_TITLES[plan.profile.program];
    const allowlist = new Set(CAT4_GYM_ALLOWLIST);
    const dailySignatures = new Set();
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex += 1) {
        const day = week.days[dayIndex];
        const keys = day.exercises.map((exercise) => exercise.exerciseKey);
        const expected = template?.[weekIndex]?.[dayIndex];
        if (keys.length !== expectedExerciseCount) {
          issues.push(`Volum editorial CAT4 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}: ${keys.length}/${expectedExerciseCount}.`);
        }
        if (!expected || keys.join("|") !== expected.join("|")) {
          issues.push(`Structura editorială CAT4 × La sală diferă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        if (day.title !== expectedTitles[dayIndex]) {
          issues.push(`Titlu editorial CAT4 × La sală invalid la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const actualGroups = keys.map((key) => CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE[key]).sort();
        const requiredGroups = [...expectedGroups[dayIndex]].sort();
        if (actualGroups.join("|") !== requiredGroups.join("|")) {
          issues.push(`Împărțire musculară CAT4 × La sală invalidă la S${weekIndex + 1} Z${dayIndex + 1}.`);
        }
        const signature = keys.join("|");
        if (dailySignatures.has(signature)) issues.push(`Secvență zilnică CAT4 × La sală repetată: ${signature}.`);
        dailySignatures.add(signature);
        for (const key of keys) {
          if (!allowlist.has(key)) issues.push(`Exercițiu în afara allowlistului CAT4 × La sală: ${key}.`);
        }
        if (plan.profile.program === "avansat-4" && dayIndex === 2) {
          const abdomenCount = keys.filter((key) => CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE[key] === "Abdomen").length;
          const abdomenKeys = keys.filter((key) => CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE[key] === "Abdomen");
          if (abdomenCount !== 2 || new Set(abdomenKeys).size !== 2) {
            issues.push(`Ziua 3 CAT4 × La sală nu are două exerciții distincte pentru abdomen la S${weekIndex + 1}.`);
          }
        }
      }
      if (plan.profile.program === "avansat-4") {
        const dayTwo = new Set(week.days[1].exercises.map((exercise) => exercise.exerciseKey));
        const overlap = week.days[3].exercises.filter((exercise) => dayTwo.has(exercise.exerciseKey));
        if (overlap.length) issues.push(`Zilele 2 și 4 CAT4 × La sală se suprapun la S${weekIndex + 1}: ${overlap.map((exercise) => exercise.exerciseKey).join(", ")}.`);
      }
    }
    if (new Set(plan.weeks.map(weekExerciseSignature)).size !== 4) {
      issues.push("Săptămânile CAT4 × La sală trebuie să fie distincte.");
    }
  } else {
    if (weekExerciseSignature(plan.weeks[0]) !== weekExerciseSignature(plan.weeks[2])) issues.push("Săptămânile 1 și 3 nu păstrează același nucleu.");
    if (weekExerciseSignature(plan.weeks[0]) === weekExerciseSignature(plan.weeks[1])) issues.push("Săptămâna 2 nu introduce variație.");
    if (weekExerciseSignature(plan.weeks[0]) === weekExerciseSignature(plan.weeks[3])) issues.push("Săptămâna 4 nu introduce variație.");
    if (new Set(plan.weeks.map(weekExerciseSignature)).size === 1) issues.push("Toate cele patru săptămâni sunt identice.");
  }
  return { valid: issues.length === 0, issues };
}

export function generatePlanV2(profile, catalog, registry) {
  const profileValidation = validateV2Profile(profile);
  if (!profileValidation.valid) return { status: "invalid_profile", issues: profileValidation.issues };
  const registryValidation = validateV2Registry(catalog, registry);
  if (!registryValidation.valid) return { status: "invalid_registry", issues: registryValidation.issues };

  const ruleByKey = new Map(registry.rules.map((rule) => [rule.exercise_key, rule]));
  const records = catalog.map((exercise) => ({ exercise, rule: ruleByKey.get(exercise.id) }));
  const recordsByKey = new Map(records.map((record) => [record.exercise.id, record]));
  try {
    // Șabloanele CAT1/CAT2/CAT3/CAT4 editoriale sunt complete și finale. Ieșirea are loc
    // înainte de structura generică, astfel încât niciun slot sau auxiliar
    // generic nu poate fi adăugat după materializare.
    if (isCat1HomeEditorialProfile(profile)) {
      const plan = buildCat1HomeEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat1GymEditorialProfile(profile)) {
      const plan = buildCat1GymEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat2HomeEditorialProfile(profile)) {
      const plan = buildCat2HomeEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat2GymEditorialProfile(profile)) {
      const plan = buildCat2GymEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat3HomeEditorialProfile(profile)) {
      const plan = buildCat3HomeEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat3GymEditorialProfile(profile)) {
      const plan = buildCat3GymEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat4HomeEditorialProfile(profile)) {
      const plan = buildCat4HomeEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    if (isCat4GymEditorialProfile(profile)) {
      const plan = buildCat4GymEditorialPlan(profile, recordsByKey);
      const audit = auditGeneratedPlanV2(plan, catalog, registry);
      if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
      return { status: "found", plan };
    }
    const template = structureTemplate(profile);
    if (!template) return { status: "invalid_profile", issues: ["Programul structural nu este acceptat."] };
    const lastUseByKey = new Map();
    const weekOne = buildSelectedWeek({ weekNumber: 1, profile, template, records, ruleByKey, lastUseByKey });
    const weekTwo = buildSelectedWeek({ weekNumber: 2, profile, template, records, ruleByKey, coreWeek: weekOne, lastUseByKey });
    const weekThree = buildCoreProgressionWeek(weekOne, profile, recordsByKey, lastUseByKey);
    const weekFour = buildSelectedWeek({
      weekNumber: 4,
      profile,
      template,
      records,
      ruleByKey,
      coreWeek: weekOne,
      previousVariationWeek: weekTwo,
      lastUseByKey,
    });
    const program = VALID_PROGRAMS[profile.program];
    const plan = {
      engineVersion: PLAN_ENGINE_V2,
      planKey: stablePlanKey(profile),
      profile: { ...profile, level: program.level, daysPerWeek: program.daysPerWeek },
      structureTemplate: `${program.daysPerWeek}-zile-${program.daysPerWeek === 3 ? "full-body" : program.daysPerWeek === 4 ? "upper-lower" : "split-controlat"}`,
      weeks: [weekOne, weekTwo, weekThree, weekFour],
    };
    const audit = auditGeneratedPlanV2(plan, catalog, registry);
    if (!audit.valid) return { status: "invalid_configuration", issues: audit.issues };
    return { status: "found", plan };
  } catch (error) {
    return { status: "configuration_error", issues: [error instanceof Error ? error.message : "Planul nu a putut fi generat."] };
  }
}

export function enumerateValidV2Profiles() {
  const profiles = [];
  for (const gender of PROFILE_DOMAINS.gender)
    for (const age of PROFILE_DOMAINS.age)
      for (const goal of PROFILE_DOMAINS.goal)
        for (const place of PROFILE_DOMAINS.place)
          for (const program of v2ProgramsForAge(age))
            profiles.push({ gender, age, goal, place, program });
  return profiles;
}
