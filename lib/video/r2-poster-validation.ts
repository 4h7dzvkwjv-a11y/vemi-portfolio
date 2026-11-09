import "server-only";

import { constantTimeEqualHex, sha256Hex } from "./digest";
import { headR2Object, readR2Object } from "./r2";
import {
  EXERCISE_POSTER_CONTENT_TYPE,
  MAX_EXERCISE_POSTER_BYTES,
} from "./upload-policy";

export type StoredExercisePosterMetadata = {
  contentType: typeof EXERCISE_POSTER_CONTENT_TYPE;
  fileSizeBytes: number;
  sha256: string;
  width: number;
  height: number;
};

export class StoredExercisePosterError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "StoredExercisePosterError";
  }
}

function readPngDimensions(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (view.byteLength < 24 || signature.some((value, index) => view.getUint8(index) !== value)) {
    throw new StoredExercisePosterError("Posterul generat nu este o imagine PNG validă.");
  }
  const chunkType = String.fromCharCode(
    view.getUint8(12),
    view.getUint8(13),
    view.getUint8(14),
    view.getUint8(15),
  );
  if (chunkType !== "IHDR") throw new StoredExercisePosterError("Posterul PNG nu conține metadate valide.");
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function validateStoredExercisePoster(
  objectKey: string,
  expected: { fileSizeBytes: number; sha256: string; width: number; height: number },
): Promise<StoredExercisePosterMetadata> {
  const head = await headR2Object(objectKey);
  if (!head) throw new StoredExercisePosterError("Posterul generat nu există în R2.", 404);
  if (head.contentLength <= 0 || head.contentLength > MAX_EXERCISE_POSTER_BYTES) {
    throw new StoredExercisePosterError("Posterul generat depășește limita permisă.");
  }
  if (head.contentLength !== expected.fileSizeBytes) {
    throw new StoredExercisePosterError("Dimensiunea posterului din R2 nu corespunde fișierului confirmat.");
  }
  if (head.contentType?.split(";", 1)[0].trim().toLowerCase() !== EXERCISE_POSTER_CONTENT_TYPE) {
    throw new StoredExercisePosterError("Posterul generat are un tip incompatibil.");
  }

  const bytes = await readR2Object(objectKey, MAX_EXERCISE_POSTER_BYTES);
  const digest = await sha256Hex(bytes);
  if (!constantTimeEqualHex(digest, expected.sha256.toLowerCase())) {
    throw new StoredExercisePosterError("Amprenta posterului din R2 nu corespunde fișierului generat.");
  }
  const dimensions = readPngDimensions(bytes);
  if (
    dimensions.width !== expected.width
    || dimensions.height !== expected.height
    || dimensions.width !== dimensions.height
    || dimensions.width < 160
    || dimensions.width > 1080
  ) {
    throw new StoredExercisePosterError("Posterul trebuie să fie o imagine pătrată 1:1 validă.");
  }

  return {
    contentType: EXERCISE_POSTER_CONTENT_TYPE,
    fileSizeBytes: head.contentLength,
    sha256: digest,
    width: dimensions.width,
    height: dimensions.height,
  };
}
