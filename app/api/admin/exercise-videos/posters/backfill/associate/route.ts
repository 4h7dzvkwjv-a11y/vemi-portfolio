import { getActiveAdminExerciseByKey } from "../../../../../../../lib/exercises/admin-catalog";
import { copyR2Object, deleteR2Object } from "../../../../../../../lib/video/r2";
import { validateStoredExercisePoster } from "../../../../../../../lib/video/r2-poster-validation";
import { exerciseVideoUploadObjectKeys, isSafeUploadMutationId } from "../../../../../../../lib/video/upload-policy";
import { verifyExerciseVideoIntentToken } from "../../../../../../../lib/video/upload-intent";
import { getAdminContext } from "../../../../../../../utils/admin/server";
import {
  adminUploadError,
  adminUploadSuccess,
  describeRequestError,
  isSameOriginAdminRequest,
  readSmallJson,
} from "../../../upload/_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = { exerciseKey?: unknown; mutationId?: unknown; posterToken?: unknown };

async function safeDelete(objectKey: string) {
  try { await deleteR2Object(objectKey); } catch { /* stale cleanup handles a later retry */ }
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.authorized) return adminUploadError(admin.status === 401 ? "Autentificarea este necesară." : "Accesul este restricționat.", admin.status);
  if (!isSameOriginAdminRequest(request)) return adminUploadError("Originea cererii nu este permisă.", 403);
  let body: Body;
  try {
    body = await readSmallJson(request) as Body;
  } catch (error) {
    const described = describeRequestError(error);
    return adminUploadError(described.message, described.status);
  }
  if (
    typeof body.exerciseKey !== "string"
    || typeof body.mutationId !== "string"
    || !isSafeUploadMutationId(body.mutationId)
    || typeof body.posterToken !== "string"
  ) return adminUploadError("Datele de asociere pentru backfill sunt invalide.", 400, { stage: "poster", code: "BACKFILL_ASSOCIATION_INVALID" });

  const exercise = await getActiveAdminExerciseByKey(admin.supabase, body.exerciseKey);
  if (!exercise) return adminUploadError("Exercițiul selectat nu există în catalog.", 400);
  let intent;
  try {
    intent = await verifyExerciseVideoIntentToken(body.posterToken, "poster");
  } catch {
    return adminUploadError("Autorizația backfillului este invalidă sau a expirat.", 401, { stage: "poster", code: "BACKFILL_TOKEN_INVALID" });
  }
  const keys = exerciseVideoUploadObjectKeys(exercise.exerciseKey, body.mutationId);
  if (
    intent.userId !== admin.userId
    || intent.exerciseKey !== exercise.exerciseKey
    || intent.mutationId !== body.mutationId
    || intent.posterUploadObjectKey !== keys.posterUploadObjectKey
    || intent.posterVerifiedObjectKey !== keys.posterVerifiedObjectKey
    || intent.finalPosterObjectKey !== keys.finalPosterObjectKey
  ) return adminUploadError("Posterul de backfill nu aparține exercițiului selectat.", 403, { stage: "poster", code: "BACKFILL_EXERCISE_MISMATCH" });

  const expectedPoster = {
    fileSizeBytes: intent.posterFileSizeBytes,
    sha256: intent.posterSha256,
    width: intent.posterWidth,
    height: intent.posterHeight,
  };
  try {
    const { data: current, error: readError } = await admin.supabase
      .from("exercise_videos")
      .select("video_object_key, poster_object_key, is_active")
      .eq("exercise_key", exercise.exerciseKey)
      .maybeSingle();
    if (readError || !current?.is_active || current.video_object_key !== intent.finalObjectKey) {
      throw new Error("Videoclipul asociat s-a schimbat în timpul backfillului.");
    }
    if (current.poster_object_key) {
      await Promise.all([safeDelete(intent.posterUploadObjectKey), safeDelete(intent.posterVerifiedObjectKey)]);
      return adminUploadSuccess({ alreadyGenerated: true });
    }

    await validateStoredExercisePoster(intent.posterUploadObjectKey, expectedPoster);
    await copyR2Object(intent.posterUploadObjectKey, intent.posterVerifiedObjectKey, "image/png");
    await validateStoredExercisePoster(intent.posterVerifiedObjectKey, expectedPoster);
    await copyR2Object(intent.posterVerifiedObjectKey, intent.finalPosterObjectKey, "image/png");
    await validateStoredExercisePoster(intent.finalPosterObjectKey, expectedPoster);

    const { error: updateError } = await admin.supabase
      .from("exercise_videos")
      .update({ poster_object_key: intent.finalPosterObjectKey })
      .eq("exercise_key", exercise.exerciseKey)
      .eq("video_object_key", intent.finalObjectKey)
      .is("poster_object_key", null);
    if (updateError) throw new Error(`Supabase poster backfill failed: ${updateError.code ?? "unknown"}`);
    const { data: confirmed, error: confirmError } = await admin.supabase
      .from("exercise_videos")
      .select("video_object_key, poster_object_key, is_active")
      .eq("exercise_key", exercise.exerciseKey)
      .maybeSingle();
    if (confirmError || confirmed?.poster_object_key !== intent.finalPosterObjectKey || confirmed.video_object_key !== intent.finalObjectKey) {
      throw new Error("Asocierea posterului de backfill nu a fost confirmată.");
    }
    await Promise.all([safeDelete(intent.posterUploadObjectKey), safeDelete(intent.posterVerifiedObjectKey)]);
    return adminUploadSuccess({ generated: true, exerciseKey: exercise.exerciseKey });
  } catch (error) {
    await Promise.all([
      safeDelete(intent.posterUploadObjectKey),
      safeDelete(intent.posterVerifiedObjectKey),
      safeDelete(intent.finalPosterObjectKey),
    ]);
    console.error("VEMI poster backfill failed", {
      exerciseKey: exercise.exerciseKey,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return adminUploadError("Posterul nu a putut fi generat; videoclipul asociat a rămas neschimbat.", 500, { stage: "poster", code: "BACKFILL_ASSOCIATION_FAILED" });
  }
}
