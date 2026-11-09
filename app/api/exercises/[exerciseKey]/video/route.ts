import { NextResponse } from "next/server";
import { isSquareExerciseVideo } from "../../../../../lib/video/aspect-ratio";
import { createTemporaryR2ReadUrl } from "../../../../../lib/video/r2";
import { createPublicCatalogClient } from "../../../../../utils/supabase/public-server";
import {
  classifyVideoMetadataQuery,
  createVideoMetadataQueryErrorBody,
  createVideoMetadataRequestId,
  createVideoMetadataResponseHeaders,
  emitVideoMetadataDiagnostic,
} from "./diagnostics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ exerciseKey: string }> };

export async function GET(request: Request, context: RouteContext) {
  const requestId = createVideoMetadataRequestId();
  const responseHeaders = createVideoMetadataResponseHeaders(requestId);
  const { exerciseKey } = await context.params;
  const squareOnly = new URL(request.url).searchParams.get("format") === "square";

  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("exercise_videos")
    .select("exercise_key, video_object_key, poster_object_key, mime_type, duration_seconds, width_pixels, height_pixels, exercise:exercises!inner(canonical_name)")
    .eq("exercise_key", exerciseKey)
    .eq("exercise.is_active", true)
    .eq("is_active", true)
    .maybeSingle();

  const queryResult = classifyVideoMetadataQuery(data, error);

  if (queryResult.classification === "QUERY_ERROR") {
    emitVideoMetadataDiagnostic(console, "QUERY_ERROR", "metadata_query", requestId);
    return NextResponse.json(
      createVideoMetadataQueryErrorBody(),
      { status: 503, headers: responseHeaders },
    );
  }

  if (queryResult.classification === "NO_DATA") {
    emitVideoMetadataDiagnostic(console, "NO_DATA", "metadata_query", requestId);
    return NextResponse.json({ available: false }, { status: 404, headers: responseHeaders });
  }

  const video = queryResult.data;

  if (squareOnly && !isSquareExerciseVideo(video.width_pixels, video.height_pixels)) {
    emitVideoMetadataDiagnostic(console, "NO_DATA", "format_validation", requestId);
    return NextResponse.json(
      { available: false, reason: "square-video-required" },
      { status: 404, headers: responseHeaders },
    );
  }

  try {
    const relatedExercise = Array.isArray(video.exercise) ? video.exercise[0] : video.exercise;
    const [url, posterUrl] = await Promise.all([
      createTemporaryR2ReadUrl(video.video_object_key),
      video.poster_object_key ? createTemporaryR2ReadUrl(video.poster_object_key) : Promise.resolve(null),
    ]);

    emitVideoMetadataDiagnostic(console, "SUCCESS", "response", requestId);
    return NextResponse.json(
      {
        available: true,
        exerciseKey: video.exercise_key,
        exerciseName: relatedExercise?.canonical_name ?? exerciseKey,
        url,
        posterUrl,
        mimeType: video.mime_type,
        durationSeconds: video.duration_seconds,
      },
      { headers: responseHeaders },
    );
  } catch {
    emitVideoMetadataDiagnostic(console, "SIGNING_ERROR", "url_signing", requestId);
    return NextResponse.json({ available: false }, { status: 503, headers: responseHeaders });
  }
}
