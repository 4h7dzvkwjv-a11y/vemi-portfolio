export const MAX_EXERCISE_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_EXERCISE_VIDEO_MEGABYTES = 25;
export const MAX_EXERCISE_POSTER_BYTES = 5 * 1024 * 1024;
export const EXERCISE_POSTER_CONTENT_TYPE = "image/png";
export const ACCEPTED_EXERCISE_VIDEO_RESOLUTIONS = [
  "352 × 352",
  "480 × 480",
  "720 × 720",
  "1080 × 1080",
] as const;

const acceptedExerciseVideoSizes = new Set([352, 480, 720, 1080]);

export function isAcceptedExerciseVideoDimensions(width: number, height: number) {
  return Number.isInteger(width)
    && width === height
    && acceptedExerciseVideoSizes.has(width);
}

export function describeAcceptedExerciseVideoResolutions() {
  return ACCEPTED_EXERCISE_VIDEO_RESOLUTIONS.join(", ");
}

export function isSafeUploadMutationId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSafeSha256Hex(value: string) {
  return /^[0-9a-f]{64}$/i.test(value);
}

export function exerciseVideoUploadObjectKeys(exerciseKey: string, mutationId: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(exerciseKey) || !isSafeUploadMutationId(mutationId)) {
    throw new Error("Invalid exercise video upload identifiers");
  }
  return {
    uploadObjectKey: `staging/exercise-videos/upload/${exerciseKey}/${mutationId}.mp4`,
    verifiedObjectKey: `staging/exercise-videos/verified/${exerciseKey}/${mutationId}.mp4`,
    finalObjectKey: `exercises/${exerciseKey}/demo-${mutationId}.mp4`,
    posterUploadObjectKey: `staging/exercise-videos/poster-upload/${exerciseKey}/${mutationId}.png`,
    posterVerifiedObjectKey: `staging/exercise-videos/poster-verified/${exerciseKey}/${mutationId}.png`,
    finalPosterObjectKey: `exercises/${exerciseKey}/poster-${mutationId}.png`,
  };
}
