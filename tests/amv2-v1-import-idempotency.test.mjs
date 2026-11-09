import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  bindAccountOwner,
  createAccountSyncEnvelope,
  enqueueAccountOperation,
  getAccountOperationDependencies,
  getAccountOperationRemoteIdentity,
  markAccountOperationRetry,
  quarantineAccountOperation,
  reconcileConfirmedAccountOperation,
  recordAccountConflict,
  selectNextAccountOperation,
} from "../lib/amv2/account-sync-local.mjs";

const OWNER = "owner-r2";
const NOW = "2026-08-23T10:00:00.000Z";
const LATER = "2026-08-23T10:01:00.000Z";

function operation(operationKey, type, payload, createdAt = NOW) {
  return {
    ownerUserId: OWNER,
    operationKey,
    type,
    expectedRevision: 0,
    payload,
    createdAt,
    delivery: { status: "pending", attempts: 0, lastCode: null, lastAttemptAt: null },
  };
}

function importOperation(operationKey, destinationDate, batchKey = operationKey) {
  return operation(operationKey, "import_days", {
    batchKey,
    source: "v1_local",
    sourceDefinitionIdentity: "v1-definition:full-body",
    sourceOccurrenceIdentity: `v1-occurrence:full-body:${destinationDate}`,
    destinationDate,
    days: [{ date: destinationDate }],
  });
}

test("identitatea definiției V1 este reutilizabilă, iar destinația și operația rămân separate", () => {
  const dates = ["2026-08-20", "2026-08-21", "2026-08-22"];
  const operations = dates.map((date, index) => importOperation(`op-${index}`, date));
  assert.equal(new Set(operations.map((item) => item.payload.sourceDefinitionIdentity)).size, 1);
  assert.equal(new Set(operations.map((item) => item.payload.sourceOccurrenceIdentity)).size, 3);
  assert.equal(new Set(operations.map((item) => item.payload.destinationDate)).size, 3);
  assert.equal(new Set(operations.map((item) => item.operationKey)).size, 3);
  assert.equal(getAccountOperationRemoteIdentity(operations[0]), "import:v1-occurrence:full-body:2026-08-20");
  assert.deepEqual(getAccountOperationDependencies(operations[0]), [
    "day:2026-08-20",
    "import:v1-occurrence:full-body:2026-08-20",
  ]);
});

test("replay-ul aceleiași apariții sub un batch nou acceptă identitatea stabilă și confirmă noua operație", () => {
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  const replay = importOperation("new-operation", "2026-08-20", "new-batch");
  sync = enqueueAccountOperation(sync, replay, NOW);
  const confirmed = reconcileConfirmedAccountOperation(sync, {
    operationKey: "new-operation",
    remoteIdentity: "import:v1-occurrence:full-body:2026-08-20",
    revision: 1,
  }, LATER);
  assert.deepEqual(confirmed.envelope.outbox, []);
  assert.equal(confirmed.envelope.remoteRevisions["import:v1-occurrence:full-body:2026-08-20"], 1);
});

test("un outbox R1 persistat folosește sourceIdentity la confirmarea R2", () => {
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  const legacy = operation("legacy-import-operation", "import_days", {
    batchKey: "legacy-batch",
    source: "v1_local",
    sourceIdentity: "legacy-source-occurrence",
    days: [{ date: "2026-08-20" }],
  });
  sync = enqueueAccountOperation(sync, legacy, NOW);
  assert.equal(getAccountOperationRemoteIdentity(legacy), "import:legacy-source-occurrence");
  const confirmed = reconcileConfirmedAccountOperation(sync, {
    operationKey: legacy.operationKey,
    remoteIdentity: "import:legacy-source-occurrence",
    revision: 1,
  }, LATER);
  assert.deepEqual(confirmed.envelope.outbox, []);
});

test("eșecul tranzitoriu este durabil retryable, iar eșecul permanent este carantinat", () => {
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  sync = enqueueAccountOperation(sync, importOperation("bad-import", "2026-08-20"), NOW);
  sync = enqueueAccountOperation(sync, operation("later-independent", "upsert_day", { date: "2026-09-01" }), NOW);
  sync = markAccountOperationRetry(sync, "bad-import", { code: "OFFLINE" }, LATER);
  assert.equal(sync.outbox[0].delivery.status, "retryable");
  assert.equal(sync.outbox[0].delivery.attempts, 1);

  sync = quarantineAccountOperation(sync, "bad-import", {
    code: "IMPORT_OCCURRENCE_CONFLICT",
    message: "Import invalid",
  }, LATER);
  assert.deepEqual(sync.outbox.map((item) => item.operationKey), ["later-independent"]);
  assert.equal(sync.importBatches[0].status, "permanently_failed");
  assert.equal(sync.importBatches[0].code, "IMPORT_OCCURRENCE_CONFLICT");
  assert.equal(selectNextAccountOperation(sync, OWNER).operationKey, "later-independent");
});

test("un eșec permanent carantinează operațiile dependente existente și permite recuperarea explicită ulterioară", () => {
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  sync = enqueueAccountOperation(sync, importOperation("failed-import", "2026-08-20"), NOW);
  sync = enqueueAccountOperation(sync, operation("same-day", "upsert_day", { date: "2026-08-20" }), NOW);
  sync = enqueueAccountOperation(sync, operation("other-day", "upsert_day", { date: "2026-08-21" }), NOW);
  sync = quarantineAccountOperation(sync, "failed-import", { code: "VALIDATION", message: "Invalid" }, LATER);
  assert.equal(selectNextAccountOperation(sync, OWNER).operationKey, "other-day");
  assert.equal(sync.importBatches[0].status, "permanently_failed");
  assert.deepEqual(sync.importBatches[0].blockedOperationKeys, ["same-day"]);
  assert.deepEqual(sync.importBatches[0].quarantinedOperationKeys, ["failed-import", "same-day"]);
  assert.deepEqual(sync.outbox.map((item) => item.operationKey), ["other-day"]);

  sync = {
    ...sync,
    outbox: sync.outbox.filter((item) => item.operationKey !== "other-day"),
  };
  assert.equal(selectNextAccountOperation(sync, OWNER), null);

  sync = enqueueAccountOperation(sync, operation(
    "same-day-explicit-recovery",
    "upsert_day",
    { date: "2026-08-20" },
    "2026-08-23T10:02:00.000Z",
  ), "2026-08-23T10:02:00.000Z");
  assert.equal(selectNextAccountOperation(sync, OWNER).operationKey, "same-day-explicit-recovery");
  sync = reconcileConfirmedAccountOperation(sync, {
    operationKey: "same-day-explicit-recovery",
    remoteIdentity: "day:2026-08-20",
    revision: 1,
  }, "2026-08-23T10:03:00.000Z").envelope;
  assert.deepEqual(sync.outbox, []);
});

test("un conflict blochează operațiile ulterioare pe aceeași identitate, dar nu alte zile", () => {
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  sync = enqueueAccountOperation(sync, operation("conflicted-day", "upsert_day", { date: "2026-08-20" }), NOW);
  sync = enqueueAccountOperation(sync, operation("same-conflicted-day", "upsert_day", { date: "2026-08-20", revision: 2 }), NOW);
  sync = enqueueAccountOperation(sync, operation("independent-day", "upsert_day", { date: "2026-08-21" }), NOW);
  sync = recordAccountConflict(sync, {
    operationKey: "conflicted-day",
    remoteIdentity: "day:2026-08-20",
    remoteRevision: 1,
    remoteCandidate: { date: "2026-08-20", remote: true },
    remoteDeleted: false,
    reason: "CONCURRENT_DOMAIN_CHANGE",
  }, LATER);
  assert.equal(selectNextAccountOperation(sync, OWNER).operationKey, "independent-day");
});

test("aceeași operation key cu payload identic este idempotentă local, iar payloadul diferit este respins", () => {
  let sync = bindAccountOwner(createAccountSyncEnvelope(NOW), OWNER, NOW);
  const first = importOperation("same-operation", "2026-08-20");
  sync = enqueueAccountOperation(sync, first, NOW);
  assert.equal(enqueueAccountOperation(sync, structuredClone(first), LATER), sync);
  assert.throws(() => enqueueAccountOperation(sync, importOperation("same-operation", "2026-08-21"), LATER), /payload diferit/);
});

test("revenirea online repornește atât acoperirea istorică, cât și outbox-ul retryable", async () => {
  const client = await readFile(new URL("../components/amv2/amv2-client.tsx", import.meta.url), "utf8");
  assert.match(client, /window\.addEventListener\("online", retry\)/);
  assert.match(client, /\[connectivityGeneration, flushAccountOutbox/);
  assert.match(client, /setHistoryBackfillTrigger/);
});
