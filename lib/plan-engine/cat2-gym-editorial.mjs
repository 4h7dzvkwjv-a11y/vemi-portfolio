import {
  CAT3_GYM_ADVANCED_ONLY,
  CAT3_GYM_ELIGIBLE_POOL,
  CAT3_GYM_FEMALE_ALLOWLIST,
  CAT3_GYM_FEMALE_BEGINNER_ALLOWLIST,
  CAT3_GYM_HOME_ONLY_FORBIDDEN,
  CAT3_GYM_MALE_ADVANCED_ALLOWLIST,
  CAT3_GYM_MALE_ADVANCED_FORBIDDEN,
  CAT3_GYM_MALE_BEGINNER_ALLOWLIST,
  CAT3_GYM_MALE_CHEST_CABLE,
  cat3GymSameFamilyConflicts,
} from "./cat3-gym-editorial.mjs";

export const CAT2_GYM_EDITORIAL_VERSION = "cat2-gym-editorial-v1";

const freezeList = (values) => Object.freeze([...values]);
const freezeWeeks = (weeks) => Object.freeze(weeks.map((week) =>
  Object.freeze(week.map((day) => Object.freeze([...day]))),
));

// CAT2 reutilizează contractele canonice CAT1–CAT3 Gym deja validate. Exporturile
// sunt aliasuri intenționate, nu copii editoriale care pot diverge în timp.
export const CAT2_GYM_ELIGIBLE_POOL = CAT3_GYM_ELIGIBLE_POOL;
export const CAT2_GYM_FEMALE_ALLOWLIST = CAT3_GYM_FEMALE_ALLOWLIST;
export const CAT2_GYM_FEMALE_BEGINNER_ALLOWLIST = CAT3_GYM_FEMALE_BEGINNER_ALLOWLIST;
export const CAT2_GYM_MALE_BEGINNER_ALLOWLIST = CAT3_GYM_MALE_BEGINNER_ALLOWLIST;
export const CAT2_GYM_MALE_ADVANCED_ALLOWLIST = CAT3_GYM_MALE_ADVANCED_ALLOWLIST;
export const CAT2_GYM_MALE_ADVANCED_FORBIDDEN = CAT3_GYM_MALE_ADVANCED_FORBIDDEN;
export const CAT2_GYM_ADVANCED_ONLY = CAT3_GYM_ADVANCED_ONLY;
export const CAT2_GYM_HOME_ONLY_FORBIDDEN = CAT3_GYM_HOME_ONLY_FORBIDDEN;
export const CAT2_GYM_MALE_CHEST_CABLE = CAT3_GYM_MALE_CHEST_CABLE;

export const CAT2_GYM_DAY_TITLES = Object.freeze({
  "incepator-4": freezeList([
    "Partea superioară A",
    "Partea inferioară A",
    "Partea superioară B",
    "Partea inferioară B",
  ]),
  "avansat-4": freezeList([
    "Piept, Umeri și Triceps",
    "Spate, Biceps și Abdomen",
    "Partea inferioară",
    "Partea superioară mixtă",
  ]),
  "avansat-5": freezeList([
    "Piept, Umeri și Triceps",
    "Spate și Biceps",
    "Partea inferioară",
    "Partea superioară mixtă",
    "Partea inferioară și Cardio",
  ]),
});

const GOAL_OFFSET = Object.freeze({ slabire: 0, masa: 2, forma: 4 });
const PROGRAM_OFFSET = Object.freeze({ "incepator-3": 0, "incepator-4": 1, "avansat-4": 2, "avansat-5": 3 });
const PROGRAMS = freezeList(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const advancedOnly = new Set(CAT2_GYM_ADVANCED_ONLY);

const FEMALE_POOLS = Object.freeze({
  chestBeginner: freezeList(["impins-la-aparat", "fluturari-la-aparat", "pec-deck", "fluturari-gantere"]),
  chestPushAdvanced: freezeList(["impins-la-aparat", "impins-cu-gantere-apropiate"]),
  chestFly: freezeList(["fluturari-la-aparat", "pec-deck", "fluturari-gantere"]),
  backRow: freezeList(["ramat-aparat", "ramat-la-cablu-cu-priza-ingusta", "ramat-la-cablu-din-sezut"]),
  backVertical: freezeList(["tractiuni-la-helcometru-cu-priza-larga", "tractiuni-la-helcometru-cu-priza-ingusta"]),
  backOtherBeginner: freezeList(["fluturari-inverse", "hiperextensii-lombare-la-banca"]),
  backOtherAdvanced: freezeList(["fluturari-inverse", "hiperextensii-lombare-la-banca", "indreptari-romanesti"]),
  shoulderPress: freezeList(["impins-cu-gantere-pentru-umeri-din-picioare"]),
  shoulderIsolation: freezeList(["ridicari-laterale-cu-gantere-din-picioare", "face-pull"]),
  biceps: freezeList(["flexii-gantere", "flexii-la-cablu-cu-franghia"]),
  triceps: freezeList(["extensii-pentru-triceps-la-cablu-cu-franghia", "extensii-pentru-triceps-la-cablu-cu-bara"]),
  coreBeginner: freezeList(["dead-bug", "abdomene", "crunch-cu-minge", "russian-twist", "atingeri-alternative-ale-piciorului-din-picioare", "crunch-lateral-din-picioare"]),
  coreAdvanced: freezeList(["dead-bug", "v-up", "crunch-cu-gantera", "russian-twist-cu-disc", "v-up-cu-minge", "abdomene"]),
  cardioBeginner: freezeList(["mers-rapid-pe-banda", "bicicleta-eliptica", "bicicleta-stationara", "alergare-pe-loc", "ridicari-alternative-ale-genunchilor"]),
  cardioAdvanced: freezeList(["alergare-pe-loc", "bicicleta-eliptica", "bicicleta-stationara", "mers-rapid-pe-banda", "burpees", "ridicari-alternative-ale-genunchilor"]),
  legPrimaryBeginner: freezeList(["genuflexiuni-goblet", "genuflexiuni-la-aparat-v-squat", "genuflexiuni-cu-gantere-la-umeri", "genuflexiuni-sumo", "genuflexiuni", "genuflexiuni-la-cablu"]),
  legPrimaryAdvanced: freezeList(["genuflexiuni-la-hack-squat", "genuflexiuni-goblet", "genuflexiuni-la-aparat-v-squat", "genuflexiuni-cu-gantere-la-umeri", "genuflexiuni-sumo", "genuflexiuni-la-cablu"]),
  legPress: freezeList(["presa-pentru-picioare-la-45", "presa-pentru-picioare-la-aparat-din-sezut"]),
  legLunge: freezeList(["fandari-inverse-cu-gantere", "fandari-inverse-alternative", "fandari-bulgaresti"]),
  legHamstring: freezeList(["flexii-pentru-picioare-la-aparat", "extensii-pentru-femurali-din-culcat"]),
  legCalf: freezeList(["ridicari-pe-varfuri-la-aparat", "ridicari-pe-varfuri-cu-gantere", "ridicari-unilaterale-pe-varfuri-cu-gantera"]),
});

const MALE_POOLS = Object.freeze({
  chestBeginner: freezeList(["impins-la-aparat", "impins-gantere", "impins-banca-haltera", "impins-inclinat-gantere", "impins-cu-bara-smith", "flotari"]),
  chestPushAdvanced: freezeList(["impins-banca-haltera", "impins-gantere", "impins-la-aparat", "impins-inclinat-gantere", "impins-cu-bara-smith", "impins-cu-bara-pe-banca-inclinata", "impins-cu-bara-pe-banca-declinata", "dips-paralele", "impins-cu-bara-smith-cu-priza-ingusta"]),
  chestFly: freezeList(["pec-deck", "fluturari-la-aparat", "fluturari-gantere"]),
  backRow: freezeList(["ramat-aparat", "ramat-haltera", "ramat-la-cablu-din-sezut", "ramat-unilateral-la-cablu-din-sezut", "ramat-la-cablu-cu-priza-ingusta"]),
  backVertical: freezeList(["tractiuni-la-helcometru-cu-priza-larga", "tractiuni-bara", "tractiuni-la-helcometru-cu-priza-ingusta"]),
  backOtherBeginner: freezeList(["fluturari-inverse", "hiperextensii-lombare-la-banca", "pulldown-cu-bratele-drepte-la-cablu"]),
  backOtherAdvanced: freezeList(["fluturari-inverse", "hiperextensii-lombare-la-banca", "indreptari-romanesti", "ridicari-din-umeri-la-aparat"]),
  backPullover: freezeList(["pulldown-cu-bratele-drepte-la-cablu", "pullover-cablu"]),
  shoulderPress: freezeList(["impins-la-aparat-pentru-umeri", "impins-cu-gantere-pentru-umeri-din-sezut", "impins-cu-gantere-pentru-umeri-din-picioare"]),
  shoulderIsolation: freezeList(["ridicari-laterale-cu-gantere-din-sezut", "face-pull", "ridicari-laterale-la-cablu", "ridicari-laterale-cu-gantere-cu-pieptul-sprijinit", "ridicari-laterale-unilaterale-la-cablu"]),
  bicepsDumbbell: freezeList(["flexii-gantere"]),
  bicepsOther: freezeList(["flexii-la-cablu-cu-bara-ez", "flexii-cu-bara-dreapta", "flexii-la-cablu-cu-franghia", "flexii-la-banca-scott-cu-bara-ez"]),
  triceps: freezeList(["extensii-pentru-triceps-la-cablu-cu-franghia", "extensii-pentru-triceps-la-cablu-cu-bara", "triceps-deasupra-capului", "extensii-pentru-triceps-la-cablu-cu-priza-inversa", "extensii-pentru-triceps-cu-bara-ez-din-culcat"]),
  coreBeginner: freezeList(["dead-bug", "plank", "abdomene", "ridicari-de-genunchi-la-aparat", "crunch-cu-minge", "ridicari-de-trunchi-cu-disc", "russian-twist"]),
  coreAdvanced: freezeList(["ab-wheel-din-genunchi", "ridicari-de-picioare-din-atarnat", "plank-cu-greutate", "v-up", "ridicari-de-genunchi-la-aparat", "ridicari-de-trunchi-cu-disc", "dead-bug", "crunch-cu-gantera"]),
  cardioBeginner: freezeList(["mers-rapid-pe-banda", "bicicleta-eliptica", "bicicleta-stationara", "alergare-pe-loc", "ridicari-alternative-ale-genunchilor"]),
  cardioAdvanced: freezeList(["alergare-pe-loc", "bicicleta-eliptica", "burpees", "bicicleta-stationara", "mers-rapid-pe-banda", "ridicari-alternative-ale-genunchilor"]),
  legPrimaryBeginner: freezeList(["genuflexiuni-la-bara-smith", "genuflexiuni-goblet", "genuflexiuni-la-aparat-v-squat", "genuflexiuni-cu-gantere-la-umeri", "genuflexiuni", "genuflexiuni-sumo"]),
  legPrimaryAdvanced: freezeList(["genuflexiuni-haltera", "genuflexiuni-la-hack-squat", "genuflexiuni-la-bara-smith", "genuflexiuni-goblet", "genuflexiuni-la-aparat-v-squat", "genuflexiuni-cu-gantere-la-umeri"]),
  legPress: freezeList(["presa-pentru-picioare-la-45", "presa-pentru-picioare-la-aparat-din-sezut"]),
  legLunge: freezeList(["fandari-inverse-cu-gantere", "fandari-bulgaresti", "fandari-inverse-alternative"]),
  legHamstring: freezeList(["flexii-pentru-picioare-la-aparat", "extensii-pentru-femurali-din-culcat"]),
  legCalf: freezeList(["ridicari-pe-varfuri-la-aparat", "ridicari-pe-varfuri-cu-gantere", "ridicari-unilaterale-pe-varfuri-cu-gantera"]),
});

function item(values, index) {
  return values[((index % values.length) + values.length) % values.length];
}

function levelItem(ctx, values, index) {
  const pool = ctx.advanced ? values : values.filter((key) => !advancedOnly.has(key));
  return item(pool, index);
}

function context(profile, weekIndex) {
  const female = profile.gender === "feminin";
  const advanced = profile.program.startsWith("avansat");
  return {
    advanced,
    female,
    pools: female ? FEMALE_POOLS : MALE_POOLS,
    offset: GOAL_OFFSET[profile.goal] + PROGRAM_OFFSET[profile.program] + weekIndex,
  };
}

function core(ctx, extra = 0) {
  return item(ctx.advanced ? ctx.pools.coreAdvanced : ctx.pools.coreBeginner, ctx.offset + extra);
}

function cardio(ctx, extra = 0) {
  return item(ctx.advanced ? ctx.pools.cardioAdvanced : ctx.pools.cardioBeginner, ctx.offset + extra);
}

function chestSingle(ctx, extra = 0) {
  return item(ctx.advanced ? ctx.pools.chestPushAdvanced : ctx.pools.chestBeginner, ctx.offset + extra);
}

function backPair(ctx, extra = 0) {
  return freezeList([
    levelItem(ctx, ctx.pools.backRow, ctx.offset + extra),
    levelItem(ctx, ctx.pools.backVertical, ctx.offset + extra + 1),
  ]);
}

function backTriple(ctx, extra = 0) {
  return freezeList([
    ...backPair(ctx, extra),
    item(ctx.advanced ? ctx.pools.backOtherAdvanced : ctx.pools.backOtherBeginner, ctx.offset + extra + 2),
  ]);
}

function shoulderPair(ctx, extra = 0) {
  return freezeList([
    item(ctx.pools.shoulderPress, ctx.offset + extra),
    item(ctx.pools.shoulderIsolation, ctx.offset + extra + 1),
  ]);
}

function bicepsSingle(ctx, extra = 0) {
  if (ctx.female) return item(ctx.pools.biceps, ctx.offset + extra);
  return item(ctx.pools.bicepsDumbbell, ctx.offset + extra);
}

function bicepsPair(ctx, extra = 0) {
  if (ctx.female) return freezeList([
    item(ctx.pools.biceps, ctx.offset + extra),
    item(ctx.pools.biceps, ctx.offset + extra + 1),
  ]);
  return freezeList([
    item(ctx.pools.bicepsDumbbell, ctx.offset + extra),
    item(ctx.pools.bicepsOther, ctx.offset + extra + 1),
  ]);
}

function triceps(ctx, extra = 0) {
  return levelItem(ctx, ctx.pools.triceps, ctx.offset + extra);
}

function legs(ctx, variant, count) {
  const shift = ctx.offset + variant;
  const primaryPool = ctx.advanced ? ctx.pools.legPrimaryAdvanced : ctx.pools.legPrimaryBeginner;
  const selected = [
    item(primaryPool, shift),
    item(ctx.pools.legPress, shift),
    levelItem(ctx, ctx.pools.legLunge, shift),
  ];
  if (count >= 4) selected.push(item(ctx.pools.legHamstring, shift));
  if (count >= 5) selected.push(item(ctx.pools.legCalf, shift));
  return freezeList(selected);
}

const BEGINNER3_TYPES = Object.freeze([
  freezeList(["upper", "lower", "upper"]),
  freezeList(["lower", "upper", "lower"]),
  freezeList(["upper", "lower", "upper"]),
  freezeList(["lower", "upper", "lower"]),
]);

function beginner3Ordinal(weekIndex, dayIndex, type) {
  let ordinal = 0;
  for (let week = 0; week <= weekIndex; week += 1) {
    const end = week === weekIndex ? dayIndex : BEGINNER3_TYPES[week].length;
    for (let day = 0; day < end; day += 1) if (BEGINNER3_TYPES[week][day] === type) ordinal += 1;
  }
  return ordinal;
}

function makeBeginner3(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  return BEGINNER3_TYPES[weekIndex].map((type, dayIndex) => {
    const ordinal = beginner3Ordinal(weekIndex, dayIndex, type);
    if (type === "lower") {
      const support = ordinal % 2 === 0 ? core(ctx, ordinal) : cardio(ctx, ordinal);
      return [...legs(ctx, ordinal, 3), support];
    }
    const chest = chestSingle(ctx, ordinal);
    const back = levelItem(ctx, ctx.pools.backRow, ctx.offset + ordinal);
    const shoulder = item(ctx.pools.shoulderPress, ctx.offset + ordinal);
    const arm = ordinal % 2 === 0 ? bicepsSingle(ctx, ordinal) : triceps(ctx, ordinal);
    return ordinal % 2 === 0
      ? [chest, back, shoulder, arm]
      : [back, chest, shoulder, arm];
  });
}

function makeBeginner4(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  const dayOne = [
    chestSingle(ctx),
    levelItem(ctx, ctx.pools.backRow, ctx.offset),
    item(ctx.pools.shoulderPress, ctx.offset),
    triceps(ctx),
  ];
  if (weekIndex % 2 === 1) [dayOne[0], dayOne[1]] = [dayOne[1], dayOne[0]];
  return [
    dayOne,
    [...legs(ctx, 0, 3), core(ctx)],
    [levelItem(ctx, ctx.pools.backVertical, ctx.offset + 1), chestSingle(ctx, 2), item(ctx.pools.shoulderPress, ctx.offset + 1), bicepsSingle(ctx, 1)],
    [...legs(ctx, 1, 3), cardio(ctx, 1)],
  ];
}

function makeAdvanced4(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  const dayOne = [chestSingle(ctx), item(ctx.pools.chestFly, ctx.offset), ...shoulderPair(ctx), triceps(ctx), ...(ctx.female ? [] : [core(ctx)])];
  const dayTwo = ctx.female
    ? [...backTriple(ctx), bicepsSingle(ctx), core(ctx)]
    : [...backTriple(ctx), ...bicepsPair(ctx), core(ctx)];
  const dayThree = ctx.female
    ? [...legs(ctx, 0, 4), core(ctx, 2)]
    : [...legs(ctx, 0, 5), core(ctx, 2)];
  const dayFour = ctx.female
    ? [chestSingle(ctx, 1), ...backPair(ctx, 2).slice(0, 1), item(ctx.pools.shoulderIsolation, ctx.offset + 2), bicepsSingle(ctx, 2), triceps(ctx, 2)]
    : [chestSingle(ctx, 1), ...backPair(ctx, 2), item(ctx.pools.shoulderIsolation, ctx.offset + 2), bicepsSingle(ctx, 2), triceps(ctx, 2)];
  return [dayOne, dayTwo, dayThree, dayFour];
}

function makeAdvanced5(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  const dayOne = ctx.female
    ? [chestSingle(ctx), item(ctx.pools.chestFly, ctx.offset), ...shoulderPair(ctx), triceps(ctx)]
    : [chestSingle(ctx), item(ctx.pools.chestFly, ctx.offset), ...shoulderPair(ctx), triceps(ctx), core(ctx)];
  const baseBack = backTriple(ctx);
  const dayTwo = ctx.female
    ? [...baseBack, ...bicepsPair(ctx)]
    : [...baseBack, item(ctx.pools.backPullover, ctx.offset + 3), ...bicepsPair(ctx)];
  const dayThree = ctx.female
    ? [...legs(ctx, 0, 4), core(ctx, 2)]
    : [...legs(ctx, 0, 5), core(ctx, 2)];
  const dayFour = ctx.female
    ? [chestSingle(ctx, 1), ...backPair(ctx, 2), item(ctx.pools.shoulderIsolation, ctx.offset + 2), triceps(ctx, 2)]
    : [chestSingle(ctx, 1), ...backPair(ctx, 2), item(ctx.pools.shoulderIsolation, ctx.offset + 2), bicepsSingle(ctx, 2), triceps(ctx, 2)];
  const dayFive = ctx.female
    ? [...legs(ctx, 1, 4), cardio(ctx, 2)]
    : [...legs(ctx, 1, 5), cardio(ctx, 2)];
  return [dayOne, dayTwo, dayThree, dayFour, dayFive];
}

function buildTemplate(profile) {
  const builders = {
    "incepator-3": makeBeginner3,
    "incepator-4": makeBeginner4,
    "avansat-4": makeAdvanced4,
    "avansat-5": makeAdvanced5,
  };
  return freezeWeeks(Array.from({ length: 4 }, (_, weekIndex) => builders[profile.program](profile, weekIndex)));
}

export const CAT2_GYM_EDITORIAL_TEMPLATES = Object.freeze(Object.fromEntries(
  ["masculin", "feminin"].flatMap((gender) =>
    ["slabire", "masa", "forma"].flatMap((goal) =>
      PROGRAMS.map((program) => {
        const profile = { gender, age: "30-44", goal, place: "sala", program };
        return [`${gender}:${goal}:${program}`, buildTemplate(profile)];
      }),
    ),
  ),
));

export function isCat2GymEditorialProfile(profile) {
  return profile?.age === "30-44"
    && profile?.place === "sala"
    && PROGRAMS.includes(profile?.program)
    && (profile?.gender === "masculin" || profile?.gender === "feminin")
    && Object.hasOwn(GOAL_OFFSET, profile?.goal);
}

export function cat2GymEditorialTemplate(profile) {
  if (!isCat2GymEditorialProfile(profile)) return null;
  return CAT2_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`] ?? null;
}

export function cat2GymDailyExerciseCount(profile) {
  if (!isCat2GymEditorialProfile(profile)) return 0;
  if (profile.program.startsWith("incepator")) return 4;
  return profile.gender === "feminin" ? 5 : 6;
}

export function cat2GymAllowlist(profile) {
  if (!isCat2GymEditorialProfile(profile)) return freezeList([]);
  if (profile.gender === "feminin") return CAT2_GYM_FEMALE_ALLOWLIST;
  return profile.program.startsWith("avansat")
    ? CAT2_GYM_MALE_ADVANCED_ALLOWLIST
    : CAT2_GYM_MALE_BEGINNER_ALLOWLIST;
}

export function cat2GymExerciseApproved(profile, exerciseKey) {
  return cat2GymAllowlist(profile).includes(exerciseKey);
}

export function cat2GymDayTitle(profile, weekIndex, dayIndex) {
  if (!isCat2GymEditorialProfile(profile)) return "";
  if (profile.program === "incepator-3") {
    return BEGINNER3_TYPES[weekIndex]?.[dayIndex] === "upper"
      ? "Partea superioară"
      : "Partea inferioară";
  }
  return CAT2_GYM_DAY_TITLES[profile.program]?.[dayIndex] ?? "";
}

export function cat2GymExpectedGroups(profile, weekIndex, dayIndex) {
  if (!isCat2GymEditorialProfile(profile)) return freezeList([]);
  if (profile.program === "incepator-3") {
    const type = BEGINNER3_TYPES[weekIndex]?.[dayIndex];
    const ordinal = beginner3Ordinal(weekIndex, dayIndex, type);
    if (type === "upper") return freezeList(["Piept", "Spate", "Umeri", ordinal % 2 === 0 ? "Biceps" : "Triceps"]);
    return freezeList(["Picioare", "Picioare", "Picioare", ordinal % 2 === 0 ? "Abdomen" : "Cardio"]);
  }
  if (profile.program === "incepator-4") return [
    freezeList(["Piept", "Spate", "Umeri", "Triceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Abdomen"]),
    freezeList(["Piept", "Spate", "Umeri", "Biceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Cardio"]),
  ][dayIndex] ?? freezeList([]);
  if (profile.program === "avansat-4") {
    const female = profile.gender === "feminin";
    return [
      freezeList(["Piept", "Piept", "Umeri", "Umeri", "Triceps", ...(female ? [] : ["Abdomen"])]),
      freezeList(["Spate", "Spate", "Spate", "Biceps", ...(female ? [] : ["Biceps"]), "Abdomen"]),
      freezeList(["Picioare", "Picioare", "Picioare", "Picioare", ...(female ? [] : ["Picioare"]), "Abdomen"]),
      freezeList(["Piept", "Spate", ...(female ? [] : ["Spate"]), "Umeri", "Biceps", "Triceps"]),
    ][dayIndex] ?? freezeList([]);
  }
  const female = profile.gender === "feminin";
  return [
    freezeList(["Piept", "Piept", "Umeri", "Umeri", "Triceps", ...(female ? [] : ["Abdomen"])]),
    freezeList(["Spate", "Spate", "Spate", ...(female ? [] : ["Spate"]), "Biceps", "Biceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Picioare", ...(female ? [] : ["Picioare"]), "Abdomen"]),
    freezeList(["Piept", "Spate", "Spate", "Umeri", ...(female ? [] : ["Biceps"]), "Triceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Picioare", ...(female ? [] : ["Picioare"]), "Cardio"]),
  ][dayIndex] ?? freezeList([]);
}

function groupCounts(groups) {
  const counts = new Map();
  for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  return [...counts].sort(([left], [right]) => left.localeCompare(right));
}

export function cat2GymDayMatchesStructure(profile, weekIndex, dayIndex, actualGroups) {
  return JSON.stringify(groupCounts(actualGroups))
    === JSON.stringify(groupCounts(cat2GymExpectedGroups(profile, weekIndex, dayIndex)));
}

export function cat2GymSameFamilyConflicts(exerciseKeys) {
  return cat3GymSameFamilyConflicts(exerciseKeys);
}

export function cat2GymShouldRotateFirst(profile, dayIndex) {
  return isCat2GymEditorialProfile(profile) && Number.isInteger(dayIndex) && dayIndex >= 0;
}
