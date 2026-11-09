export const SQUARE_EXERCISE_VIDEO_RATIO = 1;
export const SQUARE_EXERCISE_VIDEO_PIXEL_TOLERANCE = 2;

export function isSquareExerciseVideo(
  widthPixels: number | null,
  heightPixels: number | null,
) {
  if (
    !Number.isFinite(widthPixels)
    || !Number.isFinite(heightPixels)
    || widthPixels === null
    || heightPixels === null
    || widthPixels <= 0
    || heightPixels <= 0
  ) return false;

  const pixelDifference = Math.abs(widthPixels - heightPixels);
  const ratio = widthPixels / heightPixels;
  const ratioTolerance = SQUARE_EXERCISE_VIDEO_PIXEL_TOLERANCE / Math.min(widthPixels, heightPixels);

  return pixelDifference <= SQUARE_EXERCISE_VIDEO_PIXEL_TOLERANCE
    && Math.abs(ratio - SQUARE_EXERCISE_VIDEO_RATIO) <= ratioTolerance + Number.EPSILON;
}
