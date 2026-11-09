import type { ExerciseVideoState } from "./catalog-model";

export const INTENTIONALLY_WITHOUT_VIDEO_KEYS: readonly string[];

export type AuthoritativeExerciseVideoRow = {
  exercise_key: string;
  video_object_key: string | null;
  poster_object_key: string | null;
  mime_type: string | null;
  duration_seconds: number | string | null;
  width_pixels: number | null;
  height_pixels: number | null;
  file_size_bytes: number | string | null;
  is_active: boolean;
};

export function normalizeAuthoritativeVideoEligibility(input: {
  canonicalExerciseKeys: readonly string[];
  videoRows: readonly AuthoritativeExerciseVideoRow[];
}): Map<string, ExerciseVideoState>;
