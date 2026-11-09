import { validateWorkoutDay } from "./workout-day-domain.mjs";

export const AMV2_WORKOUT_CALENDAR_STORAGE_KEY = "vemi-amv2-workout-calendar-v1";
export const AMV2_WORKOUT_CALENDAR_SCHEMA_VERSION = 1;
export const AMV2_LEGACY_LOCAL_STORAGE_KEY = "vemi-amv2-local-v3";

const MAX_LOCAL_BYTES = 512 * 1_024;
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isTimestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export class WorkoutCalendarLocalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkoutCalendarLocalError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new WorkoutCalendarLocalError(code, message);
};

export function createWorkoutCalendarEnvelope(updatedAt) {
  const envelope = {
    schema: "vemi-amv2-workout-calendar",
    version: AMV2_WORKOUT_CALENDAR_SCHEMA_VERSION,
    revision: 0,
    days: [],
    updatedAt,
  };
  const validation = validateWorkoutCalendarEnvelope(envelope);
  if (!validation.valid) fail("INVALID_CALENDAR", validation.issues.join(" "));
  return envelope;
}

export function validateWorkoutCalendarEnvelope(value) {
  const issues = [];
  if (!isRecord(value)) return { valid: false, issues: ["Calendarul local nu este un obiect valid."] };
  if (value.schema !== "vemi-amv2-workout-calendar") issues.push("Schema calendarului local este invalidă.");
  if (value.version !== AMV2_WORKOUT_CALENDAR_SCHEMA_VERSION) issues.push("Versiunea calendarului local este invalidă.");
  if (!Number.isInteger(value.revision) || value.revision < 0) issues.push("Revizia calendarului local este invalidă.");
  if (!isTimestamp(value.updatedAt)) issues.push("Calendarul local nu are updatedAt valid.");
  if (!Array.isArray(value.days)) {
    issues.push("Calendarul local nu are lista de zile.");
    return { valid: false, issues };
  }
  const dates = new Set();
  let previousDate = null;
  value.days.forEach((day, index) => {
    const validation = validateWorkoutDay(day);
    validation.issues.forEach((issue) => issues.push(`Ziua ${index + 1}: ${issue}`));
    if (typeof day?.date === "string") {
      if (dates.has(day.date)) issues.push(`Data ${day.date} apare de mai multe ori.`);
      dates.add(day.date);
      if (previousDate !== null && previousDate.localeCompare(day.date, "en") >= 0) {
        issues.push("Zilele calendarului nu sunt sortate ordinal după dată.");
      }
      previousDate = day.date;
    }
  });
  return { valid: issues.length === 0, issues };
}

function assertEnvelope(envelope) {
  const validation = validateWorkoutCalendarEnvelope(envelope);
  if (!validation.valid) fail("INVALID_CALENDAR", validation.issues.join(" "));
}

export function findWorkoutDay(envelope, date) {
  assertEnvelope(envelope);
  return envelope.days.find((day) => day.date === date) ?? null;
}

export function replaceWorkoutDayInCalendar(envelope, date, day, updatedAt) {
  assertEnvelope(envelope);
  if (day !== null) {
    const validation = validateWorkoutDay(day);
    if (!validation.valid) fail("INVALID_WORKOUT_DAY", validation.issues.join(" "));
    if (day.date !== date) fail("DATE_MISMATCH", "Ziua înlocuită nu corespunde datei selectate.");
  }
  const days = envelope.days.filter((candidate) => candidate.date !== date);
  if (day !== null) days.push(day);
  days.sort((left, right) => left.date.localeCompare(right.date, "en"));
  const next = {
    ...envelope,
    revision: envelope.revision + 1,
    days,
    updatedAt,
  };
  assertEnvelope(next);
  return next;
}

export function readWorkoutCalendar(storage) {
  try {
    const raw = storage.getItem(AMV2_WORKOUT_CALENDAR_STORAGE_KEY);
    if (raw === null) return { status: "missing" };
    if (byteLength(raw) > MAX_LOCAL_BYTES) {
      return { status: "invalid", error: "Calendarul local depășește limita de 512 KiB." };
    }
    const parsed = JSON.parse(raw);
    const validation = validateWorkoutCalendarEnvelope(parsed);
    if (!validation.valid) return { status: "invalid", error: validation.issues.join(" ") };
    return { status: "loaded", envelope: parsed };
  } catch (error) {
    return {
      status: "read_error",
      error: error instanceof Error ? error.message : "Calendarul local nu poate fi citit.",
    };
  }
}

export function writeWorkoutCalendar(storage, envelope) {
  try {
    assertEnvelope(envelope);
    const serialized = JSON.stringify(envelope);
    if (byteLength(serialized) > MAX_LOCAL_BYTES) {
      return { status: "save_error", error: "Calendarul local depășește limita de 512 KiB." };
    }
    storage.setItem(AMV2_WORKOUT_CALENDAR_STORAGE_KEY, serialized);
    return { status: "saved_local", bytes: byteLength(serialized) };
  } catch (error) {
    return {
      status: "save_error",
      error: error instanceof Error ? error.message : "Calendarul local nu poate fi salvat.",
    };
  }
}
