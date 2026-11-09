import type {
  ActivityLevel,
  BiologicalSex,
  CalculatorErrors,
  CalorieGoal,
  RawCalculatorInput,
  ValidatedCalculatorInput,
} from "./types";

const BIOLOGICAL_SEXES = ["female", "male"] as const;
const ACTIVITY_LEVELS = ["1.4", "1.6", "1.8", "2.0"] as const;
const CALORIE_GOALS = ["maintenance", "loss", "gain"] as const;

const localizedDecimalPattern = /^\d+(?:[,.]\d)?$/;
const integerPattern = /^\d+$/;

export function parseLocalizedDecimal(raw: string) {
  const normalized = raw.trim();
  if (!localizedDecimalPattern.test(normalized)) return null;

  const value = Number(normalized.replace(",", "."));
  return Number.isFinite(value) && value > 0 && !Object.is(value, -0) ? value : null;
}

function parseAge(raw: string) {
  const normalized = raw.trim();
  if (!integerPattern.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isBiologicalSex(value: string): value is BiologicalSex {
  return (BIOLOGICAL_SEXES as readonly string[]).includes(value);
}

function isActivityLevel(value: string): value is ActivityLevel {
  return (ACTIVITY_LEVELS as readonly string[]).includes(value);
}

function isCalorieGoal(value: string): value is CalorieGoal {
  return (CALORIE_GOALS as readonly string[]).includes(value);
}

export function validateCalculatorInput(raw: RawCalculatorInput):
  | { valid: true; value: ValidatedCalculatorInput; errors: Record<string, never> }
  | { valid: false; value: null; errors: CalculatorErrors } {
  const errors: CalculatorErrors = {};
  const age = parseAge(raw.age);
  const heightCm = parseLocalizedDecimal(raw.heightCm);
  const weightKg = parseLocalizedDecimal(raw.weightKg);

  if (!isBiologicalSex(raw.sex)) {
    errors.sex = "Selectează ramura biologică utilizată de ecuație.";
  }
  if (age === null || age < 19 || age > 78) {
    errors.age = "Introdu o vârstă între 19 și 78 de ani, fără zecimale.";
  }
  if (heightCm === null || heightCm < 146 || heightCm > 201) {
    errors.heightCm = "Introdu o înălțime între 146 și 201 cm, cu maximum o zecimală.";
  }
  if (weightKg === null || weightKg < 46 || weightKg > 143) {
    errors.weightKg = "Introdu o greutate între 46 și 143 kg, cu maximum o zecimală.";
  }
  if (!isActivityLevel(raw.activity)) {
    errors.activity = "Selectează nivelul de activitate care descrie cel mai bine săptămâna ta obișnuită.";
  }
  if (!isCalorieGoal(raw.goal)) {
    errors.goal = "Selectează obiectivul pentru care vrei estimarea.";
  }

  if (Object.keys(errors).length > 0) return { valid: false, value: null, errors };

  return {
    valid: true,
    errors: {},
    value: {
      sex: raw.sex as BiologicalSex,
      age: age as number,
      heightCm: heightCm as number,
      weightKg: weightKg as number,
      activity: raw.activity as ActivityLevel,
      goal: raw.goal as CalorieGoal,
    },
  };
}
