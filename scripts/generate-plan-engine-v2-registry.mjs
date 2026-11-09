import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const EXPECTED_MANIFEST_SHA256 = "90dbf41cb202089cc8e39f80c49b115cd8ca93904282802e841b64e21302f8de";
const EXPECTED_EXERCISE_COUNT = 114;
const DEFAULT_INPUT = "data/plan-engine/v2/VEMI_Manifest_Content_Complete_2026-08-08.json";
const DEFAULT_OUTPUT = "data/plan-engine/v2/exercise-rules.json";

const inputPath = resolve(process.argv[2] ?? DEFAULT_INPUT);
const outputPath = resolve(process.argv[3] ?? DEFAULT_OUTPUT);
const source = readFileSync(inputPath);
const sourceSha256 = createHash("sha256").update(source).digest("hex");

if (sourceSha256 !== EXPECTED_MANIFEST_SHA256) {
  throw new Error(`Manifestul Punctul 2 nu corespunde sursei validate: ${sourceSha256}.`);
}

const manifest = JSON.parse(source.toString("utf8"));
if (!Array.isArray(manifest.exercises) || manifest.exercises.length !== EXPECTED_EXERCISE_COUNT) {
  throw new Error(`Manifestul trebuie să conțină exact ${EXPECTED_EXERCISE_COUNT} exerciții.`);
}
if (manifest.contract?.point_2_schema_version !== "vemi-point-2-1.0") {
  throw new Error("Versiunea contractului Punctul 2 nu este cea validată.");
}

const byName = new Map();
const byKey = new Map();
for (const exercise of manifest.exercises) {
  if (!exercise.exercise_key || !exercise.canonical_name || byKey.has(exercise.exercise_key)) {
    throw new Error(`Cheie invalidă sau duplicată în manifest: ${exercise.exercise_key ?? "lipsește"}.`);
  }
  byKey.set(exercise.exercise_key, exercise);
  byName.set(exercise.canonical_name, exercise.exercise_key);
}

const canonicalNamesByLength = [...byName.keys()].sort((left, right) => right.length - left.length);
const requiredRuleFields = manifest.contract.point_2_required_fields;

const rules = [...manifest.exercises]
  .sort((left, right) => left.exercise_key.localeCompare(right.exercise_key))
  .map((exercise) => {
    const point2 = exercise.generation?.rules;
    if (!point2 || exercise.generation?.needs_point_2_review !== false) {
      throw new Error(`Punctul 2 nu este validat pentru ${exercise.exercise_key}.`);
    }
    for (const field of requiredRuleFields) {
      if (!(field in point2)) throw new Error(`Câmpul ${field} lipsește pentru ${exercise.exercise_key}.`);
    }

    const alternatives = point2.alternatives.map((name) => {
      const alternativeKey = byName.get(name);
      if (!alternativeKey) throw new Error(`Alternativa ${name} nu are exercise_key canonic.`);
      return alternativeKey;
    });
    const exclusionText = point2.exclusions.join("\n");
    const exclusionKeys = canonicalNamesByLength
      .filter((name) => name !== exercise.canonical_name && exclusionText.includes(name))
      .map((name) => byName.get(name))
      .filter(Boolean);

    return {
      exercise_key: exercise.exercise_key,
      canonical_name: exercise.canonical_name,
      canonical_group: exercise.canonical_group,
      kind: exercise.kind,
      places: [...exercise.places].sort(),
      male_priority: point2.male_priority,
      female_priority: point2.female_priority,
      min_rotation_days: point2.min_rotation_days,
      age_60_plus: point2.age_60_plus,
      role: point2.role,
      level: point2.level,
      alternatives: [...new Set(alternatives)].sort(),
      exclusion_keys: [...new Set(exclusionKeys)].sort(),
      exclusions: point2.exclusions,
      notes: point2.notes,
      source: point2.source,
    };
  });

const registry = {
  schema_version: "vemi-plan-engine-rules-v2.0",
  source_manifest: {
    filename: basename(inputPath),
    sha256: sourceSha256,
    point_2_schema_version: manifest.contract.point_2_schema_version,
  },
  exercise_count: rules.length,
  rules,
};

writeFileSync(outputPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: outputPath,
  source_sha256: sourceSha256,
  exercises: rules.length,
  alternatives: rules.reduce((total, rule) => total + rule.alternatives.length, 0),
  explicit_exclusion_links: rules.reduce((total, rule) => total + rule.exclusion_keys.length, 0),
}, null, 2));
