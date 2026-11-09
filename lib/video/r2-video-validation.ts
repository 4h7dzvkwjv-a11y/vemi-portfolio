import "server-only";

import { constantTimeEqualHex, sha256Hex } from "./digest";
import { validateExerciseVideoMp4 } from "./mp4-validator";
import { headR2Object, readR2Object } from "./r2";
import { MAX_EXERCISE_VIDEO_BYTES } from "./upload-policy";

export type ExpectedStoredExerciseVideo = {
  fileSizeBytes: number;
  sha256: string;
  width: number;
  height: number;
  durationMilliseconds: number;
};

export class StoredExerciseVideoError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
  }
}

export async function validateStoredExerciseVideo(objectKey: string, expected: ExpectedStoredExerciseVideo) {
  const head = await headR2Object(objectKey);
  if (!head) throw new StoredExerciseVideoError("Obiectul încărcat nu există în R2.", 404);
  if (head.contentLength <= 0) throw new StoredExerciseVideoError("Obiectul încărcat este gol.");
  if (head.contentLength > MAX_EXERCISE_VIDEO_BYTES) {
    throw new StoredExerciseVideoError("Fișierul depășește limita de 25 MB.", 413);
  }
  if (head.contentLength !== expected.fileSizeBytes) {
    throw new StoredExerciseVideoError("Dimensiunea obiectului din R2 nu corespunde fișierului pregătit.", 409);
  }
  if (head.contentType && head.contentType.split(";")[0].trim().toLowerCase() !== "video/mp4") {
    throw new StoredExerciseVideoError("Obiectul din R2 nu are tipul MP4 declarat.", 415);
  }

  const bytes = await readR2Object(objectKey, MAX_EXERCISE_VIDEO_BYTES);
  const actualSha256 = await sha256Hex(bytes);
  if (!constantTimeEqualHex(actualSha256, expected.sha256.toLowerCase())) {
    throw new StoredExerciseVideoError("Fișierul din R2 nu corespunde fișierului verificat local.", 409);
  }
  const validation = validateExerciseVideoMp4(bytes);
  if (!validation.valid) throw new StoredExerciseVideoError(validation.message);
  if (
    validation.metadata.fileSizeBytes !== expected.fileSizeBytes
    || validation.metadata.width !== expected.width
    || validation.metadata.height !== expected.height
    || Math.abs(Math.round(validation.metadata.durationSeconds * 1000) - expected.durationMilliseconds) > 1
  ) {
    throw new StoredExerciseVideoError("Metadatele reale ale videoclipului nu corespund încărcării pregătite.", 409);
  }
  return { ...validation.metadata, sha256: actualSha256 };
}
