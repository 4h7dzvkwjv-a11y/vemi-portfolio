export const CAT3_GYM_EDITORIAL_VERSION = "cat3-gym-editorial-v1";

const freezeList = (values) => Object.freeze([...values]);
const freezeWeeks = (weeks) => Object.freeze(weeks.map((week) =>
  Object.freeze(week.map((day) => Object.freeze([...day]))),
));

export const CAT3_GYM_ELIGIBLE_POOL = freezeList([
  "ab-wheel-din-genunchi",
  "abdomene",
  "alergare-pe-loc",
  "atingeri-alternative-ale-piciorului-din-picioare",
  "bicicleta-eliptica",
  "bicicleta-stationara",
  "burpees",
  "cobra-din-culcat",
  "crunch-cu-gantera",
  "crunch-cu-minge",
  "crunch-lateral-din-picioare",
  "dead-bug",
  "dips-paralele",
  "extensii-cvadriceps",
  "extensii-pentru-femurali-din-culcat",
  "extensii-pentru-triceps-cu-bara-ez-din-culcat",
  "extensii-pentru-triceps-la-cablu-cu-bara",
  "extensii-pentru-triceps-la-cablu-cu-franghia",
  "extensii-pentru-triceps-la-cablu-cu-priza-inversa",
  "extensii-unilaterale-pentru-triceps-la-cablu",
  "extensii-unilaterale-pentru-triceps-la-cablu-cu-sprijin",
  "face-pull",
  "fandari-bulgaresti",
  "fandari-inverse-alternative",
  "fandari-inverse-cu-gantere",
  "flexii-cu-bara-dreapta",
  "flexii-cu-gantere-pe-banca-inclinata",
  "flexii-gantere",
  "flexii-la-banca-scott-cu-bara-ez",
  "flexii-la-cablu-cu-bara-ez",
  "flexii-la-cablu-cu-bratele-in-spatele-corpului",
  "flexii-la-cablu-cu-franghia",
  "flexii-pentru-picioare-la-aparat",
  "flotari",
  "flotari-cu-atingerea-umarului",
  "flotari-diamant",
  "flotari-hindu",
  "fluturari-ascendente-la-cablu",
  "fluturari-descendente-la-cablu",
  "fluturari-gantere",
  "fluturari-inverse",
  "fluturari-la-aparat",
  "fluturari-la-cablu-pe-banca-declinata",
  "genuflexiuni",
  "genuflexiuni-cu-gantere-la-umeri",
  "genuflexiuni-goblet",
  "genuflexiuni-haltera",
  "genuflexiuni-la-aparat-v-squat",
  "genuflexiuni-la-bara-smith",
  "genuflexiuni-la-cablu",
  "genuflexiuni-la-hack-squat",
  "genuflexiuni-sumo",
  "hip-thrust-cu-gantera",
  "hiperextensii-lombare-la-banca",
  "impins-banca-haltera",
  "impins-cu-bara-pe-banca-declinata",
  "impins-cu-bara-pe-banca-inclinata",
  "impins-cu-bara-smith",
  "impins-cu-bara-smith-cu-priza-ingusta",
  "impins-cu-gantere-apropiate",
  "impins-cu-gantere-pentru-umeri-din-picioare",
  "impins-cu-gantere-pentru-umeri-din-sezut",
  "impins-gantere",
  "impins-inclinat-gantere",
  "impins-la-aparat",
  "impins-la-aparat-pentru-umeri",
  "indreptari-pe-un-picior-fara-greutate",
  "indreptari-romanesti",
  "mers-rapid-pe-banda",
  "pec-deck",
  "plank",
  "plank-cu-greutate",
  "presa-pentru-picioare-la-45",
  "presa-pentru-picioare-la-aparat-din-sezut",
  "pulldown-cu-bratele-drepte-la-cablu",
  "pullover-cablu",
  "ramat-aparat",
  "ramat-haltera",
  "ramat-la-cablu-cu-priza-ingusta",
  "ramat-la-cablu-din-sezut",
  "ramat-unilateral-la-cablu-din-sezut",
  "ridicari-alternative-ale-genunchilor",
  "ridicari-de-genunchi-la-aparat",
  "ridicari-de-picioare-din-atarnat",
  "ridicari-de-trunchi-cu-disc",
  "ridicari-din-umeri-cu-bara",
  "ridicari-din-umeri-la-aparat",
  "ridicari-laterale-cu-gantere-cu-pieptul-sprijinit",
  "ridicari-laterale-cu-gantere-din-picioare",
  "ridicari-laterale-cu-gantere-din-sezut",
  "ridicari-laterale-cu-gantere-din-sezut-cu-spatele-sprijinit",
  "ridicari-laterale-la-cablu",
  "ridicari-laterale-la-cablu-din-aplecat",
  "ridicari-laterale-unilaterale-la-cablu",
  "ridicari-pe-varfuri-cu-gantere",
  "ridicari-pe-varfuri-la-aparat",
  "ridicari-unilaterale-pe-varfuri-cu-gantera",
  "russian-twist",
  "russian-twist-cu-disc",
  "tractiuni-bara",
  "tractiuni-la-helcometru-cu-priza-ingusta",
  "tractiuni-la-helcometru-cu-priza-larga",
  "triceps-deasupra-capului",
  "v-up",
  "v-up-cu-minge",
]);

export const CAT3_GYM_HOME_ONLY_FORBIDDEN = freezeList([
  "aplecari-laterale-din-picioare",
  "dips-intre-scaune",
  "flotari-declinate",
  "flotari-largi",
  "mountain-climbers",
  "plank-invers",
  "ridicari-de-genunchi-cu-rotatie",
  "ridicari-din-umeri-cu-gantere",
  "superman-alternativ",
]);

export const CAT3_GYM_ADVANCED_ONLY = freezeList([
  "ab-wheel-din-genunchi",
  "burpees",
  "dips-paralele",
  "extensii-pentru-triceps-cu-bara-ez-din-culcat",
  "fandari-bulgaresti",
  "flotari-cu-atingerea-umarului",
  "flotari-diamant",
  "flotari-hindu",
  "genuflexiuni-haltera",
  "genuflexiuni-la-hack-squat",
  "impins-cu-bara-pe-banca-declinata",
  "impins-cu-bara-pe-banca-inclinata",
  "impins-cu-bara-smith-cu-priza-ingusta",
  "impins-cu-gantere-apropiate",
  "indreptari-romanesti",
  "plank-cu-greutate",
  "ramat-haltera",
  "ridicari-de-picioare-din-atarnat",
  "tractiuni-bara",
  "v-up",
  "v-up-cu-minge",
]);

export const CAT3_GYM_FEMALE_ALLOWLIST = freezeList([
  "atingeri-alternative-ale-piciorului-din-picioare",
  "abdomene",
  "crunch-cu-gantera",
  "crunch-cu-minge",
  "crunch-lateral-din-picioare",
  "dead-bug",
  "russian-twist-cu-disc",
  "russian-twist",
  "v-up",
  "v-up-cu-minge",
  "flexii-gantere",
  "flexii-la-cablu-cu-franghia",
  "alergare-pe-loc",
  "bicicleta-eliptica",
  "bicicleta-stationara",
  "burpees",
  "mers-rapid-pe-banda",
  "ridicari-alternative-ale-genunchilor",
  "extensii-pentru-femurali-din-culcat",
  "extensii-cvadriceps",
  "fandari-bulgaresti",
  "fandari-inverse-alternative",
  "fandari-inverse-cu-gantere",
  "flexii-pentru-picioare-la-aparat",
  "genuflexiuni-goblet",
  "genuflexiuni-cu-gantere-la-umeri",
  "genuflexiuni",
  "genuflexiuni-la-aparat-v-squat",
  "genuflexiuni-la-cablu",
  "genuflexiuni-la-hack-squat",
  "genuflexiuni-sumo",
  "hip-thrust-cu-gantera",
  "indreptari-pe-un-picior-fara-greutate",
  "presa-pentru-picioare-la-45",
  "presa-pentru-picioare-la-aparat-din-sezut",
  "ridicari-pe-varfuri-cu-gantere",
  "ridicari-pe-varfuri-la-aparat",
  "ridicari-unilaterale-pe-varfuri-cu-gantera",
  "fluturari-gantere",
  "fluturari-la-aparat",
  "impins-cu-gantere-apropiate",
  "impins-la-aparat",
  "pec-deck",
  "hiperextensii-lombare-la-banca",
  "indreptari-romanesti",
  "ramat-aparat",
  "ramat-la-cablu-cu-priza-ingusta",
  "ramat-la-cablu-din-sezut",
  "fluturari-inverse",
  "tractiuni-la-helcometru-cu-priza-ingusta",
  "tractiuni-la-helcometru-cu-priza-larga",
  "extensii-pentru-triceps-la-cablu-cu-bara",
  "extensii-pentru-triceps-la-cablu-cu-franghia",
  "face-pull",
  "impins-cu-gantere-pentru-umeri-din-picioare",
  "ridicari-laterale-cu-gantere-din-picioare",
]);

export const CAT3_GYM_FEMALE_CABLE_ALLOWLIST = freezeList([
  "flexii-la-cablu-cu-franghia",
  "genuflexiuni-la-cablu",
  "ramat-la-cablu-cu-priza-ingusta",
  "ramat-la-cablu-din-sezut",
  "extensii-pentru-triceps-la-cablu-cu-bara",
  "extensii-pentru-triceps-la-cablu-cu-franghia",
  "face-pull",
]);

export const CAT3_GYM_MALE_ADVANCED_FORBIDDEN = freezeList([
  "flotari",
  "flotari-cu-atingerea-umarului",
  "flotari-hindu",
  "flotari-diamant",
]);

const advancedOnly = new Set(CAT3_GYM_ADVANCED_ONLY);
const maleAdvancedForbidden = new Set(CAT3_GYM_MALE_ADVANCED_FORBIDDEN);
export const CAT3_GYM_MALE_BEGINNER_ALLOWLIST = freezeList(
  CAT3_GYM_ELIGIBLE_POOL.filter((key) => !advancedOnly.has(key)),
);
export const CAT3_GYM_MALE_ADVANCED_ALLOWLIST = freezeList(
  CAT3_GYM_ELIGIBLE_POOL.filter((key) => !maleAdvancedForbidden.has(key)),
);
export const CAT3_GYM_FEMALE_BEGINNER_ALLOWLIST = freezeList(
  CAT3_GYM_FEMALE_ALLOWLIST.filter((key) => !advancedOnly.has(key)),
);

export const CAT3_GYM_MALE_CHEST_CABLE = freezeList([
  "fluturari-ascendente-la-cablu",
  "fluturari-descendente-la-cablu",
  "fluturari-la-cablu-pe-banca-declinata",
]);

export const CAT3_GYM_DAY_TITLES = Object.freeze({
  "incepator-3": freezeList(["Full Body A", "Full Body B", "Full Body C"]),
  "incepator-4": freezeList(["Partea superioară A", "Partea inferioară A", "Partea superioară B", "Partea inferioară B"]),
  "avansat-4": freezeList(["Piept, Umeri și Triceps", "Spate și Abdomen", "Umeri și Biceps", "Picioare și Abdomen"]),
  "avansat-5": freezeList(["Piept, Umeri și Triceps", "Spate și Biceps", "Picioare și Abdomen", "Partea superioară mixtă", "Picioare și Cardio"]),
});

export const CAT3_GYM_DAY_FOCUS = Object.freeze({
  "incepator-3": freezeList([
    "Picioare, piept, spate și abdomen",
    "Picioare, umeri, biceps și cardio",
    "Picioare, spate, triceps și abdomen",
  ]),
  "incepator-4": freezeList([
    "Piept, spate, umeri și triceps",
    "Picioare și abdomen",
    "Spate, piept, umeri și biceps",
    "Picioare și cardio",
  ]),
  "avansat-4": freezeList([
    "Piept, umeri și triceps",
    "Spate și abdomen",
    "Umeri și biceps",
    "Picioare și abdomen",
  ]),
  "avansat-5": freezeList([
    "Piept, umeri și triceps",
    "Spate și biceps",
    "Picioare și abdomen",
    "Piept, spate, umeri și triceps",
    "Picioare și cardio",
  ]),
});

export const CAT3_GYM_DAY_GROUPS = Object.freeze({
  "incepator-3": Object.freeze([
    freezeList(["Picioare", "Piept", "Spate", "Abdomen"]),
    freezeList(["Picioare", "Umeri", "Biceps", "Cardio"]),
    freezeList(["Picioare", "Spate", "Triceps", "Abdomen"]),
  ]),
  "incepator-4": Object.freeze([
    freezeList(["Piept", "Spate", "Umeri", "Triceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Abdomen"]),
    freezeList(["Spate", "Piept", "Umeri", "Biceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Cardio"]),
  ]),
  "avansat-4": Object.freeze([
    freezeList(["Piept", "Piept", "Umeri", "Umeri", "Triceps"]),
    freezeList(["Spate", "Spate", "Spate", "Spate", "Abdomen"]),
    freezeList(["Umeri", "Umeri", "Biceps", "Biceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Picioare", "Abdomen"]),
  ]),
  "avansat-5": Object.freeze([
    freezeList(["Piept", "Piept", "Umeri", "Umeri", "Triceps"]),
    freezeList(["Spate", "Spate", "Spate", "Biceps", "Biceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Picioare", "Abdomen"]),
    freezeList(["Piept", "Spate", "Spate", "Umeri", "Triceps"]),
    freezeList(["Picioare", "Picioare", "Picioare", "Picioare", "Cardio"]),
  ]),
});

export const CAT3_GYM_DAILY_EXERCISE_COUNTS = Object.freeze({
  "incepator-3": freezeList([4, 4, 4]),
  "incepator-4": freezeList([4, 4, 4, 4]),
  "avansat-4": freezeList([5, 5, 4, 5]),
  "avansat-5": freezeList([5, 5, 5, 5, 5]),
});

export const CAT3_GYM_REDUNDANT_FAMILIES = Object.freeze({
  chestPush: freezeList([
    "flotari", "flotari-cu-atingerea-umarului", "flotari-hindu", "dips-paralele",
    "impins-banca-haltera", "impins-cu-bara-pe-banca-declinata", "impins-cu-bara-pe-banca-inclinata",
    "impins-cu-bara-smith", "impins-cu-bara-smith-cu-priza-ingusta", "impins-cu-gantere-apropiate",
    "impins-gantere", "impins-inclinat-gantere", "impins-la-aparat",
  ]),
  chestFly: freezeList([
    "fluturari-ascendente-la-cablu", "fluturari-descendente-la-cablu", "fluturari-gantere",
    "fluturari-la-aparat", "fluturari-la-cablu-pe-banca-declinata", "pec-deck",
  ]),
  row: freezeList([
    "ramat-aparat", "ramat-haltera", "ramat-la-cablu-cu-priza-ingusta",
    "ramat-la-cablu-din-sezut", "ramat-unilateral-la-cablu-din-sezut",
  ]),
  verticalPull: freezeList([
    "tractiuni-bara", "tractiuni-la-helcometru-cu-priza-ingusta", "tractiuni-la-helcometru-cu-priza-larga",
  ]),
  pullover: freezeList(["pulldown-cu-bratele-drepte-la-cablu", "pullover-cablu"]),
  shoulderPress: freezeList([
    "impins-cu-gantere-pentru-umeri-din-picioare", "impins-cu-gantere-pentru-umeri-din-sezut",
    "impins-la-aparat-pentru-umeri",
  ]),
  shoulderLateral: freezeList([
    "ridicari-laterale-cu-gantere-cu-pieptul-sprijinit", "ridicari-laterale-cu-gantere-din-picioare",
    "ridicari-laterale-cu-gantere-din-sezut", "ridicari-laterale-cu-gantere-din-sezut-cu-spatele-sprijinit",
    "ridicari-laterale-la-cablu", "ridicari-laterale-la-cablu-din-aplecat",
    "ridicari-laterale-unilaterale-la-cablu",
  ]),
  bicepsBar: freezeList(["flexii-cu-bara-dreapta", "flexii-la-banca-scott-cu-bara-ez"]),
  bicepsDumbbell: freezeList(["flexii-gantere", "flexii-cu-gantere-pe-banca-inclinata"]),
  bicepsCable: freezeList([
    "flexii-la-cablu-cu-bara-ez", "flexii-la-cablu-cu-bratele-in-spatele-corpului", "flexii-la-cablu-cu-franghia",
  ]),
  legPress: freezeList(["presa-pentru-picioare-la-45", "presa-pentru-picioare-la-aparat-din-sezut"]),
  squat: freezeList([
    "genuflexiuni", "genuflexiuni-cu-gantere-la-umeri", "genuflexiuni-goblet", "genuflexiuni-haltera",
    "genuflexiuni-la-aparat-v-squat", "genuflexiuni-la-bara-smith", "genuflexiuni-la-cablu",
    "genuflexiuni-la-hack-squat", "genuflexiuni-sumo",
  ]),
  lunge: freezeList(["fandari-bulgaresti", "fandari-inverse-alternative", "fandari-inverse-cu-gantere"]),
  hamstringCurl: freezeList(["extensii-pentru-femurali-din-culcat", "flexii-pentru-picioare-la-aparat"]),
  calfRaise: freezeList([
    "ridicari-pe-varfuri-cu-gantere", "ridicari-pe-varfuri-la-aparat", "ridicari-unilaterale-pe-varfuri-cu-gantera",
  ]),
  crunch: freezeList(["abdomene", "crunch-cu-gantera", "crunch-cu-minge", "crunch-lateral-din-picioare"]),
  plank: freezeList(["plank", "plank-cu-greutate"]),
  russianTwist: freezeList(["russian-twist", "russian-twist-cu-disc"]),
  vUp: freezeList(["v-up", "v-up-cu-minge"]),
});

const GOAL_OFFSET = Object.freeze({ slabire: 0, masa: 2, forma: 4 });
const PROGRAM_OFFSET = Object.freeze({ "incepator-3": 0, "incepator-4": 1, "avansat-4": 2, "avansat-5": 3 });

const FEMALE_POOLS = Object.freeze({
  coreBeginner: freezeList(["dead-bug", "abdomene", "crunch-cu-minge", "crunch-cu-gantera", "russian-twist", "atingeri-alternative-ale-piciorului-din-picioare", "crunch-lateral-din-picioare", "russian-twist-cu-disc"]),
  coreAdvanced: freezeList(["dead-bug", "crunch-cu-gantera", "v-up", "crunch-cu-minge", "russian-twist-cu-disc", "v-up-cu-minge", "abdomene", "russian-twist"]),
  cardioBeginner: freezeList(["bicicleta-eliptica", "bicicleta-stationara", "mers-rapid-pe-banda", "alergare-pe-loc", "ridicari-alternative-ale-genunchilor"]),
  cardioAdvanced: freezeList(["bicicleta-eliptica", "bicicleta-stationara", "mers-rapid-pe-banda", "burpees", "alergare-pe-loc", "ridicari-alternative-ale-genunchilor"]),
  chestPushBeginner: freezeList(["impins-la-aparat"]),
  chestPushAdvanced: freezeList(["impins-la-aparat", "impins-cu-gantere-apropiate"]),
  chestFly: freezeList(["fluturari-la-aparat", "pec-deck", "fluturari-gantere"]),
  backBeginner: freezeList(["ramat-aparat", "tractiuni-la-helcometru-cu-priza-larga", "ramat-la-cablu-din-sezut", "tractiuni-la-helcometru-cu-priza-ingusta", "ramat-la-cablu-cu-priza-ingusta", "hiperextensii-lombare-la-banca"]),
  shoulderPress: freezeList(["impins-cu-gantere-pentru-umeri-din-picioare"]),
  shoulderIsolation: freezeList(["ridicari-laterale-cu-gantere-din-picioare", "face-pull"]),
  bicepsSingle: freezeList(["flexii-gantere", "flexii-la-cablu-cu-franghia"]),
  triceps: freezeList(["extensii-pentru-triceps-la-cablu-cu-bara", "extensii-pentru-triceps-la-cablu-cu-franghia"]),
  legMain: freezeList(["presa-pentru-picioare-la-aparat-din-sezut", "presa-pentru-picioare-la-45", "genuflexiuni-goblet", "fandari-inverse-cu-gantere", "genuflexiuni", "genuflexiuni-cu-gantere-la-umeri"]),
});

const MALE_POOLS = Object.freeze({
  coreBeginner: freezeList(["dead-bug", "abdomene", "plank", "crunch-cu-minge", "ridicari-de-genunchi-la-aparat", "crunch-cu-gantera", "ridicari-de-trunchi-cu-disc", "russian-twist"]),
  coreAdvanced: freezeList(["ab-wheel-din-genunchi", "ridicari-de-picioare-din-atarnat", "plank-cu-greutate", "v-up", "ridicari-de-genunchi-la-aparat", "ridicari-de-trunchi-cu-disc", "dead-bug", "crunch-cu-gantera"]),
  cardioBeginner: freezeList(["bicicleta-eliptica", "bicicleta-stationara", "mers-rapid-pe-banda", "alergare-pe-loc", "ridicari-alternative-ale-genunchilor"]),
  cardioAdvanced: freezeList(["bicicleta-eliptica", "burpees", "bicicleta-stationara", "mers-rapid-pe-banda", "alergare-pe-loc", "ridicari-alternative-ale-genunchilor"]),
  chestPushBeginner: freezeList(["impins-la-aparat", "impins-gantere", "impins-banca-haltera", "impins-inclinat-gantere", "impins-cu-bara-smith", "flotari"]),
  chestPushAdvanced: freezeList(["impins-banca-haltera", "impins-gantere", "impins-la-aparat", "impins-inclinat-gantere", "impins-cu-bara-smith", "impins-cu-bara-pe-banca-inclinata", "impins-cu-bara-pe-banca-declinata", "dips-paralele", "impins-cu-bara-smith-cu-priza-ingusta"]),
  chestFly: freezeList(["pec-deck", "fluturari-la-aparat", "fluturari-gantere"]),
  backBeginner: freezeList(["ramat-aparat", "tractiuni-la-helcometru-cu-priza-larga", "ramat-la-cablu-din-sezut", "tractiuni-la-helcometru-cu-priza-ingusta", "ramat-la-cablu-cu-priza-ingusta", "ramat-unilateral-la-cablu-din-sezut", "hiperextensii-lombare-la-banca", "pulldown-cu-bratele-drepte-la-cablu"]),
  shoulderPress: freezeList(["impins-la-aparat-pentru-umeri", "impins-cu-gantere-pentru-umeri-din-sezut", "impins-cu-gantere-pentru-umeri-din-picioare"]),
  shoulderIsolation: freezeList(["ridicari-laterale-cu-gantere-din-sezut", "ridicari-laterale-cu-gantere-din-picioare", "face-pull", "ridicari-laterale-la-cablu", "ridicari-laterale-unilaterale-la-cablu", "ridicari-laterale-cu-gantere-cu-pieptul-sprijinit"]),
  bicepsSingle: freezeList(["flexii-cu-bara-dreapta", "flexii-gantere", "flexii-la-cablu-cu-bara-ez", "flexii-cu-gantere-pe-banca-inclinata", "flexii-la-banca-scott-cu-bara-ez", "flexii-la-cablu-cu-franghia"]),
  triceps: freezeList(["extensii-pentru-triceps-la-cablu-cu-bara", "extensii-pentru-triceps-la-cablu-cu-franghia", "triceps-deasupra-capului", "extensii-pentru-triceps-cu-bara-ez-din-culcat", "extensii-pentru-triceps-la-cablu-cu-priza-inversa"]),
  legMain: freezeList(["presa-pentru-picioare-la-aparat-din-sezut", "presa-pentru-picioare-la-45", "genuflexiuni-la-bara-smith", "genuflexiuni-goblet", "fandari-inverse-cu-gantere", "genuflexiuni"]),
});

const FEMALE_BACK_QUADS = Object.freeze([
  freezeList(["ramat-aparat", "tractiuni-la-helcometru-cu-priza-larga", "fluturari-inverse", "hiperextensii-lombare-la-banca"]),
  freezeList(["ramat-la-cablu-din-sezut", "tractiuni-la-helcometru-cu-priza-ingusta", "fluturari-inverse", "indreptari-romanesti"]),
  freezeList(["ramat-la-cablu-cu-priza-ingusta", "tractiuni-la-helcometru-cu-priza-larga", "fluturari-inverse", "hiperextensii-lombare-la-banca"]),
  freezeList(["ramat-aparat", "tractiuni-la-helcometru-cu-priza-ingusta", "fluturari-inverse", "indreptari-romanesti"]),
  freezeList(["ramat-la-cablu-din-sezut", "tractiuni-la-helcometru-cu-priza-larga", "fluturari-inverse", "hiperextensii-lombare-la-banca"]),
  freezeList(["ramat-la-cablu-cu-priza-ingusta", "tractiuni-la-helcometru-cu-priza-ingusta", "fluturari-inverse", "indreptari-romanesti"]),
]);

const MALE_BACK_QUADS = Object.freeze([
  freezeList(["ramat-aparat", "tractiuni-la-helcometru-cu-priza-larga", "fluturari-inverse", "hiperextensii-lombare-la-banca"]),
  freezeList(["ramat-haltera", "tractiuni-bara", "pulldown-cu-bratele-drepte-la-cablu", "indreptari-romanesti"]),
  freezeList(["ramat-la-cablu-din-sezut", "tractiuni-la-helcometru-cu-priza-ingusta", "ridicari-din-umeri-la-aparat", "pullover-cablu"]),
  freezeList(["ramat-unilateral-la-cablu-din-sezut", "tractiuni-la-helcometru-cu-priza-larga", "fluturari-inverse", "indreptari-romanesti"]),
  freezeList(["ramat-la-cablu-cu-priza-ingusta", "tractiuni-bara", "ridicari-din-umeri-cu-bara", "hiperextensii-lombare-la-banca"]),
]);

const BICEPS_PAIRS = Object.freeze({
  feminin: Object.freeze([
    freezeList(["flexii-gantere", "flexii-la-cablu-cu-franghia"]),
    freezeList(["flexii-la-cablu-cu-franghia", "flexii-gantere"]),
  ]),
  masculin: Object.freeze([
    freezeList(["flexii-cu-bara-dreapta", "flexii-gantere"]),
    freezeList(["flexii-la-cablu-cu-bara-ez", "flexii-cu-gantere-pe-banca-inclinata"]),
    freezeList(["flexii-la-banca-scott-cu-bara-ez", "flexii-la-cablu-cu-franghia"]),
    freezeList(["flexii-la-cablu-cu-bratele-in-spatele-corpului", "flexii-gantere"]),
    freezeList(["flexii-cu-bara-dreapta", "flexii-la-cablu-cu-franghia"]),
    freezeList(["flexii-la-cablu-cu-bara-ez", "flexii-cu-gantere-pe-banca-inclinata"]),
  ]),
});

const FEMALE_LEG_PAIRS = Object.freeze([
  Object.freeze({ a: freezeList(["presa-pentru-picioare-la-aparat-din-sezut", "extensii-cvadriceps", "flexii-pentru-picioare-la-aparat", "ridicari-pe-varfuri-la-aparat"]), b: freezeList(["presa-pentru-picioare-la-45", "genuflexiuni-la-aparat-v-squat", "extensii-pentru-femurali-din-culcat", "fandari-inverse-alternative"]) }),
  Object.freeze({ a: freezeList(["genuflexiuni-goblet", "extensii-cvadriceps", "hip-thrust-cu-gantera", "ridicari-pe-varfuri-cu-gantere"]), b: freezeList(["fandari-inverse-cu-gantere", "genuflexiuni-la-cablu", "flexii-pentru-picioare-la-aparat", "ridicari-unilaterale-pe-varfuri-cu-gantera"]) }),
  Object.freeze({ a: freezeList(["genuflexiuni-cu-gantere-la-umeri", "extensii-cvadriceps", "extensii-pentru-femurali-din-culcat", "ridicari-pe-varfuri-la-aparat"]), b: freezeList(["genuflexiuni-sumo", "presa-pentru-picioare-la-aparat-din-sezut", "hip-thrust-cu-gantera", "fandari-inverse-alternative"]) }),
  Object.freeze({ a: freezeList(["genuflexiuni", "extensii-cvadriceps", "flexii-pentru-picioare-la-aparat", "ridicari-unilaterale-pe-varfuri-cu-gantera"]), b: freezeList(["genuflexiuni-goblet", "presa-pentru-picioare-la-45", "hip-thrust-cu-gantera", "fandari-inverse-cu-gantere"]) }),
  Object.freeze({ a: freezeList(["presa-pentru-picioare-la-45", "genuflexiuni-la-aparat-v-squat", "extensii-pentru-femurali-din-culcat", "ridicari-pe-varfuri-cu-gantere"]), b: freezeList(["genuflexiuni", "extensii-cvadriceps", "hip-thrust-cu-gantera", "fandari-inverse-alternative"]) }),
  Object.freeze({ a: freezeList(["fandari-inverse-cu-gantere", "extensii-cvadriceps", "flexii-pentru-picioare-la-aparat", "ridicari-pe-varfuri-la-aparat"]), b: freezeList(["presa-pentru-picioare-la-aparat-din-sezut", "genuflexiuni-la-cablu", "hip-thrust-cu-gantera", "indreptari-pe-un-picior-fara-greutate"]) }),
]);

const FEMALE_ADVANCED_LEG_PAIRS = Object.freeze(FEMALE_LEG_PAIRS.map((pair, index) => {
  if (index === 1) return Object.freeze({ a: freezeList(["genuflexiuni-la-hack-squat", ...pair.a.slice(1)]), b: pair.b });
  if (index === 3) return Object.freeze({ a: pair.a, b: freezeList(["fandari-bulgaresti", pair.b[1], pair.b[2], "ridicari-pe-varfuri-cu-gantere"]) });
  return pair;
}));

const MALE_LEG_PAIRS = Object.freeze([
  Object.freeze({ a: freezeList(["presa-pentru-picioare-la-aparat-din-sezut", "extensii-cvadriceps", "flexii-pentru-picioare-la-aparat", "ridicari-pe-varfuri-la-aparat"]), b: freezeList(["presa-pentru-picioare-la-45", "genuflexiuni-la-aparat-v-squat", "extensii-pentru-femurali-din-culcat", "fandari-inverse-alternative"]) }),
  Object.freeze({ a: freezeList(["genuflexiuni-la-bara-smith", "extensii-cvadriceps", "hip-thrust-cu-gantera", "ridicari-pe-varfuri-cu-gantere"]), b: freezeList(["fandari-inverse-cu-gantere", "genuflexiuni-la-cablu", "flexii-pentru-picioare-la-aparat", "ridicari-unilaterale-pe-varfuri-cu-gantera"]) }),
  Object.freeze({ a: freezeList(["genuflexiuni-goblet", "extensii-cvadriceps", "extensii-pentru-femurali-din-culcat", "ridicari-pe-varfuri-la-aparat"]), b: freezeList(["genuflexiuni-sumo", "presa-pentru-picioare-la-aparat-din-sezut", "hip-thrust-cu-gantera", "fandari-inverse-alternative"]) }),
  Object.freeze({ a: freezeList(["genuflexiuni", "extensii-cvadriceps", "flexii-pentru-picioare-la-aparat", "ridicari-unilaterale-pe-varfuri-cu-gantera"]), b: freezeList(["genuflexiuni-goblet", "presa-pentru-picioare-la-45", "hip-thrust-cu-gantera", "fandari-inverse-cu-gantere"]) }),
  Object.freeze({ a: freezeList(["presa-pentru-picioare-la-45", "genuflexiuni-la-aparat-v-squat", "extensii-pentru-femurali-din-culcat", "ridicari-pe-varfuri-cu-gantere"]), b: freezeList(["genuflexiuni-la-bara-smith", "extensii-cvadriceps", "hip-thrust-cu-gantera", "fandari-inverse-alternative"]) }),
  Object.freeze({ a: freezeList(["fandari-inverse-cu-gantere", "extensii-cvadriceps", "flexii-pentru-picioare-la-aparat", "ridicari-pe-varfuri-la-aparat"]), b: freezeList(["presa-pentru-picioare-la-aparat-din-sezut", "genuflexiuni-la-cablu", "hip-thrust-cu-gantera", "indreptari-pe-un-picior-fara-greutate"]) }),
]);

const MALE_ADVANCED_LEG_PAIRS = Object.freeze(MALE_LEG_PAIRS.map((pair, index) => {
  if (index === 0) return Object.freeze({ a: freezeList(["genuflexiuni-haltera", ...pair.a.slice(1)]), b: pair.b });
  if (index === 1) return Object.freeze({ a: freezeList(["genuflexiuni-la-hack-squat", ...pair.a.slice(1)]), b: pair.b });
  if (index === 3) return Object.freeze({ a: pair.a, b: freezeList(["fandari-bulgaresti", pair.b[1], pair.b[2], "ridicari-pe-varfuri-cu-gantere"]) });
  return pair;
}));

function item(values, index) {
  return values[((index % values.length) + values.length) % values.length];
}

function context(profile, weekIndex) {
  const female = profile.gender === "feminin";
  const advanced = profile.program.startsWith("avansat");
  const pools = female ? FEMALE_POOLS : MALE_POOLS;
  const offset = GOAL_OFFSET[profile.goal] + PROGRAM_OFFSET[profile.program] + weekIndex;
  const legPairs = female
    ? advanced ? FEMALE_ADVANCED_LEG_PAIRS : FEMALE_LEG_PAIRS
    : advanced ? MALE_ADVANCED_LEG_PAIRS : MALE_LEG_PAIRS;
  return {
    advanced,
    female,
    offset,
    pools,
    legPair: item(legPairs, GOAL_OFFSET[profile.goal] + weekIndex),
    backQuad: item(female ? FEMALE_BACK_QUADS : MALE_BACK_QUADS, GOAL_OFFSET[profile.goal] + weekIndex),
    nextBackQuad: item(female ? FEMALE_BACK_QUADS : MALE_BACK_QUADS, GOAL_OFFSET[profile.goal] + weekIndex + 1),
    bicepsPair: item(BICEPS_PAIRS[profile.gender], offset),
  };
}

function chestPush(ctx, extra = 0) {
  return item(ctx.advanced ? ctx.pools.chestPushAdvanced : ctx.pools.chestPushBeginner, ctx.offset + extra);
}

function core(ctx, extra = 0) {
  return item(ctx.advanced ? ctx.pools.coreAdvanced : ctx.pools.coreBeginner, ctx.offset + extra);
}

function cardio(ctx, extra = 0) {
  return item(ctx.advanced ? ctx.pools.cardioAdvanced : ctx.pools.cardioBeginner, ctx.offset + extra);
}

function shoulderPair(ctx, alternate = false) {
  if (ctx.female) {
    return alternate
      ? freezeList(["face-pull", item(["impins-cu-gantere-pentru-umeri-din-picioare", "ridicari-laterale-cu-gantere-din-picioare"], Math.floor(ctx.offset / 2))])
      : freezeList(["impins-cu-gantere-pentru-umeri-din-picioare", "ridicari-laterale-cu-gantere-din-picioare"]);
  }
  return freezeList([
    item(ctx.pools.shoulderPress, ctx.offset + (alternate ? 1 : 0)),
    item(ctx.pools.shoulderIsolation, ctx.offset + (alternate ? 3 : 0)),
  ]);
}

function triceps(ctx, extra = 0) {
  const pool = ctx.advanced
    ? ctx.pools.triceps
    : ctx.pools.triceps.filter((key) => !advancedOnly.has(key));
  return item(pool, ctx.offset + extra);
}

function makeBeginner3(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  const legs = ctx.pools.legMain;
  return [
    [item(legs, ctx.offset), chestPush(ctx), item(ctx.pools.backBeginner, ctx.offset), core(ctx)],
    [item(legs, ctx.offset + 2), item(ctx.pools.shoulderPress, ctx.offset), item(ctx.pools.bicepsSingle, ctx.offset), cardio(ctx)],
    [item(legs, ctx.offset + 4), item(ctx.pools.backBeginner, ctx.offset + 3), triceps(ctx), core(ctx, 3)],
  ];
}

function makeBeginner4(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  return [
    [chestPush(ctx), item(ctx.pools.backBeginner, ctx.offset), item(ctx.pools.shoulderPress, ctx.offset), triceps(ctx)],
    [...ctx.legPair.a.slice(0, 3), core(ctx)],
    [item(ctx.pools.backBeginner, ctx.offset + 3), chestPush(ctx, 1), item(ctx.pools.shoulderPress, ctx.offset + 1), item(ctx.pools.bicepsSingle, ctx.offset + 1)],
    [...ctx.legPair.b.slice(0, 3), cardio(ctx)],
  ];
}

function makeAdvanced4(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  const shouldersDay1 = shoulderPair(ctx);
  const shouldersDay3 = shoulderPair(ctx, true);
  return [
    [chestPush(ctx), item(ctx.pools.chestFly, ctx.offset), ...shouldersDay1, triceps(ctx)],
    [...ctx.backQuad, core(ctx)],
    [...shouldersDay3, ...ctx.bicepsPair],
    [...ctx.legPair.a, core(ctx, 3)],
  ];
}

function makeAdvanced5(profile, weekIndex) {
  const ctx = context(profile, weekIndex);
  const shouldersDay1 = shoulderPair(ctx);
  return [
    [chestPush(ctx), item(ctx.pools.chestFly, ctx.offset), ...shouldersDay1, triceps(ctx)],
    [...ctx.backQuad.slice(0, 3), ...ctx.bicepsPair],
    [...ctx.legPair.a, core(ctx)],
    [chestPush(ctx, 1), ...ctx.nextBackQuad.slice(0, 2), item(ctx.pools.shoulderIsolation, ctx.offset + 2), triceps(ctx, 1)],
    [...ctx.legPair.b, cardio(ctx)],
  ];
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

export const CAT3_GYM_EDITORIAL_TEMPLATES = Object.freeze(Object.fromEntries(
  ["masculin", "feminin"].flatMap((gender) =>
    ["slabire", "masa", "forma"].flatMap((goal) =>
      ["incepator-3", "incepator-4", "avansat-4", "avansat-5"].map((program) => {
        const profile = { gender, age: "45-59", goal, place: "sala", program };
        return [`${gender}:${goal}:${program}`, buildTemplate(profile)];
      }),
    ),
  ),
));

export function isCat3GymEditorialProfile(profile) {
  return profile?.age === "45-59"
    && profile?.place === "sala"
    && Object.hasOwn(CAT3_GYM_DAILY_EXERCISE_COUNTS, profile?.program)
    && (profile?.gender === "masculin" || profile?.gender === "feminin")
    && Object.hasOwn(GOAL_OFFSET, profile?.goal);
}

export function cat3GymEditorialTemplate(profile) {
  if (!isCat3GymEditorialProfile(profile)) return null;
  return CAT3_GYM_EDITORIAL_TEMPLATES[`${profile.gender}:${profile.goal}:${profile.program}`] ?? null;
}

export function cat3GymDailyExerciseCount(profile, dayIndex) {
  return CAT3_GYM_DAILY_EXERCISE_COUNTS[profile?.program]?.[dayIndex] ?? 0;
}

export function cat3GymAllowlist(profile) {
  if (!isCat3GymEditorialProfile(profile)) return freezeList([]);
  if (profile.gender === "feminin") return CAT3_GYM_FEMALE_ALLOWLIST;
  return profile.program.startsWith("avansat")
    ? CAT3_GYM_MALE_ADVANCED_ALLOWLIST
    : CAT3_GYM_MALE_BEGINNER_ALLOWLIST;
}

export function cat3GymExerciseApproved(profile, exerciseKey) {
  return cat3GymAllowlist(profile).includes(exerciseKey);
}

export function cat3GymSameFamilyConflicts(exerciseKeys) {
  return Object.entries(CAT3_GYM_REDUNDANT_FAMILIES)
    .filter(([, family]) => exerciseKeys.filter((key) => family.includes(key)).length > 1)
    .map(([familyName]) => familyName);
}

export function cat3GymShouldRotateFirst(profile, dayIndex) {
  if (!isCat3GymEditorialProfile(profile)) return false;
  if (profile.program === "incepator-3") return true;
  if (profile.program === "incepator-4") {
    if (dayIndex === 0) return profile.gender === "masculin";
    if (dayIndex === 2) return true;
    return true;
  }
  if (profile.program === "avansat-4") {
    if (dayIndex === 0 || dayIndex === 1) return profile.gender === "masculin";
    if (dayIndex === 2) return false;
    return true;
  }
  if (dayIndex === 0 || dayIndex === 1 || dayIndex === 3) return profile.gender === "masculin";
  return true;
}
