export const VIDEO_METADATA_DIAGNOSTIC_EVENT = "vemi.video_metadata_route.diagnostic.v1";
export const VIDEO_METADATA_QUERY_ERROR_CODE = "VIDEO_METADATA_QUERY_ERROR";

export type VideoMetadataDiagnosticClassification =
  | "QUERY_ERROR"
  | "NO_DATA"
  | "SUCCESS"
  | "SIGNING_ERROR";

type VideoMetadataDiagnosticStage =
  | "metadata_query"
  | "format_validation"
  | "url_signing"
  | "response";

type DiagnosticLogger = {
  info(message: string): void;
  error(message: string): void;
};

export function createVideoMetadataRequestId() {
  return crypto.randomUUID();
}

export function createVideoMetadataResponseHeaders(requestId: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "X-Request-ID": requestId,
  };
}

export function classifyVideoMetadataQuery<T>(data: T | null, error: unknown) {
  if (error != null) return { classification: "QUERY_ERROR" as const };
  if (data == null) return { classification: "NO_DATA" as const };
  return { classification: "SUCCESS" as const, data };
}

export function createVideoMetadataQueryErrorBody() {
  return {
    available: false as const,
    code: VIDEO_METADATA_QUERY_ERROR_CODE,
  };
}

export function emitVideoMetadataDiagnostic(
  logger: DiagnosticLogger,
  classification: VideoMetadataDiagnosticClassification,
  stage: VideoMetadataDiagnosticStage,
  requestId: string,
) {
  const serializedEntry = JSON.stringify({
    event: VIDEO_METADATA_DIAGNOSTIC_EVENT,
    stage,
    requestId,
    classification,
    timestamp: new Date().toISOString(),
  });

  if (classification === "QUERY_ERROR" || classification === "SIGNING_ERROR") {
    logger.error(serializedEntry);
    return;
  }

  logger.info(serializedEntry);
}
