import { getActiveAdminExerciseByKey } from "../../../../../../../lib/exercises/admin-catalog";
import {
  createTemporaryR2UploadUrl,
  deleteR2Object,
  headR2Object,
  probeR2BrowserUploadCors,
} from "../../../../../../../lib/video/r2";
import { validateStoredExerciseVideo } from "../../../../../../../lib/video/r2-video-validation";
import {
  EXERCISE_POSTER_CONTENT_TYPE,
  exerciseVideoUploadObjectKeys,
  isSafeSha256Hex,
  isSafeUploadMutationId,
  MAX_EXERCISE_POSTER_BYTES,
} from "../../../../../../../lib/video/upload-policy";
import {
  createExerciseVideoIntentToken,
  intentExpiry,
  type PosterUploadIntent,
  verifyExerciseVideoIntentToken,
} from "../../../../../../../lib/video/upload-intent";
import { getAdminContext } from "../../../../../../../utils/admin/server";
import {
  adminUploadError,
  adminUploadSuccess,
  describeRequestError,
  isSameOriginAdminRequest,
  readSmallJson,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PosterPrepareBody = {
  exerciseKey?: unknown;
  mutationId?: unknown;
  verificationToken?: unknown;
  poster?: { type?: unknown; size?: unknown; sha256?: unknown; width?: unknown; height?: unknown };
};

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.authorized) {
    return adminUploadError(admin.status === 401 ? "Autentificarea este necesară." : "Accesul este restricționat.", admin.status);
  }
  if (!isSameOriginAdminRequest(request)) return adminUploadError("Originea cererii nu este permisă.", 403);

  let body: PosterPrepareBody;
  try {
    body = await readSmallJson(request) as PosterPrepareBody;
  } catch (error) {
    const described = describeRequestError(error);
    return adminUploadError(described.message, described.status);
  }
  const poster = body.poster;
  if (
    typeof body.exerciseKey !== "string"
    || typeof body.mutationId !== "string"
    || !isSafeUploadMutationId(body.mutationId)
    || typeof body.verificationToken !== "string"
    || !poster
    || poster.type !== EXERCISE_POSTER_CONTENT_TYPE
    || !Number.isInteger(poster.size)
    || Number(poster.size) <= 0
    || Number(poster.size) > MAX_EXERCISE_POSTER_BYTES
    || typeof poster.sha256 !== "string"
    || !isSafeSha256Hex(poster.sha256)
    || !Number.isInteger(poster.width)
    || !Number.isInteger(poster.height)
    || Number(poster.width) !== Number(poster.height)
    || Number(poster.width) < 160
    || Number(poster.width) > 1080
  ) {
    return adminUploadError("Metadatele posterului pătrat sunt invalide.", 400, { stage: "poster", code: "POSTER_DECLARATION_INVALID" });
  }

  const exercise = await getActiveAdminExerciseByKey(admin.supabase, body.exerciseKey);
  if (!exercise) return adminUploadError("Exercițiul selectat nu există în catalog.", 400);
  let verifiedIntent;
  try {
    verifiedIntent = await verifyExerciseVideoIntentToken(body.verificationToken, "verified");
  } catch {
    return adminUploadError("Confirmarea videoclipului este invalidă sau a expirat.", 401, { stage: "poster", code: "VIDEO_VERIFICATION_EXPIRED" });
  }
  const keys = exerciseVideoUploadObjectKeys(exercise.exerciseKey, body.mutationId);
  if (
    verifiedIntent.userId !== admin.userId
    || verifiedIntent.exerciseKey !== exercise.exerciseKey
    || verifiedIntent.mutationId !== body.mutationId
    || verifiedIntent.verifiedObjectKey !== keys.verifiedObjectKey
    || verifiedIntent.finalObjectKey !== keys.finalObjectKey
  ) {
    return adminUploadError("Posterul nu aparține videoclipului verificat.", 403, { stage: "poster", code: "POSTER_VIDEO_MISMATCH" });
  }

  try {
    await validateStoredExerciseVideo(verifiedIntent.verifiedObjectKey, {
      fileSizeBytes: verifiedIntent.fileSizeBytes,
      sha256: verifiedIntent.sha256,
      width: verifiedIntent.width,
      height: verifiedIntent.height,
      durationMilliseconds: verifiedIntent.durationMilliseconds,
    });
    for (const objectKey of [keys.posterUploadObjectKey, keys.posterVerifiedObjectKey, keys.finalPosterObjectKey]) {
      if (await headR2Object(objectKey)) await deleteR2Object(objectKey);
    }

    const requestOrigin = new URL(request.headers.get("origin") ?? new URL(request.url).origin).origin;
    const signedUpload = await createTemporaryR2UploadUrl(keys.posterUploadObjectKey, EXERCISE_POSTER_CONTENT_TYPE);
    const preflight = await probeR2BrowserUploadCors(signedUpload.url, requestOrigin, ["content-type"]);
    if (!preflight.ok) {
      return adminUploadError("Preflightul CORS pentru poster a fost respins. Videoclipul existent a fost păstrat.", 502, { stage: "poster", code: "POSTER_CORS_REJECTED" });
    }

    const timing = intentExpiry(signedUpload.expiresIn);
    const intent: PosterUploadIntent = {
      ...verifiedIntent,
      kind: "poster",
      posterUploadObjectKey: keys.posterUploadObjectKey,
      posterVerifiedObjectKey: keys.posterVerifiedObjectKey,
      finalPosterObjectKey: keys.finalPosterObjectKey,
      posterFileSizeBytes: Number(poster.size),
      posterSha256: poster.sha256.toLowerCase(),
      posterWidth: Number(poster.width),
      posterHeight: Number(poster.height),
      issuedAt: timing.issuedAt,
      expiresAt: timing.expiresAt,
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
  } catch (error) {
    console.error("VEMI poster preparation failed", {
      exerciseKey: exercise.exerciseKey,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return adminUploadError("Pregătirea posterului nu a putut fi confirmată. Videoclipul existent a fost păstrat.", 500, { stage: "poster", code: "POSTER_PREPARE_FAILED" });
  }
}
