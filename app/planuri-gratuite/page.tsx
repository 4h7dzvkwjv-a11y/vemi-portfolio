import { VemiPage } from "../../components/vemi-page";
import { loadLiveExerciseCatalog } from "../../lib/exercises/live-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadCatalog() {
  try {
    return await loadLiveExerciseCatalog();
  } catch (error) {
    console.error("VEMI Plan Engine V2 catalog load failed", error);
    return null;
  }
}

export default async function PlanuriGratuite() {
  const exerciseCatalog = await loadCatalog();
  return <VemiPage plansOnly exerciseCatalog={exerciseCatalog} />;
}
