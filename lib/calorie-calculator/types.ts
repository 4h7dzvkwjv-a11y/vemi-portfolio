export const BIOLOGICAL_SEXES = ["female", "male"] as const;
export const ACTIVITY_LEVELS = ["1.4", "1.6", "1.8", "2.0"] as const;
export const CALORIE_GOALS = ["maintenance", "loss", "gain"] as const;

export type BiologicalSex = (typeof BIOLOGICAL_SEXES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type CalorieGoal = (typeof CALORIE_GOALS)[number];

export type CalculatorField =
  | "sex"
  | "age"
  | "heightCm"
  | "weightKg"
  | "activity"
  | "goal";

export type RawCalculatorInput = {
  sex: string;
  age: string;
  heightCm: string;
  weightKg: string;
  activity: string;
  goal: string;
};

export type ValidatedCalculatorInput = {
  sex: BiologicalSex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: CalorieGoal;
};

export type NumericRange = Readonly<{
  minimum: number;
  maximum: number;
}>;

export type CalculatorErrors = Partial<Record<CalculatorField | "form", string>>;

