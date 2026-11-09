import { handleActiveCatalogRequest } from "../../../lib/exercises/catalog-api.mjs";
import { loadLiveExerciseCatalog } from "../../../lib/exercises/live-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return handleActiveCatalogRequest(request, loadLiveExerciseCatalog, (error) => {
    console.error(JSON.stringify({
      message: "VEMI public active catalog delivery failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  });
}
