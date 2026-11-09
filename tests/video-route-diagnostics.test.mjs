import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  VIDEO_METADATA_DIAGNOSTIC_EVENT,
  VIDEO_METADATA_QUERY_ERROR_CODE,
  classifyVideoMetadataQuery,
  createVideoMetadataQueryErrorBody,
  createVideoMetadataRequestId,
  createVideoMetadataResponseHeaders,
  emitVideoMetadataDiagnostic,
} from "../app/api/exercises/[exerciseKey]/video/diagnostics.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function captureDiagnostic(classification, stage, requestId) {
  const entries = [];
  const logger = {
    info: (message) => entries.push({ level: "info", message }),
    error: (message) => entries.push({ level: "error", message }),
  };

  emitVideoMetadataDiagnostic(logger, classification, stage, requestId);
  assert.equal(entries.length, 1);
  return {
    level: entries[0].level,
    serialized: entries[0].message,
    entry: JSON.parse(entries[0].message),
  };
}

test("QUERY ERROR, NO DATA și SUCCESS sunt clasificări distincte", () => {
  const rawError = { message: "RAW_MESSAGE_CANARY" };
  const successData = { exercise_key: "alergare-pe-loc" };

  assert.deepEqual(classifyVideoMetadataQuery(null, rawError), { classification: "QUERY_ERROR" });
  assert.deepEqual(classifyVideoMetadataQuery(null, null), { classification: "NO_DATA" });
  assert.deepEqual(classifyVideoMetadataQuery(successData, null), {
    classification: "SUCCESS",
    data: successData,
  });
});

test("ruta metadata folosește exclusiv clientul public anonim read-only", async () => {
  const [route, publicClient, migration] = await Promise.all([
    read("app/api/exercises/[exerciseKey]/video/route.ts"),
    read("utils/supabase/public-server.ts"),
    read("supabase/migrations/202608040004_vemi_exercise_videos.sql"),
  ]);

  assert.match(route, /createPublicCatalogClient/);
  assert.match(route, /utils\/supabase\/public-server/);
  assert.match(route, /const supabase = createPublicCatalogClient\(\);/);
  assert.equal((route.match(/createPublicCatalogClient\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(route, /utils\/supabase\/server|await createClient\(|createServerClient|cookies\(|service[_-]?role/i);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);

  assert.match(publicClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(publicClient, /persistSession: false/);
  assert.match(publicClient, /autoRefreshToken: false/);
  assert.match(publicClient, /detectSessionInUrl: false/);
  assert.doesNotMatch(publicClient, /createServerClient|cookies\(|service[_-]?role|SUPABASE_SECRET/i);

  assert.match(migration, /for select\s+to anon, authenticated\s+using \(\s+is_active = true/s);
  assert.match(migration, /grant select on table public\.exercise_videos to anon, authenticated/);
});

test("QUERY ERROR expune numai un cod generic și telemetrie allowlistată", () => {
  const canaries = [
    "RAW_MESSAGE_CANARY",
    "PRIVATE_KEY_CANARY",
    "COOKIE_VALUE_CANARY",
    "TOKEN_VALUE_CANARY",
    "SIGNED_URL_CANARY",
  ];
  const rawError = {
    message: canaries[0],
    details: canaries[1],
    hint: canaries[2],
    stack: `${canaries[3]} ${canaries[4]}`,
  };
  const requestId = "00000000-0000-4000-8000-000000000001";
  const outcome = classifyVideoMetadataQuery(null, rawError);
  const diagnostic = captureDiagnostic(outcome.classification, "metadata_query", requestId);
  const publicBody = createVideoMetadataQueryErrorBody();
  const externallyVisible = JSON.stringify({ publicBody, telemetry: diagnostic.entry });

  assert.equal(diagnostic.level, "error");
  assert.deepEqual(publicBody, { available: false, code: VIDEO_METADATA_QUERY_ERROR_CODE });
  assert.deepEqual(Object.keys(diagnostic.entry).sort(), [
    "classification",
    "event",
    "requestId",
    "stage",
    "timestamp",
  ]);
  assert.equal(diagnostic.entry.event, VIDEO_METADATA_DIAGNOSTIC_EVENT);
  assert.equal(diagnostic.entry.classification, "QUERY_ERROR");
  assert.equal(diagnostic.entry.stage, "metadata_query");
  assert.equal(diagnostic.entry.requestId, requestId);
  assert.ok(Number.isFinite(Date.parse(diagnostic.entry.timestamp)));
  for (const canary of canaries) assert.doesNotMatch(externallyVisible, new RegExp(canary));
});

test("NO DATA păstrează 404 indisponibil, iar QUERY ERROR folosește 503 distinct", async () => {
  const route = await read("app/api/exercises/[exerciseKey]/video/route.ts");
  const queryErrorBranch = route.slice(
    route.indexOf('queryResult.classification === "QUERY_ERROR"'),
    route.indexOf('queryResult.classification === "NO_DATA"'),
  );
  const noDataBranch = route.slice(
    route.indexOf('queryResult.classification === "NO_DATA"'),
    route.indexOf("const video = queryResult.data"),
  );

  assert.match(queryErrorBranch, /createVideoMetadataQueryErrorBody\(\)/);
  assert.match(queryErrorBranch, /status: 503/);
  assert.match(noDataBranch, /\{ available: false \}/);
  assert.match(noDataBranch, /status: 404/);
  assert.doesNotMatch(noDataBranch, /VIDEO_METADATA_QUERY_ERROR/);
});

test("SUCCESS păstrează contractul video și nu loghează URL-urile semnate", async () => {
  const route = await read("app/api/exercises/[exerciseKey]/video/route.ts");
  const successBranch = route.slice(
    route.indexOf('emitVideoMetadataDiagnostic(console, "SUCCESS"'),
    route.indexOf("} catch"),
  );

  for (const field of [
    "available: true",
    "exerciseKey: video.exercise_key",
    "exerciseName:",
    "url,",
    "posterUrl,",
    "mimeType: video.mime_type",
    "durationSeconds: video.duration_seconds",
  ]) {
    assert.match(successBranch, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(route, /emitVideoMetadataDiagnostic\(console, "SUCCESS", "response", requestId\)/);
  assert.doesNotMatch(
    await read("app/api/exercises/[exerciseKey]/video/diagnostics.ts"),
    /video_object_key|poster_object_key|signed|url\b/i,
  );
});

test("fiecare răspuns are corelare UUID și cache privat no-store", () => {
  const firstRequestId = createVideoMetadataRequestId();
  const secondRequestId = createVideoMetadataRequestId();
  const headers = createVideoMetadataResponseHeaders(firstRequestId);

  assert.match(firstRequestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(firstRequestId, secondRequestId);
  assert.deepEqual(headers, {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "X-Request-ID": firstRequestId,
  });
});

test("cele trei excepții intenționate rămân în catalog, nu în ruta metadata", async () => {
  const [catalog, eligibility, route] = await Promise.all([
    read("lib/exercises/live-catalog.ts"),
    read("lib/exercises/video-eligibility.mjs"),
    read("app/api/exercises/[exerciseKey]/video/route.ts"),
  ]);

  for (const exerciseKey of [
    "mers-rapid-pe-banda",
    "bicicleta-stationara",
    "bicicleta-eliptica",
  ]) {
    assert.match(eligibility, new RegExp(`"${exerciseKey}"`));
    assert.doesNotMatch(catalog, new RegExp(exerciseKey));
    assert.doesNotMatch(route, new RegExp(exerciseKey));
  }
});

test("playerul și CSS-ul nu sunt modificate de instrumentarea rutei", () => {
  const changedProtectedFiles = execFileSync(
    "git",
    ["diff", "--name-only", "--", "components/exercise-video.tsx", "app/globals.css"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  ).trim();

  assert.equal(changedProtectedFiles, "");
});
