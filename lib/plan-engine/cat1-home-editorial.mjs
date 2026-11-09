import {
  CAT3_HOME_ADVANCED_ONLY,
  CAT3_HOME_ALLOWLIST,
  CAT3_HOME_EXERCISES,
  CAT3_HOME_GROUP_BY_EXERCISE,
  CAT3_HOME_REDUNDANT_FAMILIES,
  cat3HomeSameFamilyConflicts,
} from "./cat3-home-editorial.mjs";

export const CAT1_HOME_EDITORIAL_VERSION = "cat1-home-editorial-v1";

export const CAT1_HOME_DAILY_EXERCISE_COUNT = Object.freeze({
  "incepator-3": 4,
  "incepator-4": 4,
  "avansat-4": 5,
  "avansat-5": 5,
});

// CAT1 reutilizează identitatea canonică validată pentru CAT2/CAT3 Acasă.
// Singura diferențiere nouă este selecția editorială controlată după echipament.
export const CAT1_HOME_EXERCISES = CAT3_HOME_EXERCISES;
export const CAT1_HOME_ALLOWLIST = CAT3_HOME_ALLOWLIST;
export const CAT1_HOME_ADVANCED_ONLY = CAT3_HOME_ADVANCED_ONLY;
export const CAT1_HOME_GROUP_BY_EXERCISE = CAT3_HOME_GROUP_BY_EXERCISE;
export const CAT1_HOME_REDUNDANT_FAMILIES = CAT3_HOME_REDUNDANT_FAMILIES;

const E = CAT1_HOME_EXERCISES;

export const CAT1_HOME_DUMBBELL_EXERCISES = Object.freeze([
  E.P3,
  E.S2,
  E.S4,
  E.U1,
  E.U2,
  E.B1,
  E.L3,
  E.L5,
  E.L6,
  E.L7,
  E.L8,
  E.L10,
  E.L11,
  E.L12,
]);

const dumbbell = new Set(CAT1_HOME_DUMBBELL_EXERCISES);

export function cat1HomeEquipmentClass(exerciseKey) {
  if (!CAT1_HOME_ALLOWLIST.includes(exerciseKey)) return null;
  return dumbbell.has(exerciseKey) ? "DUMBBELL" : "NON_DUMBBELL";
}

const BEGINNER_3_DAY_TYPES = Object.freeze([
  Object.freeze(["upper-a", "lower", "upper-b"]),
  Object.freeze(["lower-a", "upper", "lower-b"]),
  Object.freeze(["upper-a", "lower", "upper-b"]),
  Object.freeze(["lower-a", "upper", "lower-b"]),
]);

const FIXED_DAY_TITLES = Object.freeze({
  "incepator-4": Object.freeze(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-4": Object.freeze(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-5": Object.freeze(["Împins", "Tras", "Partea inferioară A", "Partea superioară mixtă", "Partea inferioară B"]),
});

const FIXED_DAY_FOCUS = Object.freeze({
  "incepator-4": Object.freeze([
    "Piept, spate, umeri și triceps",
    "Picioare și abdomen",
    "Piept, spate, umeri și biceps",
    "Picioare și cardio",
  ]),
  "avansat-4": Object.freeze([
    "Piept, spate, umeri, biceps și triceps",
    "Picioare și abdomen",
    "Piept, spate, umeri, biceps și triceps",
    "Picioare și cardio",
  ]),
  "avansat-5": Object.freeze([
    "Piept, umeri și triceps",
    "Spate, biceps și abdomen",
    "Picioare și abdomen",
    "Piept, spate, umeri, biceps și triceps",
    "Picioare și cardio",
  ]),
});

export function cat1HomeDayTitle(profile, weekIndex, dayIndex) {
  if (!isCat1HomeEditorialProfile(profile)) return null;
  if (profile.program !== "incepator-3") return FIXED_DAY_TITLES[profile.program]?.[dayIndex] ?? null;
  const type = BEGINNER_3_DAY_TYPES[weekIndex]?.[dayIndex];
  if (type === "upper-a") return "Partea superioară A";
  if (type === "upper-b") return "Partea superioară B";
  if (type === "upper") return "Partea superioară";
  if (type === "lower-a") return "Partea inferioară A";
  if (type === "lower-b") return "Partea inferioară B";
  return type === "lower" ? "Partea inferioară" : null;
}

export function cat1HomeDayFocus(profile, weekIndex, dayIndex) {
  if (!isCat1HomeEditorialProfile(profile)) return null;
  if (profile.program !== "incepator-3") return FIXED_DAY_FOCUS[profile.program]?.[dayIndex] ?? null;
  return BEGINNER_3_DAY_TYPES[weekIndex]?.[dayIndex]?.startsWith("upper")
    ? "Piept, spate, umeri și brațe"
    : "Picioare, abdomen sau cardio";
}

const UPPER_BEGINNER_SLOTS = Object.freeze([
  Object.freeze(["Piept"]),
  Object.freeze(["Spate"]),
  Object.freeze(["Umeri"]),
  Object.freeze(["Biceps", "Triceps"]),
]);
const LOWER_BEGINNER_SLOTS = Object.freeze([
  Object.freeze(["Picioare"]),
  Object.freeze(["Picioare"]),
  Object.freeze(["Picioare"]),
  Object.freeze(["Abdomen", "Cardio"]),
]);
const FIXED_DAY_STRUCTURE = Object.freeze({
  "incepator-4": Object.freeze([
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Triceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen"]]),
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Biceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Cardio"]]),
  ]),
  "avansat-4": Object.freeze([
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Biceps"], ["Triceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen"]]),
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Biceps"], ["Triceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Cardio"]]),
  ]),
  "avansat-5": Object.freeze([
    Object.freeze([["Piept"], ["Piept"], ["Umeri"], ["Umeri"], ["Triceps"]]),
    Object.freeze([["Spate"], ["Spate"], ["Spate"], ["Biceps"], ["Abdomen"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen"]]),
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Biceps"], ["Triceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Cardio"]]),
  ]),
});

const GOAL_OFFSET = Object.freeze({ slabire: 0, masa: 1, forma: 2 });
const BEGINNER_CORE = Object.freeze([E.A1, E.A2, E.A3, E.A4, E.A5, E.A6, E.A7, E.A8, E.A9, E.A10]);
const ADVANCED_CORE = Object.freeze([...BEGINNER_CORE, E.A11, E.A12, E.A13, E.A14]);
const BEGINNER_CARDIO = Object.freeze([E.C1, E.C2]);
const ADVANCED_CARDIO = Object.freeze([E.C3, E.C1, E.C2]);
const BEGINNER_BACK = Object.freeze([E.S2, E.S3, E.S1]);
const ADVANCED_BACK = Object.freeze([E.S4, E.S3, E.S1, E.S2]);
const BODY_CHEST = Object.freeze([E.P1, E.P2, E.P4, E.P5, E.P6]);
const SQUATS = Object.freeze([E.L4, E.L6, E.L5, E.L7]);
const CALVES = Object.freeze([E.L10, E.L11]);

function pick(pool, index) {
  return pool[((index % pool.length) + pool.length) % pool.length];
}

function selectionIndex(goal, week, salt = 0) {
  return week + GOAL_OFFSET[goal] + salt;
}

function beginnerChest(gender, index) {
  const nonDumbbell = pick([E.P1, E.P2, E.P1, E.P2], index);
  return gender === "masculin" && index % 4 === 0 ? E.P3 : nonDumbbell;
}

function advancedChest(gender, index) {
  const nonDumbbell = pick(BODY_CHEST, index);
  return gender === "masculin" && index % 5 === 0 ? E.P3 : nonDumbbell;
}

function beginnerLower(gender, index) {
  return [
    pick(SQUATS, index),
    gender === "masculin" ? E.L3 : E.L2,
    pick([E.L8, E.L9, E.L1], index),
  ];
}

function beginnerLowerPair(gender, index) {
  return Object.freeze({
    a: Object.freeze([
      pick(SQUATS, index),
      gender === "masculin" ? E.L3 : E.L2,
      gender === "masculin" ? E.L8 : pick([E.L9, E.L1], index),
    ]),
    b: Object.freeze([
      pick(SQUATS, index + 2),
      gender === "masculin" ? E.L2 : E.L3,
      pick(CALVES, index),
    ]),
  });
}

function advancedLowerPair(gender, index) {
  return Object.freeze({
    a: Object.freeze([
      pick(SQUATS, index),
      gender === "masculin" ? E.L3 : E.L2,
      gender === "masculin" ? E.L8 : E.L9,
      pick(CALVES, index),
    ]),
    b: Object.freeze([
      pick(SQUATS, index + 2),
      E.L12,
      E.L1,
      pick(CALVES, index + 1),
    ]),
  });
}

function upperBeginner(gender, goal, ordinal, arm) {
  const index = selectionIndex(goal, ordinal);
  return [
    beginnerChest(gender, index),
    pick(BEGINNER_BACK, index),
    pick([E.U1, E.U2], index),
    arm,
  ];
}

function advancedBack(gender, index) {
  return gender === "masculin"
    ? pick(ADVANCED_BACK, index)
    : pick([E.S1, E.S3, E.S1, E.S3], index);
}

function advancedUpper(gender, goal, week, variant) {
  const index = GOAL_OFFSET[goal] * 3 + week * 2 + variant;
  const triceps = week === 0 && variant === 0 ? E.T2 : E.T1;
  const chest = triceps === E.T2 ? E.P3 : advancedChest(gender, index);
  return [
    chest,
    advancedBack(gender, index),
    pick([E.U1, E.U2], index + variant),
    E.B1,
    triceps,
  ];
}

function advancedPull(gender, index) {
  const dumb = [pick([E.S4, E.S2], index), pick([E.S4, E.S2], index + 1)];
  const nonDumb = [pick([E.S3, E.S1], index), pick([E.S3, E.S1], index + 1)];
  return gender === "masculin"
    ? [dumb[0], dumb[1], nonDumb[0]]
    : [nonDumb[0], nonDumb[1], dumb[0]];
}

function freezeWeeks(weeks) {
  return Object.freeze(weeks.map((week) => Object.freeze(
    week.map((day) => Object.freeze([...day])),
  )));
}

function buildBeginner3(gender, goal) {
  let upperOrdinal = 0;
  let lowerOrdinal = 0;
  return freezeWeeks(BEGINNER_3_DAY_TYPES.map((types) => types.map((type) => {
    if (type.startsWith("upper")) {
      const arm = upperOrdinal % 2 === 0 ? E.B1 : E.T1;
      const day = upperBeginner(gender, goal, upperOrdinal, arm);
      upperOrdinal += 1;
      return day;
    }
    const index = selectionIndex(goal, lowerOrdinal);
    const ending = lowerOrdinal % 2 === 0
      ? pick(BEGINNER_CORE, index)
      : pick(BEGINNER_CARDIO, index);
    lowerOrdinal += 1;
    return [...beginnerLower(gender, index), ending];
  })));
}

function buildBeginner4(gender, goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const index = selectionIndex(goal, week);
    const lower = beginnerLowerPair(gender, index);
    return [
      upperBeginner(gender, goal, week, E.T1),
      [...lower.a, pick(BEGINNER_CORE, index + 2)],
      upperBeginner(gender, goal, week + 1, E.B1),
      [...lower.b, pick(BEGINNER_CARDIO, index + 1)],
    ];
  }));
}

function buildAdvanced4(gender, goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const index = selectionIndex(goal, week);
    const lower = advancedLowerPair(gender, index);
    return [
      advancedUpper(gender, goal, week, 0),
      [...lower.a, pick(ADVANCED_CORE, index + 2)],
      advancedUpper(gender, goal, week, 1),
      [...lower.b, pick(ADVANCED_CARDIO, index + 1)],
    ];
  }));
}

function buildAdvanced5(gender, goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const index = selectionIndex(goal, week);
    const lower = advancedLowerPair(gender, index);
    const mixed = advancedUpper(gender, goal, week, 1);
    return [
      [pick(BODY_CHEST, index), E.P3, E.U1, E.U2, E.T1],
      [...advancedPull(gender, index), E.B1, pick(ADVANCED_CORE, index + 3)],
      [...lower.a, pick(ADVANCED_CORE, index + 8)],
      mixed,
      [...lower.b, pick(ADVANCED_CARDIO, index + 1)],
    ];
  }));
}

const PROGRAM_BUILDERS = Object.freeze({
  "incepator-3": buildBeginner3,
  "incepator-4": buildBeginner4,
  "avansat-4": buildAdvanced4,
  "avansat-5": buildAdvanced5,
});

export const CAT1_HOME_EDITORIAL_TEMPLATES = Object.freeze(Object.fromEntries(
  ["masculin", "feminin"].flatMap((gender) =>
    ["slabire", "masa", "forma"].flatMap((goal) =>
      Object.entries(PROGRAM_BUILDERS).map(([program, builder]) => [
        `${gender}:${goal}:${program}`,
        builder(gender, goal),
      ]),
    )),
));

export function isCat1HomeEditorialProfile(profile) {
  return profile?.age === "18-29"
    && profile?.place === "acasa"
    && Object.hasOwn(CAT1_HOME_EDITORIAL_TEMPLATES, `${profile.gender}:${profile.goal}:${profile.program}`);
}

export function cat1HomeEditorialTemplate(profile) {
  if (!isCat1HomeEditorialProfile(profile)) return null;
  return CAT1_HOME_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`];
}

export function cat1HomeDailyExerciseCount(profile) {
  return isCat1HomeEditorialProfile(profile)
    ? CAT1_HOME_DAILY_EXERCISE_COUNT[profile.program]
    : null;
}

export function cat1HomeExerciseApprovedForGender(profile, exerciseKey) {
  return isCat1HomeEditorialProfile(profile) && CAT1_HOME_ALLOWLIST.includes(exerciseKey);
}

function matchGroupsToSlots(groups, slots, used = new Set(), groupIndex = 0) {
  if (groupIndex === groups.length) return used.size === slots.length;
  for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
    if (used.has(slotIndex) || !slots[slotIndex].includes(groups[groupIndex])) continue;
    used.add(slotIndex);
    if (matchGroupsToSlots(groups, slots, used, groupIndex + 1)) return true;
    used.delete(slotIndex);
  }
  return false;
}

export function cat1HomeDayMatchesStructure(profile, weekIndex, dayIndex, exerciseKeys) {
  if (!isCat1HomeEditorialProfile(profile)) return false;
  const slots = profile.program === "incepator-3"
    ? BEGINNER_3_DAY_TYPES[weekIndex]?.[dayIndex]?.startsWith("upper") ? UPPER_BEGINNER_SLOTS : LOWER_BEGINNER_SLOTS
    : FIXED_DAY_STRUCTURE[profile.program]?.[dayIndex];
  if (!slots || slots.length !== exerciseKeys.length) return false;
  const groups = exerciseKeys.map((key) => CAT1_HOME_GROUP_BY_EXERCISE[key]);
  return groups.every(Boolean) && matchGroupsToSlots(groups, slots);
}

export function cat1HomeSameFamilyConflicts(exerciseKeys) {
  return cat3HomeSameFamilyConflicts(exerciseKeys);
}
