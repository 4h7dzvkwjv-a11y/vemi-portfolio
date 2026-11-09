import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAmv2HistoryRpcErrorKind,
  getAmv2OperationRpcErrorKind,
  getAmv2PublicApiError,
} from "../lib/amv2/public-api-error.mjs";

const route = await readFile(new URL("../app/api/amv2/sync/route.ts", import.meta.url), "utf8");
const historyRoute = await readFile(new URL("../app/api/amv2/sync/history/route.ts", import.meta.url), "utf8");
const cloudClient = await readFile(new URL("../lib/amv2/cloud-sync-client.ts", import.meta.url), "utf8");

test("sync API derives authoritative candidates through the owner-safe calendar RPC", () => {
  assert.match(route, /hydrateCloudCalendarSnapshot/);
  assert.match(route, /readOwnerCalendar/);
  assert.match(route, /supabase\.rpc\("amv2_read_calendar"/);
  assert.doesNotMatch(route, /supabase\.from\("amv2_(?:workout_days|personal_exercises)"/);
  assert.match(route, /dayStateFromSnapshot/);
  assert.match(route, /snapshot\.hydrated\.tombstones/);
  assert.match(route, /snapshot\.hydrated\.personalExercises/);
});

test("successful apply response includes the canonical candidate, deletion state and authoritative revision", () => {
  assert.match(route, /const result = parseApplyResult\(data\)/);
  assert.match(route, /canonicalCandidate: authoritative\.canonicalCandidate/);
  assert.match(route, /deleted: authoritative\.deleted/);
  assert.match(route, /revision: authoritative\.revision/);
  assert.match(route, /remoteIdentity: authoritative\.remoteIdentity/);
});

test("conflict response is complete and owner-scoped instead of returning revision alone", () => {
  assert.equal(getAmv2PublicApiError("conflict").body.code, "CONFLICT");
  assert.equal(getAmv2PublicApiError("conflict").status, 409);
  assert.match(route, /getAmv2PublicApiError\("conflict"\)/);
  assert.match(route, /remoteRevision: authoritative\.revision/);
  assert.match(route, /remoteCandidate: authoritative\.canonicalCandidate/);
  assert.match(route, /remoteDeleted: authoritative\.deleted/);
  assert.match(route, /return json\(\{[\s\S]*remoteIdentity: authoritative\.remoteIdentity[\s\S]*\}, response\.status\)/);
});

test("GET response writes the trusted claim owner after the database snapshot", () => {
  const responseStart = route.indexOf("return json({\n      ...snapshot,");
  const ownerPosition = route.indexOf("ownerUserId: userId", responseStart);
  assert.ok(responseStart >= 0);
  assert.ok(ownerPosition > responseStart);
});

test("request errors are bounded before database work", () => {
  assert.equal(getAmv2PublicApiError("calendarInvalidRequest").status, 400);
  assert.equal(getAmv2PublicApiError("operationInvalid").status, 400);
  assert.match(route, /if \(!range\) return publicError\("calendarInvalidRequest"\)/);
  assert.match(route, /parsed\.toISOString\(\)\.slice\(0, 10\) === value/);
  assert.match(route, /request\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(route, /if \(!isRecord\(parsedBody\)\) return publicError\("operationInvalid"\)/);
  assert.match(route, /Number\.isSafeInteger\(body\.expectedRevision\)/);
  assert.match(historyRoute, /if \(!parameters\) return publicError\("historyInvalidRequest"\)/);
  assert.match(historyRoute, /Number\.isSafeInteger\(snapshotRevision\)/);
});

test("POST rejects an outbox owner that differs from the trusted authenticated claim", () => {
  assert.match(route, /typeof body\.ownerUserId !== "string"/);
  assert.match(route, /if \(body\.ownerUserId !== userId\)/);
  assert.equal(getAmv2PublicApiError("accountBoundary").body.code, "ACCOUNT_BOUNDARY");
  assert.equal(getAmv2PublicApiError("accountBoundary").status, 403);
  assert.match(route, /publicError\("accountBoundary"\)/);
});

test("history backfill derives owner server-side and uses a bounded exclusive cursor plus snapshot revision", () => {
  assert.match(historyRoute, /supabase\.auth\.getClaims\(\)/);
  assert.match(historyRoute, /supabase\.rpc\("amv2_read_history_page"/);
  assert.match(historyRoute, /p_before: before/);
  assert.match(historyRoute, /p_limit: limit/);
  assert.match(historyRoute, /p_snapshot_revision: snapshotRevision/);
  assert.match(historyRoute, /limit > MAX_PAGE_SIZE/);
  assert.doesNotMatch(historyRoute, /ownerUserId.*searchParams|p_owner/);
  assert.equal(getAmv2HistoryRpcErrorKind({ code: "40001", message: "serialization" }), "historySnapshotChanged");
  assert.match(cloudClient, /normalizeHistoryPage/);
  assert.match(cloudClient, /\/api\/amv2\/sync\/history/);
});

test("idempotency/import errors are bounded and do not expose raw SQL details", () => {
  assert.equal(getAmv2OperationRpcErrorKind({ code: "22023", message: "AMV2_IDEMPOTENCY_PAYLOAD_CONFLICT" }), "idempotencyPayloadConflict");
  assert.equal(getAmv2OperationRpcErrorKind({ code: "22023", message: "AMV2_IMPORT_OCCURRENCE_CONFLICT" }), "importOccurrenceConflict");
  assert.doesNotMatch(route, /code: idempotency \? "IDEMPOTENCY"/);
  assert.equal(getAmv2PublicApiError("operationValidation").body.error, "Datele operației AMV2 nu sunt valide.");
});

test("un răspuns ACCOUNT_BOUNDARY dintr-un schimb de cont nu carantinează operația proprietarului anterior", () => {
  assert.match(cloudClient, /body\.code !== "ACCOUNT_BOUNDARY"/);
  assert.doesNotMatch(cloudClient, /\[400, 403, 413, 422\]/);
});

test("erorile AMV2 5xx rămân retryable în clientul cloud", () => {
  assert.match(cloudClient, /response\.status >= 500 \? "offline" : "unavailable"/);
  assert.match(cloudClient, /if \(response\.status >= 500\) \{[\s\S]*status: "offline"/);
});
