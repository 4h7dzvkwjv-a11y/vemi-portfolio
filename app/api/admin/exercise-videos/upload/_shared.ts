import "server-only";

import { NextResponse } from "next/server";

export const adminUploadResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
};

export type AdminUploadErrorStage = "prepare" | "cors-preflight" | "r2-put" | "verify" | "poster" | "associate" | "abort";

export function adminUploadError(
  message: string,
  status: number,
  details: { stage?: AdminUploadErrorStage; code?: string } = {},
) {
  return NextResponse.json(
    { success: false, message, ...details },
    { status, headers: adminUploadResponseHeaders },
  );
}

export function adminUploadSuccess(payload: Record<string, unknown>) {
  return NextResponse.json({ success: true, ...payload }, { headers: adminUploadResponseHeaders });
}

export function isSameOriginAdminRequest(request: Request) {
  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) return true;
  try {
    const allowedOrigins = new Set([new URL(request.url).origin]);
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configuredSiteUrl) {
      allowedOrigins.add(new URL(configuredSiteUrl).origin);
    }
    return allowedOrigins.has(new URL(suppliedOrigin).origin);
  } catch {
    return false;
  }
}

export async function readSmallJson(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("JSON_REQUIRED");
  }
  return request.json() as Promise<unknown>;
}

export function describeRequestError(error: unknown) {
  if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
    return { message: "Cererea de pregătire este prea mare.", status: 413 };
  }
  if (error instanceof Error && error.message === "JSON_REQUIRED") {
    return { message: "Cererea trebuie trimisă în format JSON.", status: 415 };
  }
  return { message: "Cererea de încărcare este invalidă.", status: 400 };
}

export function exercisePayload(exercise: {
  exerciseKey: string;
  name: string;
}, row: {
  width_pixels: number;
  height_pixels: number;
  duration_seconds: number | string;
  file_size_bytes: number | string;
  updated_at: string;
}) {
  return {
    exerciseKey: exercise.exerciseKey,
    name: exercise.name,
    status: "available" as const,
    width: row.width_pixels,
    height: row.height_pixels,
    durationSeconds: Number(row.duration_seconds),
    fileSizeBytes: Number(row.file_size_bytes),
    updatedAt: row.updated_at,
  };
}
