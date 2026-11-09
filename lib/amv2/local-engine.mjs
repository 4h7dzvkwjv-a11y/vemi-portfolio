import { Amv2DomainError, validateWorkoutDraft } from "./draft-domain.mjs";
import {
  abandonWorkoutSession,
  completeWorkoutSession,
  createWorkoutDefinitionSnapshot,
  createWorkoutSession,
  reduceWorkoutSession,
} from "./session-domain.mjs";
import { validateLocalEnvelope } from "./local-schema-v3.mjs";

const fail = (code, message) => {
  throw new Amv2DomainError(code, message);
};

const isTimestamp = (value) => typeof value === "string"
  && value.trim().length > 0
  && Number.isFinite(Date.parse(value));

function nextEnvelope(envelope, patch, savedAt) {
  const currentValidation = validateLocalEnvelope(envelope);
  if (!currentValidation.valid) fail("INVALID_LOCAL_ENVELOPE", currentValidation.issues.join(" "));
  if (!isTimestamp(savedAt)) fail("MISSING_TIMESTAMP", "Tranziția locală necesită un timestamp valid.");
  const next = {
    ...envelope,
    ...patch,
    revision: envelope.revision + 1,
    savedAt,
  };
  const nextValidation = validateLocalEnvelope(next);
  if (!nextValidation.valid) fail("INVALID_LOCAL_TRANSITION", nextValidation.issues.join(" "));
  return next;
}

export function replaceDraftInLocalEnvelope(envelope, draft, savedAt) {
  const validation = validateWorkoutDraft(draft, { requireName: false });
  if (!validation.valid) fail("INVALID_DRAFT", validation.issues.join(" "));
  if (envelope.drafts[0] === draft) return envelope;
  return nextEnvelope(envelope, { drafts: [draft] }, savedAt);
}

export function saveDefinitionInLocalEnvelope(envelope, draft, savedAt) {
  const definition = createWorkoutDefinitionSnapshot(draft, savedAt);
  return nextEnvelope(envelope, { drafts: [draft], definitions: [definition] }, savedAt);
}

export function startLocalSession(envelope, { draft, sessionId, startedAt }) {
  if (envelope.activeSession !== null) return envelope;
  const definition = createWorkoutDefinitionSnapshot(draft, startedAt);
  const session = createWorkoutSession({ id: sessionId, definition, startedAt });
  return nextEnvelope(envelope, {
    drafts: [draft],
    definitions: [definition],
    activeSession: session,
  }, startedAt);
}

export function updateActiveSessionInLocalEnvelope(envelope, action) {
  if (envelope.activeSession === null) fail("NO_ACTIVE_SESSION", "Nu există o sesiune activă de actualizat.");
  const session = reduceWorkoutSession(envelope.activeSession, action);
  if (session === envelope.activeSession) return envelope;
  return nextEnvelope(envelope, { activeSession: session }, action.updatedAt);
}

export function completeActiveSessionInLocalEnvelope(envelope, { sessionId, completedAt }) {
  if (envelope.activeSession === null) {
    if (envelope.completedSessions.some((session) => session.id === sessionId)) return envelope;
    fail("NO_ACTIVE_SESSION", "Nu există o sesiune activă de încheiat.");
  }
  if (envelope.activeSession.id !== sessionId) fail("SESSION_ID_MISMATCH", "Sesiunea activă nu corespunde cererii.");
  const completed = completeWorkoutSession(envelope.activeSession, completedAt);
  const completedSessions = envelope.completedSessions.some((session) => session.id === completed.id)
    ? envelope.completedSessions
    : [completed, ...envelope.completedSessions];
  return nextEnvelope(envelope, { activeSession: null, completedSessions }, completedAt);
}

export function abandonActiveSessionInLocalEnvelope(envelope, { sessionId, abandonedAt }) {
  if (envelope.activeSession === null) {
    if (envelope.abandonedSessions.some((session) => session.id === sessionId)) return envelope;
    fail("NO_ACTIVE_SESSION", "Nu există o sesiune activă de abandonat.");
  }
  if (envelope.activeSession.id !== sessionId) fail("SESSION_ID_MISMATCH", "Sesiunea activă nu corespunde cererii.");
  const abandoned = abandonWorkoutSession(envelope.activeSession, abandonedAt);
  const abandonedSessions = envelope.abandonedSessions.some((session) => session.id === abandoned.id)
    ? envelope.abandonedSessions
    : [abandoned, ...envelope.abandonedSessions];
  return nextEnvelope(envelope, { activeSession: null, abandonedSessions }, abandonedAt);
}
