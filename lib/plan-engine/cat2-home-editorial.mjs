import {
  CAT3_HOME_ADVANCED_ONLY,
  CAT3_HOME_ALLOWLIST,
  CAT3_HOME_EXERCISES,
  CAT3_HOME_FLOOR_EXERCISES,
  CAT3_HOME_GROUP_BY_EXERCISE,
  CAT3_HOME_REDUNDANT_FAMILIES,
  CAT3_HOME_STANDING_EXERCISES,
  cat3HomeSameFamilyConflicts,
} from "./cat3-home-editorial.mjs";

export const CAT2_HOME_EDITORIAL_VERSION = "cat2-home-editorial-v1";

export const CAT2_HOME_DAILY_EXERCISE_COUNT = Object.freeze({
  "incepator-3": 4,
  "incepator-4": 4,
  "avansat-4": 5,
  "avansat-5": 5,
});

// Auditul CAT2 × Acasă și allowlistul CAT3 × Acasă au fost comparate
// programatic înaintea implementării. Refolosirea referințelor canonice evită
// două surse editoriale care s-ar putea îndepărta în timp.
export const CAT2_HOME_EXERCISES = CAT3_HOME_EXERCISES;
export const CAT2_HOME_ALLOWLIST = CAT3_HOME_ALLOWLIST;
export const CAT2_HOME_ADVANCED_ONLY = CAT3_HOME_ADVANCED_ONLY;
export const CAT2_HOME_GROUP_BY_EXERCISE = CAT3_HOME_GROUP_BY_EXERCISE;
export const CAT2_HOME_REDUNDANT_FAMILIES = CAT3_HOME_REDUNDANT_FAMILIES;
export const CAT2_HOME_STANDING_EXERCISES = CAT3_HOME_STANDING_EXERCISES;
export const CAT2_HOME_FLOOR_EXERCISES = CAT3_HOME_FLOOR_EXERCISES;

const E = CAT2_HOME_EXERCISES;

export const CAT2_HOME_DAY_TITLES = Object.freeze({
  "incepator-3": Object.freeze(["Full Body A", "Full Body B", "Full Body C"]),
  "incepator-4": Object.freeze(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-4": Object.freeze(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-5": Object.freeze(["Împins", "Tras", "Picioare A", "Partea superioară mixtă", "Picioare B și Cardio"]),
});

export const CAT2_HOME_DAY_FOCUS = Object.freeze({
  "incepator-3": Object.freeze([
    "Picioare, piept, spate și abdomen",
    "Picioare, umeri, biceps și cardio",
    "Picioare, spate, triceps și abdomen",
  ]),
  "incepator-4": Object.freeze([
    "Piept, spate, umeri și triceps",
    "Picioare și abdomen",
    "Spate, piept, umeri și biceps",
    "Picioare și cardio",
  ]),
  "avansat-4": Object.freeze([
    "Piept, spate, umeri, triceps și abdomen",
    "Picioare și abdomen",
    "Spate, piept, umeri, biceps și cardio",
    "Picioare și abdomen",
  ]),
  "avansat-5": Object.freeze([
    "Piept, umeri și triceps",
    "Spate, biceps și abdomen",
    "Picioare și abdomen",
    "Piept, spate, umeri, biceps și triceps",
    "Picioare și cardio",
  ]),
});

export const CAT2_HOME_DAY_GROUPS = Object.freeze({
  "incepator-3": Object.freeze([
    Object.freeze(["Picioare", "Piept", "Spate", "Abdomen"]),
    Object.freeze(["Picioare", "Umeri", "Biceps", "Cardio"]),
    Object.freeze(["Picioare", "Spate", "Triceps", "Abdomen"]),
  ]),
  "incepator-4": Object.freeze([
    Object.freeze(["Piept", "Spate", "Umeri", "Triceps"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Abdomen"]),
    Object.freeze(["Spate", "Piept", "Umeri", "Biceps"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Cardio"]),
  ]),
  "avansat-4": Object.freeze([
    Object.freeze(["Piept", "Spate", "Umeri", "Triceps", "Abdomen"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Picioare", "Abdomen"]),
    Object.freeze(["Spate", "Piept", "Umeri", "Biceps", "Cardio"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Picioare", "Abdomen"]),
  ]),
  "avansat-5": Object.freeze([
    Object.freeze(["Piept", "Piept", "Umeri", "Umeri", "Triceps"]),
    Object.freeze(["Spate", "Spate", "Spate", "Biceps", "Abdomen"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Picioare", "Abdomen"]),
    Object.freeze(["Piept", "Spate", "Umeri", "Biceps", "Triceps"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Picioare", "Cardio"]),
  ]),
});

const GOAL_OFFSET = Object.freeze({ slabire: 0, masa: 1, forma: 2 });
const BEGINNER_CORE = Object.freeze([E.A1, E.A2, E.A3, E.A4, E.A5, E.A6, E.A7, E.A8, E.A9, E.A10]);
const ADVANCED_CORE = Object.freeze([...BEGINNER_CORE, E.A11, E.A12, E.A13, E.A14]);
const BEGINNER_CHEST = Object.freeze([E.P1, E.P2, E.P3]);
const ADVANCED_PUSH = Object.freeze([E.P1, E.P4, E.P5, E.P6]);
const ADVANCED_CHEST = Object.freeze([E.P1, E.P2, E.P4, E.P5, E.P6, E.P3]);
const BEGINNER_BACK = Object.freeze([E.S3, E.S2, E.S1]);
const ADVANCED_BACK = Object.freeze([E.S4, E.S3, E.S2, E.S1]);
const BEGINNER_CARDIO = Object.freeze([E.C1, E.C2]);
const ADVANCED_CARDIO = Object.freeze([E.C3, E.C1, E.C2]);
const SHOULDERS = Object.freeze([E.U1, E.U2]);
const ADVANCED_TRICEPS = Object.freeze([E.T1, E.T2]);

const LEG_FAMILIES = Object.freeze([
  Object.freeze([E.L4, E.L5, E.L6, E.L7]),
  Object.freeze([E.L3, E.L2]),
  Object.freeze([E.L8, E.L9, E.L1]),
  Object.freeze([E.L10, E.L11]),
]);

const BEGINNER_LOWER_PAIRS = Object.freeze([
  Object.freeze({ a: Object.freeze([E.L4, E.L2, E.L8]), b: Object.freeze([E.L3, E.L5, E.L9]) }),
  Object.freeze({ a: Object.freeze([E.L6, E.L3, E.L1]), b: Object.freeze([E.L4, E.L2, E.L8]) }),
  Object.freeze({ a: Object.freeze([E.L3, E.L5, E.L9]), b: Object.freeze([E.L6, E.L2, E.L1]) }),
  Object.freeze({ a: Object.freeze([E.L4, E.L2, E.L1]), b: Object.freeze([E.L6, E.L3, E.L8]) }),
]);

const ADVANCED_SQUATS = Object.freeze([E.L4, E.L5, E.L6, E.L7]);
const ADVANCED_LUNGES = Object.freeze([E.L2, E.L3, E.L12]);
const ADVANCED_POSTERIOR = Object.freeze([E.L8, E.L9, E.L1]);
const ADVANCED_CALVES = Object.freeze([E.L10, E.L11]);

function pick(pool, index) {
  return pool[((index % pool.length) + pool.length) % pool.length];
}

function selectionIndex(goal, week, salt = 0) {
  return week + GOAL_OFFSET[goal] * 4 + salt;
}

function beginnerCore(goal, week, salt) {
  return pick(BEGINNER_CORE, selectionIndex(goal, week, salt));
}

function advancedCore(goal, week, salt) {
  return pick(ADVANCED_CORE, selectionIndex(goal, week, salt));
}

function beginnerCardio(goal, week, salt = 0) {
  return pick(BEGINNER_CARDIO, selectionIndex(goal, week, salt));
}

function advancedCardio(goal, week, salt = 0) {
  return pick(ADVANCED_CARDIO, selectionIndex(goal, week, salt));
}

function beginnerLeg(goal, week, dayIndex) {
  const familyIndex = (week + dayIndex + GOAL_OFFSET[goal]) % LEG_FAMILIES.length;
  return pick(LEG_FAMILIES[familyIndex], selectionIndex(goal, week, dayIndex));
}

function advancedLowerPair(index) {
  return Object.freeze({
    a: Object.freeze([
      pick(ADVANCED_SQUATS, index),
      pick(ADVANCED_LUNGES, index),
      pick(ADVANCED_POSTERIOR, index),
      pick(ADVANCED_CALVES, index),
    ]),
    b: Object.freeze([
      pick(ADVANCED_SQUATS, index + 2),
      pick(ADVANCED_LUNGES, index + 1),
      pick(ADVANCED_POSTERIOR, index + 1),
      pick(ADVANCED_CALVES, index + 1),
    ]),
  });
}

function freezeWeeks(weeks) {
  return Object.freeze(weeks.map((week) => Object.freeze(
    week.map((day) => Object.freeze([...day])),
  )));
}

function buildBeginner3(goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => [
    [
      beginnerLeg(goal, week, 0),
      pick(BEGINNER_CHEST, selectionIndex(goal, week, 0)),
      pick(BEGINNER_BACK, selectionIndex(goal, week, 0)),
      beginnerCore(goal, week, 0),
    ],
    [
      beginnerLeg(goal, week, 1),
      pick(SHOULDERS, selectionIndex(goal, week, 1)),
      E.B1,
      beginnerCardio(goal, week, 0),
    ],
    [
      beginnerLeg(goal, week, 2),
      pick(BEGINNER_BACK, selectionIndex(goal, week, 1)),
      E.T1,
      beginnerCore(goal, week, 5),
    ],
  ]));
}

function buildBeginner4(goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const index = selectionIndex(goal, week);
    const lower = BEGINNER_LOWER_PAIRS[index % BEGINNER_LOWER_PAIRS.length];
    return [
      [
        pick(BEGINNER_CHEST, index),
        pick(BEGINNER_BACK, index),
        pick(SHOULDERS, index),
        E.T1,
      ],
      [...lower.a, beginnerCore(goal, week, 2)],
      [
        pick(BEGINNER_BACK, index + 1),
        pick(BEGINNER_CHEST, index + 1),
        pick(SHOULDERS, index + 1),
        E.B1,
      ],
      [...lower.b, beginnerCardio(goal, week, 1)],
    ];
  }));
}

function buildAdvanced4(goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const index = selectionIndex(goal, week);
    const lower = advancedLowerPair(index);
    const triceps = pick(ADVANCED_TRICEPS, index);
    return [
      [
        triceps === E.T2 ? E.P3 : pick(ADVANCED_CHEST, index),
        pick(ADVANCED_BACK, index),
        pick(SHOULDERS, index),
        triceps,
        advancedCore(goal, week, 0),
      ],
      [...lower.a, advancedCore(goal, week, 4)],
      [
        pick(ADVANCED_BACK, index + 1),
        pick(ADVANCED_CHEST, index + 2),
        pick(SHOULDERS, index + 1),
        E.B1,
        advancedCardio(goal, week, 0),
      ],
      [...lower.b, advancedCore(goal, week, 8)],
    ];
  }));
}

function buildAdvanced5(goal) {
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const index = selectionIndex(goal, week);
    const lower = advancedLowerPair(index);
    const mixedTriceps = pick(ADVANCED_TRICEPS, index + 1);
    const pull = [
      pick(ADVANCED_BACK, index),
      pick(ADVANCED_BACK, index + 1),
      pick(ADVANCED_BACK, index + 2),
    ];
    return [
      [
        pick(ADVANCED_PUSH, index),
        E.P3,
        E.U1,
        E.U2,
        E.T1,
      ],
      [...pull, E.B1, advancedCore(goal, week, 1)],
      [...lower.a, advancedCore(goal, week, 5)],
      [
        mixedTriceps === E.T2 ? E.P3 : pick(ADVANCED_CHEST, index + 1),
        pick(ADVANCED_BACK, index + 3),
        pick(SHOULDERS, index),
        E.B1,
        mixedTriceps,
      ],
      [...lower.b, advancedCardio(goal, week, 1)],
    ];
  }));
}

const PROGRAM_BUILDERS = Object.freeze({
  "incepator-3": buildBeginner3,
  "incepator-4": buildBeginner4,
  "avansat-4": buildAdvanced4,
  "avansat-5": buildAdvanced5,
});

export const CAT2_HOME_EDITORIAL_TEMPLATES = Object.freeze(Object.fromEntries(
  ["slabire", "masa", "forma"].flatMap((goal) => Object.entries(PROGRAM_BUILDERS).map(([program, builder]) => [
    `${goal}:${program}`,
    builder(goal),
  ])),
));

export function isCat2HomeEditorialProfile(profile) {
  return profile?.age === "30-44"
    && profile?.place === "acasa"
    && Object.hasOwn(CAT2_HOME_EDITORIAL_TEMPLATES, `${profile.goal}:${profile.program}`);
}

export function cat2HomeEditorialTemplate(profile) {
  if (!isCat2HomeEditorialProfile(profile)) return null;
  return CAT2_HOME_EDITORIAL_TEMPLATES[`${profile.goal}:${profile.program}`];
}

export function cat2HomeDailyExerciseCount(profile) {
  return isCat2HomeEditorialProfile(profile)
    ? CAT2_HOME_DAILY_EXERCISE_COUNT[profile.program]
    : null;
}

export function cat2HomeExerciseApprovedForGender(profile, exerciseKey) {
  return isCat2HomeEditorialProfile(profile) && CAT2_HOME_ALLOWLIST.includes(exerciseKey);
}

export function cat2HomeDayMatchesStructure(program, dayIndex, exerciseKeys) {
  const expectedGroups = CAT2_HOME_DAY_GROUPS[program]?.[dayIndex];
  if (!expectedGroups || expectedGroups.length !== exerciseKeys.length) return false;
  const actualGroups = exerciseKeys.map((key) => CAT2_HOME_GROUP_BY_EXERCISE[key]);
  return actualGroups.every(Boolean) && actualGroups.join("|") === expectedGroups.join("|");
}

export function cat2HomeSameFamilyConflicts(exerciseKeys) {
  return cat3HomeSameFamilyConflicts(exerciseKeys);
}
