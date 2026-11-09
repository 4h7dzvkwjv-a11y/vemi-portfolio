export const CAT4_GYM_EDITORIAL_VERSION = "cat4-gym-editorial-v1";

export const CAT4_GYM_DAILY_EXERCISE_COUNT = Object.freeze({
  "incepator-3": 3,
  "avansat-4": 4,
});

export const CAT4_GYM_EXERCISES = Object.freeze({
  A1: "abdomene",
  A2: "dead-bug",
  A3: "russian-twist",
  L1: "extensii-pentru-femurali-din-culcat",
  L2: "extensii-cvadriceps",
  L3: "flexii-pentru-picioare-la-aparat",
  L4: "genuflexiuni",
  L5: "presa-pentru-picioare-la-aparat-din-sezut",
  L6: "presa-pentru-picioare-la-45",
  C1: "fluturari-la-aparat",
  C2: "impins-cu-gantere-apropiate",
  C3: "impins-la-aparat",
  C4: "pec-deck",
  S1: "fluturari-inverse",
  S2: "ridicari-laterale-cu-gantere-din-sezut-cu-spatele-sprijinit",
  S3: "impins-cu-gantere-pentru-umeri-din-sezut",
  S4: "ridicari-laterale-cu-gantere-din-sezut",
  T1: "extensii-pentru-triceps-la-cablu-cu-bara",
  T2: "extensii-pentru-triceps-la-cablu-cu-franghia",
  B1: "ramat-aparat",
  B2: "tractiuni-la-helcometru-cu-priza-ingusta",
  B3: "tractiuni-la-helcometru-cu-priza-larga",
  I1: "flexii-gantere",
  I2: "flexii-la-cablu-cu-franghia",
});

export const CAT4_GYM_ALLOWLIST = Object.freeze(Object.values(CAT4_GYM_EXERCISES));

const E = CAT4_GYM_EXERCISES;

// Reverse Fly este încadrat editorial la Umeri în această configurație aprobată,
// fără a modifica grupa canonică din catalog sau eligibilitatea globală.
export const CAT4_GYM_EDITORIAL_GROUP_BY_EXERCISE = Object.freeze({
  [E.A1]: "Abdomen",
  [E.A2]: "Abdomen",
  [E.A3]: "Abdomen",
  [E.L1]: "Picioare",
  [E.L2]: "Picioare",
  [E.L3]: "Picioare",
  [E.L4]: "Picioare",
  [E.L5]: "Picioare",
  [E.L6]: "Picioare",
  [E.C1]: "Piept",
  [E.C2]: "Piept",
  [E.C3]: "Piept",
  [E.C4]: "Piept",
  [E.S1]: "Umeri",
  [E.S2]: "Umeri",
  [E.S3]: "Umeri",
  [E.S4]: "Umeri",
  [E.T1]: "Triceps",
  [E.T2]: "Triceps",
  [E.B1]: "Spate",
  [E.B2]: "Spate",
  [E.B3]: "Spate",
  [E.I1]: "Biceps",
  [E.I2]: "Biceps",
});

export const CAT4_GYM_DAY_GROUPS = Object.freeze({
  "incepator-3": Object.freeze([
    Object.freeze(["Piept", "Umeri", "Triceps"]),
    Object.freeze(["Picioare", "Picioare", "Picioare"]),
    Object.freeze(["Spate", "Biceps", "Abdomen"]),
  ]),
  "avansat-4": Object.freeze([
    Object.freeze(["Piept", "Umeri", "Triceps", "Abdomen"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Abdomen"]),
    Object.freeze(["Spate", "Biceps", "Abdomen", "Abdomen"]),
    Object.freeze(["Picioare", "Picioare", "Picioare", "Abdomen"]),
  ]),
});

export const CAT4_GYM_DAY_TITLES = Object.freeze({
  "incepator-3": Object.freeze(["Partea superioară", "Partea inferioară", "Partea superioară"]),
  "avansat-4": Object.freeze(["Partea superioară", "Partea inferioară", "Partea superioară", "Partea inferioară"]),
});

const freezeWeeks = (weeks) => Object.freeze(weeks.map((week) => Object.freeze(
  week.map((day) => Object.freeze([...day])),
)));

export const CAT4_GYM_EDITORIAL_TEMPLATES = Object.freeze({
  "slabire:incepator-3": freezeWeeks([
    [[E.C3, E.S2, E.T2], [E.L5, E.L2, E.L1], [E.B2, E.I2, E.A2]],
    [[E.S3, E.C1, E.T1], [E.L4, E.L6, E.L3], [E.I1, E.B1, E.A1]],
    [[E.T2, E.C2, E.S1], [E.L6, E.L1, E.L2], [E.B3, E.A3, E.I2]],
    [[E.S4, E.T1, E.C4], [E.L3, E.L4, E.L5], [E.A2, E.I1, E.B2]],
  ]),
  "slabire:avansat-4": freezeWeeks([
    [[E.C3, E.S3, E.T2, E.A2], [E.L4, E.L2, E.L1, E.A3], [E.B2, E.I2, E.A1, E.A2], [E.L5, E.L6, E.L3, E.A1]],
    [[E.C1, E.S2, E.T1, E.A3], [E.L5, E.L3, E.L2, E.A2], [E.B1, E.I1, E.A1, E.A3], [E.L4, E.L6, E.L1, E.A1]],
    [[E.C2, E.S1, E.T2, E.A1], [E.L6, E.L1, E.L4, E.A3], [E.B3, E.I2, E.A2, E.A1], [E.L5, E.L2, E.L3, E.A2]],
    [[E.C4, E.S4, E.T1, E.A2], [E.L4, E.L3, E.L5, E.A1], [E.B2, E.I1, E.A3, E.A2], [E.L6, E.L2, E.L1, E.A3]],
  ]),
  "masa:incepator-3": freezeWeeks([
    [[E.C2, E.S3, E.T1], [E.L6, E.L2, E.L3], [E.B1, E.I1, E.A1]],
    [[E.C3, E.S2, E.T2], [E.L5, E.L4, E.L1], [E.B2, E.I2, E.A2]],
    [[E.C4, E.S1, E.T1], [E.L6, E.L3, E.L2], [E.B3, E.I1, E.A3]],
    [[E.C1, E.S4, E.T2], [E.L4, E.L5, E.L1], [E.B1, E.I2, E.A1]],
  ]),
  "masa:avansat-4": freezeWeeks([
    [[E.C2, E.S3, E.T1, E.A1], [E.L6, E.L2, E.L3, E.A2], [E.B1, E.I1, E.A1, E.A3], [E.L5, E.L4, E.L1, E.A3]],
    [[E.C3, E.S2, E.T2, E.A2], [E.L5, E.L4, E.L1, E.A1], [E.B2, E.I2, E.A2, E.A3], [E.L6, E.L2, E.L3, E.A3]],
    [[E.C4, E.S1, E.T1, E.A3], [E.L6, E.L3, E.L1, E.A2], [E.B3, E.I1, E.A1, E.A3], [E.L5, E.L4, E.L2, E.A1]],
    [[E.C1, E.S4, E.T2, E.A1], [E.L5, E.L2, E.L3, E.A3], [E.B1, E.I2, E.A1, E.A2], [E.L6, E.L4, E.L1, E.A2]],
  ]),
  "forma:incepator-3": freezeWeeks([
    [[E.C4, E.S4, E.T2], [E.L5, E.L2, E.L1], [E.B3, E.I2, E.A3]],
    [[E.C1, E.S3, E.T1], [E.L4, E.L6, E.L3], [E.B1, E.I1, E.A2]],
    [[E.C3, E.S2, E.T2], [E.L6, E.L1, E.L2], [E.B2, E.I2, E.A1]],
    [[E.C2, E.S1, E.T1], [E.L3, E.L4, E.L5], [E.B3, E.I1, E.A3]],
  ]),
  "forma:avansat-4": freezeWeeks([
    [[E.C4, E.S4, E.T2, E.A3], [E.L5, E.L2, E.L1, E.A1], [E.B3, E.I2, E.A2, E.A3], [E.L4, E.L6, E.L3, E.A2]],
    [[E.C1, E.S3, E.T1, E.A2], [E.L4, E.L6, E.L3, E.A3], [E.B1, E.I1, E.A1, E.A2], [E.L2, E.L1, E.L5, E.A1]],
    [[E.C3, E.S2, E.T2, E.A1], [E.L6, E.L1, E.L2, E.A2], [E.B2, E.I2, E.A3, E.A1], [E.L3, E.L4, E.L5, E.A3]],
    [[E.C2, E.S1, E.T1, E.A3], [E.L3, E.L4, E.L5, E.A1], [E.B3, E.I1, E.A2, E.A3], [E.L1, E.L2, E.L6, E.A2]],
  ]),
});

export function isCat4GymEditorialProfile(profile) {
  return profile?.age === "60+"
    && profile?.place === "sala"
    && Object.hasOwn(CAT4_GYM_EDITORIAL_TEMPLATES, `${profile.goal}:${profile.program}`);
}

export function cat4GymEditorialTemplate(profile) {
  if (!isCat4GymEditorialProfile(profile)) return null;
  return CAT4_GYM_EDITORIAL_TEMPLATES[`${profile.goal}:${profile.program}`];
}

export function cat4GymDailyExerciseCount(profile) {
  return isCat4GymEditorialProfile(profile)
    ? CAT4_GYM_DAILY_EXERCISE_COUNT[profile.program]
    : null;
}
