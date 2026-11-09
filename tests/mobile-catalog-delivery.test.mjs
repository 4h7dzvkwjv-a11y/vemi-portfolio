import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACTIVE_CATALOG_CONTRACT_VERSION,
  ACTIVE_CATALOG_ENDPOINT,
  createCatalogRequestGate,
  fetchActiveCatalog,
  loadCatalogWithControlledRetry,
  validateActiveCatalogPayload,
} from "../lib/exercises/catalog-delivery.mjs";
import {
  ACTIVE_CATALOG_RESPONSE_HEADERS,
  handleActiveCatalogRequest,
} from "../lib/exercises/catalog-api.mjs";
import { resolvePublicV2Plan } from "../lib/plan-engine/public-v2-integration.mjs";
import { createFreePlanGenerationGate } from "../utils/progress/free-plan-state.mjs";
import { catalog, registry } from "./helpers/plan-engine-v2-fixture.mjs";

const collections = [...new Set(catalog.flatMap((exercise) =>
  exercise.memberships.map((membership) => membership.collectionKey),
))];

const validPayload = {
  source: "live",
  contractVersion: ACTIVE_CATALOG_CONTRACT_VERSION,
  exercises: catalog,
  collections,
  metrics: {
    activeExercises: catalog.length,
    memberships: catalog.reduce((total, exercise) => total + exercise.memberships.length, 0),
    aliases: catalog.reduce((total, exercise) => total + exercise.aliases.length, 0),
    videoAssociations: 5,
  },
};

const expectedContractVersion = `${registry.schema_version}:${registry.source_manifest.sha256}:${catalog.length}`;

function jsonResponse(payload = validPayload, init = {}) {
  return Response.json(payload, init);
}

test("catalogul activ răspunde identic pentru iPhone/Safari și desktop", async () => {
  assert.equal(ACTIVE_CATALOG_CONTRACT_VERSION, expectedContractVersion);
  const iphoneRequest = new Request("https://example.test/api/exercise-catalog", {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
    },
  });
  const desktopRequest = new Request("https://example.test/api/exercise-catalog", {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15" },
  });

  const [iphoneResponse, desktopResponse] = await Promise.all([
    handleActiveCatalogRequest(iphoneRequest, async () => validPayload),
    handleActiveCatalogRequest(desktopRequest, async () => validPayload),
  ]);
  const [iphonePayload, desktopPayload] = await Promise.all([
    iphoneResponse.json(),
    desktopResponse.json(),
  ]);

  assert.equal(iphoneResponse.status, 200);
  assert.equal(desktopResponse.status, 200);
  assert.equal(iphonePayload.exercises.length, 114);
  assert.equal(iphonePayload.metrics.activeExercises, 114);
  assert.equal(iphonePayload.exercises.filter((exercise) => exercise.is_active === false).length, 0);
  assert.deepEqual(iphonePayload, desktopPayload);
  assert.match(iphoneResponse.headers.get("cache-control"), /private/);
  assert.match(iphoneResponse.headers.get("cache-control"), /no-store/);
  assert.equal(iphoneResponse.headers.get("x-vemi-catalog-version"), ACTIVE_CATALOG_CONTRACT_VERSION);
});

test("răspunsul gol nu este acceptat sau memorat ca succes", async () => {
  const emptyPayload = {
    ...validPayload,
    exercises: [],
    metrics: { ...validPayload.metrics, activeExercises: 0 },
  };
  const validation = validateActiveCatalogPayload(emptyPayload);
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /exact 114|nu este 114/i);

  const response = await handleActiveCatalogRequest(
    new Request("https://example.test/api/exercise-catalog"),
    async () => emptyPayload,
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    contractVersion: ACTIVE_CATALOG_CONTRACT_VERSION,
  });
});

test("cold load și rețeaua lentă rămân loading până la snapshot-ul complet", async () => {
  let releaseResponse;
  const delayedResponse = new Promise((resolve) => { releaseResponse = resolve; });
  const states = ["loading"];
  let activeExercises = 0;
  let unsafeGenerations = 0;

  const loading = fetchActiveCatalog({
    maxAttempts: 1,
    fetchImpl: async (url, init) => {
      assert.equal(url, ACTIVE_CATALOG_ENDPOINT);
      assert.equal(init.cache, "no-store");
      assert.equal(init.credentials, "same-origin");
      return delayedResponse;
    },
  }).then((payload) => {
    activeExercises = payload.exercises.length;
    states.push("ready");
    return payload;
  });

  await Promise.resolve();
  assert.deepEqual(states, ["loading"]);
  assert.equal(activeExercises, 0);
  assert.equal(unsafeGenerations, 0);
  releaseResponse(jsonResponse());
  const payload = await loading;
  assert.deepEqual(states, ["loading", "ready"]);
  assert.equal(payload.exercises.length, 114);
  assert.equal(activeExercises, 114);
  assert.equal(unsafeGenerations, 0);
});

test("o eroare tranzitorie are exact două încercări, fără retry loop", async () => {
  let calls = 0;
  const requestedUrls = [];
  const payload = await fetchActiveCatalog({
    fetchImpl: async (url) => {
      calls += 1;
      requestedUrls.push(url);
      return calls === 1 ? jsonResponse({ status: "unavailable" }, { status: 503 }) : jsonResponse();
    },
  });
  assert.equal(calls, 2);
  assert.equal(payload.exercises.length, 114);
  assert.equal(requestedUrls[0], ACTIVE_CATALOG_ENDPOINT);
  assert.match(requestedUrls[1], /catalog_contract=/);
  assert.match(requestedUrls[1], /catalog_attempt=2/);

  calls = 0;
  await assert.rejects(
    fetchActiveCatalog({ fetchImpl: async () => { calls += 1; return jsonResponse({}, { status: 503 }); } }),
    /status 503/,
  );
  assert.equal(calls, 2);
});

test("retry-ul server este limitat și nu păstrează prima stare goală", async () => {
  let calls = 0;
  const payload = await loadCatalogWithControlledRetry(async () => {
    calls += 1;
    return calls === 1 ? { ...validPayload, exercises: [] } : validPayload;
  });
  assert.equal(calls, 2);
  assert.equal(payload.metrics.activeExercises, 114);
});

test("un răspuns vechi nu poate suprascrie catalogul valid", () => {
  const gate = createCatalogRequestGate();
  let activeCatalog = null;
  const staleToken = gate.begin();
  const currentToken = gate.begin();

  if (gate.isCurrent(currentToken)) activeCatalog = validPayload;
  if (gate.isCurrent(staleToken)) activeCatalog = { ...validPayload, exercises: [] };

  assert.equal(gate.isCurrent(staleToken), false);
  assert.equal(gate.isCurrent(currentToken), true);
  assert.equal(activeCatalog.exercises.length, 114);
});

test("un payload cache-uit cu versiune veche este respins, apoi recuperat controlat", async () => {
  let calls = 0;
  const oldPayload = { ...validPayload, contractVersion: "vemi-plan-engine-rules-v1:73" };
  const recovered = await fetchActiveCatalog({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(calls === 1 ? oldPayload : validPayload);
    },
  });
  assert.equal(calls, 2);
  assert.equal(recovered.contractVersion, ACTIVE_CATALOG_CONTRACT_VERSION);
  assert.equal(recovered.exercises.length, 114);
  assert.match(ACTIVE_CATALOG_RESPONSE_HEADERS["Cache-Control"], /no-store/);
  assert.equal(ACTIVE_CATALOG_RESPONSE_HEADERS["CDN-Cache-Control"], "no-store");
});

test("Plan Engine așteaptă catalogul ready și generează o singură dată după acțiunea explicită", async () => {
  const profile = {
    gender: "masculin",
    age: "cat2",
    goal: "masa",
    place: "sala",
    program: "incepator-3",
    engineVersion: "v2",
  };
  const generationGate = createFreePlanGenerationGate();
  let catalogReady = false;
  let generations = 0;
  let v1Fallbacks = 0;

  const chooseFinalCard = () => {
    if (!catalogReady) return null;
    const token = generationGate.begin();
    if (token === null) return null;
    generations += 1;
    const resolution = resolvePublicV2Plan(profile, validPayload.exercises, registry);
    v1Fallbacks += resolution.fallbackUsed ? 1 : 0;
    return resolution;
  };

  assert.equal(chooseFinalCard(), null);
  assert.equal(generations, 0);
  const delivered = await fetchActiveCatalog({ maxAttempts: 1, fetchImpl: async () => jsonResponse() });
  catalogReady = validateActiveCatalogPayload(delivered).valid;
  assert.equal(generations, 0, "catalog recovery must not auto-generate");
  const resolution = chooseFinalCard();
  assert.equal(resolution.status, "found");
  assert.equal(chooseFinalCard(), null, "double click must not generate twice");
  assert.equal(generations, 1);
  assert.equal(v1Fallbacks, 0);
});

test("integrarea folosește aceeași rută anonimă, same-origin, fără ramură mobilă", async () => {
  const [clientPage, publicClient, liveLoader, route] = await Promise.all([
    readFile(new URL("../components/vemi-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../utils/supabase/public-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/exercises/live-catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exercise-catalog/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(clientPage, /fetchActiveCatalog\(\{/);
  assert.match(clientPage, /catalogStatus.*"loading".*"ready".*"error"/s);
  assert.match(clientPage, /catalogRequestGateRef\.current\.isCurrent\(token\)/);
  assert.match(clientPage, /catalogAbortRef\.current\?\.abort\(\)/);
  assert.match(clientPage, /disabled=\{currentStep\.key === "program".*!catalogReadyForV2/s);
  assert.doesNotMatch(clientPage, /navigator\.userAgent|window\.innerWidth|matchMedia/);
  assert.match(publicClient, /createClient/);
  assert.doesNotMatch(publicClient, /createServerClient|cookies\(|service[_-]?role/i);
  assert.match(liveLoader, /createPublicCatalogClient\(\)/);
  assert.match(liveLoader, /validateV2Registry\(exercises, point2Registry\)/);
  assert.match(route, /handleActiveCatalogRequest/);
});
