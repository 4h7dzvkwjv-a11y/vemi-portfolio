import assert from "node:assert/strict";
import test from "node:test";

import {
  AMV2_HISTORY_PAGE_SIZE,
  advanceHistoryCoverage,
  createHistoryCoverageState,
  isHistoryCoverageComplete,
  markHistoryCoverageError,
  markHistoryCoverageStale,
  normalizeHistoryPage,
  readHistoryCoverage,
  withHistoryCoverage,
} from "../lib/amv2/cloud-history-coverage.mjs";

const NOW = "2026-08-23T10:00:00.000Z";

function rawPage(dates, { revision = 9, hasMore = true } = {}) {
  const ordered = [...dates].sort((left, right) => right.localeCompare(left, "en"));
  return {
    snapshotRevision: revision,
    hasMore,
    nextCursor: hasMore ? ordered.at(-1) : null,
    days: ordered.map((date) => ({ workout_date: date })),
    exercises: [],
    sets: [],
    personalExercises: [],
    tombstones: [],
  };
}

test("cursorul istoric este exclusiv, determinist și avansează numai după o pagină coerentă", () => {
  const first = normalizeHistoryPage(rawPage(["2026-08-23", "2026-08-20"]));
  const afterFirst = advanceHistoryCoverage(createHistoryCoverageState(), first, NOW);
  assert.equal(afterFirst.status, "incomplete");
  assert.equal(afterFirst.snapshotRevision, 9);
  assert.equal(afterFirst.cursor, "2026-08-20");
  assert.equal(afterFirst.latestDate, "2026-08-23");

  const final = normalizeHistoryPage(rawPage(["2025-12-31", "2021-01-02"], {
    revision: 9,
    hasMore: false,
  }), {
    requestedCursor: afterFirst.cursor,
    requestedSnapshotRevision: afterFirst.snapshotRevision,
  });
  const complete = advanceHistoryCoverage(afterFirst, final, "2026-08-23T10:01:00.000Z");
  assert.equal(complete.status, "complete");
  assert.equal(complete.cursor, null);
  assert.equal(complete.earliestDate, "2021-01-02");
  assert.equal(isHistoryCoverageComplete(withHistoryCoverage({}, complete)), true);
});

test("paginile duplicate, cursorii neexclusivi și reviziile amestecate sunt respinse", () => {
  assert.throws(() => normalizeHistoryPage(rawPage(["2026-08-20"], { revision: 10 }), {
    requestedCursor: "2026-08-20",
    requestedSnapshotRevision: 10,
  }), /cursorul exclusiv/);
  assert.throws(() => normalizeHistoryPage(rawPage(["2026-08-19"], { revision: 11 }), {
    requestedCursor: "2026-08-20",
    requestedSnapshotRevision: 10,
  }), /schimbat/);
  assert.throws(() => normalizeHistoryPage({
    ...rawPage(["2026-08-19"], { revision: 10 }),
    nextCursor: "2026-08-18",
  }), /cea mai veche dată/);
});

test("tombstone-urile participă la cursor și istoricul gol se închide corect", () => {
  const tombstonePage = normalizeHistoryPage({
    ...rawPage([], { hasMore: true }),
    tombstones: [{ workout_date: "2024-04-03" }],
    nextCursor: "2024-04-03",
  });
  assert.deepEqual(tombstonePage.dates, ["2024-04-03"]);

  const empty = normalizeHistoryPage(rawPage([], { revision: 0, hasMore: false }));
  const complete = advanceHistoryCoverage(createHistoryCoverageState(), empty, NOW);
  assert.equal(complete.status, "complete");
  assert.equal(complete.snapshotRevision, 0);
  assert.equal(complete.earliestDate, null);
  assert.equal(complete.latestDate, null);
});

test("acoperirea întreruptă este reluabilă, iar stările stale/error nu pretind rezultate complete", () => {
  const page = normalizeHistoryPage(rawPage(["2026-01-01", "2025-12-01"]));
  const interrupted = advanceHistoryCoverage(createHistoryCoverageState(), page, NOW);
  const persisted = withHistoryCoverage({ "month:2026-08": NOW }, interrupted);
  assert.deepEqual(readHistoryCoverage(persisted), interrupted);
  assert.equal(isHistoryCoverageComplete(persisted), false);
  assert.equal(markHistoryCoverageStale(interrupted).status, "stale");
  assert.equal(markHistoryCoverageError(interrupted, "NETWORK").status, "error");
  assert.equal(readHistoryCoverage({ history: { malformed: true } }).status, "incomplete");
});

test("un fixture de cinci ani poate fi parcurs fără goluri sau duplicate la limita exactă", () => {
  const dates = Array.from({ length: 5 * 365 }, (_, index) => {
    const date = new Date(Date.UTC(2021, 0, 1 + index));
    return date.toISOString().slice(0, 10);
  }).sort((left, right) => right.localeCompare(left, "en"));
  let state = createHistoryCoverageState();
  const observed = [];
  for (let offset = 0; offset < dates.length; offset += AMV2_HISTORY_PAGE_SIZE) {
    const slice = dates.slice(offset, offset + AMV2_HISTORY_PAGE_SIZE);
    const hasMore = offset + slice.length < dates.length;
    const page = normalizeHistoryPage(rawPage(slice, { revision: 42, hasMore }), {
      requestedCursor: state.cursor,
      requestedSnapshotRevision: state.snapshotRevision,
    });
    observed.push(...page.dates);
    state = advanceHistoryCoverage(state, page, NOW);
  }
  assert.equal(state.status, "complete");
  assert.equal(observed.length, dates.length);
  assert.equal(new Set(observed).size, dates.length);
  assert.deepEqual(observed, dates);
});
