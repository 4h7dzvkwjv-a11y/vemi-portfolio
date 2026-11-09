export const CAT4_HOME_EDITORIAL_VERSION = "cat4-home-batch-1-v3-crunch-pair";

export const CAT4_HOME_DAILY_EXERCISE_COUNT = Object.freeze({
  "incepator-3": 3,
  "avansat-4": 4,
});

export const CAT4_HOME_EXERCISES = Object.freeze({
  E1: "alergare-pe-loc",
  E2: "atingeri-alternative-ale-piciorului-din-picioare",
  E3: "abdomene",
  E4: "aplecari-laterale-din-picioare",
  E5: "crunch-lateral-din-picioare",
  E6: "dead-bug",
  E7: "genuflexiuni",
  E8: "ridicari-de-genunchi-cu-rotatie",
  E9: "russian-twist",
  E10: "superman-alternativ",
});

export const CAT4_HOME_ALLOWLIST = Object.freeze(Object.values(CAT4_HOME_EXERCISES));
export const CAT4_HOME_STANDING_EXERCISES = Object.freeze([
  CAT4_HOME_EXERCISES.E1,
  CAT4_HOME_EXERCISES.E2,
  CAT4_HOME_EXERCISES.E4,
  CAT4_HOME_EXERCISES.E5,
  CAT4_HOME_EXERCISES.E7,
  CAT4_HOME_EXERCISES.E8,
]);
export const CAT4_HOME_FLOOR_EXERCISES = Object.freeze([
  CAT4_HOME_EXERCISES.E3,
  CAT4_HOME_EXERCISES.E6,
  CAT4_HOME_EXERCISES.E9,
  CAT4_HOME_EXERCISES.E10,
]);

const E = CAT4_HOME_EXERCISES;
export const CAT4_HOME_CRUNCH_PAIR = Object.freeze([E.E3, E.E5]);
export const CAT4_HOME_MAX_SAME_DAY_EXERCISES_FROM_CRUNCH_PAIR = 1;
const freezeWeeks = (weeks) => Object.freeze(weeks.map((week) => Object.freeze(
  week.map((day) => Object.freeze([...day])),
)));

export const CAT4_HOME_EDITORIAL_TEMPLATES = Object.freeze({
  "slabire:incepator-3": freezeWeeks([
    [[E.E1, E.E7, E.E6], [E.E2, E.E8, E.E3], [E.E4, E.E5, E.E10]],
    [[E.E2, E.E1, E.E9], [E.E8, E.E7, E.E10], [E.E5, E.E4, E.E6]],
    [[E.E7, E.E2, E.E3], [E.E1, E.E4, E.E6], [E.E8, E.E5, E.E9]],
    [[E.E5, E.E1, E.E10], [E.E7, E.E8, E.E9], [E.E2, E.E4, E.E3]],
  ]),
  "slabire:avansat-4": freezeWeeks([
    [[E.E1, E.E2, E.E7, E.E6], [E.E8, E.E4, E.E5, E.E6], [E.E2, E.E8, E.E7, E.E9], [E.E1, E.E5, E.E4, E.E10]],
    [[E.E2, E.E1, E.E8, E.E9], [E.E7, E.E5, E.E4, E.E10], [E.E8, E.E2, E.E1, E.E3], [E.E4, E.E7, E.E5, E.E6]],
    [[E.E7, E.E8, E.E1, E.E3], [E.E5, E.E2, E.E4, E.E6], [E.E1, E.E7, E.E8, E.E10], [E.E2, E.E4, E.E5, E.E9]],
    [[E.E8, E.E2, E.E7, E.E10], [E.E4, E.E1, E.E5, E.E9], [E.E7, E.E8, E.E2, E.E6], [E.E5, E.E1, E.E4, E.E6]],
  ]),
  "masa:incepator-3": freezeWeeks([
    [[E.E7, E.E3, E.E6], [E.E8, E.E9, E.E10], [E.E2, E.E7, E.E3]],
    [[E.E8, E.E6, E.E10], [E.E7, E.E3, E.E9], [E.E4, E.E5, E.E6]],
    [[E.E2, E.E9, E.E3], [E.E4, E.E7, E.E10], [E.E5, E.E6, E.E9]],
    [[E.E5, E.E6, E.E10], [E.E1, E.E7, E.E6], [E.E8, E.E2, E.E9]],
  ]),
  "masa:avansat-4": freezeWeeks([
    [[E.E7, E.E8, E.E3, E.E6], [E.E2, E.E7, E.E9, E.E10], [E.E4, E.E5, E.E6, E.E10], [E.E1, E.E7, E.E10, E.E9]],
    [[E.E8, E.E7, E.E6, E.E10], [E.E7, E.E2, E.E3, E.E9], [E.E5, E.E4, E.E9, E.E6], [E.E2, E.E8, E.E3, E.E10]],
    [[E.E2, E.E8, E.E9, E.E3], [E.E4, E.E7, E.E6, E.E10], [E.E7, E.E5, E.E6, E.E9], [E.E8, E.E1, E.E10, E.E6]],
    [[E.E5, E.E7, E.E10, E.E6], [E.E1, E.E8, E.E9, E.E6], [E.E8, E.E2, E.E6, E.E3], [E.E7, E.E4, E.E9, E.E10]],
  ]),
  "forma:incepator-3": freezeWeeks([
    [[E.E7, E.E2, E.E3], [E.E8, E.E4, E.E6], [E.E5, E.E1, E.E10]],
    [[E.E2, E.E5, E.E9], [E.E4, E.E7, E.E10], [E.E1, E.E8, E.E3]],
    [[E.E8, E.E2, E.E6], [E.E5, E.E4, E.E10], [E.E7, E.E1, E.E9]],
    [[E.E4, E.E8, E.E10], [E.E1, E.E2, E.E9], [E.E2, E.E7, E.E6]],
  ]),
  "forma:avansat-4": freezeWeeks([
    [[E.E1, E.E7, E.E6, E.E3], [E.E2, E.E8, E.E9, E.E10], [E.E4, E.E5, E.E6, E.E9], [E.E7, E.E2, E.E10, E.E6]],
    [[E.E2, E.E5, E.E9, E.E6], [E.E8, E.E7, E.E3, E.E10], [E.E5, E.E4, E.E6, E.E10], [E.E1, E.E8, E.E9, E.E3]],
    [[E.E7, E.E4, E.E10, E.E9], [E.E4, E.E2, E.E6, E.E3], [E.E1, E.E8, E.E3, E.E10], [E.E5, E.E7, E.E9, E.E6]],
    [[E.E8, E.E2, E.E3, E.E9], [E.E1, E.E5, E.E10, E.E6], [E.E7, E.E4, E.E9, E.E3], [E.E2, E.E8, E.E6, E.E10]],
  ]),
});

export function isCat4HomeEditorialProfile(profile) {
  return profile?.age === "60+"
    && profile?.place === "acasa"
    && Object.hasOwn(CAT4_HOME_EDITORIAL_TEMPLATES, `${profile.goal}:${profile.program}`);
}

export function cat4HomeEditorialTemplate(profile) {
  if (!isCat4HomeEditorialProfile(profile)) return null;
  return CAT4_HOME_EDITORIAL_TEMPLATES[`${profile.goal}:${profile.program}`];
}

export function cat4HomeDailyExerciseCount(profile) {
  return isCat4HomeEditorialProfile(profile)
    ? CAT4_HOME_DAILY_EXERCISE_COUNT[profile.program]
    : null;
}
