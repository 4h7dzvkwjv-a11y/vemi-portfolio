import type { ExerciseCatalogPayload } from "./catalog-model";

export const ACTIVE_CATALOG_RESPONSE_HEADERS: Readonly<Record<string, string>>;
export function handleActiveCatalogRequest(
  request: Request,
  loadCatalog: () => Promise<ExerciseCatalogPayload>,
  onError?: (error: unknown, request: Request) => void,
): Promise<Response>;
