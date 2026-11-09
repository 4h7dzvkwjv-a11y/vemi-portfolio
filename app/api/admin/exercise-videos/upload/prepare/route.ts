import { getActiveAdminExerciseByKey } from "../../../../../../lib/exercises/admin-catalog";
import {
  describeAcceptedExerciseVideoResolutions,
  exerciseVideoUploadObjectKeys,
  isAcceptedExerciseVideoDimensions,
  isSafeSha256Hex,
  isSafeUploadMutationId,
  MAX_EXERCISE_VIDEO_BYTES,
} from "../../../../../../lib/video/upload-policy";
import {
  cleanupStaleExerciseVideoUploads,
  createTemporaryR2UploadUrl,
  deleteR2Object,
  headR2Object,
  probeR2BrowserUploadCors,
} from "../../../../../../lib/video/r2";
import {
  createExerciseVideoIntentToken,
  intentExpiry,
  type UploadIntent,
} from "../../../../../../lib/video/upload-intent";
import { getAdminContext } from "../../../../../../utils/admin/server";
import {
  adminUploadError,
  adminUploadSuccess,
  describeRequestError,
  exercisePayload,
  isSameOriginAdminRequest,
  readSmallJson,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PrepareBody = {
  exerciseKey?: unknown;
  mutationId?: unknown;
  file?: {
    name?: unknown;
    type?: unknown;
    size?: unknown;
    sha256?: unknown;
    width?: unknown;
    height?: unknown;
    durationSeconds?: unknown;
  };
};

function invalidDeclaration(body: PrepareBody) {
  const file = body.file;
  if (typeof body.exerciseKey !== "string" || typeof body.mutationId !== "string") return "Exercițiul sau identificatorul încărcării lipsește.";
  if (!isSafeUploadMutationId(body.mutationId)) return "Identificatorul încărcării este invalid.";
  if (!file || typeof file.name !== "string" || !file.name.toLocaleLowerCase("ro").endsWith(".mp4")) return "Este acceptat numai formatul MP4.";
  if (file.type !== "video/mp4") return "Este acceptat numai formatul MP4.";
  if (!Number.isInteger(file.size) || Number(file.size) <= 0) return "Fișierul video este gol.";
  if (Number(file.size) > MAX_EXERCISE_VIDEO_BYTES) return "Fișierul depășește limita de 25 MB.";
  if (typeof file.sha256 !== "string" || !isSafeSha256Hex(file.sha256)) return "Amprenta fișierului este invalidă.";
  if (!Number.isInteger(file.width) || !Number.isInteger(file.height) || !isAcceptedExerciseVideoDimensions(Number(file.width), Number(file.height))) {
    return `Videoclipul trebuie să aibă una dintre rezoluțiile acceptate (${describeAcceptedExerciseVideoResolutions()}). Fișierul selectat are rezoluția ${String(file.width)} × ${String(file.height)}.`;
  }
  if (typeof file.durationSeconds !== "number" || !Number.isFinite(file.durationSeconds) || file.durationSeconds <= 0) {
    return "Durata videoclipului nu a putut fi verificată.";
  }
  return null;
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.authorized) {
    return adminUploadError(admin.status === 401 ? "Autentificarea este necesară." : "Accesul este restricționat.", admin.status);
  }
  if (!isSameOriginAdminRequest(request)) return adminUploadError("Originea cererii nu este permisă.", 403);

  let body: PrepareBody;
  try {
    body = await readSmallJson(request) as PrepareBody;
  } catch (error) {
    const described = describeRequestError(error);
    return adminUploadError(described.message, described.status);
  }
  const declarationError = invalidDeclaration(body);
  if (declarationError) return adminUploadError(declarationError, declarationError.includes("25 MB") ? 413 : 400);

  const exercise = await getActiveAdminExerciseByKey(admin.supabase, body.exerciseKey as string);
  if (!exercise) return adminUploadError("Exercițiul selectat nu există în catalog.", 400);

  const file = body.file!;
  const mutationId = body.mutationId as string;
  const keys = exerciseVideoUploadObjectKeys(exercise.exerciseKey, mutationId);
  try {
    const { data: currentRow, error: currentError } = await admin.supabase
      .from("exercise_videos")
      .select("video_object_key, width_pixels, height_pixels, duration_seconds, file_size_bytes, updated_at, is_active")
      .eq("exercise_key", exercise.exerciseKey)
      .maybeSingle();
    if (currentError) throw new Error(`Supabase preparation read failed: ${currentError.code ?? "unknown"}`);
    if (currentRow?.video_object_key === keys.finalObjectKey && currentRow.is_active === true) {
      return adminUploadSuccess({ alreadyAssociated: true, exercise: exercisePayload(exercise, currentRow) });
    }

    try {
      await cleanupStaleExerciseVideoUploads();
    } catch (cleanupError) {
      console.error("VEMI stale direct-upload cleanup deferred", cleanupError instanceof Error ? cleanupError.message : "unknown error");
    }

    for (const objectKey of [keys.uploadObjectKey, keys.verifiedObjectKey, keys.finalObjectKey]) {
      const existing = await headR2Object(objectKey);
      if (existing) await deleteR2Object(objectKey);
    }

    const requestOrigin = new URL(request.headers.get("origin") ?? new URL(request.url).origin).origin;
    const signedUpload = await createTemporaryR2UploadUrl(keys.uploadObjectKey, "video/mp4");
    let preflight;
    try {
      preflight = await probeR2BrowserUploadCors(signedUpload.url, requestOrigin, ["content-type"]);
    } catch (preflightError) {
      console.error("VEMI R2 direct-upload preflight unavailable", {
        exerciseKey: exercise.exerciseKey,
        origin: requestOrigin,
        message: preflightError instanceof Error ? preflightError.message : "unknown error",
      });
      return adminUploadError(
        "Preflightul CORS pentru încărcarea directă în R2 nu a putut fi contactat. Videoclipul existent a fost păstrat.",
        502,
        { stage: "cors-preflight", code: "R2_CORS_PREFLIGHT_UNAVAILABLE" },
      );
    }
    if (!preflight.ok) {
      console.error("VEMI R2 direct-upload preflight rejected", {
        exerciseKey: exercise.exerciseKey,
        origin: requestOrigin,
        status: preflight.status,
        allowedOriginMatches: preflight.allowedOrigin === requestOrigin,
        allowedMethods: preflight.allowedMethods,
        allowedHeaders: preflight.allowedHeaders,
      });
      return adminUploadError(
        "Preflightul CORS pentru încărcarea directă în R2 a fost respins. Videoclipul existent a fost păstrat.",
        502,
        { stage: "cors-preflight", code: "R2_CORS_PREFLIGHT_REJECTED" },
      );
    }
    const timing = intentExpiry(signedUpload.expiresIn);
    const intent: UploadIntent = {
      version: 1,
      kind: "upload",
      userId: admin.userId,
      exerciseKey: exercise.exerciseKey,
      mutationId,
      ...keys,
      fileName: file.name as string,
      fileSizeBytes: Number(file.size),
      sha256: (file.sha256 as string).toLowerCase(),
      width: Number(file.width),
      height: Number(file.height),
      durationMilliseconds: Math.round(Number(file.durationSeconds) * 1000),
      ...timing,
    };

    return adminUploadSuccess({
      upload: {
        method: "PUT",
        url: signedUpload.url,
        headers: signedUpload.headers,
        expiresAt: signedUpload.expiresAt,
        mutationId,
        uploadToken: await createExerciseVideoIntentToken(intent),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown error";
    console.error("VEMI direct upload preparation failed", {
      exerciseKey: exercise.exerciseKey,
      message: errorMessage,
    });
    return adminUploadError(
      "Pregătirea încărcării directe nu a putut fi confirmată. Videoclipul existent a fost păstrat.",
      500,
      { stage: "prepare", code: "UPLOAD_PREPARE_FAILED" },
    );
  }
}
