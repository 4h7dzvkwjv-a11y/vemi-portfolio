import type { WorkoutDraft } from "./draft-domain.mjs";
import type { Amv2LocalEnvelopeV3 } from "./local-schema-v3.mjs";
import type { SessionAction } from "./session-domain.mjs";

export function replaceDraftInLocalEnvelope(
  envelope: Amv2LocalEnvelopeV3,
  draft: WorkoutDraft,
  savedAt: string,
): Amv2LocalEnvelopeV3;

export function saveDefinitionInLocalEnvelope(
  envelope: Amv2LocalEnvelopeV3,
  draft: WorkoutDraft,
  savedAt: string,
): Amv2LocalEnvelopeV3;

export function startLocalSession(
  envelope: Amv2LocalEnvelopeV3,
  input: { draft: WorkoutDraft; sessionId: string; startedAt: string },
): Amv2LocalEnvelopeV3;

export function updateActiveSessionInLocalEnvelope(
  envelope: Amv2LocalEnvelopeV3,
  action: SessionAction,
): Amv2LocalEnvelopeV3;

export function completeActiveSessionInLocalEnvelope(
  envelope: Amv2LocalEnvelopeV3,
  input: { sessionId: string; completedAt: string },
): Amv2LocalEnvelopeV3;

export function abandonActiveSessionInLocalEnvelope(
  envelope: Amv2LocalEnvelopeV3,
  input: { sessionId: string; abandonedAt: string },
): Amv2LocalEnvelopeV3;
