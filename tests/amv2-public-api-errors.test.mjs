import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAmv2HistoryRpcErrorKind,
  getAmv2OperationRpcErrorKind,
  getAmv2PublicApiError,
} from "../lib/amv2/public-api-error.mjs";

const syncRoute = await readFile(new URL("../app/api/amv2/sync/route.ts", import.meta.url), "utf8");
const historyRoute = await readFile(new URL("../app/api/amv2/sync/history/route.ts", import.meta.url), "utf8");

test("maparea publică AMV2 păstrează statusurile și codurile de retry/conflict", () => {
  assert.deepEqual(getAmv2PublicApiError("conflict"), {
    status: 409,
    body: {
      error: "Datele din cont s-au schimbat. Alege versiunea pe care vrei să o păstrezi.",
      code: "CONFLICT",
    },
  });
  assert.equal(getAmv2PublicApiError("accountBoundary").status, 403);
  assert.equal(getAmv2PublicApiError("calendarInvalidRequest").status, 400);
  assert.equal(getAmv2PublicApiError("payloadTooLarge").status, 413);
  assert.equal(getAmv2PublicApiError("idempotencyPayloadConflict").status, 400);
  assert.equal(getAmv2PublicApiError("historySnapshotChanged").status, 409);
  assert.equal(getAmv2PublicApiError("historyUnavailable").status, 503);
  assert.equal(getAmv2PublicApiError("operationUnavailable").status, 503);
});

test("maparea este închisă și nu poate publica din greșeală o eroare arbitrară", () => {
  assert.throws(() => getAmv2PublicApiError("raw_database_error"), /invalid/);
  const publicDefinitions = [
    "calendarInvalidRequest",
    "calendarUnavailable",
    "operationInvalid",
    "accountBoundary",
    "payloadTooLarge",
    "conflict",
    "idempotencyPayloadConflict",
    "importOccurrenceConflict",
    "operationValidation",
    "operationUnavailable",
    "historyInvalidRequest",
    "historySnapshotChanged",
    "historyUnavailable",
  ].map((kind) => getAmv2PublicApiError(kind));
  const serialized = JSON.stringify(publicDefinitions);
  assert.doesNotMatch(serialized, /23505|40001|sqlstate|constraint|schema|table|function|public\.|request_payload|response_payload|amv2_workout_days|amv2_apply_operation|violates/i);
});

test("mostrele brute Postgres nu pot traversa maparea publică închisă", () => {
  const rawDatabaseSamples = [
    "SQLSTATE 23505: duplicate key value violates unique constraint amv2_operation_receipts_pkey",
    "schema public table amv2_workout_days",
    "function public.amv2_apply_operation(text,text,bigint,jsonb)",
    "request_payload={ownerUserId:secret}",
  ];
  const publicResponses = [
    getAmv2PublicApiError("operationValidation"),
    getAmv2PublicApiError("operationUnavailable"),
    getAmv2PublicApiError("historyUnavailable"),
  ];
  const serialized = JSON.stringify(publicResponses);
  rawDatabaseSamples.forEach((sample) => assert.ok(!serialized.includes(sample)));
  assert.doesNotMatch(serialized, /23505|sqlstate|constraint|schema|table|function|public\.|request_payload/i);
});

test("numai validările RPC cunoscute sunt permanente; erorile tranzitorii rămân retryable", () => {
  assert.equal(getAmv2OperationRpcErrorKind({ code: "22023", message: "AMV2_OPERATION_INVALID" }), "operationValidation");
  assert.equal(getAmv2OperationRpcErrorKind({ code: "23514", message: "check failed" }), "operationValidation");
  assert.equal(getAmv2OperationRpcErrorKind({ code: "54000", message: "AMV2_PAYLOAD_TOO_LARGE" }), "payloadTooLarge");
  assert.equal(getAmv2OperationRpcErrorKind({ code: "40001", message: "serialization" }), "conflict");
  assert.equal(getAmv2OperationRpcErrorKind({ code: "22023", message: "AMV2_IDEMPOTENCY_PAYLOAD_CONFLICT" }), "idempotencyPayloadConflict");
  for (const code of ["40P01", "57014", "53300", "08006", "XX000", ""]) {
    const kind = getAmv2OperationRpcErrorKind({ code, message: "internal table or constraint detail" });
    assert.equal(kind, "operationUnavailable");
    assert.equal(getAmv2PublicApiError(kind).status, 503);
  }
  assert.equal(getAmv2HistoryRpcErrorKind({ code: "57014", message: "timeout" }), "historyUnavailable");
  assert.equal(getAmv2HistoryRpcErrorKind({ code: "40001", message: "serialization" }), "historySnapshotChanged");
});

test("rutele AMV2 nu mai serializează mesajele brute ale excepțiilor", () => {
  assert.match(syncRoute, /publicError\("calendarUnavailable"\)/);
  assert.match(syncRoute, /publicError\("calendarInvalidRequest"\)/);
  assert.match(syncRoute, /publicError\("operationUnavailable"\)/);
  assert.match(syncRoute, /request\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(syncRoute, /getAmv2PublicApiError\("conflict"\)/);
  assert.match(syncRoute, /getAmv2OperationRpcErrorKind\(error\)/);
  assert.doesNotMatch(syncRoute, /error:\s*error\.message/);
  assert.doesNotMatch(syncRoute, /error instanceof Error \? error\.message/);

  assert.match(historyRoute, /getAmv2HistoryRpcErrorKind\(error\)/);
  assert.match(historyRoute, /if \(!parameters\) return publicError\("historyInvalidRequest"\)/);
  assert.match(historyRoute, /publicError\("historyUnavailable"\)/);
  assert.doesNotMatch(historyRoute, /error:\s*error\.message/);
  assert.doesNotMatch(historyRoute, /\?\s*error\.message\s*:/);
});
