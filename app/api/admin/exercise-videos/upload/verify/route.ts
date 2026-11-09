import { getActiveAdminExerciseByKey } from "../../../../../../lib/exercises/admin-catalog";
import { copyR2Object, deleteR2Object, headR2Object } from "../../../../../../lib/video/r2";
import {
  StoredExerciseVideoError,
  validateStoredExerciseVideo,
} from "../../../../../../lib/video/r2-video-validation";
import {
  createExerciseVideoIntentToken,
  intentExpiry,
  verifyExerciseVideoIntentToken,
  type VerifiedUploadIntent,
} from "../../../../../../lib/video/upload-intent";
import { exerciseVideoUploadObjectKeys, isSafeUploadMutationId } from "../../../../../../lib/video/upload-policy";
import { getAdminContext } from "../../../../../../utils/admin/server";
import {
  adminUploadError,
  adminUploadSuccess,
  describeRequestError,
  isSameOriginAdminRequest,
  readSmallJson,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VerifyBody = {
  exerciseKey?: unknown;
  mutationId?: unknown;
  uploadToken?: unknown;
};

async function safeDelete(objectKey: string) {
  try {
    await deleteR2Object(objectKey);
  } catch (error) {
    console.error("VEMI staging object cleanup failed", {
      objectKey,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.authorized) {
    return adminUploadError(admin.status === 401 ? "Autentificarea este necesară." : "Accesul este restricționat.", admin.status);
  }
  if (!isSameOriginAdminRequest(request)) return adminUploadError("Originea cererii nu este permisă.", 403);

  let body: VerifyBody;
  try {
    body = await readSmallJson(request) as VerifyBody;
  } catch (error) {
    const described = describeRequestError(error);
    return adminUploadError(described.message, described.status);
  }
  if (
    typeof body.exerciseKey !== "string"
    || typeof body.mutationId !== "string"
    || !isSafeUploadMutationId(body.mutationId)
    || typeof body.uploadToken !== "string"
  ) {
    return adminUploadError("Datele de verificare ale încărcării sunt invalide.", 400);
  }
  const exercise = await getActiveAdminExerciseByKey(admin.supabase, body.exerciseKey);
  if (!exercise) return adminUploadError("Exercițiul selectat nu există în catalog.", 400);

  let intent;
  try {
    intent = await verifyExerciseVideoIntentToken(body.uploadToken, "upload");
  } catch {
    return adminUploadError("Autorizația temporară de încărcare este invalidă sau a expirat.", 401);
  }
  const expectedKeys = exerciseVideoUploadObjectKeys(exercise.exerciseKey, body.mutationId);
  if (
    intent.userId !== admin.userId
    || intent.exerciseKey !== exercise.exerciseKey
    || intent.mutationId !== body.mutationId
    || intent.uploadObjectKey !== expectedKeys.uploadObjectKey
    || intent.verifiedObjectKey !== expectedKeys.verifiedObjectKey
    || intent.finalObjectKey !== expectedKeys.finalObjectKey
  ) {
    return adminUploadError("Încărcarea nu aparține exercițiului selectat.", 403);
  }

  const expected = {
    fileSizeBytes: intent.fileSizeBytes,
    sha256: intent.sha256,
    width: intent.width,
    height: intent.height,
    durationMilliseconds: intent.durationMilliseconds,
  };
  try {
    let metadata;
    if (await headR2Object(intent.verifiedObjectKey)) {
      metadata = await validateStoredExerciseVideo(intent.verifiedObjectKey, expected);
    } else {
      metadata = await validateStoredExerciseVideo(intent.uploadObjectKey, expected);
      await copyR2Object(intent.uploadObjectKey, intent.verifiedObjectKey, "video/mp4");
      metadata = await validateStoredExerciseVideo(intent.verifiedObjectKey, expected);
      await deleteR2Object(intent.uploadObjectKey);
    }

    const timing = intentExpiry(300);
    const verifiedIntent: VerifiedUploadIntent = {
      ...intent,
      kind: "verified",
      issuedAt: timing.issuedAt,
      expiresAt: timing.expiresAt,
    };
    return adminUploadSuccess({
      verification: {
        mutationId: intent.mutationId,
        verificationToken: await createExerciseVideoIntentToken(verifiedIntent),
        metadata: {
          width: metadata.width,
          height: metadata.height,
          durationSeconds: metadata.durationSeconds,
          fileSizeBytes: metadata.fileSizeBytes,
          codec: metadata.codec,
        },
      },
    });
  } catch (error) {
    await Promise.all([safeDelete(intent.uploadObjectKey), safeDelete(intent.verifiedObjectKey)]);
    console.error("VEMI direct upload server verification failed", {
      exerciseKey: exercise.exerciseKey,
      message: error instanceof Error ? error.message : "unknown error",
    });
    if (error instanceof StoredExerciseVideoError) {
      return adminUploadError(error.message, error.status, { stage: "verify", code: "SERVER_VIDEO_VALIDATION_REJECTED" });
    }
    return adminUploadError(
      "Verificarea server-side a videoclipului a eșuat. Videoclipul existent a fost păstrat.",
      500,
      { stage: "verify", code: "SERVER_VIDEO_VERIFICATION_FAILED" },
    );
  }
}
