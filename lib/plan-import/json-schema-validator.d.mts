import type { ValidationIssue } from "../plan-engine/contracts";

export function validateAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>,
  options?: { rootSchema?: Record<string, unknown>; basePath?: string },
): {
  valid: boolean;
  issues: Array<ValidationIssue & { value?: unknown }>;
};
