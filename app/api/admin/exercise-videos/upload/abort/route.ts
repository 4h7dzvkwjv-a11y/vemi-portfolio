import { deleteR2Object } from "../../../../../../lib/video/r2";
import { verifyExerciseVideoIntentToken } from "../../../../../../lib/video/upload-intent";
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

type AbortBody = {
  uploadToken?: unknown;
  verificationToken?: unknown;
  posterToken?: unknown;
};

async function safeDelete(objectKey: string) {
  try {
    await deleteR2Object(objectKey);
  } catch (error) {
    console.error("VEMI aborted upload cleanup failed", {
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

  let body: AbortBody;
  try {
    body = await readSmallJson(request) as AbortBody;
  } catch (error) {
    const described = describeRequestError(error);
    return adminUploadError(described.message, described.status);
  }
  const token = typeof body.posterToken === "string"
    ? body.posterToken
    : typeof body.verificationToken === "string"
    ? body.verificationToken
    : typeof body.uploadToken === "string" ? body.uploadToken : null;
  if (!token) return adminUploadError("Autorizația încărcării lipsește.", 400);

  let intent;
  try {
    intent = await verifyExerciseVideoIntentToken(
      token,
      typeof body.posterToken === "string" ? "poster" : typeof body.verificationToken === "string" ? "verified" : "upload",
    );
  } catch {
    return adminUploadError("Autorizația încărcării este invalidă sau a expirat.", 401);
  }
  if (intent.userId !== admin.userId) return adminUploadError("Încărcarea nu aparține utilizatorului autentificat.", 403);

  const { data: currentRow } = await admin.supabase
    .from("exercise_videos")
    .select("video_object_key, poster_object_key")
    .eq("exercise_key", intent.exerciseKey)
    .maybeSingle();
  await Promise.all([safeDelete(intent.uploadObjectKey), safeDelete(intent.verifiedObjectKey)]);
  if (currentRow?.video_object_key !== intent.finalObjectKey) await safeDelete(intent.finalObjectKey);
  if (intent.kind === "poster") {
    await Promise.all([safeDelete(intent.posterUploadObjectKey), safeDelete(intent.posterVerifiedObjectKey)]);
    if (currentRow?.poster_object_key !== intent.finalPosterObjectKey) await safeDelete(intent.finalPosterObjectKey);
  }
  return adminUploadSuccess({ cleaned: true });
}
