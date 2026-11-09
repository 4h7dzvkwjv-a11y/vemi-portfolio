import type {
  CalorieGoal,
  NumericRange,
  ValidatedCalculatorInput,
} from "./types";

export const WEIGHT_LOSS_SAFETY_FLOOR = 1_200;

export function calculateMifflinRmr(
  input: Pick<ValidatedCalculatorInput, "sex" | "age" | "heightCm" | "weightKg">,
) {
  const branchConstant = input.sex === "male" ? 5 : -161;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + branchConstant;
}

export function estimateMaintenance(rmr: number, activity: ValidatedCalculatorInput["activity"]) {
  return rmr * Number(activity);
}

export function deriveGoalRange(maintenance: number, goal: CalorieGoal): NumericRange {
  if (goal === "loss") return { minimum: maintenance * 0.8, maximum: maintenance * 0.9 };
  if (goal === "gain") return { minimum: maintenance * 1.05, maximum: maintenance * 1.1 };
  return { minimum: maintenance * 0.9, maximum: maintenance * 1.1 };
}

export function applySafetyGates(range: NumericRange, goal: CalorieGoal) {
  return {
    weightLossTargetBlocked: goal === "loss" && range.minimum < WEIGHT_LOSS_SAFETY_FLOOR,
  } as const;
}

export function roundTo50(value: number) {
  return Math.round(value / 50) * 50;
}

export function roundRangeTo50(range: NumericRange): NumericRange {
  return {
    minimum: roundTo50(range.minimum),
    maximum: roundTo50(range.maximum),
  };
}

const romanianInteger = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

export function formatKcalRange(range: NumericRange) {
  return `${romanianInteger.format(range.minimum)}–${romanianInteger.format(range.maximum)} kcal/zi`;
}

export function formatKcalRangeAccessible(range: NumericRange) {
  return `între ${romanianInteger.format(range.minimum)} și ${romanianInteger.format(range.maximum)} kilocalorii pe zi`;
}

export function calculateCalorieEstimate(input: ValidatedCalculatorInput) {
  const rmr = calculateMifflinRmr(input);
  const maintenance = estimateMaintenance(rmr, input.activity);
  const rawGoalRange = deriveGoalRange(maintenance, input.goal);
  const safety = applySafetyGates(rawGoalRange, input.goal);
  const rawMaintenanceRange = deriveGoalRange(maintenance, "maintenance");

  if (![rmr, maintenance, rawGoalRange.minimum, rawGoalRange.maximum].every(Number.isFinite)) {
    return null;
  }

  if (rmr <= 0 || maintenance <= 0 || rawGoalRange.minimum <= 0 || rawGoalRange.maximum <= 0) {
    return null;
  }

  return {
    rmr,
    maintenance,
    rawGoalRange,
    goalRange: safety.weightLossTargetBlocked ? null : roundRangeTo50(rawGoalRange),
    maintenanceRange: roundRangeTo50(rawMaintenanceRange),
    weightLossTargetBlocked: safety.weightLossTargetBlocked,
  } as const;
}

