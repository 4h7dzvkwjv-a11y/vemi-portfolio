import {
  CAT2_GYM_ADVANCED_ONLY,
  CAT2_GYM_DAY_TITLES,
  CAT2_GYM_EDITORIAL_TEMPLATES,
  CAT2_GYM_ELIGIBLE_POOL,
  CAT2_GYM_FEMALE_ALLOWLIST,
  CAT2_GYM_FEMALE_BEGINNER_ALLOWLIST,
  CAT2_GYM_HOME_ONLY_FORBIDDEN,
  CAT2_GYM_MALE_ADVANCED_ALLOWLIST,
  CAT2_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT2_GYM_MALE_BEGINNER_ALLOWLIST,
  CAT2_GYM_MALE_CHEST_CABLE,
  cat2GymDayTitle,
  cat2GymExpectedGroups,
  cat2GymSameFamilyConflicts,
} from "./cat2-gym-editorial.mjs";

export const CAT1_GYM_EDITORIAL_VERSION = "cat1-gym-editorial-v1";

const freezeList = (values) => Object.freeze([...values]);
const freezeWeeks = (weeks) => Object.freeze(weeks.map((week) =>
  Object.freeze(week.map((day) => Object.freeze([...day]))),
));

// Contractele de eligibilitate sunt aceleași obiecte canonice validate pentru
// CAT2/CAT3 Gym. CAT1 adaugă numai selecția editorială proprie.
export const CAT1_GYM_ELIGIBLE_POOL = CAT2_GYM_ELIGIBLE_POOL;
export const CAT1_GYM_FEMALE_ALLOWLIST = CAT2_GYM_FEMALE_ALLOWLIST;
export const CAT1_GYM_FEMALE_BEGINNER_ALLOWLIST = CAT2_GYM_FEMALE_BEGINNER_ALLOWLIST;
export const CAT1_GYM_MALE_BEGINNER_ALLOWLIST = CAT2_GYM_MALE_BEGINNER_ALLOWLIST;
export const CAT1_GYM_MALE_ADVANCED_ALLOWLIST = CAT2_GYM_MALE_ADVANCED_ALLOWLIST;
export const CAT1_GYM_MALE_ADVANCED_FORBIDDEN = CAT2_GYM_MALE_ADVANCED_FORBIDDEN;
export const CAT1_GYM_ADVANCED_ONLY = CAT2_GYM_ADVANCED_ONLY;
export const CAT1_GYM_HOME_ONLY_FORBIDDEN = CAT2_GYM_HOME_ONLY_FORBIDDEN;
export const CAT1_GYM_MALE_CHEST_CABLE = CAT2_GYM_MALE_CHEST_CABLE;
export const CAT1_GYM_DAY_TITLES = CAT2_GYM_DAY_TITLES;

// Bara atașată cablului sau aparatului nu intră în această listă.
export const CAT1_GYM_FEMALE_FREE_BAR_FORBIDDEN = freezeList([
  "extensii-pentru-triceps-cu-bara-ez-din-culcat",
  "flexii-cu-bara-dreapta",
  "flexii-la-banca-scott-cu-bara-ez",
  "genuflexiuni-haltera",
  "impins-banca-haltera",
  "impins-cu-bara-pe-banca-declinata",
  "impins-cu-bara-pe-banca-inclinata",
  "ramat-haltera",
  "ridicari-din-umeri-cu-bara",
]);

const PROGRAMS = freezeList(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const GOAL_OFFSET = Object.freeze({ slabire: 0, masa: 2, forma: 4 });
const MALE_BEGINNER4_BICEPS = freezeList([
  "flexii-la-cablu-cu-bara-ez",
  "flexii-cu-bara-dreapta",
]);
const MALE_BEGINNER4_TRICEPS = freezeList([
  "extensii-pentru-triceps-la-cablu-cu-franghia",
  "extensii-pentru-triceps-la-cablu-cu-bara",
  "triceps-deasupra-capului",
  "extensii-pentru-triceps-la-cablu-cu-priza-inversa",
]);
const MALE_BEGINNER4_BACK_ROWS = freezeList([
  "ramat-aparat",
  "ramat-la-cablu-din-sezut",
  "ramat-unilateral-la-cablu-din-sezut",
  "ramat-la-cablu-cu-priza-ingusta",
]);
const MALE_BEGINNER4_HAMSTRINGS = freezeList([
  "flexii-pentru-picioare-la-aparat",
  "extensii-pentru-femurali-din-culcat",
]);
const MALE_BICEPS_REPLACEMENTS = freezeList([
  "flexii-cu-bara-dreapta",
  "flexii-la-cablu-cu-bara-ez",
]);
const MALE_SHOULDER_PRESS_REPLACEMENTS = freezeList([
  "impins-la-aparat-pentru-umeri",
  "impins-cu-gantere-pentru-umeri-din-sezut",
]);

const BEGINNER3_TYPES = Object.freeze([
  freezeList(["upper", "lower", "upper"]),
  freezeList(["lower", "upper", "lower"]),
  freezeList(["upper", "lower", "upper"]),
  freezeList(["lower", "upper", "lower"]),
]);

function item(values, index) {
  return values[((index % values.length) + values.length) % values.length];
}

function beginner3Ordinal(weekIndex, dayIndex, type) {
  let ordinal = 0;
  for (let week = 0; week <= weekIndex; week += 1) {
    const end = week === weekIndex ? dayIndex : BEGINNER3_TYPES[week].length;
    for (let day = 0; day < end; day += 1) {
      if (BEGINNER3_TYPES[week][day] === type) ordinal += 1;
    }
  }
  return ordinal;
}

function cat2TemplateFor(profile) {
  return CAT2_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`] ?? null;
}

function safeReplacement(day, targetIndex, candidates, offset) {
  for (let step = 0; step < candidates.length; step += 1) {
    const candidate = item(candidates, offset + step);
    if (day.includes(candidate)) continue;
    const replaced = day.map((key, index) => index === targetIndex ? candidate : key);
    if (cat2GymSameFamilyConflicts(replaced).length === 0) return candidate;
  }
  throw new Error(`Nu există o înlocuire editorială fără redundanță pentru ${day[targetIndex]}.`);
}

function adaptCat1Template(profile, baseWeeks) {
  const femaleAdvanced = profile.gender === "feminin" && profile.program.startsWith("avansat");
  return freezeWeeks(baseWeeks.map((week, weekIndex) => week.map((sourceDay, dayIndex) => {
    const day = [...sourceDay];
    const offset = GOAL_OFFSET[profile.goal] + weekIndex + dayIndex;
    for (let index = 0; index < day.length; index += 1) {
      if (day[index] === "flexii-gantere" && !femaleAdvanced) {
        const candidates = profile.gender === "feminin"
          ? ["flexii-la-cablu-cu-franghia"]
          : MALE_BICEPS_REPLACEMENTS;
        day[index] = safeReplacement(day, index, candidates, offset);
      }
      if (day[index] === "impins-cu-gantere-pentru-umeri-din-picioare" && profile.gender === "masculin") {
        day[index] = safeReplacement(day, index, MALE_SHOULDER_PRESS_REPLACEMENTS, offset);
      }
    }
    return day;
  })));
}

function buildMaleBeginner4(profile, baseWeeks) {
  return freezeWeeks(baseWeeks.map((week, weekIndex) => {
    const offset = GOAL_OFFSET[profile.goal] + weekIndex;
    const [baseDayOne, baseDayTwo, baseDayThree, baseDayFour] = week;
    const dayOne = [
      ...baseDayOne,
      item(MALE_BEGINNER4_BICEPS, offset),
    ];
    const dayTwo = [
      ...baseDayTwo.slice(0, -1),
      item(MALE_BEGINNER4_HAMSTRINGS, offset),
      baseDayTwo.at(-1),
    ];
    const dayThreeArm = weekIndex % 2 === 0
      ? baseDayThree.at(-1)
      : item(MALE_BEGINNER4_TRICEPS, offset);
    const dayThree = [
      ...baseDayThree.slice(0, -1),
      item(MALE_BEGINNER4_BACK_ROWS, offset),
      dayThreeArm,
    ];
    const dayFour = [
      ...baseDayFour.slice(0, -1),
      item(MALE_BEGINNER4_HAMSTRINGS, offset + 1),
      baseDayFour.at(-1),
    ];
    return [dayOne, dayTwo, dayThree, dayFour];
  }));
}

function buildTemplate(profile) {
  const baseWeeks = cat2TemplateFor(profile);
  if (!baseWeeks) return null;
  const adaptedWeeks = adaptCat1Template(profile, baseWeeks);
  if (profile.gender === "masculin" && profile.program === "incepator-4") {
    return buildMaleBeginner4(profile, adaptedWeeks);
  }
  return adaptedWeeks;
}

export const CAT1_GYM_EDITORIAL_TEMPLATES = Object.freeze(Object.fromEntries(
  ["masculin", "feminin"].flatMap((gender) =>
    ["slabire", "masa", "forma"].flatMap((goal) =>
      PROGRAMS.map((program) => {
        const profile = { gender, age: "18-29", goal, place: "sala", program };
        return [`${gender}:${goal}:${program}`, buildTemplate(profile)];
      }),
    ),
  ),
));

export function isCat1GymEditorialProfile(profile) {
  return profile?.age === "18-29"
    && profile?.place === "sala"
    && PROGRAMS.includes(profile?.program)
    && (profile?.gender === "masculin" || profile?.gender === "feminin")
    && Object.hasOwn(GOAL_OFFSET, profile?.goal);
}

export function cat1GymEditorialTemplate(profile) {
  if (!isCat1GymEditorialProfile(profile)) return null;
  return CAT1_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`] ?? null;
}

export function cat1GymDailyExerciseCount(profile) {
  if (!isCat1GymEditorialProfile(profile)) return 0;
  if (profile.program === "incepator-3") return 4;
  if (profile.program === "incepator-4") return profile.gender === "feminin" ? 4 : 5;
  return profile.gender === "feminin" ? 5 : 6;
}

export function cat1GymAllowlist(profile) {
  if (!isCat1GymEditorialProfile(profile)) return freezeList([]);
  if (profile.gender === "feminin") return CAT1_GYM_FEMALE_ALLOWLIST;
  return profile.program.startsWith("avansat")
    ? CAT1_GYM_MALE_ADVANCED_ALLOWLIST
    : CAT1_GYM_MALE_BEGINNER_ALLOWLIST;
}

export function cat1GymExerciseApproved(profile, exerciseKey) {
  return cat1GymAllowlist(profile).includes(exerciseKey);
}

export function cat1GymDayTitle(profile, weekIndex, dayIndex) {
  if (!isCat1GymEditorialProfile(profile)) return "";
  return cat2GymDayTitle({ ...profile, age: "30-44" }, weekIndex, dayIndex);
}

export function cat1GymExpectedGroups(profile, weekIndex, dayIndex) {
  if (!isCat1GymEditorialProfile(profile)) return freezeList([]);
  if (profile.program === "incepator-3") {
    const type = BEGINNER3_TYPES[weekIndex]?.[dayIndex];
    const ordinal = beginner3Ordinal(weekIndex, dayIndex, type);
    if (type === "upper") {
      return freezeList(["Piept", "Spate", "Umeri", ordinal % 2 === 0 ? "Biceps" : "Triceps"]);
    }
    return freezeList(["Picioare", "Picioare", "Picioare", ordinal % 2 === 0 ? "Abdomen" : "Cardio"]);
  }
  if (profile.program === "incepator-4" && profile.gender === "masculin") {
    return [
      freezeList(["Piept", "Spate", "Umeri", "Biceps", "Triceps"]),
      freezeList(["Picioare", "Picioare", "Picioare", "Picioare", "Abdomen"]),
      freezeList(["Piept", "Spate", "Spate", "Umeri", weekIndex % 2 === 0 ? "Biceps" : "Triceps"]),
      freezeList(["Picioare", "Picioare", "Picioare", "Picioare", "Cardio"]),
    ][dayIndex] ?? freezeList([]);
  }
  return cat2GymExpectedGroups({ ...profile, age: "30-44" }, weekIndex, dayIndex);
}

function groupCounts(groups) {
  const counts = new Map();
  for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  return [...counts].sort(([left], [right]) => left.localeCompare(right));
}

export function cat1GymDayMatchesStructure(profile, weekIndex, dayIndex, actualGroups) {
  return JSON.stringify(groupCounts(actualGroups))
    === JSON.stringify(groupCounts(cat1GymExpectedGroups(profile, weekIndex, dayIndex)));
}

export function cat1GymSameFamilyConflicts(exerciseKeys) {
  return cat2GymSameFamilyConflicts(exerciseKeys);
}

export function cat1GymShouldRotateFirst(profile, dayIndex) {
  return isCat1GymEditorialProfile(profile) && Number.isInteger(dayIndex) && dayIndex >= 0;
}
