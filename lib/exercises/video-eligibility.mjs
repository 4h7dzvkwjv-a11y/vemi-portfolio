export const INTENTIONALLY_WITHOUT_VIDEO_KEYS = Object.freeze([
  "mers-rapid-pe-banda",
  "bicicleta-stationara",
  "bicicleta-eliptica",
]);

const intentionallyWithoutVideo = new Set(INTENTIONALLY_WITHOUT_VIDEO_KEYS);

const isText = (value) => typeof value === "string" && value.trim().length > 0;

function isSafeObjectKey(value) {
  if (!isText(value)) return false;
  const key = value.trim();
  return !key.startsWith("/")
    && !key.includes("..")
    && !key.includes("\\")
    && !key.includes("//")
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(key)
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key);
}

function isPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function isEligibleVideoRow(row) {
  if (!row || typeof row !== "object" || row.is_active !== true) return false;
  if (!isSafeObjectKey(row.video_object_key)) return false;
  if (row.poster_object_key !== null
    && row.poster_object_key !== undefined
    && !isSafeObjectKey(row.poster_object_key)) return false;
  if (row.mime_type !== "video/mp4") return false;
  if (!isPositiveNumber(row.duration_seconds) || !isPositiveNumber(row.file_size_bytes)) return false;
  if (!isPositiveNumber(row.width_pixels) || !isPositiveNumber(row.height_pixels)) return false;
  return Number(row.width_pixels) === Number(row.height_pixels);
}

export function normalizeAuthoritativeVideoEligibility({ canonicalExerciseKeys, videoRows }) {
  if (!Array.isArray(canonicalExerciseKeys) || !Array.isArray(videoRows)) {
    throw new TypeError("Video eligibility requires canonicalExerciseKeys and videoRows arrays.");
  }

  const canonicalKeys = canonicalExerciseKeys.map((value) => {
    if (!isText(value)) throw new TypeError("Canonical exercise keys must be non-empty strings.");
    return value.trim();
  });
  const canonicalKeySet = new Set(canonicalKeys);
  if (canonicalKeySet.size !== canonicalKeys.length) {
    throw new TypeError("Canonical exercise keys must be unique.");
  }

  const rowsByExercise = new Map();
  for (const row of videoRows) {
    const exerciseKey = isText(row?.exercise_key) ? row.exercise_key.trim() : null;
    if (!exerciseKey || !canonicalKeySet.has(exerciseKey)) continue;
    rowsByExercise.set(exerciseKey, [...(rowsByExercise.get(exerciseKey) ?? []), row]);
  }

  return new Map(canonicalKeys.map((exerciseKey) => {
    if (intentionallyWithoutVideo.has(exerciseKey)) return [exerciseKey, "not-required"];
    const rows = rowsByExercise.get(exerciseKey) ?? [];
    return [exerciseKey, rows.length === 1 && isEligibleVideoRow(rows[0]) ? "available" : "missing"];
  }));
}
