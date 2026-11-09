import { getActiveAdminExerciseByKey } from "../../../../../../../lib/exercises/admin-catalog";
import { createTemporaryR2ReadUrl } from "../../../../../../../lib/video/r2";
import { getAdminContext } from "../../../../../../../utils/admin/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ exerciseKey: string }> };

export async function GET(request: Request, context: RouteContext) {
  const admin = await getAdminContext();
  if (!admin.authorized) return new Response(null, { status: admin.status });
  const { exerciseKey } = await context.params;
  const exercise = await getActiveAdminExerciseByKey(admin.supabase, exerciseKey);
  if (!exercise) return new Response(null, { status: 404 });

  const { data, error } = await admin.supabase
    .from("exercise_videos")
    .select("video_object_key, is_active")
    .eq("exercise_key", exercise.exerciseKey)
    .maybeSingle();
  if (error || !data?.is_active) return new Response(null, { status: 404 });

  const signedUrl = await createTemporaryR2ReadUrl(data.video_object_key);
  const range = request.headers.get("range");
  const upstream = await fetch(signedUrl, {
    method: "GET",
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 206) return new Response(null, { status: 502 });
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Accept-Ranges": upstream.headers.get("accept-ranges") ?? "bytes",
  });
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
