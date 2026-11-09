import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditorialFooter } from "../../../components/editorial/editorial-footer";
import { EditorialHeader } from "../../../components/editorial/editorial-header";
import { loadActiveAdminExerciseCatalog } from "../../../lib/exercises/admin-catalog";
import { isAcceptedExerciseVideoDimensions } from "../../../lib/video/upload-policy";
import { getAdminContext } from "../../../utils/admin/server";
import { AdminExerciseVideos } from "./video-admin-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Administrare videoclipuri · VEMI",
  description: "Panou privat VEMI pentru demonstrațiile video ale exercițiilor.",
  robots: { index: false, follow: false },
};

type VideoRow = {
  exercise_key: string;
  poster_object_key: string | null;
  duration_seconds: number | string | null;
  width_pixels: number | null;
  height_pixels: number | null;
  file_size_bytes: number | string | null;
  is_active: boolean;
  updated_at: string;
};

export default async function AdminExerciseVideosPage() {
  const admin = await getAdminContext();
  if (!admin.authorized && admin.status === 401) {
    redirect("/contul-meu?next=%2Fadmin%2Fexercitii-video");
  }
  if (!admin.authorized) notFound();

  const activeCatalog = await loadActiveAdminExerciseCatalog(admin.supabase);

  const { data, error } = await admin.supabase
    .from("exercise_videos")
    .select("exercise_key, poster_object_key, duration_seconds, width_pixels, height_pixels, file_size_bytes, is_active, updated_at")
    .order("exercise_key");

  if (error) throw new Error("Catalogul video nu a putut fi citit în siguranță.");
  const rows = new Map((data as VideoRow[] | null ?? []).map((row) => [row.exercise_key, row]));
  const exercises = activeCatalog.map((exercise) => {
    const row = rows.get(exercise.exerciseKey);
    const compatible = Boolean(
      row?.is_active
      && isAcceptedExerciseVideoDimensions(row.width_pixels ?? 0, row.height_pixels ?? 0),
    );
    return {
      exerciseKey: exercise.exerciseKey,
      name: exercise.name,
      group: exercise.group,
      status: !row ? "missing" as const : compatible ? "available" as const : "incompatible" as const,
      width: row?.width_pixels ?? null,
      height: row?.height_pixels ?? null,
      durationSeconds: row?.duration_seconds === null || row?.duration_seconds === undefined ? null : Number(row.duration_seconds),
      fileSizeBytes: row?.file_size_bytes === null || row?.file_size_bytes === undefined ? null : Number(row.file_size_bytes),
      updatedAt: row?.updated_at ?? null,
      hasPoster: Boolean(row?.poster_object_key),
    };
  });

  return (
    <div className="editorial-site admin-video-site">
      <EditorialHeader />
      <main className="admin-video-main">
        <header className="admin-video-hero">
          <div>
            <p className="section-kicker">Administrare VEMI</p>
            <h1>Videoclipurile exercițiilor</h1>
          </div>
          <p>Încarcă demonstrațiile pătrate 1:1, verifică asocierea și înlocuiește în siguranță un clip existent.</p>
        </header>
        <AdminExerciseVideos initialExercises={exercises} />
      </main>
      <EditorialFooter />
    </div>
  );
}
