const DEFINITIONS = Object.freeze({
  calendarInvalidRequest: Object.freeze({
    status: 400,
    body: Object.freeze({
      error: "Intervalul calendaristic este invalid.",
      code: "VALIDATION",
    }),
  }),
  calendarUnavailable: Object.freeze({
    status: 503,
    body: Object.freeze({ error: "Calendarul din cont nu poate fi citit momentan." }),
  }),
  operationInvalid: Object.freeze({
    status: 400,
    body: Object.freeze({ error: "Operația AMV2 este invalidă." }),
  }),
  accountBoundary: Object.freeze({
    status: 403,
    body: Object.freeze({
      error: "Operația AMV2 nu corespunde contului autentificat.",
      code: "ACCOUNT_BOUNDARY",
    }),
  }),
  payloadTooLarge: Object.freeze({
    status: 413,
    body: Object.freeze({ error: "Payloadul AMV2 depășește 512 KiB." }),
  }),
  conflict: Object.freeze({
    status: 409,
    body: Object.freeze({
      error: "Datele din cont s-au schimbat. Alege versiunea pe care vrei să o păstrezi.",
      code: "CONFLICT",
    }),
  }),
  idempotencyPayloadConflict: Object.freeze({
    status: 400,
    body: Object.freeze({
      error: "Operația a fost deja folosită cu alte date.",
      code: "IDEMPOTENCY_PAYLOAD_CONFLICT",
    }),
  }),
  importOccurrenceConflict: Object.freeze({
    status: 400,
    body: Object.freeze({
      error: "Aceeași apariție V1 a fost deja importată cu alte valori.",
      code: "IMPORT_OCCURRENCE_CONFLICT",
    }),
  }),
  operationValidation: Object.freeze({
    status: 400,
    body: Object.freeze({
      error: "Datele operației AMV2 nu sunt valide.",
      code: "VALIDATION",
    }),
  }),
  operationUnavailable: Object.freeze({
    status: 503,
    body: Object.freeze({ error: "Operația AMV2 nu poate fi salvată momentan." }),
  }),
  historyInvalidRequest: Object.freeze({
    status: 400,
    body: Object.freeze({
      error: "Parametrii paginii istorice sunt invalizi.",
      code: "HISTORY_UNAVAILABLE",
    }),
  }),
  historySnapshotChanged: Object.freeze({
    status: 409,
    body: Object.freeze({
      error: "Istoricul s-a schimbat; acoperirea va fi reluată.",
      code: "HISTORY_SNAPSHOT_CHANGED",
    }),
  }),
  historyUnavailable: Object.freeze({
    status: 503,
    body: Object.freeze({
      error: "Istoricul complet nu poate fi citit momentan.",
      code: "HISTORY_UNAVAILABLE",
    }),
  }),
});

export function getAmv2PublicApiError(kind) {
  const definition = DEFINITIONS[kind];
  if (!definition) throw new TypeError("Tipul erorii publice AMV2 este invalid.");
  return {
    status: definition.status,
    body: { ...definition.body },
  };
}

const OPERATION_VALIDATION_SQLSTATES = new Set(["22023", "23503", "23514"]);

function rpcErrorFields(error) {
  return {
    code: error && typeof error === "object" && typeof error.code === "string" ? error.code : "",
    message: error && typeof error === "object" && typeof error.message === "string" ? error.message : "",
  };
}

export function getAmv2OperationRpcErrorKind(error) {
  const { code, message } = rpcErrorFields(error);
  if (code === "40001" || message.includes("AMV2_REVISION_CONFLICT")) return "conflict";
  if (message.includes("AMV2_IDEMPOTENCY_PAYLOAD_CONFLICT")) return "idempotencyPayloadConflict";
  if (message.includes("AMV2_IMPORT_OCCURRENCE_CONFLICT")) return "importOccurrenceConflict";
  if (code === "54000" || message.includes("AMV2_PAYLOAD_TOO_LARGE")) return "payloadTooLarge";
  if (OPERATION_VALIDATION_SQLSTATES.has(code) || message.includes("AMV2_PERSONAL_ARCHIVED")) {
    return "operationValidation";
  }
  return "operationUnavailable";
}

export function getAmv2HistoryRpcErrorKind(error) {
  const { code, message } = rpcErrorFields(error);
  return code === "40001" || message.includes("AMV2_HISTORY_SNAPSHOT_CHANGED")
    || message.includes("AMV2_SNAPSHOT_REVISION_CHANGED")
    ? "historySnapshotChanged"
    : "historyUnavailable";
}
