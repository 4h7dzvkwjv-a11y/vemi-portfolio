import {
  makeProfileConfigurationKey,
  validatePlanConfiguration,
} from "../plan-engine/runtime.mjs";
import { validateAgainstSchema } from "./json-schema-validator.mjs";

const CONFIGURATION_KEY_PATTERN = /^plan:v1:(male|female):(18_29|30_44|45_59|60_plus):(weight_loss|muscle_gain|general_fitness):(home|gym):(beginner|intermediate|advanced):[1-7]$/;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function safeValue(value) {
  if (value === undefined) return undefined;
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return `[listă cu ${value.length} elemente]`;
  return "{obiect}";
}

function parsePosition(message, text) {
  const match = /position\s+(\d+)/i.exec(message);
  if (!match) return null;
  const position = Number(match[1]);
  const before = text.slice(0, position);
  return {
    position,
    line: before.split("\n").length,
    column: position - before.lastIndexOf("\n"),
  };
}

function categoryFor(code) {
  if (code === "json_parse_error" || code === "invalid_batch_root") return "json";
  if (["invalid_profile", "invalid_profile_value", "invalid_days_per_week"].includes(code)) return "profile";
  if (["configuration_key_mismatch", "invalid_configuration_key", "invalid_schema_version"].includes(code)) return "configuration_key";
  if (code === "duplicate_configuration_key" || code === "duplicate_expected_configuration_key") return "duplicate";
  if (code === "ambiguous_configuration") return "ambiguous";
  if (code === "inactive_exercise_reference") return "inactive_exercise";
  if (code === "retired_exercise_reference") return "retired_exercise";
  if (["unknown_exercise_key", "invalid_exercise_key", "exercise_location_mismatch"].includes(code)) return "exercise_reference";
  if (code.startsWith("coverage_") || code.startsWith("expected_")) return "coverage";
  return "structural";
}

function coordinates(configuration, path) {
  const weekMatch = /weeks\[(\d+)\]/.exec(path);
  const dayMatch = /days\[(\d+)\]/.exec(path);
  const exerciseMatch = /exercises\[(\d+)\]/.exec(path);
  const weekIndex = weekMatch ? Number(weekMatch[1]) : null;
  const dayIndex = dayMatch ? Number(dayMatch[1]) : null;
  const exerciseIndex = exerciseMatch ? Number(exerciseMatch[1]) : null;
  const week = weekIndex === null ? null : configuration?.weeks?.[weekIndex];
  const day = dayIndex === null ? null : week?.days?.[dayIndex];
  const exercise = exerciseIndex === null ? null : day?.exercises?.[exerciseIndex];
  return {
    week_number: Number.isInteger(week?.week_number) ? week.week_number : weekIndex === null ? null : weekIndex + 1,
    day_number: Number.isInteger(day?.day_number) ? day.day_number : dayIndex === null ? null : dayIndex + 1,
    exercise_order: Number.isInteger(exercise?.order) ? exercise.order : exerciseIndex === null ? null : exerciseIndex + 1,
  };
}

function batchIssue({ code, path, message, configuration, configurationIndex = null, value }) {
  return {
    severity: "blocking",
    category: categoryFor(code),
    code,
    path,
    message,
    configuration_index: configurationIndex,
    configuration_key: typeof configuration?.configuration_key === "string" ? configuration.configuration_key : null,
    ...coordinates(configuration, path),
    value: safeValue(value),
  };
}

function emptyReport(now, issue) {
  return {
    mode: "dry-run",
    status: "rejected",
    generated_at: now().toISOString(),
    summary: {
      total_configurations: 0,
      valid_configurations: 0,
      invalid_configurations: 0,
      missing_configurations: 0,
      duplicate_keys: 0,
      unknown_exercise_keys: 0,
      inactive_exercises: 0,
      retired_exercises: 0,
      structural_errors: issue.category === "structural" ? 1 : 0,
      ambiguous_configurations: 0,
      extra_configurations: 0,
    },
    coverage: { expected_count: 0, present_count: 0, missing_keys: [], extra_keys: [] },
    publication: { attempted: false, published_configurations: 0, active_data_changed: false },
    configurations: [],
    issues: [issue],
  };
}

function addUnique(issues, seen, nextIssue) {
  const identity = [nextIssue.configuration_index, nextIssue.code, nextIssue.path, nextIssue.message].join("|");
  if (seen.has(identity)) return;
  seen.add(identity);
  issues.push(nextIssue);
}

function valueAtPath(root, path) {
  return path
    .match(/[^.[\]]+/g)
    ?.reduce((current, segment) => current?.[Number.isInteger(Number(segment)) ? Number(segment) : segment], root);
}

function validateDuplicateExercisePositions(configuration, configurationIndex, issues, seen) {
  if (!Array.isArray(configuration?.weeks)) return;
  configuration.weeks.forEach((week, weekIndex) => {
    if (!Array.isArray(week?.days)) return;
    week.days.forEach((day, dayIndex) => {
      if (!Array.isArray(day?.exercises)) return;
      const seenOrders = new Map();
      day.exercises.forEach((exercise, exerciseIndex) => {
        if (!Number.isInteger(exercise?.order)) return;
        const previous = seenOrders.get(exercise.order);
        if (previous === undefined) {
          seenOrders.set(exercise.order, exerciseIndex);
          return;
        }
        const path = `configurations[${configurationIndex}].weeks[${weekIndex}].days[${dayIndex}].exercises[${exerciseIndex}].order`;
        addUnique(issues, seen, batchIssue({
          code: "duplicate_exercise_position",
          path,
          message: `Poziția ${exercise.order} este deja folosită de exercițiul ${previous + 1} din aceeași zi.`,
          configuration,
          configurationIndex,
          value: exercise.order,
        }));
      });
    });
  });
}

/**
 * Singura operație expusă pentru loturi în această etapă. Produce un raport
 * imutabil și nu primește niciun adaptor de scriere sau activare.
 */
export function validatePlanBatchDryRun(rawInput, options) {
  const now = options.now ?? (() => new Date());
  let parsed = rawInput;

  if (typeof rawInput === "string") {
    try {
      parsed = JSON.parse(rawInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON invalid.";
      const location = parsePosition(message, rawInput);
      return emptyReport(now, batchIssue({
        code: "json_parse_error",
        path: location ? `line ${location.line}, column ${location.column}` : "$",
        message: `Fișierul nu este JSON valid: ${message}`,
        value: location?.position,
      }));
    }
  }

  let configurations;
  let envelopeExpectedKeys = [];
  if (Array.isArray(parsed)) configurations = parsed;
  else if (isObject(parsed) && Array.isArray(parsed.configurations)) {
    configurations = parsed.configurations;
    envelopeExpectedKeys = Array.isArray(parsed.expected_configuration_keys) ? parsed.expected_configuration_keys : [];
  } else {
    return emptyReport(now, batchIssue({
      code: "invalid_batch_root",
      path: "configurations",
      message: "Lotul trebuie să fie o listă de configurații sau un obiect cu câmpul configurations.",
      value: parsed,
    }));
  }

  const issues = [];
  const seenIssues = new Set();
  const keyIndices = new Map();

  configurations.forEach((configuration, configurationIndex) => {
    const basePath = `configurations[${configurationIndex}]`;
    const schemaValidation = validateAgainstSchema(configuration, options.schema, {
      rootSchema: options.schema,
      basePath,
    });
    schemaValidation.issues.forEach((schemaIssue) => addUnique(issues, seenIssues, batchIssue({
      code: schemaIssue.code,
      path: schemaIssue.path,
      message: schemaIssue.message,
      configuration,
      configurationIndex,
      value: schemaIssue.value,
    })));

    const semanticValidation = validatePlanConfiguration(configuration, options.exerciseRegistry);
    semanticValidation.issues.forEach((semanticIssue) => addUnique(issues, seenIssues, batchIssue({
      code: semanticIssue.code,
      path: `${basePath}.${semanticIssue.path}`,
      message: semanticIssue.message,
      configuration,
      configurationIndex,
      value: valueAtPath(configuration, semanticIssue.path),
    })));

    validateDuplicateExercisePositions(configuration, configurationIndex, issues, seenIssues);

    if (typeof configuration?.configuration_key === "string") {
      if (!CONFIGURATION_KEY_PATTERN.test(configuration.configuration_key)) {
        addUnique(issues, seenIssues, batchIssue({
          code: "invalid_configuration_key",
          path: `${basePath}.configuration_key`,
          message: "Cheia configurației nu respectă formatul determinist VEMI v1.",
          configuration,
          configurationIndex,
          value: configuration.configuration_key,
        }));
      }
      const indices = keyIndices.get(configuration.configuration_key) ?? [];
      indices.push(configurationIndex);
      keyIndices.set(configuration.configuration_key, indices);
    }
  });

  const duplicateEntries = [...keyIndices.entries()].filter(([, indices]) => indices.length > 1);
  duplicateEntries.forEach(([key, indices]) => {
    indices.forEach((configurationIndex) => addUnique(issues, seenIssues, batchIssue({
      code: "duplicate_configuration_key",
      path: `configurations[${configurationIndex}].configuration_key`,
      message: `Cheia ${key} apare de ${indices.length} ori în același lot.`,
      configuration: configurations[configurationIndex],
      configurationIndex,
      value: key,
    })));
    addUnique(issues, seenIssues, batchIssue({
      code: "ambiguous_configuration",
      path: "configurations",
      message: `Configurația ${key} este ambiguă deoarece are mai multe definiții.`,
      value: indices,
    }));
  });

  const expectedInput = options.expectedConfigurationKeys ?? envelopeExpectedKeys;
  const expectedKeys = [];
  const expectedSeen = new Set();
  for (const [index, key] of expectedInput.entries()) {
    if (typeof key !== "string" || !CONFIGURATION_KEY_PATTERN.test(key)) {
      addUnique(issues, seenIssues, batchIssue({
        code: "expected_configuration_key_invalid",
        path: `expected_configuration_keys[${index}]`,
        message: "Matricea conține o cheie de configurație invalidă.",
        value: key,
      }));
      continue;
    }
    if (expectedSeen.has(key)) {
      addUnique(issues, seenIssues, batchIssue({
        code: "duplicate_expected_configuration_key",
        path: `expected_configuration_keys[${index}]`,
        message: `Cheia ${key} apare de mai multe ori în matricea așteptată.`,
        value: key,
      }));
      continue;
    }
    expectedSeen.add(key);
    expectedKeys.push(key);
  }

  const presentKeys = [...keyIndices.keys()];
  const missingKeys = expectedKeys.filter((key) => !keyIndices.has(key));
  const extraKeys = expectedKeys.length > 0 ? presentKeys.filter((key) => !expectedSeen.has(key)) : [];

  missingKeys.forEach((key) => addUnique(issues, seenIssues, batchIssue({
    code: "coverage_missing_configuration",
    path: "expected_configuration_keys",
    message: `Configurația așteptată ${key} lipsește din lot.`,
    value: key,
  })));
  extraKeys.forEach((key) => {
    const configurationIndex = keyIndices.get(key)?.[0] ?? null;
    addUnique(issues, seenIssues, batchIssue({
      code: "coverage_extra_configuration",
      path: configurationIndex === null ? "configurations" : `configurations[${configurationIndex}].configuration_key`,
      message: `Configurația ${key} nu este prevăzută în matricea așteptată.`,
      configuration: configurationIndex === null ? null : configurations[configurationIndex],
      configurationIndex,
      value: key,
    }));
  });

  const invalidConfigurationIndices = new Set(
    issues
      .filter((entry) => entry.configuration_index !== null && entry.category !== "coverage")
      .map((entry) => entry.configuration_index),
  );
  const configurationSummaries = configurations.map((configuration, index) => ({
    index,
    configuration_key: typeof configuration?.configuration_key === "string" ? configuration.configuration_key : null,
    status: invalidConfigurationIndices.has(index) ? "invalid" : "valid",
    issue_count: issues.filter((entry) => entry.configuration_index === index).length,
  }));

  const countDistinctCodeValues = (code) => new Set(
    issues
      .filter((entry) => entry.code === code)
      .map((entry) => entry.value === undefined ? entry.message : String(entry.value)),
  ).size;
  const countCategory = (category) => issues.filter((entry) => entry.category === category).length;
  return {
    mode: "dry-run",
    status: issues.length === 0 ? "valid" : "rejected",
    generated_at: now().toISOString(),
    summary: {
      total_configurations: configurations.length,
      valid_configurations: configurations.length - invalidConfigurationIndices.size,
      invalid_configurations: invalidConfigurationIndices.size,
      missing_configurations: missingKeys.length,
      duplicate_keys: duplicateEntries.length,
      unknown_exercise_keys: countDistinctCodeValues("unknown_exercise_key"),
      inactive_exercises: countDistinctCodeValues("inactive_exercise_reference"),
      retired_exercises: countDistinctCodeValues("retired_exercise_reference"),
      structural_errors: countCategory("structural"),
      ambiguous_configurations: duplicateEntries.length,
      extra_configurations: extraKeys.length,
    },
    coverage: {
      expected_count: expectedKeys.length,
      present_count: presentKeys.length,
      missing_keys: missingKeys,
      extra_keys: extraKeys,
    },
    publication: { attempted: false, published_configurations: 0, active_data_changed: false },
    configurations: configurationSummaries,
    issues,
  };
}

export function deterministicKeyForProfile(profile) {
  return makeProfileConfigurationKey(profile);
}
