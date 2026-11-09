import { getWorkoutExerciseIdentity } from "./draft-domain.mjs";
import { AMV2_CATEGORY_ORDER } from "./category-presentation.mjs";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const categoryOrder = new Map(AMV2_CATEGORY_ORDER.map((category, index) => [category, index]));

function parseDateKey(dateKey) {
  if (typeof dateKey !== "string" || !DATE_KEY_PATTERN.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function startOfIsoWeek(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return toDateKey(date);
}

function shiftDateKey(dateKey, days) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return toDateKey(new Date(date.getTime() + days * DAY_MS));
}

function metricValue(exercise) {
  if (exercise.metricType === "repetitions_weight") {
    return Math.max(0, ...exercise.sets.map((set) => set.targetWeightKg));
  }
  if (exercise.metricType === "repetitions_only") {
    return Math.max(0, ...exercise.sets.map((set) => set.targetRepetitions));
  }
  if (exercise.metricType === "time_per_set") {
    return Math.max(0, ...exercise.sets.map((set) => set.targetDurationSeconds));
  }
  return exercise.targetTotalDurationSeconds;
}

function deriveExerciseHistories(days) {
  const grouped = new Map();
  for (const day of days) {
    for (const exercise of day.exercises) {
      const identity = getWorkoutExerciseIdentity(exercise);
      if (!identity) continue;
      const existing = grouped.get(identity) ?? [];
      existing.push({ date: day.date, exercise });
      grouped.set(identity, existing);
    }
  }

  return [...grouped.entries()].map(([identity, sourceOccurrences]) => {
    const occurrences = sourceOccurrences.toSorted((left, right) => right.date.localeCompare(left.date));
    const latest = occurrences[0];
    const metricType = latest.exercise.metricType;
    const comparable = occurrences
      .filter((occurrence) => occurrence.exercise.metricType === metricType)
      .toSorted((left, right) => left.date.localeCompare(right.date));
    const trend = comparable.slice(-4).map((occurrence) => ({
      date: occurrence.date,
      value: metricValue(occurrence.exercise),
    }));

    return {
      identity,
      displayName: latest.exercise.displayName,
      category: latest.exercise.category,
      metricType,
      latestDate: latest.date,
      latestValue: metricValue(latest.exercise),
      bestValue: Math.max(0, ...comparable.map((occurrence) => metricValue(occurrence.exercise))),
      trend,
      occurrences,
    };
  }).toSorted((left, right) => right.latestDate.localeCompare(left.latestDate)
    || left.displayName.localeCompare(right.displayName, "ro"));
}

export function deriveWorkoutStatistics(days, todayDateKey) {
  const validDays = Array.isArray(days)
    ? days.filter((day) => day && typeof day === "object" && parseDateKey(day.date) && Array.isArray(day.exercises))
    : [];
  const activeDates = new Set(validDays.map((day) => day.date));
  const activeWeeks = new Set([...activeDates].map(startOfIsoWeek).filter(Boolean));
  const categoryCounts = new Map();
  let exerciseOccurrences = 0;

  for (const day of validDays) {
    for (const exercise of day.exercises) {
      exerciseOccurrences += 1;
      categoryCounts.set(exercise.category, (categoryCounts.get(exercise.category) ?? 0) + 1);
    }
  }

  const groups = [...categoryCounts.entries()].map(([category, count]) => ({
    category,
    count,
    percentage: exerciseOccurrences === 0 ? 0 : Math.round((count / exerciseOccurrences) * 100),
  })).toSorted((left, right) => right.count - left.count
    || (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER)
      - (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER)
    || left.category.localeCompare(right.category, "ro"));

  const fallbackAnchor = validDays.toSorted((left, right) => right.date.localeCompare(left.date))[0]?.date;
  const anchorWeek = startOfIsoWeek(todayDateKey) ?? startOfIsoWeek(fallbackAnchor) ?? "1970-01-05";
  const recentWeeks = [3, 2, 1, 0].map((weeksAgo, index) => {
    const startDate = shiftDateKey(anchorWeek, -7 * weeksAgo);
    const endDate = shiftDateKey(startDate, 6);
    return {
      id: startDate,
      label: `S${index + 1}`,
      startDate,
      endDate,
      dayCount: [...activeDates].filter((date) => date >= startDate && date <= endDate).length,
    };
  });

  const histories = deriveExerciseHistories(validDays);
  const activeDayCount = activeDates.size;
  const activeWeekCount = activeWeeks.size;

  return {
    activeDays: activeDayCount,
    activeWeeks: activeWeekCount,
    averageWeeklyFrequency: activeWeekCount === 0
      ? 0
      : Math.round((activeDayCount / activeWeekCount) * 10) / 10,
    recentWeeks,
    groups,
    recentExercises: histories.slice(0, 3),
    exerciseHistories: histories,
  };
}

export function findExerciseHistory(statistics, identity) {
  if (!statistics || typeof identity !== "string") return null;
  return statistics.exerciseHistories.find((history) => history.identity === identity) ?? null;
}

export function selectRecentExerciseOccurrences(history, beforeDate, limit = 2) {
  if (!history || !parseDateKey(beforeDate) || !Number.isInteger(limit) || limit < 1) return [];
  return history.occurrences
    .filter((occurrence) => occurrence.date < beforeDate)
    .slice(0, limit);
}
