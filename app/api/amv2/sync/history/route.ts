import { NextRequest, NextResponse } from "next/server";
import {
  getAmv2HistoryRpcErrorKind,
  getAmv2PublicApiError,
} from "../../../../../lib/amv2/public-api-error.mjs";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = { "cache-control": "private, no-store, max-age=0" };
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE_SIZE = 3;

function isDateKey(value: string) {
  if (!DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function publicError(kind: Parameters<typeof getAmv2PublicApiError>[0]) {
  const response = getAmv2PublicApiError(kind);
  return json(response.body, response.status);
}

function requestParameters(request: NextRequest) {
  const before = request.nextUrl.searchParams.get("before");
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? String(MAX_PAGE_SIZE);
  const rawRevision = request.nextUrl.searchParams.get("snapshotRevision");
  const limit = Number(rawLimit);
  const snapshotRevision = rawRevision === null ? null : Number(rawRevision);
  if ((before !== null && !isDateKey(before))
    || !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_PAGE_SIZE
    || !(snapshotRevision === null || (Number.isSafeInteger(snapshotRevision) && snapshotRevision >= 0))) {
    return null;
  }
  return { before, limit, snapshotRevision };
}

export async function GET(request: NextRequest) {
  const parameters = requestParameters(request);
  if (!parameters) return publicError("historyInvalidRequest");
  try {
    const { before, limit, snapshotRevision } = parameters;
    const supabase = await createClient();
    const { data: claimData, error: claimError } = await supabase.auth.getClaims();
    const userId = claimError ? null : typeof claimData?.claims?.sub === "string" ? claimData.claims.sub : null;
    if (!userId) return json({ authenticated: false }, 401);
    const { data, error } = await supabase.rpc("amv2_read_history_page", {
      p_before: before,
      p_limit: limit,
      p_snapshot_revision: snapshotRevision,
    });
    if (error) {
      return publicError(getAmv2HistoryRpcErrorKind(error));
    }
    const page = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return json({ ...page, authenticated: true, ownerUserId: userId });
  } catch {
    return publicError("historyUnavailable");
  }
}
