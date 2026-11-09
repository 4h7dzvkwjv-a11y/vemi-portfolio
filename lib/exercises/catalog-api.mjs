import {
  ACTIVE_CATALOG_CONTRACT_VERSION,
  requireActiveCatalogPayload,
} from "./catalog-delivery.mjs";

export const ACTIVE_CATALOG_RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-VEMI-Catalog-Version": ACTIVE_CATALOG_CONTRACT_VERSION,
  Vary: "Accept-Encoding, X-VEMI-Catalog-Contract",
});

export async function handleActiveCatalogRequest(request, loadCatalog, onError = () => {}) {
  try {
    const payload = requireActiveCatalogPayload(await loadCatalog());
    return Response.json(payload, {
      status: 200,
      headers: ACTIVE_CATALOG_RESPONSE_HEADERS,
    });
  } catch (error) {
    onError(error, request);
    return Response.json(
      {
        status: "unavailable",
        contractVersion: ACTIVE_CATALOG_CONTRACT_VERSION,
      },
      {
        status: 503,
        headers: ACTIVE_CATALOG_RESPONSE_HEADERS,
      },
    );
  }
}
