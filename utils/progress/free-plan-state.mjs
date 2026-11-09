import { CAT1_HOME_EDITORIAL_VERSION } from "../../lib/plan-engine/cat1-home-editorial.mjs";
import { CAT1_GYM_EDITORIAL_VERSION } from "../../lib/plan-engine/cat1-gym-editorial.mjs";
import { CAT2_HOME_EDITORIAL_VERSION } from "../../lib/plan-engine/cat2-home-editorial.mjs";
import { CAT2_GYM_EDITORIAL_VERSION } from "../../lib/plan-engine/cat2-gym-editorial.mjs";
import { CAT3_HOME_EDITORIAL_VERSION } from "../../lib/plan-engine/cat3-home-editorial.mjs";
import { CAT3_GYM_EDITORIAL_VERSION } from "../../lib/plan-engine/cat3-gym-editorial.mjs";
import { CAT4_HOME_EDITORIAL_VERSION } from "../../lib/plan-engine/cat4-home-editorial.mjs";
import { CAT4_GYM_EDITORIAL_VERSION } from "../../lib/plan-engine/cat4-gym-editorial.mjs";

const REQUIRED_BEFORE_FINAL = Object.freeze(["gender", "age", "goal", "place"]);
const VALID_PROGRAMS = new Set(["incepator-3", "incepator-4", "avansat-4", "avansat-5"]);
const PLAN_INSTANCE_PATTERN = /^plan-instance-[a-zA-Z0-9-]{8,80}$/;
const PLAN_INSTANCE_SEPARATOR = ":instance:";
const PLAN_CONTENT_SEPARATOR = ":content:";
const PLAN_CONTENT_VERSION_PATTERN = /^[a-z0-9-]{3,80}$/;

export function normalizeFreePlanContentVersion(value) {
  return typeof value === "string" && PLAN_CONTENT_VERSION_PATTERN.test(value) ? value : undefined;
}

export function expectedFreePlanContentVersion(selections) {
  const cat1 = selections?.age === "cat1" || selections?.age === "18-29";
  if (cat1 && selections?.place === "acasa" && VALID_PROGRAMS.has(selections?.program)) {
    return CAT1_HOME_EDITORIAL_VERSION;
  }
  if (cat1 && selections?.place === "sala" && VALID_PROGRAMS.has(selections?.program)) {
    return CAT1_GYM_EDITORIAL_VERSION;
  }
  const cat2 = selections?.age === "cat2" || selections?.age === "30-44";
  if (cat2 && selections?.place === "acasa" && VALID_PROGRAMS.has(selections?.program)) {
    return CAT2_HOME_EDITORIAL_VERSION;
  }
  if (cat2 && selections?.place === "sala" && VALID_PROGRAMS.has(selections?.program)) {
    return CAT2_GYM_EDITORIAL_VERSION;
  }
  const cat3 = selections?.age === "cat3" || selections?.age === "45-59" || selections?.age === "45-60";
  if (cat3 && selections?.place === "acasa" && VALID_PROGRAMS.has(selections?.program)) {
    return CAT3_HOME_EDITORIAL_VERSION;
  }
  if (cat3 && selections?.place === "sala" && VALID_PROGRAMS.has(selections?.program)) {
    return CAT3_GYM_EDITORIAL_VERSION;
  }
  const cat4 = selections?.age === "cat4" || selections?.age === "60+";
  const supportedProgram = selections?.program === "incepator-3" || selections?.program === "avansat-4";
  if (!cat4 || !supportedProgram) return undefined;
  if (selections?.place === "acasa") return CAT4_HOME_EDITORIAL_VERSION;
  if (selections?.place === "sala") return CAT4_GYM_EDITORIAL_VERSION;
  return undefined;
}

export function hasCurrentFreePlanContentVersion(selections) {
  const expected = expectedFreePlanContentVersion(selections);
  return !expected || normalizeFreePlanContentVersion(selections?.contentVersion) === expected;
}

export function normalizeFreePlanSelectionsForCurrentContent(selections) {
  const normalized = { ...(selections ?? {}) };
  if (!expectedFreePlanContentVersion(normalized)) return normalized;
  if (normalized.engineVersion === "v2" && hasCurrentFreePlanContentVersion(normalized)) return normalized;
  return {
    ...normalized,
    program: undefined,
    planInstanceId: undefined,
    contentVersion: undefined,
    engineVersion: "v2",
  };
}

export function normalizePlanInstanceId(value) {
  return typeof value === "string" && PLAN_INSTANCE_PATTERN.test(value) ? value : undefined;
}

export function createPlanInstanceId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  const suffix = typeof randomUUID === "function"
    ? randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `plan-instance-${suffix}`;
}

export function hasRequiredFreePlanSelections(selections) {
  return Boolean(selections && REQUIRED_BEFORE_FINAL.every((key) => selections[key]));
}

export function invalidateFinalFreePlanSelection(selections, key, value) {
  if (!REQUIRED_BEFORE_FINAL.includes(key)) return { ...selections };
  return {
    ...selections,
    [key]: value,
    program: undefined,
    planInstanceId: undefined,
    contentVersion: undefined,
    engineVersion: "v2",
  };
}

export function finalizeFreePlanSelections(selections, program, planInstanceId) {
  const normalizedInstanceId = normalizePlanInstanceId(planInstanceId);
  if (!hasRequiredFreePlanSelections(selections) || !VALID_PROGRAMS.has(program) || !normalizedInstanceId) {
    return null;
  }
  return {
    ...selections,
    program,
    planInstanceId: normalizedInstanceId,
    contentVersion: expectedFreePlanContentVersion({ ...selections, program }),
    engineVersion: "v2",
  };
}

export function resetActiveFreePlanSnapshot(snapshot) {
  return {
    ...snapshot,
    selections: {},
    activeWeek: 1,
    completed: [],
  };
}

export function createFreePlanGenerationGate() {
  let epoch = 0;
  let locked = false;
  return Object.freeze({
    begin() {
      if (locked) return null;
      locked = true;
      epoch += 1;
      return epoch;
    },
    isCurrent(token) {
      return locked && token === epoch;
    },
    fail(token) {
      if (token === epoch) locked = false;
    },
    invalidate() {
      epoch += 1;
      locked = false;
      return epoch;
    },
    snapshot() {
      return { epoch, locked };
    },
  });
}

export function shouldApplyFreePlanHydration(requestEpoch, currentEpoch, selectionFlowActive) {
  return requestEpoch === currentEpoch && selectionFlowActive !== true;
}

export function withPlanInstanceKey(canonicalPlanKey, planInstanceId) {
  const normalized = normalizePlanInstanceId(planInstanceId);
  return normalized ? `${canonicalPlanKey}${PLAN_INSTANCE_SEPARATOR}${normalized}` : canonicalPlanKey;
}

export function withPlanContentVersionKey(canonicalPlanKey, contentVersion) {
  const normalized = normalizeFreePlanContentVersion(contentVersion);
  return normalized ? `${canonicalPlanKey}${PLAN_CONTENT_SEPARATOR}${normalized}` : canonicalPlanKey;
}

export function planContentVersionFromPlanKey(planKey) {
  if (typeof planKey !== "string") return undefined;
  const beforeInstance = planKey.split(PLAN_INSTANCE_SEPARATOR)[0];
  return normalizeFreePlanContentVersion(beforeInstance.split(PLAN_CONTENT_SEPARATOR).at(-1));
}

export function planInstanceIdFromPlanKey(planKey) {
  if (typeof planKey !== "string") return undefined;
  return normalizePlanInstanceId(planKey.split(PLAN_INSTANCE_SEPARATOR).at(-1));
}

export function activeFreePlanSessions(plan, sessions) {
  if (!plan) return [];
  const instanceId = planInstanceIdFromPlanKey(plan.plan_key);
  return sessions.filter((session) => {
    if (session.source !== "free_plan" || session.free_plan_id !== plan.id) return false;
    if (!instanceId) return true;
    const completedAt = new Date(session.completed_at ?? session.updated_at ?? 0).getTime();
    const startedAt = new Date(plan.started_at ?? 0).getTime();
    return Number.isFinite(completedAt) && Number.isFinite(startedAt) && completedAt >= startedAt;
  });
}
