import { getActiveAdminExerciseByKey } from "../../../../../../../lib/exercises/admin-catalog";
import {
  createTemporaryR2UploadUrl,
  deleteR2Object,
  headR2Object,
  probeR2BrowserUploadCors,
} from "../../../../../../../lib/video/r2";
import {
  EXERCISE_POSTER_CONTENT_TYPE,
  exerciseVideoUploadObjectKeys,
  isAcceptedExerciseVideoDimensions,
  isSafeSha256Hex,
  isSafeUploadMutationId,
  MAX_EXERCISE_POSTER_BYTES,
} from "../../../../../../../lib/video/upload-policy";
import {
  createExerciseVideoIntentToken,
  intentExpiry,
  type PosterUploadIntent,
} from "../../../../../../../lib/video/upload-intent";
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

type Body = {
  exerciseKey?: unknown;
  mutationId?: unknown;
  poster?: { type?: unknown; size?: unknown; sha256?: unknown; width?: unknown; height?: unknown };
};

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
  const poster = body.poster;
  if (
    typeof body.exerciseKey !== "string"
    || typeof body.mutationId !== "string"
    || !isSafeUploadMutationId(body.mutationId)
    || !poster
    || poster.type !== EXERCISE_POSTER_CONTENT_TYPE
    || !Number.isInteger(poster.size)
    || Number(poster.size) <= 0
    || Number(poster.size) > MAX_EXERCISE_POSTER_BYTES
    || typeof poster.sha256 !== "string"
    || !isSafeSha256Hex(poster.sha256)
    || !Number.isInteger(poster.width)
    || Number(poster.width) !== Number(poster.height)
    || Number(poster.width) < 160
    || Number(poster.width) > 1080
  ) return adminUploadError("Metadatele posterului pentru backfill sunt invalide.", 400, { stage: "poster", code: "BACKFILL_POSTER_INVALID" });

  const exercise = await getActiveAdminExerciseByKey(admin.supabase, body.exerciseKey);
  if (!exercise) return adminUploadError("Exercițiul selectat nu există în catalog.", 400);
  const { data: row, error } = await admin.supabase
    .from("exercise_videos")
    .select("video_object_key, poster_object_key, file_size_bytes, width_pixels, height_pixels, duration_seconds, is_active")
    .eq("exercise_key", exercise.exerciseKey)
    .maybeSingle();
  if (error || !row?.is_active) return adminUploadError("Videoclipul activ nu a putut fi confirmat.", 404, { stage: "poster", code: "BACKFILL_VIDEO_MISSING" });
  if (!isAcceptedExerciseVideoDimensions(Number(row.width_pixels), Number(row.height_pixels))) {
    return adminUploadError("Videoclipul existent nu respectă formatul pătrat 1:1.", 422, { stage: "poster", code: "BACKFILL_VIDEO_INCOMPATIBLE" });
  }
  if (row.poster_object_key) return adminUploadSuccess({ alreadyGenerated: true });

  try {
    const keys = exerciseVideoUploadObjectKeys(exercise.exerciseKey, body.mutationId);
    for (const objectKey of [keys.posterUploadObjectKey, keys.posterVerifiedObjectKey, keys.finalPosterObjectKey]) {
      if (await headR2Object(objectKey)) await deleteR2Object(objectKey);
    }
    const requestOrigin = new URL(request.headers.get("origin") ?? new URL(request.url).origin).origin;
    const signedUpload = await createTemporaryR2UploadUrl(keys.posterUploadObjectKey, EXERCISE_POSTER_CONTENT_TYPE);
    const preflight = await probeR2BrowserUploadCors(signedUpload.url, requestOrigin, ["content-type"]);
    if (!preflight.ok) return adminUploadError("Preflightul CORS pentru backfill a fost respins.", 502, { stage: "poster", code: "BACKFILL_CORS_REJECTED" });
    const timing = intentExpiry(signedUpload.expiresIn);
    const intent: PosterUploadIntent = {
      version: 1,
      kind: "poster",
      userId: admin.userId,
      exerciseKey: exercise.exerciseKey,
      mutationId: body.mutationId,
      uploadObjectKey: row.video_object_key,
      verifiedObjectKey: row.video_object_key,
      finalObjectKey: row.video_object_key,
      fileName: "backfill-existing-video.mp4",
      fileSizeBytes: Number(row.file_size_bytes),
      sha256: "0".repeat(64),
      width: Number(row.width_pixels),
      height: Number(row.height_pixels),
      durationMilliseconds: Math.round(Number(row.duration_seconds) * 1000),
      posterUploadObjectKey: keys.posterUploadObjectKey,
      posterVerifiedObjectKey: keys.posterVerifiedObjectKey,
      finalPosterObjectKey: keys.finalPosterObjectKey,
      posterFileSizeBytes: Number(poster.size),
      posterSha256: poster.sha256.toLowerCase(),
      posterWidth: Number(poster.width),
      posterHeight: Number(poster.height),
      ...timing,
    };
    return adminUploadSuccess({
      posterUpload: {
        method: "PUT",
        url: signedUpload.url,
        headers: signedUpload.headers,
        expiresAt: signedUpload.expiresAt,
        mutationId: body.mutationId,
        posterToken: await createExerciseVideoIntentToken(intent),
      },
    });
  } catch (caught) {
    console.error("VEMI poster backfill preparation failed", caught instanceof Error ? caught.message : "unknown error");
    return adminUploadError("Backfillul posterului nu a putut fi pregătit.", 500, { stage: "poster", code: "BACKFILL_PREPARE_FAILED" });
  }
}
