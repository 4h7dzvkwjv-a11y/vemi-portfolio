import { VemiPage } from "../../components/vemi-page";
import { loadLiveExerciseCatalog } from "../../lib/exercises/live-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadCatalog() {
  try {
    return await loadLiveExerciseCatalog();
  } catch (error) {
    console.error("VEMI live workout exercise catalog load failed", error);
    return null;
  }
}

export default async function AntrenamentulMeu() {
  const exerciseCatalog = await loadCatalog();
  return <VemiPage workoutOnly exerciseCatalog={exerciseCatalog} />;
}
