import { AMV2_LIMITS, validateWorkoutDraft } from "./draft-domain.mjs";
import { validateWorkoutDefinition, validateWorkoutSession } from "./session-domain.mjs";

export const AMV2_LOCAL_STORAGE_KEY = "vemi-amv2-local-v3";
export const AMV2_LOCAL_SCHEMA_VERSION = 3;

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isEmptyArray = (value) => Array.isArray(value) && value.length === 0;

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function createLocalEnvelope({ installationScopeId, draft, savedAt }) {
  return {
    schema: "vemi-amv2-local",
    version: AMV2_LOCAL_SCHEMA_VERSION,
    installationScopeId,
    revision: draft.revision,
    savedAt,
    drafts: [draft],
    definitions: [],
    activeSession: null,
    completedSessions: [],
    abandonedSessions: [],
    personalExercises: [],
    pendingOperations: [],
    identityMappings: [],
    importState: {
      status: "not_started",
      sourceVersion: 2,
      preservesSource: true,
    },
    backupState: {
      status: "not_created",
      lastBackupAt: null,
    },
    compatibility: {
      preserveAnonymousV2: true,
      destructiveConversionAllowed: false,
    },
  };
}

function normalizeLocalEnvelope(value) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    activeSession: Object.hasOwn(value, "activeSession") ? value.activeSession : null,
    completedSessions: Object.hasOwn(value, "completedSessions") ? value.completedSessions : [],
    abandonedSessions: Object.hasOwn(value, "abandonedSessions") ? value.abandonedSessions : [],
  };
}

export function validateLocalEnvelope(value) {
  value = normalizeLocalEnvelope(value);
  const issues = [];
  if (!isRecord(value)) return { valid: false, issues: ["Schema locală nu este un obiect."] };
  if (value.schema !== "vemi-amv2-local") issues.push("Identificatorul schemei locale este invalid.");
  if (value.version !== AMV2_LOCAL_SCHEMA_VERSION) issues.push("Versiunea schemei locale nu este 3.");
  if (!isText(value.installationScopeId)) issues.push("installationScopeId lipsește.");
  if (!Number.isInteger(value.revision) || value.revision < 0) issues.push("Revizia locală este invalidă.");
  if (!isText(value.savedAt)) issues.push("savedAt lipsește.");
  if (!Array.isArray(value.drafts) || value.drafts.length !== 1) {
    issues.push("Vertical Slice 1 permite exact un draft local.");
  } else {
    const draftValidation = validateWorkoutDraft(value.drafts[0]);
    issues.push(...draftValidation.issues);
  }

  if (!Array.isArray(value.definitions) || value.definitions.length > 1) {
    issues.push("Schema locală permite cel mult o definiție salvată.");
  } else if (value.definitions.length === 1) {
    issues.push(...validateWorkoutDefinition(value.definitions[0]).issues);
  }

  if (value.activeSession !== null) {
    const activeValidation = validateWorkoutSession(value.activeSession);
    issues.push(...activeValidation.issues);
    if (value.activeSession?.status !== "in_progress") issues.push("Slotul activ acceptă numai status in_progress.");
  }

  for (const [field, status] of [["completedSessions", "completed"], ["abandonedSessions", "abandoned"]]) {
    if (!Array.isArray(value[field])) {
      issues.push(`${field} trebuie să fie o listă.`);
      continue;
    }
    const ids = new Set();
    value[field].forEach((session, index) => {
      const sessionValidation = validateWorkoutSession(session);
      issues.push(...sessionValidation.issues.map((issue) => `${field}[${index}]: ${issue}`));
      if (session?.status !== status) issues.push(`${field}[${index}] are status incompatibil.`);
      if (isText(session?.id) && ids.has(session.id)) issues.push(`${field} conține un ID de sesiune duplicat.`);
      else if (isText(session?.id)) ids.add(session.id);
    });
  }

  const allSessionIds = [
    ...(value.activeSession ? [value.activeSession.id] : []),
    ...(Array.isArray(value.completedSessions) ? value.completedSessions.map((session) => session?.id) : []),
    ...(Array.isArray(value.abandonedSessions) ? value.abandonedSessions.map((session) => session?.id) : []),
  ].filter(isText);
  if (new Set(allSessionIds).size !== allSessionIds.length) {
    issues.push("Același ID de sesiune nu poate apărea în mai multe stări locale.");
  }

  for (const field of [
    "personalExercises",
    "pendingOperations",
    "identityMappings",
  ]) {
    if (!isEmptyArray(value[field])) issues.push(`${field} trebuie să rămână gol în Vertical Slice 1.`);
  }
  if (!isRecord(value.importState)
    || value.importState.status !== "not_started"
    || value.importState.sourceVersion !== 2
    || value.importState.preservesSource !== true) {
    issues.push("Starea de import trebuie să păstreze v2 fără conversie.");
  }
  if (!isRecord(value.backupState)
    || value.backupState.status !== "not_created"
    || value.backupState.lastBackupAt !== null) {
    issues.push("Starea backupului local este invalidă pentru slice.");
  }
  if (!isRecord(value.compatibility)
    || value.compatibility.preserveAnonymousV2 !== true
    || value.compatibility.destructiveConversionAllowed !== false) {
    issues.push("Contractul de compatibilitate v2 lipsește.");
  }
  return { valid: issues.length === 0, issues };
}

export function readLocalEnvelope(storage) {
  let raw;
  try {
    raw = storage.getItem(AMV2_LOCAL_STORAGE_KEY);
  } catch (error) {
    return {
      status: "unavailable",
      error: error instanceof Error ? error.message : "Stocarea locală nu poate fi citită.",
    };
  }
  if (raw === null) return { status: "missing" };

  const payloadBytes = byteLength(raw);
  if (payloadBytes > AMV2_LIMITS.semanticPayloadBytes) {
    return {
      status: "invalid",
      error: "Payloadul semantic AMV2 depășește limita de 512 KiB.",
      payloadBytes,
      raw,
    };
  }

  let envelope;
  try {
    envelope = normalizeLocalEnvelope(JSON.parse(raw));
  } catch {
    return { status: "invalid", error: "Datele locale AMV2 nu sunt JSON valid.", raw };
  }
  const validation = validateLocalEnvelope(envelope);
  if (!validation.valid) {
    return {
      status: "invalid",
      error: validation.issues.join(" "),
      raw,
    };
  }
  return { status: "loaded", envelope, raw };
}

export function writeLocalEnvelope(storage, envelope) {
  const validation = validateLocalEnvelope(envelope);
  if (!validation.valid) {
    return { status: "save_error", error: validation.issues.join(" ") };
  }
  const serialized = JSON.stringify(envelope);
  const payloadBytes = byteLength(serialized);
  if (payloadBytes > AMV2_LIMITS.semanticPayloadBytes) {
    return {
      status: "save_error",
      error: "Payloadul semantic AMV2 depășește limita de 512 KiB.",
      payloadBytes,
    };
  }
  try {
    storage.setItem(AMV2_LOCAL_STORAGE_KEY, serialized);
    return { status: "saved_local", payloadBytes, serialized };
  } catch (error) {
    return {
      status: "save_error",
      error: error instanceof Error ? error.message : "Draftul nu a putut fi salvat local.",
      payloadBytes,
    };
  }
}
