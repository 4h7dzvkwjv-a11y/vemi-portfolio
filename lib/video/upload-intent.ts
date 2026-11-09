import "server-only";

import { bytesToHex, constantTimeEqualHex } from "./digest";

type BaseVideoIntent = {
  version: 1;
  userId: string;
  exerciseKey: string;
  mutationId: string;
  uploadObjectKey: string;
  verifiedObjectKey: string;
  finalObjectKey: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  width: number;
  height: number;
  durationMilliseconds: number;
  issuedAt: number;
  expiresAt: number;
};

export type UploadIntent = BaseVideoIntent & { kind: "upload" };

export type VerifiedUploadIntent = Omit<BaseVideoIntent, "issuedAt" | "expiresAt"> & {
  kind: "verified";
  issuedAt: number;
  expiresAt: number;
};

export type PosterUploadIntent = Omit<BaseVideoIntent, "issuedAt" | "expiresAt"> & {
  kind: "poster";
  posterUploadObjectKey: string;
  posterVerifiedObjectKey: string;
  finalPosterObjectKey: string;
  posterFileSizeBytes: number;
  posterSha256: string;
  posterWidth: number;
  posterHeight: number;
  issuedAt: number;
  expiresAt: number;
};

export type ExerciseVideoIntent = UploadIntent | VerifiedUploadIntent | PosterUploadIntent;

function signingSecret() {
  const value = process.env.R2_WRITE_SECRET_ACCESS_KEY?.trim();
  if (!value) throw new Error("Missing server configuration: R2_WRITE_SECRET_ACCESS_KEY");
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodePayload(payload: ExerciseVideoIntent) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function isIntent(value: unknown): value is ExerciseVideoIntent {
  if (!value || typeof value !== "object") return false;
  const intent = value as Partial<ExerciseVideoIntent>;
  return intent.version === 1
    && (intent.kind === "upload" || intent.kind === "verified" || intent.kind === "poster")
    && typeof intent.userId === "string"
    && typeof intent.exerciseKey === "string"
    && typeof intent.mutationId === "string"
    && typeof intent.uploadObjectKey === "string"
    && typeof intent.verifiedObjectKey === "string"
    && typeof intent.finalObjectKey === "string"
    && typeof intent.fileName === "string"
    && typeof intent.fileSizeBytes === "number"
    && typeof intent.sha256 === "string"
    && typeof intent.width === "number"
    && typeof intent.height === "number"
    && typeof intent.durationMilliseconds === "number"
    && (intent.kind !== "poster" || (
      typeof intent.posterUploadObjectKey === "string"
      && typeof intent.posterVerifiedObjectKey === "string"
      && typeof intent.finalPosterObjectKey === "string"
      && typeof intent.posterFileSizeBytes === "number"
      && typeof intent.posterSha256 === "string"
      && typeof intent.posterWidth === "number"
      && typeof intent.posterHeight === "number"
    ))
    && typeof intent.issuedAt === "number"
    && typeof intent.expiresAt === "number";
}

async function signature(payloadPart: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart)));
}

export async function createExerciseVideoIntentToken(payload: ExerciseVideoIntent) {
  const payloadPart = encodePayload(payload);
  return `${payloadPart}.${await signature(payloadPart)}`;
}

export async function verifyExerciseVideoIntentToken(token: string, expectedKind: ExerciseVideoIntent["kind"]) {
  const [payloadPart, suppliedSignature, extra] = token.split(".");
  if (!payloadPart || !suppliedSignature || extra || !/^[0-9a-f]{64}$/i.test(suppliedSignature)) {
    throw new Error("Invalid upload token");
  }
  const expectedSignature = await signature(payloadPart);
  if (!constantTimeEqualHex(expectedSignature, suppliedSignature.toLowerCase())) {
    throw new Error("Invalid upload token signature");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
  } catch {
    throw new Error("Invalid upload token payload");
  }
  if (!isIntent(decoded) || decoded.kind !== expectedKind) throw new Error("Invalid upload token kind");
  if (decoded.expiresAt < Math.floor(Date.now() / 1000)) throw new Error("Upload token expired");
  return decoded;
}

export function intentExpiry(uploadUrlExpiresInSeconds: number) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return { issuedAt, expiresAt: issuedAt + uploadUrlExpiresInSeconds + 300 };
}
