import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  INTENTIONALLY_WITHOUT_VIDEO_KEYS,
  normalizeAuthoritativeVideoEligibility,
} from "../lib/exercises/video-eligibility.mjs";
import {
  selectPlayableExerciseKeys,
} from "../lib/exercises/catalog-delivery.mjs";
import { CANONICAL_EXERCISE_CATALOG } from "../lib/amv2/exercise-catalog.mjs";
import { catalog as activeCatalogFixture } from "./helpers/plan-engine-v2-fixture.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const validVideo = (exerciseKey, overrides = {}) => ({
  exercise_key: exerciseKey,
  video_object_key: `exercise-videos/${exerciseKey}/video.mp4`,
  poster_object_key: `exercise-videos/${exerciseKey}/poster.png`,
  mime_type: "video/mp4",
  duration_seconds: 12.5,
  width_pixels: 1080,
  height_pixels: 1080,
  file_size_bytes: 1024,
  is_active: true,
  ...overrides,
});

test("adaptorul authoritative validează rândul complet și păstrează posterul opțional al playerului existent", () => {
  const canonicalKeys = ["flotari", "plank", "ramat-haltera"];
  const eligibility = normalizeAuthoritativeVideoEligibility({
    canonicalExerciseKeys: canonicalKeys,
    videoRows: [
      validVideo("flotari"),
      validVideo("plank", { poster_object_key: null }),
      validVideo("ramat-haltera", { poster_object_key: "../unsafe.png" }),
    ],
  });

  assert.equal(eligibility.get("flotari"), "available");
  assert.equal(eligibility.get("plank"), "available");
  assert.equal(eligibility.get("ramat-haltera"), "missing");
});

test("adaptorul eșuează sigur pentru media inactivă, lipsă, malformed, non-square sau duplicată", () => {
  const canonicalKeys = ["flotari", "plank", "ramat-haltera", "impins-gantere", "genuflexiuni"];
  const eligibility = normalizeAuthoritativeVideoEligibility({
    canonicalExerciseKeys: canonicalKeys,
    videoRows: [
      validVideo("flotari", { is_active: false }),
      validVideo("plank", { video_object_key: "" }),
      validVideo("ramat-haltera", { video_object_key: "https://example.test/video.mp4" }),
      validVideo("impins-gantere", { width_pixels: 1920, height_pixels: 1080 }),
      validVideo("genuflexiuni"),
      validVideo("genuflexiuni", { video_object_key: "exercise-videos/duplicate/video.mp4" }),
    ],
  });

  for (const key of canonicalKeys) assert.equal(eligibility.get(key), "missing", key);
});

test("identitatea media este exclusiv canonical exercise_key; aliasurile și cheile necunoscute nu se atașează", () => {
  const eligibility = normalizeAuthoritativeVideoEligibility({
    canonicalExerciseKeys: ["flotari"],
    videoRows: [
      validVideo("push-ups"),
      validVideo("flotari"),
    ],
  });

  assert.deepEqual([...eligibility], [["flotari", "available"]]);
  assert.equal(eligibility.has("push-ups"), false);
});

test("cele trei excepții canonice rămân not-required chiar dacă o sursă malformed încearcă să le asocieze", () => {
  const canonicalKeys = [...INTENTIONALLY_WITHOUT_VIDEO_KEYS];
  const eligibility = normalizeAuthoritativeVideoEligibility({
    canonicalExerciseKeys: canonicalKeys,
    videoRows: canonicalKeys.map((key) => validVideo(key)),
  });

  assert.deepEqual(canonicalKeys.sort(), [
    "bicicleta-eliptica",
    "bicicleta-stationara",
    "mers-rapid-pe-banda",
  ]);
  for (const key of canonicalKeys) assert.equal(eligibility.get(key), "not-required", key);
});

test("AMV2 proiectează Play numai din catalogul live normalizat, nu din manifestul static stale", () => {
  const intentional = new Set(INTENTIONALLY_WITHOUT_VIDEO_KEYS);
  const payload = {
    source: "live",
    contractVersion: "vemi-plan-engine-rules-v2.0:90dbf41cb202089cc8e39f80c49b115cd8ca93904282802e841b64e21302f8de:114",
    exercises: activeCatalogFixture.map((exercise) => ({
      ...exercise,
      videoState: intentional.has(exercise.id) ? "not-required" : "available",
    })),
    collections: [...new Set(activeCatalogFixture.flatMap((exercise) => exercise.memberships.map((item) => item.collectionKey)))],
    metrics: {
      activeExercises: 114,
      memberships: activeCatalogFixture.reduce((count, exercise) => count + exercise.memberships.length, 0),
      aliases: activeCatalogFixture.reduce((count, exercise) => count + exercise.aliases.length, 0),
      videoAssociations: 111,
    },
  };

  const playable = selectPlayableExerciseKeys(payload);
  assert.equal(playable.size, 111);
  assert.equal(playable.has("flotari"), true);
  for (const key of intentional) assert.equal(playable.has(key), false, key);
  assert.equal(Object.hasOwn(CANONICAL_EXERCISE_CATALOG[0], "videoAvailable"), false);
});

test("integrarea AMV2 încarcă o singură dată catalogul live și nu persistă URL-uri media", async () => {
  const [client, panel, editor, dayCard, catalogSource] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/editable-exercise-card.tsx"),
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("lib/amv2/exercise-catalog.mjs"),
  ]);

  assert.match(client, /fetchActiveCatalog\(\{ signal: controller\.signal \}\)/);
  assert.match(client, /selectPlayableExerciseKeys/);
  assert.match(client, /setPlayableExerciseKeys\(new Set\(\)\)/);
  assert.match(panel, /playable=\{playableExerciseKeys\.has\(exercise\.exerciseKey\)\}/);
  assert.match(editor, /working\.reference\.source === "canonical"\s*&& templateKey !== null\s*&& playableExerciseKeys\.has\(templateKey\)/);
  assert.match(dayCard, /exercise\.reference\.source === "canonical"\s*&& templateKey !== null\s*&& playableExerciseKeys\.has\(templateKey\)/);
  assert.match(panel, /playable=\{false\}/);
  assert.doesNotMatch(client + panel + editor + dayCard, /posterUrl|video_object_key|signedUrl|final_video_object_key/);
  assert.doesNotMatch(catalogSource, /VEMI_Manifest_Content_Complete|pending_admin_upload|final_video_object_key/);
});
