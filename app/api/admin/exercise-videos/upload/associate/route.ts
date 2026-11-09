import { getActiveAdminExerciseByKey } from "../../../../../../lib/exercises/admin-catalog";
import { copyR2Object, deleteR2Object } from "../../../../../../lib/video/r2";
import {
  StoredExerciseVideoError,
  validateStoredExerciseVideo,
} from "../../../../../../lib/video/r2-video-validation";
import {
  StoredExercisePosterError,
  validateStoredExercisePoster,
} from "../../../../../../lib/video/r2-poster-validation";
import { verifyExerciseVideoIntentToken } from "../../../../../../lib/video/upload-intent";
import { exerciseVideoUploadObjectKeys, isSafeUploadMutationId } from "../../../../../../lib/video/upload-policy";
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

type AssociateBody = {
  exerciseKey?: unknown;
  mutationId?: unknown;
  posterToken?: unknown;
};

type VideoRow = {
  exercise_key: string;
  video_object_key: string;
  poster_object_key: string | null;
  mime_type: string;
  duration_seconds: number | string;
  width_pixels: number;
  height_pixels: number;
  file_size_bytes: number | string;
  is_active: boolean;
  updated_at: string;
};

const selection = "exercise_key, video_object_key, poster_object_key, mime_type, duration_seconds, width_pixels, height_pixels, file_size_bytes, is_active, updated_at";

async function safeDelete(objectKey: string) {
  try {
    await deleteR2Object(objectKey);
  } catch (error) {
    console.error("VEMI association cleanup failed", {
      objectKey,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}

async function restorePreviousAssociation(
  supabase: Awaited<ReturnType<typeof getAdminContext>>["supabase"],
  exerciseKey: string,
  previousRow: VideoRow | null,
) {
  if (!previousRow) {
    const { error } = await supabase.from("exercise_videos").delete().eq("exercise_key", exerciseKey);
    if (error) throw new Error(`Supabase rollback delete failed: ${error.code ?? "unknown"}`);
    return;
  }
  const { error } = await supabase.from("exercise_videos").upsert({
    exercise_key: previousRow.exercise_key,
    video_object_key: previousRow.video_object_key,
    poster_object_key: previousRow.poster_object_key,
    mime_type: previousRow.mime_type,
    duration_seconds: previousRow.duration_seconds,
    width_pixels: previousRow.width_pixels,
    height_pixels: previousRow.height_pixels,
    file_size_bytes: previousRow.file_size_bytes,
    is_active: previousRow.is_active,
  }, { onConflict: "exercise_key" });
  if (error) throw new Error(`Supabase rollback upsert failed: ${error.code ?? "unknown"}`);
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.authorized) {
    return adminUploadError(admin.status === 401 ? "Autentificarea este necesară." : "Accesul este restricționat.", admin.status);
  }
  if (!isSameOriginAdminRequest(request)) return adminUploadError("Originea cererii nu este permisă.", 403);

  let body: AssociateBody;
  try {
    body = await readSmallJson(request) as AssociateBody;
  } catch (error) {
    const described = describeRequestError(error);
    return adminUploadError(described.message, described.status);
  }
  if (
    typeof body.exerciseKey !== "string"
    || typeof body.mutationId !== "string"
    || !isSafeUploadMutationId(body.mutationId)
    || typeof body.posterToken !== "string"
  ) {
    return adminUploadError("Datele de asociere ale încărcării sunt invalide.", 400);
  }
  const exercise = await getActiveAdminExerciseByKey(admin.supabase, body.exerciseKey);
  if (!exercise) return adminUploadError("Exercițiul selectat nu există în catalog.", 400);

  let intent;
  try {
    intent = await verifyExerciseVideoIntentToken(body.posterToken, "poster");
  } catch {
    return adminUploadError("Confirmarea server-side este invalidă sau a expirat.", 401);
  }
  const expectedKeys = exerciseVideoUploadObjectKeys(exercise.exerciseKey, body.mutationId);
  if (
    intent.userId !== admin.userId
    || intent.exerciseKey !== exercise.exerciseKey
    || intent.mutationId !== body.mutationId
    || intent.uploadObjectKey !== expectedKeys.uploadObjectKey
    || intent.verifiedObjectKey !== expectedKeys.verifiedObjectKey
    || intent.finalObjectKey !== expectedKeys.finalObjectKey
    || intent.posterUploadObjectKey !== expectedKeys.posterUploadObjectKey
    || intent.posterVerifiedObjectKey !== expectedKeys.posterVerifiedObjectKey
    || intent.finalPosterObjectKey !== expectedKeys.finalPosterObjectKey
  ) {
    return adminUploadError("Videoclipul verificat nu aparține exercițiului selectat.", 403);
  }

  const expected = {
    fileSizeBytes: intent.fileSizeBytes,
    sha256: intent.sha256,
    width: intent.width,
    height: intent.height,
    durationMilliseconds: intent.durationMilliseconds,
  };
  const expectedPoster = {
    fileSizeBytes: intent.posterFileSizeBytes,
    sha256: intent.posterSha256,
    width: intent.posterWidth,
    height: intent.posterHeight,
  };
  let previousRow: VideoRow | null = null;
  let associationAttempted = false;
  try {
    const { data: currentRow, error: currentError } = await admin.supabase
      .from("exercise_videos")
      .select(selection)
      .eq("exercise_key", exercise.exerciseKey)
      .maybeSingle();
    if (currentError) throw new Error(`Supabase association read failed: ${currentError.code ?? "unknown"}`);
    previousRow = currentRow as VideoRow | null;
    if (
      previousRow?.video_object_key === intent.finalObjectKey
      && previousRow.poster_object_key === intent.finalPosterObjectKey
      && previousRow.is_active === true
      && previousRow.width_pixels === intent.width
      && previousRow.height_pixels === intent.height
      && Number(previousRow.file_size_bytes) === intent.fileSizeBytes
    ) {
      await Promise.all([
        safeDelete(intent.verifiedObjectKey),
        safeDelete(intent.posterUploadObjectKey),
        safeDelete(intent.posterVerifiedObjectKey),
      ]);
      return adminUploadSuccess({ exercise: exercisePayload(exercise, previousRow) });
    }

    await validateStoredExerciseVideo(intent.verifiedObjectKey, expected);
    await validateStoredExercisePoster(intent.posterUploadObjectKey, expectedPoster);
    await copyR2Object(intent.posterUploadObjectKey, intent.posterVerifiedObjectKey, "image/png");
    await validateStoredExercisePoster(intent.posterVerifiedObjectKey, expectedPoster);
    await copyR2Object(intent.verifiedObjectKey, intent.finalObjectKey, "video/mp4");
    const metadata = await validateStoredExerciseVideo(intent.finalObjectKey, expected);
    await copyR2Object(intent.posterVerifiedObjectKey, intent.finalPosterObjectKey, "image/png");
    await validateStoredExercisePoster(intent.finalPosterObjectKey, expectedPoster);

    associationAttempted = true;
    const { error: upsertError } = await admin.supabase.from("exercise_videos").upsert({
      exercise_key: exercise.exerciseKey,
      video_object_key: intent.finalObjectKey,
      poster_object_key: intent.finalPosterObjectKey,
      mime_type: metadata.mimeType,
      duration_seconds: metadata.durationSeconds,
      width_pixels: metadata.width,
      height_pixels: metadata.height,
      file_size_bytes: metadata.fileSizeBytes,
      is_active: true,
    }, { onConflict: "exercise_key" });
    if (upsertError) throw new Error(`Supabase association failed: ${upsertError.code ?? "unknown"}`);

    const { data: verifiedRow, error: verificationError } = await admin.supabase
      .from("exercise_videos")
      .select(selection)
      .eq("exercise_key", exercise.exerciseKey)
      .maybeSingle();
    const confirmed = verifiedRow as VideoRow | null;
    if (
      verificationError
      || !confirmed
      || confirmed.video_object_key !== intent.finalObjectKey
      || confirmed.poster_object_key !== intent.finalPosterObjectKey
      || confirmed.is_active !== true
      || confirmed.width_pixels !== metadata.width
      || confirmed.height_pixels !== metadata.height
      || Number(confirmed.file_size_bytes) !== metadata.fileSizeBytes
    ) {
      throw new Error("Supabase association verification failed");
    }

    await Promise.all([
      safeDelete(intent.verifiedObjectKey),
      safeDelete(intent.posterUploadObjectKey),
      safeDelete(intent.posterVerifiedObjectKey),
    ]);
    if (previousRow?.poster_object_key && previousRow.poster_object_key !== intent.finalPosterObjectKey) {
      await safeDelete(previousRow.poster_object_key);
    }
    return adminUploadSuccess({ exercise: exercisePayload(exercise, confirmed) });
  } catch (error) {
    let rollbackFailed = false;
    if (associationAttempted) {
      try {
        await restorePreviousAssociation(admin.supabase, exercise.exerciseKey, previousRow);
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error("VEMI video association rollback failed", rollbackError instanceof Error ? rollbackError.message : "unknown error");
      }
    }
    if (!rollbackFailed) {
      await Promise.all([
        safeDelete(intent.finalObjectKey),
        safeDelete(intent.finalPosterObjectKey),
        safeDelete(intent.verifiedObjectKey),
        safeDelete(intent.posterUploadObjectKey),
        safeDelete(intent.posterVerifiedObjectKey),
      ]);
    }
    console.error("VEMI direct upload association failed", {
      exerciseKey: exercise.exerciseKey,
      message: error instanceof Error ? error.message : "unknown error",
      rollbackFailed,
    });
    if (error instanceof StoredExerciseVideoError || error instanceof StoredExercisePosterError) {
      return adminUploadError(error.message, error.status, { stage: "associate", code: "ASSOCIATION_VIDEO_VALIDATION_REJECTED" });
    }
    return adminUploadError(
      rollbackFailed
        ? "Asocierea nu a putut fi confirmată și restaurarea automată necesită verificare. Reîncarcă panoul înainte de a continua."
        : "Asocierea nu a putut fi confirmată. Videoclipul existent a fost păstrat.",
      500,
      { stage: "associate", code: rollbackFailed ? "ASSOCIATION_ROLLBACK_REQUIRES_REVIEW" : "SUPABASE_ASSOCIATION_FAILED" },
    );
  }
}
