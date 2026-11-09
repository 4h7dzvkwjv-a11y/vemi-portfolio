import { NextRequest, NextResponse } from "next/server";
import { hydrateCloudCalendarSnapshot } from "../../../../lib/amv2/cloud-graph.mjs";
import {
  getAmv2OperationRpcErrorKind,
  getAmv2PublicApiError,
} from "../../../../lib/amv2/public-api-error.mjs";
import { createClient } from "../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStoreHeaders = { "cache-control": "private, no-store, max-age=0" };
const operationTypes = new Set(["upsert_day", "delete_day", "upsert_personal", "archive_personal", "import_days"]);
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type OperationType = "upsert_day" | "delete_day" | "upsert_personal" | "archive_personal" | "import_days";
type ApplyResult = Record<string, unknown> & {
  remoteIdentity: string;
  revision: number;
};
type AuthoritativeState = {
  remoteIdentity: string;
  revision: number;
  canonicalCandidate: Record<string, unknown> | null;
  deleted: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDateKey(value: string) {
  if (!dateKeyPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseApplyResult(value: unknown): ApplyResult {
  if (!isRecord(value)
    || typeof value.remoteIdentity !== "string"
    || typeof value.revision !== "number"
    || !Number.isInteger(value.revision)
    || value.revision < 0) {
    throw new Error("Confirmarea cloud AMV2 este invalidă.");
  }
  return value as ApplyResult;
}

async function readOwnerCalendar(supabase: SupabaseServerClient, from: string, to: string) {
  const { data, error } = await supabase.rpc("amv2_read_calendar", { p_from: from, p_to: to });
  if (error) throw error;
  const raw = isRecord(data) ? data : {};
  return {
    raw,
    hydrated: hydrateCloudCalendarSnapshot(raw),
  };
}

function dayStateFromSnapshot(
  date: string,
  snapshot: Awaited<ReturnType<typeof readOwnerCalendar>>,
): AuthoritativeState {
  const day = snapshot.hydrated.days.find((candidate) => candidate.date === date);
  const tombstone = snapshot.hydrated.tombstones.find((candidate) => candidate.date === date);
  if (day) {
    const revision = snapshot.hydrated.dayRevisions[date];
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revizia zilei cloud AMV2 este invalidă.");
    return {
      remoteIdentity: `day:${date}`,
      revision,
      canonicalCandidate: day as unknown as Record<string, unknown>,
      deleted: false,
    };
  }
  if (tombstone) {
    return {
      remoteIdentity: `day:${date}`,
      revision: tombstone.revision,
      canonicalCandidate: null,
      deleted: true,
    };
  }
  throw new Error("Starea autoritativă a zilei AMV2 nu este disponibilă.");
}

async function readAuthoritativeState(
  supabase: SupabaseServerClient,
  type: OperationType,
  payload: Record<string, unknown>,
  fallback: ApplyResult,
): Promise<AuthoritativeState> {
  if (type === "upsert_day" || type === "delete_day") {
    if (typeof payload.date !== "string" || !dateKeyPattern.test(payload.date)) {
      throw new Error("Data operației AMV2 este invalidă.");
    }
    return dayStateFromSnapshot(payload.date, await readOwnerCalendar(supabase, payload.date, payload.date));
  }

  if (type === "upsert_personal" || type === "archive_personal") {
    if (typeof payload.id !== "string" || payload.id.length === 0) {
      throw new Error("Identitatea exercițiului personal este invalidă.");
    }
    // Personal definitions are owner-filtered by RLS and returned independently
    // of the requested day range by the canonical read RPC.
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await readOwnerCalendar(supabase, today, today);
    const personal = snapshot.hydrated.personalExercises.find((candidate) => candidate.id === payload.id);
    if (!personal) throw new Error("Exercițiul personal autoritativ nu este disponibil.");
    return {
      remoteIdentity: `personal:${payload.id}`,
      revision: personal.revision,
      canonicalCandidate: personal as unknown as Record<string, unknown>,
      deleted: false,
    };
  }

  const dates = Array.isArray(payload.days)
    ? [...new Set(payload.days.flatMap((day) => isRecord(day) && typeof day.date === "string" && dateKeyPattern.test(day.date)
      ? [day.date]
      : []))].sort()
    : [];
  if (dates.length === 0) throw new Error("Importul AMV2 nu conține date autoritative.");
  const dayStates = await Promise.all(dates.map(async (date) => (
    dayStateFromSnapshot(date, await readOwnerCalendar(supabase, date, date))
  )));
  return {
    remoteIdentity: fallback.remoteIdentity,
    revision: fallback.revision,
    canonicalCandidate: {
      days: dayStates.map((state) => state.canonicalCandidate),
    },
    deleted: false,
  };
}

async function authenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return { supabase, userId: null };
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function publicError(kind: Parameters<typeof getAmv2PublicApiError>[0]) {
  const response = getAmv2PublicApiError(kind);
  return json(response.body, response.status);
}

function dateRange(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to || !isDateKey(from) || !isDateKey(to) || from > to) {
    return null;
  }
  const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(rangeDays) || rangeDays > 366) return null;
  return { from, to };
}

export async function GET(request: NextRequest) {
  const range = dateRange(request);
  if (!range) return publicError("calendarInvalidRequest");
  try {
    const { from, to } = range;
    const { supabase, userId } = await authenticatedContext();
    if (!userId) return json({ authenticated: false });

    const { data, error } = await supabase.rpc("amv2_read_calendar", { p_from: from, p_to: to });
    if (error) throw error;
    const snapshot = isRecord(data) ? data : {};
    return json({
      ...snapshot,
      authenticated: true,
      ownerUserId: userId,
    });
  } catch {
    return publicError("calendarUnavailable");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await authenticatedContext();
    if (!userId) return json({ authenticated: false }, 401);
    const parsedBody = await request.json().catch(() => null);
    if (!isRecord(parsedBody)) return publicError("operationInvalid");
    const body = parsedBody;
    if (typeof body.ownerUserId !== "string"
      || typeof body.operationKey !== "string"
      || body.operationKey.length > 160
      || typeof body.type !== "string"
      || !operationTypes.has(body.type)
      || typeof body.expectedRevision !== "number"
      || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 0
      || !body.payload
      || typeof body.payload !== "object"
      || Array.isArray(body.payload)) {
      return publicError("operationInvalid");
    }
    if (body.ownerUserId !== userId) {
      return publicError("accountBoundary");
    }
    if (new TextEncoder().encode(JSON.stringify(body.payload)).byteLength > 512 * 1_024) {
      return publicError("payloadTooLarge");
    }
    const { data, error } = await supabase.rpc("amv2_apply_operation", {
      p_operation_key: body.operationKey,
      p_operation_type: body.type,
      p_expected_revision: body.expectedRevision,
      p_payload: body.payload,
    });
    if (error) {
      const errorKind = getAmv2OperationRpcErrorKind(error);
      if (errorKind === "conflict") {
        const payload = body.payload as Record<string, unknown>;
        const identity = body.type === "upsert_day" || body.type === "delete_day"
          ? `day:${String(payload.date ?? "")}`
          : `personal:${String(payload.id ?? "")}`;
        const authoritative = await readAuthoritativeState(supabase, body.type as OperationType, payload, {
          remoteIdentity: identity,
          revision: 0,
        });
        const response = getAmv2PublicApiError("conflict");
        return json({
          ...response.body,
          remoteIdentity: authoritative.remoteIdentity,
          remoteRevision: authoritative.revision,
          remoteCandidate: authoritative.canonicalCandidate,
          remoteDeleted: authoritative.deleted,
        }, response.status);
      }
      return publicError(errorKind);
    }
    const result = parseApplyResult(data);
    const authoritative = await readAuthoritativeState(
      supabase,
      body.type as OperationType,
      body.payload as Record<string, unknown>,
      result,
    );
    return json({
      authenticated: true,
      result: {
        ...result,
        remoteIdentity: authoritative.remoteIdentity,
        revision: authoritative.revision,
        canonicalCandidate: authoritative.canonicalCandidate,
        deleted: authoritative.deleted,
      },
    });
  } catch {
    return publicError("operationUnavailable");
  }
}
