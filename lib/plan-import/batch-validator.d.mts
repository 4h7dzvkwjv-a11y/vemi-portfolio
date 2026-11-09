import type { BatchValidationOptions, BatchValidationReport } from "./contracts";
import type { PlanProfile, ProfileConfigurationKey } from "../plan-engine/contracts";

export function validatePlanBatchDryRun(rawInput: unknown, options: BatchValidationOptions): BatchValidationReport;
export function deterministicKeyForProfile(profile: PlanProfile): ProfileConfigurationKey;
