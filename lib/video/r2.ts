import "server-only";

import { AwsV4Signer } from "aws4fetch";

type R2ReadConfig = {
  bucket: string;
  endpointOrigin: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresIn: number;
};

type R2WriteConfig = Omit<R2ReadConfig, "expiresIn">;

export type R2ObjectMetadata = {
  contentLength: number;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
};

export type R2ListedObject = {
  key: string;
  lastModified: string | null;
  size: number;
};

let cachedConfig: R2ReadConfig | null = null;
let cachedWriteConfig: R2WriteConfig | null = null;

export type R2CorsPreflightResult = {
  ok: boolean;
  status: number;
  allowedOrigin: string | null;
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAgeSeconds: number | null;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function getR2ReadConfig(): R2ReadConfig {
  if (cachedConfig) return cachedConfig;

  const accountId = required("R2_ACCOUNT_ID");
  const endpoint = required("R2_S3_ENDPOINT");
  const accessKeyId = required("R2_READ_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_READ_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET_NAME");
  const requestedTtl = Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? "900");
  const expiresIn = Number.isFinite(requestedTtl)
    ? Math.min(900, Math.max(60, Math.floor(requestedTtl)))
    : 900;

  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "https:") throw new Error("R2 endpoint must use HTTPS");
  if (!parsedEndpoint.hostname.startsWith(accountId)) throw new Error("R2 endpoint does not match R2_ACCOUNT_ID");

  cachedConfig = {
    bucket,
    endpointOrigin: parsedEndpoint.origin,
    accessKeyId,
    secretAccessKey,
    expiresIn,
  };

  return cachedConfig;
}

function getR2WriteConfig(): R2WriteConfig {
  if (cachedWriteConfig) return cachedWriteConfig;

  const accountId = required("R2_ACCOUNT_ID");
  const endpoint = required("R2_S3_ENDPOINT");
  const accessKeyId = required("R2_WRITE_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_WRITE_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET_NAME");
  const parsedEndpoint = new URL(endpoint);

  if (parsedEndpoint.protocol !== "https:") throw new Error("R2 endpoint must use HTTPS");
  if (!parsedEndpoint.hostname.startsWith(accountId)) throw new Error("R2 endpoint does not match R2_ACCOUNT_ID");

  cachedWriteConfig = { bucket, endpointOrigin: parsedEndpoint.origin, accessKeyId, secretAccessKey };
  return cachedWriteConfig;
}

function getDirectUploadTtlSeconds() {
  const requested = Number(process.env.R2_UPLOAD_URL_TTL_SECONDS ?? "300");
  return Number.isFinite(requested) ? Math.min(600, Math.max(60, Math.floor(requested))) : 300;
}

function validateObjectKey(objectKey: string) {
  const normalizedKey = objectKey.trim();
  if (!normalizedKey || normalizedKey.startsWith("/") || normalizedKey.includes("..")) {
    throw new Error("Invalid R2 object key");
  }
  return normalizedKey;
}

function encodedObjectKey(objectKey: string) {
  return validateObjectKey(objectKey).split("/").map(encodeURIComponent).join("/");
}

function objectUrl(endpointOrigin: string, bucket: string, objectKey: string) {
  return new URL(`${endpointOrigin}/${encodeURIComponent(bucket)}/${encodedObjectKey(objectKey)}`);
}

function bucketUrl(endpointOrigin: string, bucket: string) {
  return new URL(`${endpointOrigin}/${encodeURIComponent(bucket)}`);
}

async function signedFetch(
  config: R2WriteConfig | R2ReadConfig,
  method: string,
  url: URL,
  options: { headers?: HeadersInit; body?: BodyInit; allHeaders?: boolean } = {},
) {
  const signer = new AwsV4Signer({
    method,
    url: url.toString(),
    headers: options.headers,
    body: options.body,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    allHeaders: options.allHeaders,
  });
  const signed = await signer.sign();
  return fetch(signed.url, {
    method,
    headers: signed.headers,
    body: options.body,
    cache: "no-store",
  });
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

export async function createTemporaryR2ReadUrl(objectKey: string) {
  const { bucket, endpointOrigin, accessKeyId, secretAccessKey, expiresIn } = getR2ReadConfig();
  const url = objectUrl(endpointOrigin, bucket, objectKey);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  const signer = new AwsV4Signer({
    method: "GET",
    url: url.toString(),
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
  });
  const signed = await signer.sign();
  return signed.url.toString();
}

export async function createTemporaryR2UploadUrl(objectKey: string, contentType = "video/mp4") {
  const { bucket, endpointOrigin, accessKeyId, secretAccessKey } = getR2WriteConfig();
  const expiresIn = getDirectUploadTtlSeconds();
  const url = objectUrl(endpointOrigin, bucket, objectKey);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  const headers = { "Content-Type": contentType };

  const signer = new AwsV4Signer({
    method: "PUT",
    url: url.toString(),
    headers,
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
    allHeaders: true,
  });
  const signed = await signer.sign();

  return {
    url: signed.url.toString(),
    headers,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    expiresIn,
  };
}

function splitCorsHeader(value: string | null) {
  return value?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) ?? [];
}

export async function probeR2BrowserUploadCors(
  signedUploadUrl: string,
  originValue: string,
  requestedHeaders: string[] = ["content-type"],
): Promise<R2CorsPreflightResult> {
  const origin = new URL(originValue).origin;
  const response = await fetch(signedUploadUrl, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": requestedHeaders.join(", "),
    },
    cache: "no-store",
  });
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  const allowedMethods = splitCorsHeader(response.headers.get("access-control-allow-methods"));
  const allowedHeaders = splitCorsHeader(response.headers.get("access-control-allow-headers"));
  const maxAgeHeader = response.headers.get("access-control-max-age");
  const maxAgeValue = maxAgeHeader === null ? Number.NaN : Number(maxAgeHeader);
  const normalizedRequestedHeaders = requestedHeaders.map((header) => header.toLowerCase());
  const allowsEveryHeader = normalizedRequestedHeaders.every((header) => allowedHeaders.includes(header));

  return {
    ok: response.ok
      && allowedOrigin === origin
      && allowedMethods.includes("put")
      && allowsEveryHeader,
    status: response.status,
    allowedOrigin,
    allowedMethods,
    allowedHeaders,
    maxAgeSeconds: Number.isFinite(maxAgeValue) ? maxAgeValue : null,
  };
}

export async function uploadR2Object(objectKey: string, bytes: ArrayBuffer, contentType: string) {
  const config = getR2WriteConfig();
  const url = objectUrl(config.endpointOrigin, config.bucket, objectKey);
  const response = await signedFetch(config, "PUT", url, {
    headers: { "Content-Type": contentType },
    body: bytes,
    allHeaders: true,
  });

  if (!response.ok) throw new Error(`R2 upload failed with status ${response.status}`);
}

export async function copyR2Object(sourceObjectKey: string, destinationObjectKey: string, contentType: string) {
  const config = getR2WriteConfig();
  const url = objectUrl(config.endpointOrigin, config.bucket, destinationObjectKey);
  const copySource = `/${encodeURIComponent(config.bucket)}/${encodedObjectKey(sourceObjectKey)}`;
  const response = await signedFetch(config, "PUT", url, {
    headers: {
      "Content-Type": contentType,
      "x-amz-copy-source": copySource,
      "x-amz-metadata-directive": "REPLACE",
    },
    allHeaders: true,
  });
  if (!response.ok) throw new Error(`R2 copy failed with status ${response.status}`);
}

export async function deleteR2Object(objectKey: string) {
  const config = getR2WriteConfig();
  const url = objectUrl(config.endpointOrigin, config.bucket, objectKey);
  const response = await signedFetch(config, "DELETE", url);
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed with status ${response.status}`);
  }
}

export async function headR2Object(objectKey: string): Promise<R2ObjectMetadata | null> {
  const config = getR2ReadConfig();
  const url = objectUrl(config.endpointOrigin, config.bucket, objectKey);
  const response = await signedFetch(config, "HEAD", url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 metadata read failed with status ${response.status}`);

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new Error("R2 returned an invalid object size");
  }
  return {
    contentLength,
    contentType: response.headers.get("content-type"),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export async function readR2Object(objectKey: string, maximumBytes: number) {
  const url = await createTemporaryR2ReadUrl(objectKey);
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`R2 verification read failed with status ${response.status}`);

  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > maximumBytes) {
    throw new Error("R2 object exceeds the verification size limit");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maximumBytes) throw new Error("R2 object exceeds the verification size limit");
  return bytes;
}

export async function listR2Objects(prefix: string, maximumKeys = 100): Promise<R2ListedObject[]> {
  const config = getR2WriteConfig();
  const url = bucketUrl(config.endpointOrigin, config.bucket);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", validateObjectKey(prefix));
  url.searchParams.set("max-keys", String(Math.min(1000, Math.max(1, maximumKeys))));
  const response = await signedFetch(config, "GET", url);
  if (!response.ok) throw new Error(`R2 object listing failed with status ${response.status}`);
  const xml = await response.text();

  return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].flatMap((match) => {
    const key = match[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
    if (!key) return [];
    const lastModified = match[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? null;
    const size = Number(match[1].match(/<Size>(\d+)<\/Size>/)?.[1] ?? "0");
    return [{ key: decodeXml(key), lastModified, size: Number.isFinite(size) ? size : 0 }];
  });
}

export async function cleanupStaleExerciseVideoUploads(olderThanMilliseconds = 60 * 60 * 1000) {
  const prefix = "staging/exercise-videos/";
  const objects = await listR2Objects(prefix, 200);
  const cutoff = Date.now() - olderThanMilliseconds;
  let deleted = 0;
  for (const object of objects) {
    const modifiedAt = object.lastModified ? Date.parse(object.lastModified) : Number.NaN;
    if (Number.isFinite(modifiedAt) && modifiedAt < cutoff) {
      await deleteR2Object(object.key);
      deleted += 1;
    }
  }
  return deleted;
}
