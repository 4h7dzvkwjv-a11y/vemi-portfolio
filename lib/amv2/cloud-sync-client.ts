import type { Amv2OutboxOperation } from "./account-sync-local.mjs";
import type { Amv2HistoryPage } from "./cloud-history-coverage.mjs";
import { AMV2_HISTORY_PAGE_SIZE, normalizeHistoryPage } from "./cloud-history-coverage.mjs";

export type Amv2CloudSaveResult =
  | {
      status: "confirmed";
      remoteIdentity: string;
      revision: number;
      canonicalCandidate?: Record<string, unknown> | null;
      deleted: boolean;
    }
  | { status: "unauthenticated" }
  | {
      status: "conflict";
      message: string;
      remoteRevision: number;
      remoteIdentity?: string;
      remoteCandidate?: Record<string, unknown> | null;
      remoteDeleted?: boolean;
    }
  | { status: "offline"; message: string }
  | { status: "rejected"; message: string; code: string; permanent: boolean };

export type Amv2HistoryReadResult =
  | { status: "authenticated"; ownerUserId: string; page: Amv2HistoryPage }
  | { status: "unauthenticated" }
  | { status: "snapshot_changed" }
  | { status: "offline" | "unavailable"; message: string };

export async function probeAmv2Account(monthKey: string, signal?: AbortSignal) {
  const [year, month] = monthKey.split("-").map(Number);
  const from = `${monthKey}-01`;
  const to = `${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  try {
    const response = await fetch(`/api/amv2/sync?from=${from}&to=${to}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (response.status === 401) return { status: "unauthenticated" as const };
    if (!response.ok) return { status: "unavailable" as const };
    const snapshot = await response.json() as Record<string, unknown>;
    if (snapshot.authenticated !== true) return { status: "unauthenticated" as const };
    return { status: "authenticated" as const, snapshot };
  } catch {
    return { status: "offline" as const };
  }
}

export async function readAmv2HistoryPage({
  cursor = null,
  snapshotRevision = null,
  signal,
}: {
  cursor?: string | null;
  snapshotRevision?: number | null;
  signal?: AbortSignal;
} = {}): Promise<Amv2HistoryReadResult> {
  const params = new URLSearchParams({ limit: String(AMV2_HISTORY_PAGE_SIZE) });
  if (cursor) params.set("before", cursor);
  if (snapshotRevision !== null) params.set("snapshotRevision", String(snapshotRevision));
  try {
    const response = await fetch(`/api/amv2/sync/history?${params}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (response.status === 401) return { status: "unauthenticated" };
    if (response.status === 409) return { status: "snapshot_changed" };
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      return {
        status: response.status >= 500 ? "offline" : "unavailable",
        message: typeof body.error === "string" ? body.error : "Istoricul complet nu este disponibil momentan.",
      };
    }
    if (body.authenticated !== true || typeof body.ownerUserId !== "string") {
      return { status: "unauthenticated" };
    }
    return {
      status: "authenticated",
      ownerUserId: body.ownerUserId,
      page: normalizeHistoryPage(body, {
        requestedCursor: cursor,
        requestedSnapshotRevision: snapshotRevision,
      }),
    };
  } catch (error) {
    return {
      status: "offline",
      message: error instanceof Error ? error.message : "Istoricul complet nu este disponibil momentan.",
    };
  }
}

export async function sendAmv2Operation(operation: Amv2OutboxOperation): Promise<Amv2CloudSaveResult> {
  try {
    const response = await fetch("/api/amv2/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(operation),
    });
    if (response.status === 401) return { status: "unauthenticated" };
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 409) {
      const remoteCandidate = body.remoteCandidate;
      return {
        status: "conflict",
        message: typeof body.error === "string" ? body.error : "Ziua a fost modificată în altă sesiune.",
        remoteRevision: Number(body.remoteRevision ?? 0),
        ...(typeof body.remoteIdentity === "string" ? { remoteIdentity: body.remoteIdentity } : {}),
        ...(remoteCandidate === null || (remoteCandidate && typeof remoteCandidate === "object" && !Array.isArray(remoteCandidate))
          ? { remoteCandidate: remoteCandidate as Record<string, unknown> | null }
          : {}),
        ...(typeof body.remoteDeleted === "boolean" ? { remoteDeleted: body.remoteDeleted } : {}),
      };
    }
    if (!response.ok) {
      if (response.status >= 500) {
        return { status: "offline", message: "Serviciul de sincronizare nu este disponibil momentan." };
      }
      return {
        status: "rejected",
        message: typeof body.error === "string" ? body.error : "Salvarea în cont a fost respinsă.",
        code: typeof body.code === "string" ? body.code : "VALIDATION",
        permanent: [400, 413, 422].includes(response.status) && body.code !== "ACCOUNT_BOUNDARY",
      };
    }
    const result = body.result as Record<string, unknown> | undefined;
    if (!result || typeof result.remoteIdentity !== "string" || !Number.isInteger(result.revision)) {
      return { status: "rejected", message: "Confirmarea cloud AMV2 este invalidă.", code: "INVALID_CONFIRMATION", permanent: false };
    }
    const canonicalCandidate = result.canonicalCandidate;
    return {
      status: "confirmed",
      remoteIdentity: result.remoteIdentity,
      revision: Number(result.revision),
      deleted: result.deleted === true,
      ...(canonicalCandidate === null || (canonicalCandidate && typeof canonicalCandidate === "object" && !Array.isArray(canonicalCandidate))
        ? { canonicalCandidate: canonicalCandidate as Record<string, unknown> | null }
        : {}),
    };
  } catch (error) {
    return { status: "offline", message: error instanceof Error ? error.message : "Conexiunea nu este disponibilă." };
  }
}
