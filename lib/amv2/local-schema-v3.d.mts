import type { WorkoutDraft } from "./draft-domain.mjs";
import type { WorkoutDefinitionSnapshot, WorkoutSession } from "./session-domain.mjs";

export type Amv2LocalEnvelopeV3 = {
  schema: "vemi-amv2-local";
  version: 3;
  installationScopeId: string;
  revision: number;
  savedAt: string;
  drafts: [WorkoutDraft];
  definitions: [] | [WorkoutDefinitionSnapshot];
  activeSession: WorkoutSession | null;
  completedSessions: WorkoutSession[];
  abandonedSessions: WorkoutSession[];
  personalExercises: [];
  pendingOperations: [];
  identityMappings: [];
  importState: {
    status: "not_started";
    sourceVersion: 2;
    preservesSource: true;
  };
  backupState: {
    status: "not_created";
    lastBackupAt: null;
  };
  compatibility: {
    preserveAnonymousV2: true;
    destructiveConversionAllowed: false;
  };
};

export type StoragePort = Pick<Storage, "getItem" | "setItem">;

export const AMV2_LOCAL_STORAGE_KEY: "vemi-amv2-local-v3";
export const AMV2_LOCAL_SCHEMA_VERSION: 3;

export function createLocalEnvelope(input: {
  installationScopeId: string;
  draft: WorkoutDraft;
  savedAt: string;
}): Amv2LocalEnvelopeV3;

export function validateLocalEnvelope(value: unknown): { valid: boolean; issues: string[] };

export function readLocalEnvelope(storage: StoragePort):
  | { status: "missing" }
  | { status: "loaded"; envelope: Amv2LocalEnvelopeV3; raw: string }
  | { status: "invalid"; error: string; raw: string }
  | { status: "unavailable"; error: string };

export function writeLocalEnvelope(storage: StoragePort, envelope: Amv2LocalEnvelopeV3):
  | { status: "saved_local"; payloadBytes: number; serialized: string }
  | { status: "save_error"; error: string; payloadBytes?: number };
