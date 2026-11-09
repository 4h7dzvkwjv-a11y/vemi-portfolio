export const CAT3_HOME_EDITORIAL_VERSION = "cat3-home-editorial-v1";

export const CAT3_HOME_DAILY_EXERCISE_COUNT = Object.freeze({
  "incepator-3": 4,
  "incepator-4": 4,
  "avansat-4": 5,
  "avansat-5": 5,
});

export const CAT3_HOME_EXERCISES = Object.freeze({
  A1: "abdomene",
  A2: "aplecari-laterale-din-picioare",
  A3: "atingeri-alternative-ale-piciorului-din-picioare",
  A4: "crunch-cu-minge",
  A5: "crunch-lateral-din-picioare",
  A6: "dead-bug",
  A7: "plank",
  A8: "plank-invers",
  A9: "ridicari-de-genunchi-cu-rotatie",
  A10: "russian-twist",
  C1: "alergare-pe-loc",
  C2: "ridicari-alternative-ale-genunchilor",
  P1: "flotari",
  P2: "flotari-largi",
  P3: "fluturari-gantere",
  S1: "cobra-din-culcat",
  S2: "ridicari-din-umeri-cu-gantere",
  S3: "superman-alternativ",
  U1: "impins-cu-gantere-pentru-umeri-din-picioare",
  U2: "ridicari-laterale-cu-gantere-din-picioare",
  B1: "flexii-gantere",
  T1: "dips-intre-scaune",
  L1: "extensii-pentru-femurali-din-culcat",
  L2: "fandari-inverse-alternative",
  L3: "fandari-inverse-cu-gantere",
  L4: "genuflexiuni",
  L5: "genuflexiuni-cu-gantere-la-umeri",
  L6: "genuflexiuni-goblet",
  L7: "genuflexiuni-sumo",
  L8: "hip-thrust-cu-gantera",
  L9: "indreptari-pe-un-picior-fara-greutate",
  L10: "ridicari-pe-varfuri-cu-gantere",
  L11: "ridicari-unilaterale-pe-varfuri-cu-gantera",
  A11: "ab-wheel-din-genunchi",
  C3: "burpees",
  L12: "fandari-bulgaresti",
  P4: "flotari-cu-atingerea-umarului",
  P5: "flotari-declinate",
  T2: "flotari-diamant",
  P6: "flotari-hindu",
  S4: "indreptari-romanesti",
  A12: "mountain-climbers",
  A13: "v-up",
  A14: "v-up-cu-minge",
});

const E = CAT3_HOME_EXERCISES;

export const CAT3_HOME_ALLOWLIST = Object.freeze(Object.values(E));
export const CAT3_HOME_ADVANCED_ONLY = Object.freeze([
  E.A11,
  E.C3,
  E.L12,
  E.P4,
  E.P5,
  E.T2,
  E.P6,
  E.S4,
  E.A12,
  E.A13,
  E.A14,
]);

export const CAT3_HOME_GROUP_BY_EXERCISE = Object.freeze({
  [E.A1]: "Abdomen",
  [E.A2]: "Abdomen",
  [E.A3]: "Abdomen",
  [E.A4]: "Abdomen",
  [E.A5]: "Abdomen",
  [E.A6]: "Abdomen",
  [E.A7]: "Abdomen",
  [E.A8]: "Abdomen",
  [E.A9]: "Abdomen",
  [E.A10]: "Abdomen",
  [E.A11]: "Abdomen",
  [E.A12]: "Abdomen",
  [E.A13]: "Abdomen",
  [E.A14]: "Abdomen",
  [E.C1]: "Cardio",
  [E.C2]: "Cardio",
  [E.C3]: "Cardio",
  [E.P1]: "Piept",
  [E.P2]: "Piept",
  [E.P3]: "Piept",
  [E.P4]: "Piept",
  [E.P5]: "Piept",
  [E.P6]: "Piept",
  [E.S1]: "Spate",
  [E.S2]: "Spate",
  [E.S3]: "Spate",
  [E.S4]: "Spate",
  [E.U1]: "Umeri",
  [E.U2]: "Umeri",
  [E.B1]: "Biceps",
  [E.T1]: "Triceps",
  [E.T2]: "Triceps",
  [E.L1]: "Picioare",
  [E.L2]: "Picioare",
  [E.L3]: "Picioare",
  [E.L4]: "Picioare",
  [E.L5]: "Picioare",
  [E.L6]: "Picioare",
  [E.L7]: "Picioare",
  [E.L8]: "Picioare",
  [E.L9]: "Picioare",
  [E.L10]: "Picioare",
  [E.L11]: "Picioare",
  [E.L12]: "Picioare",
});

export const CAT3_HOME_REDUNDANT_FAMILIES = Object.freeze({
  flotari: Object.freeze([E.P1, E.P4, E.P5, E.T2, E.P6, E.P2]),
  genuflexiuni: Object.freeze([E.L4, E.L5, E.L6, E.L7]),
  fandari: Object.freeze([E.L12, E.L2, E.L3]),
  ridicariPeVarfuri: Object.freeze([E.L10, E.L11]),
  crunch: Object.freeze([E.A1, E.A4, E.A5]),
  plank: Object.freeze([E.A7, E.A8]),
  vUp: Object.freeze([E.A13, E.A14]),
});

export const CAT3_HOME_STANDING_EXERCISES = Object.freeze([
  E.A2, E.A3, E.A5, E.A9,
  E.C1, E.C2,
  E.S2, E.S4,
  E.U1, E.U2, E.B1, E.T1,
  E.L2, E.L3, E.L4, E.L5, E.L6, E.L7, E.L9, E.L10, E.L11, E.L12,
]);

export const CAT3_HOME_FLOOR_EXERCISES = Object.freeze([
  E.A1, E.A4, E.A6, E.A7, E.A8, E.A10, E.A11, E.A12, E.A13, E.A14,
  E.P1, E.P2, E.P3, E.P4, E.P5, E.P6, E.T2,
  E.S1, E.S3,
  E.L1, E.L8,
]);

export const CAT3_HOME_MIXED_EXERCISES = Object.freeze([E.C3]);

export const CAT3_HOME_DAY_TITLES = Object.freeze({
  "incepator-3": Object.freeze(["Tot corpul · A", "Tot corpul · B", "Tot corpul · C"]),
  "incepator-4": Object.freeze(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-4": Object.freeze(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-5": Object.freeze(["Împins", "Tras", "Picioare A", "Partea superioară", "Picioare B și condiționare"]),
});

export const CAT3_HOME_DAY_FOCUS = Object.freeze({
  "incepator-3": Object.freeze([
    "Picioare, piept, spate și trunchi",
    "Picioare, umeri, biceps și trunchi",
    "Picioare, împins, spate și trunchi",
  ]),
  "incepator-4": Object.freeze([
    "Piept, spate, umeri și triceps",
    "Picioare și trunchi",
    "Piept, spate, umeri și biceps",
    "Picioare și trunchi",
  ]),
  "avansat-4": Object.freeze([
    "Piept, spate, umeri, triceps și abdomen",
    "Picioare și trunchi",
    "Piept, spate, umeri, biceps și abdomen",
    "Picioare și trunchi",
  ]),
  "avansat-5": Object.freeze([
    "Piept, umeri și triceps",
    "Spate, biceps și abdomen",
    "Picioare și abdomen",
    "Piept, spate, umeri, triceps și abdomen",
    "Picioare, abdomen și cardio",
  ]),
});

export const CAT3_HOME_DAY_STRUCTURE = Object.freeze({
  "incepator-3": Object.freeze([
    Object.freeze([["Picioare"], ["Piept"], ["Spate"], ["Abdomen", "Cardio"]]),
    Object.freeze([["Picioare"], ["Umeri"], ["Biceps"], ["Abdomen", "Cardio"]]),
    Object.freeze([["Picioare"], ["Piept", "Triceps"], ["Spate"], ["Abdomen", "Cardio"]]),
  ]),
  "incepator-4": Object.freeze([
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Triceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen", "Cardio"]]),
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Biceps"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen", "Cardio"]]),
  ]),
  "avansat-4": Object.freeze([
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Triceps"], ["Abdomen"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen", "Cardio"]]),
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Biceps"], ["Abdomen"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen", "Cardio"]]),
  ]),
  "avansat-5": Object.freeze([
    Object.freeze([["Piept"], ["Piept"], ["Umeri"], ["Umeri"], ["Triceps"]]),
    Object.freeze([["Spate"], ["Spate"], ["Spate"], ["Biceps"], ["Abdomen"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen"]]),
    Object.freeze([["Piept"], ["Spate"], ["Umeri"], ["Triceps"], ["Abdomen"]]),
    Object.freeze([["Picioare"], ["Picioare"], ["Picioare"], ["Abdomen"], ["Cardio"]]),
  ]),
});

const GOAL_OFFSET = Object.freeze({ slabire: 0, masa: 1, forma: 2 });

const COMMON_CORE = Object.freeze({
  slabire: Object.freeze([E.C1, E.A3, E.C2, E.A5]),
  masa: Object.freeze([E.A7, E.A6, E.A4, E.A1]),
  forma: Object.freeze([E.A2, E.C2, E.A10, E.C1]),
});

const COMMON_CHEST = Object.freeze({
  slabire: Object.freeze([E.P1, E.P2, E.P1, E.P3]),
  masa: Object.freeze([E.P3, E.P1, E.P2, E.P3]),
  forma: Object.freeze([E.P2, E.P3, E.P1, E.P2]),
});

const COMMON_BACK = Object.freeze({
  slabire: Object.freeze([E.S2, E.S3, E.S1, E.S2]),
  masa: Object.freeze([E.S2, E.S1, E.S3, E.S2]),
  forma: Object.freeze([E.S3, E.S2, E.S1, E.S3]),
});

const BEGINNER_3_LEGS = Object.freeze({
  slabire: Object.freeze({
    day1: Object.freeze([E.L4, E.L2, E.L9, E.L6]),
    day2: Object.freeze([E.L2, E.L4, E.L6, E.L9]),
    day3: Object.freeze([E.L9, E.L6, E.L2, E.L4]),
  }),
  masa: Object.freeze({
    day1: Object.freeze([E.L6, E.L3, E.L5, E.L7]),
    day2: Object.freeze([E.L5, E.L7, E.L3, E.L6]),
    day3: Object.freeze([E.L3, E.L6, E.L7, E.L5]),
  }),
  forma: Object.freeze({
    day1: Object.freeze([E.L5, E.L2, E.L7, E.L9]),
    day2: Object.freeze([E.L9, E.L4, E.L6, E.L3]),
    day3: Object.freeze([E.L2, E.L6, E.L3, E.L4]),
  }),
});

const BEGINNER_4_LOWER_PAIRS = Object.freeze([
  Object.freeze({ a: Object.freeze([E.L4, E.L2, E.L10]), b: Object.freeze([E.L6, E.L3, E.L8]) }),
  Object.freeze({ a: Object.freeze([E.L5, E.L3, E.L1]), b: Object.freeze([E.L7, E.L2, E.L9]) }),
  Object.freeze({ a: Object.freeze([E.L6, E.L2, E.L11]), b: Object.freeze([E.L4, E.L3, E.L8]) }),
  Object.freeze({ a: Object.freeze([E.L7, E.L3, E.L9]), b: Object.freeze([E.L5, E.L2, E.L1]) }),
]);

const BEGINNER_4_UPPER_A = Object.freeze([
  Object.freeze([E.U1, E.T1, E.S2, E.P1]),
  Object.freeze([E.U2, E.T1, E.S3, E.P2]),
  Object.freeze([E.S2, E.U1, E.T1, E.P3]),
  Object.freeze([E.T1, E.U2, E.S1, E.P1]),
]);

const BEGINNER_4_UPPER_B = Object.freeze([
  Object.freeze([E.U2, E.B1, E.S2, E.P2]),
  Object.freeze([E.U1, E.B1, E.S3, E.P3]),
  Object.freeze([E.S2, E.U2, E.B1, E.P1]),
  Object.freeze([E.U1, E.B1, E.S1, E.P2]),
]);

const BEGINNER_4_LOWER_CORE_A = Object.freeze({
  slabire: Object.freeze([E.C1, E.C2, E.A3, E.A9]),
  masa: Object.freeze([E.A7, E.A6, E.A4, E.A1]),
  forma: Object.freeze([E.A2, E.A9, E.C2, E.A5]),
});

const BEGINNER_4_LOWER_CORE_B = Object.freeze({
  slabire: Object.freeze([E.A6, E.A7, E.A10, E.A8]),
  masa: Object.freeze([E.A8, E.A10, E.A6, E.A7]),
  forma: Object.freeze([E.A10, E.A6, E.A7, E.A4]),
});

const ADVANCED_4_LOWER_PAIRS = Object.freeze([
  Object.freeze({ a: Object.freeze([E.L4, E.L2, E.L10, E.L9]), b: Object.freeze([E.L6, E.L3, E.L11, E.L8]) }),
  Object.freeze({ a: Object.freeze([E.L5, E.L3, E.L11, E.L9]), b: Object.freeze([E.L7, E.L12, E.L10, E.L1]) }),
  Object.freeze({ a: Object.freeze([E.L6, E.L12, E.L10, E.L9]), b: Object.freeze([E.L4, E.L2, E.L11, E.L8]) }),
  Object.freeze({ a: Object.freeze([E.L7, E.L2, E.L11, E.L9]), b: Object.freeze([E.L5, E.L3, E.L10, E.L1]) }),
]);

const ADVANCED_4_UPPER_A = Object.freeze([
  Object.freeze([E.U1, E.S2, E.T1, E.P4, E.A11]),
  Object.freeze([E.U2, E.T1, E.A9, E.S3, E.P5]),
  Object.freeze([E.S2, E.U1, E.T1, E.P6, E.A13]),
  Object.freeze([E.A5, E.U2, E.T1, E.S1, E.P1]),
]);

const ADVANCED_4_UPPER_B = Object.freeze([
  Object.freeze([E.U2, E.S4, E.B1, E.P5, E.A12]),
  Object.freeze([E.U1, E.S2, E.B1, E.P4, E.A14]),
  Object.freeze([E.S2, E.U2, E.B1, E.P6, E.A11]),
  Object.freeze([E.A3, E.U1, E.B1, E.S1, E.P1]),
]);

const ADVANCED_4_LOWER_CORE_A = Object.freeze({
  slabire: Object.freeze([E.C1, E.C2, E.A9, E.A3]),
  masa: Object.freeze([E.A11, E.A14, E.A13, E.A12]),
  forma: Object.freeze([E.A9, E.C2, E.A3, E.C1]),
});

const ADVANCED_4_LOWER_CORE_B = Object.freeze({
  slabire: Object.freeze([E.A11, E.A12, E.A13, E.A14]),
  masa: Object.freeze([E.A7, E.A6, E.A10, E.A4]),
  forma: Object.freeze([E.A13, E.A12, E.A14, E.A11]),
});

const ADVANCED_5_PUSH = Object.freeze([
  Object.freeze([E.U1, E.U2, E.T1, E.P1, E.P3]),
  Object.freeze([E.U2, E.U1, E.T1, E.P4, E.P3]),
  Object.freeze([E.T1, E.U1, E.U2, E.P5, E.P3]),
  Object.freeze([E.P6, E.P3, E.U1, E.U2, E.T1]),
]);

const ADVANCED_5_PULL = Object.freeze([
  Object.freeze([E.S4, E.S2, E.B1, E.S1, E.A11]),
  Object.freeze([E.S4, E.S2, E.B1, E.S3, E.A12]),
  Object.freeze([E.S2, E.B1, E.S1, E.S3, E.A13]),
  Object.freeze([E.S4, E.B1, E.S1, E.S3, E.A14]),
]);

const ADVANCED_5_UPPER = Object.freeze([
  Object.freeze([E.U1, E.S2, E.T1, E.P4, E.A11]),
  Object.freeze([E.U2, E.S4, E.T1, E.P5, E.A13]),
  Object.freeze([E.S2, E.U1, E.A9, E.T1, E.P6]),
  Object.freeze([E.U2, E.S2, E.P3, E.T2, E.A14]),
]);

const ADVANCED_5_LOWER_PAIRS = Object.freeze([
  Object.freeze({ a: Object.freeze([E.L4, E.L12, E.L10, E.L1]), b: Object.freeze([E.L6, E.L3, E.L11]) }),
  Object.freeze({ a: Object.freeze([E.L5, E.L3, E.L11, E.L9]), b: Object.freeze([E.L7, E.L12, E.L10]) }),
  Object.freeze({ a: Object.freeze([E.L6, E.L2, E.L10, E.L8]), b: Object.freeze([E.L4, E.L3, E.L11]) }),
  Object.freeze({ a: Object.freeze([E.L7, E.L12, E.L11, E.L1]), b: Object.freeze([E.L5, E.L2, E.L10]) }),
]);

const ADVANCED_CORE = Object.freeze({
  slabire: Object.freeze([E.A12, E.A13, E.A11, E.A14]),
  masa: Object.freeze([E.A11, E.A14, E.A13, E.A12]),
  forma: Object.freeze([E.A13, E.A12, E.A14, E.A11]),
});

const ADVANCED_5_CARDIO = Object.freeze({
  slabire: Object.freeze([E.C3, E.C1, E.C2, E.C3]),
  masa: Object.freeze([E.C2, E.C1, E.C2, E.C1]),
  forma: Object.freeze([E.C1, E.C2, E.C3, E.C2]),
});

const standing = new Set(CAT3_HOME_STANDING_EXERCISES);
const floor = new Set(CAT3_HOME_FLOOR_EXERCISES);

function orderStandingThenFloor(exerciseKeys) {
  return [
    ...exerciseKeys.filter((key) => standing.has(key) || !floor.has(key)),
    ...exerciseKeys.filter((key) => floor.has(key)),
  ];
}

function freezeWeeks(weeks) {
  return Object.freeze(weeks.map((week) => Object.freeze(
    week.map((day) => Object.freeze([...day])),
  )));
}

function buildBeginner3(goal) {
  const legs = BEGINNER_3_LEGS[goal];
  const chest = COMMON_CHEST[goal];
  const back = COMMON_BACK[goal];
  const core = COMMON_CORE[goal];
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => [
    orderStandingThenFloor([legs.day1[week], chest[week], back[week], core[week]]),
    orderStandingThenFloor([legs.day2[week], week % 2 === 0 ? E.U1 : E.U2, E.B1, core[(week + 1) % 4]]),
    orderStandingThenFloor([
      legs.day3[week],
      week % 2 === 0 ? chest[(week + 1) % 4] : E.T1,
      back[(week + 2) % 4],
      core[(week + 2) % 4],
    ]),
  ]));
}

function buildBeginner4(goal) {
  const offset = GOAL_OFFSET[goal];
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const variant = (week + offset) % 4;
    const lower = BEGINNER_4_LOWER_PAIRS[variant];
    return [
      BEGINNER_4_UPPER_A[variant],
      orderStandingThenFloor([...lower.a, BEGINNER_4_LOWER_CORE_A[goal][week]]),
      BEGINNER_4_UPPER_B[variant],
      orderStandingThenFloor([...lower.b, BEGINNER_4_LOWER_CORE_B[goal][week]]),
    ];
  }));
}

function buildAdvanced4(goal) {
  const offset = GOAL_OFFSET[goal];
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const variant = (week + offset) % 4;
    const lower = ADVANCED_4_LOWER_PAIRS[variant];
    return [
      ADVANCED_4_UPPER_A[variant],
      orderStandingThenFloor([...lower.a, ADVANCED_4_LOWER_CORE_A[goal][week]]),
      ADVANCED_4_UPPER_B[variant],
      orderStandingThenFloor([...lower.b, ADVANCED_4_LOWER_CORE_B[goal][week]]),
    ];
  }));
}

function buildAdvanced5(goal) {
  const offset = GOAL_OFFSET[goal];
  return freezeWeeks(Array.from({ length: 4 }, (_, week) => {
    const variant = (week + offset) % 4;
    const lower = ADVANCED_5_LOWER_PAIRS[variant];
    return [
      ADVANCED_5_PUSH[variant],
      ADVANCED_5_PULL[variant],
      orderStandingThenFloor([...lower.a, ADVANCED_CORE[goal][week]]),
      ADVANCED_5_UPPER[variant],
      orderStandingThenFloor([...lower.b, ADVANCED_5_CARDIO[goal][week], ADVANCED_CORE[goal][(week + 1) % 4]]),
    ];
  }));
}

const PROGRAM_BUILDERS = Object.freeze({
  "incepator-3": buildBeginner3,
  "incepator-4": buildBeginner4,
  "avansat-4": buildAdvanced4,
  "avansat-5": buildAdvanced5,
});

export const CAT3_HOME_EDITORIAL_TEMPLATES = Object.freeze(Object.fromEntries(
  ["slabire", "masa", "forma"].flatMap((goal) => Object.entries(PROGRAM_BUILDERS).map(([program, builder]) => [
    `${goal}:${program}`,
    builder(goal),
  ])),
));

export function isCat3HomeEditorialProfile(profile) {
  return profile?.age === "45-59"
    && profile?.place === "acasa"
    && Object.hasOwn(CAT3_HOME_EDITORIAL_TEMPLATES, `${profile.goal}:${profile.program}`);
}

export function cat3HomeEditorialTemplate(profile) {
  if (!isCat3HomeEditorialProfile(profile)) return null;
  return CAT3_HOME_EDITORIAL_TEMPLATES[`${profile.goal}:${profile.program}`];
}

export function cat3HomeDailyExerciseCount(profile) {
  return isCat3HomeEditorialProfile(profile)
    ? CAT3_HOME_DAILY_EXERCISE_COUNT[profile.program]
    : null;
}

export function cat3HomeExerciseApprovedForGender(profile, exerciseKey) {
  return isCat3HomeEditorialProfile(profile) && CAT3_HOME_ALLOWLIST.includes(exerciseKey);
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

export function cat3HomeDayMatchesStructure(program, dayIndex, exerciseKeys) {
  const slots = CAT3_HOME_DAY_STRUCTURE[program]?.[dayIndex];
  if (!slots || slots.length !== exerciseKeys.length) return false;
  const groups = exerciseKeys.map((key) => CAT3_HOME_GROUP_BY_EXERCISE[key]);
  return groups.every(Boolean) && matchGroupsToSlots(groups, slots);
}

export function cat3HomeSameFamilyConflicts(exerciseKeys) {
  return Object.entries(CAT3_HOME_REDUNDANT_FAMILIES).filter(([, family]) =>
    exerciseKeys.filter((key) => family.includes(key)).length > 1,
  ).map(([familyName]) => familyName);
}

export function cat3HomeSurfaceTransitions(exerciseKeys) {
  const surfaces = exerciseKeys.map((key) => standing.has(key) ? "standing" : floor.has(key) ? "floor" : "mixed")
    .filter((surface) => surface !== "mixed");
  let transitions = 0;
  for (let index = 1; index < surfaces.length; index += 1) {
    if (surfaces[index] !== surfaces[index - 1]) transitions += 1;
  }
  return transitions;
}
