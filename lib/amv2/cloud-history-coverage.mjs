export const AMV2_HISTORY_COVERAGE_VERSION = 1;
export const AMV2_HISTORY_PAGE_SIZE = 3;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = new Set(["incomplete", "complete", "stale", "error"]);
const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const clone = (value) => structuredClone(value);

export class Amv2HistoryCoverageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "Amv2HistoryCoverageError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new Amv2HistoryCoverageError(code, message);
};

export function createHistoryCoverageState() {
  return {
    version: AMV2_HISTORY_COVERAGE_VERSION,
    status: "incomplete",
    snapshotRevision: null,
    cursor: null,
    earliestDate: null,
    latestDate: null,
    lastDurablePageAt: null,
    errorCode: null,
  };
}

export function validateHistoryCoverageState(value) {
  if (!isRecord(value)
    || value.version !== AMV2_HISTORY_COVERAGE_VERSION
    || !STATUS.has(value.status)
    || !(value.snapshotRevision === null
      || (Number.isInteger(value.snapshotRevision) && value.snapshotRevision >= 0))
    || !(value.cursor === null || (typeof value.cursor === "string" && DATE_KEY.test(value.cursor)))
    || !(value.earliestDate === null || (typeof value.earliestDate === "string" && DATE_KEY.test(value.earliestDate)))
    || !(value.latestDate === null || (typeof value.latestDate === "string" && DATE_KEY.test(value.latestDate)))
    || !(value.lastDurablePageAt === null
      || (typeof value.lastDurablePageAt === "string" && Number.isFinite(Date.parse(value.lastDurablePageAt))))
    || !(value.errorCode === null || (typeof value.errorCode === "string" && value.errorCode.length > 0))) {
    return false;
  }
  if (value.status === "complete" && value.cursor !== null) return false;
  if (value.status !== "complete" && value.snapshotRevision === null && value.cursor !== null) return false;
  if (value.earliestDate && value.latestDate && value.earliestDate > value.latestDate) return false;
  return true;
}

export function readHistoryCoverage(coverage) {
  const candidate = isRecord(coverage) ? coverage.history : null;
  return validateHistoryCoverageState(candidate) ? clone(candidate) : createHistoryCoverageState();
}

export function withHistoryCoverage(coverage, history) {
  if (!validateHistoryCoverageState(history)) fail("INVALID_HISTORY_COVERAGE", "Acoperirea istoricului AMV2 este invalidă.");
  return { ...(isRecord(coverage) ? coverage : {}), history: clone(history) };
}

export function isHistoryCoverageComplete(coverage) {
  return readHistoryCoverage(coverage).status === "complete";
}

function pageDates(page) {
  const values = [];
  for (const row of page.days) {
    if (!isRecord(row) || typeof row.workout_date !== "string" || !DATE_KEY.test(row.workout_date)) {
      fail("INVALID_HISTORY_PAGE", "Pagina istoricului conține o zi invalidă.");
    }
    values.push(row.workout_date);
  }
  for (const row of page.tombstones) {
    if (!isRecord(row) || typeof row.workout_date !== "string" || !DATE_KEY.test(row.workout_date)) {
      fail("INVALID_HISTORY_PAGE", "Pagina istoricului conține un tombstone invalid.");
    }
    values.push(row.workout_date);
  }
  return [...new Set(values)].sort((left, right) => right.localeCompare(left, "en"));
}

export function normalizeHistoryPage(value, {
  requestedCursor = null,
  requestedSnapshotRevision = null,
} = {}) {
  if (!isRecord(value)
    || !Number.isInteger(value.snapshotRevision)
    || value.snapshotRevision < 0
    || typeof value.hasMore !== "boolean"
    || !(value.nextCursor === null || (typeof value.nextCursor === "string" && DATE_KEY.test(value.nextCursor)))
    || !Array.isArray(value.days)
    || !Array.isArray(value.exercises)
    || !Array.isArray(value.sets)
    || !Array.isArray(value.personalExercises)
    || !Array.isArray(value.tombstones)) {
    fail("INVALID_HISTORY_PAGE", "Pagina istoricului cloud este invalidă.");
  }
  if (requestedCursor !== null && (!DATE_KEY.test(requestedCursor))) {
    fail("INVALID_HISTORY_CURSOR", "Cursorul istoricului cloud este invalid.");
  }
  if (requestedSnapshotRevision !== null && value.snapshotRevision !== requestedSnapshotRevision) {
    fail("HISTORY_SNAPSHOT_CHANGED", "Revizia istoricului cloud s-a schimbat în timpul hidratării.");
  }
  const dates = pageDates(value);
  if (requestedCursor && dates.some((date) => date >= requestedCursor)) {
    fail("NON_EXCLUSIVE_HISTORY_CURSOR", "Pagina istoricului nu respectă cursorul exclusiv.");
  }
  if (value.hasMore) {
    if (dates.length === 0 || value.nextCursor !== dates.at(-1)) {
      fail("INVALID_HISTORY_CURSOR", "Cursorul paginii nu indică cea mai veche dată returnată.");
    }
  } else if (value.nextCursor !== null) {
    fail("INVALID_HISTORY_CURSOR", "Ultima pagină a istoricului trebuie să închidă cursorul.");
  }
  return { ...clone(value), dates };
}

export function advanceHistoryCoverage(current, page, timestamp) {
  const previous = validateHistoryCoverageState(current) ? current : createHistoryCoverageState();
  if (!Number.isFinite(Date.parse(timestamp))) fail("INVALID_TIMESTAMP", "Momentul paginii istorice este invalid.");
  if (previous.snapshotRevision !== null && previous.snapshotRevision !== page.snapshotRevision) {
    fail("HISTORY_SNAPSHOT_CHANGED", "Pagina nu aparține reviziei istorice în curs.");
  }
  const pageEarliest = page.dates.at(-1) ?? null;
  const pageLatest = page.dates[0] ?? null;
  const earliestDate = [previous.earliestDate, pageEarliest].filter(Boolean).sort()[0] ?? null;
  const latestDate = [previous.latestDate, pageLatest].filter(Boolean).sort().at(-1) ?? null;
  const next = {
    version: AMV2_HISTORY_COVERAGE_VERSION,
    status: page.hasMore ? "incomplete" : "complete",
    snapshotRevision: page.snapshotRevision,
    cursor: page.hasMore ? page.nextCursor : null,
    earliestDate,
    latestDate,
    lastDurablePageAt: timestamp,
    errorCode: null,
  };
  if (!validateHistoryCoverageState(next)) fail("INVALID_HISTORY_COVERAGE", "Acoperirea rezultată este invalidă.");
  return next;
}

export function restartHistoryCoverage() {
  return createHistoryCoverageState();
}

export function markHistoryCoverageStale(current) {
  const previous = validateHistoryCoverageState(current) ? current : createHistoryCoverageState();
  return {
    ...previous,
    status: "stale",
    cursor: null,
    errorCode: "HISTORY_SNAPSHOT_CHANGED",
  };
}

export function markHistoryCoverageError(current, errorCode) {
  const previous = validateHistoryCoverageState(current) ? current : createHistoryCoverageState();
  return {
    ...previous,
    status: "error",
    errorCode: typeof errorCode === "string" && errorCode.length > 0 ? errorCode : "HISTORY_UNAVAILABLE",
  };
}
