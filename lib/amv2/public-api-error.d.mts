export type Amv2PublicApiErrorKind =
  | "calendarInvalidRequest"
  | "calendarUnavailable"
  | "operationInvalid"
  | "accountBoundary"
  | "payloadTooLarge"
  | "conflict"
  | "idempotencyPayloadConflict"
  | "importOccurrenceConflict"
  | "operationValidation"
  | "operationUnavailable"
  | "historyInvalidRequest"
  | "historySnapshotChanged"
  | "historyUnavailable";

export function getAmv2PublicApiError(kind: Amv2PublicApiErrorKind): {
  status: number;
  body: { error: string; code?: string };
};

export function getAmv2OperationRpcErrorKind(error: unknown): Amv2PublicApiErrorKind;
export function getAmv2HistoryRpcErrorKind(error: unknown): Amv2PublicApiErrorKind;
