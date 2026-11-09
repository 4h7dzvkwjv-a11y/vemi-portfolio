"use client";

import { useMemo, useState } from "react";
import planConfigurationSchema from "../../../data/plan-engine/plan-config.schema.json";
import type { BatchIssueCategory, BatchValidationReport } from "../../../lib/plan-import/contracts";
import { deterministicKeyForProfile, validatePlanBatchDryRun } from "../../../lib/plan-import/batch-validator.mjs";
import type {
  ExerciseRegistryEntry,
  PlanConfiguration,
  PlanProfile,
} from "../../../lib/plan-engine/contracts";
import styles from "./plan-import.module.css";

const MAX_JSON_BYTES = 10 * 1024 * 1024;

const categoryLabels: Record<BatchIssueCategory | "all", string> = {
  all: "Toate erorile",
  json: "JSON",
  structural: "Structură",
  profile: "Profil",
  configuration_key: "Cheie configurație",
  duplicate: "Duplicate",
  ambiguous: "Ambiguitate",
  exercise_reference: "Referințe exerciții",
  inactive_exercise: "Exerciții inactive",
  retired_exercise: "Exerciții retrase",
  coverage: "Acoperire",
};

function buildFixtureConfiguration(
  profile: PlanProfile,
  exerciseKey: string,
  title = "Configurație controlată de test",
): PlanConfiguration {
  const configurationKey = deterministicKeyForProfile(profile);
  return {
    schema_version: 1,
    configuration_key: configurationKey,
    profile,
    number_of_weeks: 2,
    metadata: {
      title,
      summary: "Date placeholder folosite exclusiv pentru validarea infrastructurii.",
      language: "ro",
      content_status: "draft",
      source_reference: "admin-dry-run-fixture",
    },
    weeks: [1, 2].map((weekNumber) => ({
      week_number: weekNumber,
      display_label: `Săptămâna ${weekNumber}`,
      progression: { summary: `Progresie demonstrativă pentru săptămâna ${weekNumber}.` },
      days: Array.from({ length: profile.days_per_week }, (_, dayIndex) => ({
        day_number: dayIndex + 1,
        display_label: `Ziua ${dayIndex + 1}`,
        title: `Sesiune demonstrativă ${dayIndex + 1}`,
        focus: "Validare structură",
        estimated_minutes: 30,
        instructions: "Instrucțiune placeholder.",
        exercises: [{
          order: 1,
          exercise_key: exerciseKey,
          sets: 3,
          target: { kind: "repetitions", min: 8, max: 10 },
          rest_seconds: 60,
          instructions: "Instrucțiune placeholder pentru exercițiu.",
        }],
      })),
    })),
  };
}

function fixtureFor(registry: ExerciseRegistryEntry[], kind: "valid" | "invalid") {
  const exercise = registry.find((entry) => entry.status === "active" && entry.available_locations.length > 0)!;
  const profile: PlanProfile = {
    gender: "male",
    age_group: "18_29",
    goal: "weight_loss",
    location: exercise.available_locations[0],
    level: "advanced",
    days_per_week: 3,
  };
  const validPlan = buildFixtureConfiguration(profile, exercise.exercise_key);
  if (kind === "valid") {
    return {
      json: JSON.stringify({ batch_version: 1, source: { kind: "normalized_json", reference: "fixture-valid" }, configurations: [validPlan] }, null, 2),
      expected: validPlan.configuration_key,
    };
  }

  const invalidPlan = structuredClone(validPlan) as PlanConfiguration;
  invalidPlan.weeks[0].days[0].exercises[0].exercise_key = "exercise_key_inexistent";
  invalidPlan.weeks[1].days = [];
  return {
    json: JSON.stringify({ batch_version: 1, source: { kind: "normalized_json", reference: "fixture-invalid" }, configurations: [invalidPlan, validPlan] }, null, 2),
    expected: `${validPlan.configuration_key}\nplan:v1:female:30_44:general_fitness:home:beginner:3`,
  };
}

function summaryItems(report: BatchValidationReport) {
  return [
    ["Total analizate", report.summary.total_configurations],
    ["Valide", report.summary.valid_configurations],
    ["Invalide", report.summary.invalid_configurations],
    ["Lipsă", report.summary.missing_configurations],
    ["Chei duplicate", report.summary.duplicate_keys],
    ["exercise_key inexistente", report.summary.unknown_exercise_keys],
    ["Inactive", report.summary.inactive_exercises],
    ["Retrase", report.summary.retired_exercises],
    ["Erori structurale", report.summary.structural_errors],
    ["Ambigue", report.summary.ambiguous_configurations],
    ["Suplimentare", report.summary.extra_configurations],
  ] as const;
}

export function AdminPlanImport({ exerciseRegistry }: { exerciseRegistry: ExerciseRegistryEntry[] }) {
  const [jsonText, setJsonText] = useState("");
  const [expectedKeysText, setExpectedKeysText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<BatchValidationReport | null>(null);
  const [filter, setFilter] = useState<BatchIssueCategory | "all">("all");
  const [inputMessage, setInputMessage] = useState("");

  const visibleIssues = useMemo(() => {
    if (!report) return [];
    return filter === "all" ? report.issues : report.issues.filter((entry) => entry.category === filter);
  }, [filter, report]);

  function loadFixture(kind: "valid" | "invalid") {
    const fixture = fixtureFor(exerciseRegistry, kind);
    setJsonText(fixture.json);
    setExpectedKeysText(fixture.expected);
    setFileName(null);
    setReport(null);
    setInputMessage(kind === "valid" ? "Fixture valid încărcat." : "Fixture invalid încărcat pentru demonstrarea raportului.");
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setReport(null);
    if (!file.name.toLocaleLowerCase("ro").endsWith(".json")) {
      setInputMessage("Este acceptat numai un fișier JSON normalizat.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_JSON_BYTES) {
      setInputMessage("Fișierul trebuie să aibă între 1 byte și 10 MB.");
      return;
    }
    setJsonText(await file.text());
    setFileName(file.name);
    setInputMessage("Fișier citit local. Nicio dată nu a fost publicată sau salvată.");
  }

  function runValidation() {
    const expectedConfigurationKeys = expectedKeysText
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const nextReport = validatePlanBatchDryRun(jsonText, {
      schema: planConfigurationSchema,
      exerciseRegistry,
      expectedConfigurationKeys: expectedConfigurationKeys.length > 0 ? expectedConfigurationKeys : undefined,
    });
    setReport(nextReport);
    setFilter("all");
    setInputMessage(nextReport.status === "valid"
      ? "Lot validat complet. Rămâne nepublicat."
      : "Lot respins integral. Datele active au rămas intacte.");
  }

  return (
    <section className={styles.workspace}>
      <aside className={styles.controls}>
        <div className={styles.safetyBanner}>
          <span>POARTĂ DE SIGURANȚĂ</span>
          <strong>Validate only</strong>
          <p>Instrumentul nu conține o comandă de activare și nu scrie configurații în baza de date.</p>
        </div>

        <label className={styles.filePicker}>
          <span>Încarcă lot JSON</span>
          <input type="file" accept=".json,application/json" onChange={(event) => void readFile(event.target.files?.[0])} />
          <strong>{fileName ?? "Alege fișierul normalizat"}</strong>
          <small>Maximum 10 MB · citire locală · dry-run</small>
        </label>

        <div className={styles.fixtureButtons}>
          <button type="button" onClick={() => loadFixture("valid")}>Lot valid de test</button>
          <button type="button" onClick={() => loadFixture("invalid")}>Lot invalid de test</button>
        </div>

        <label className={styles.field}>
          <span>JSON normalizat</span>
          <textarea value={jsonText} onChange={(event) => { setJsonText(event.target.value); setReport(null); }} spellCheck={false} placeholder='{"configurations": [...]}' />
        </label>

        <label className={styles.field}>
          <span>Matrice așteptată · opțional</span>
          <textarea className={styles.matrix} value={expectedKeysText} onChange={(event) => { setExpectedKeysText(event.target.value); setReport(null); }} spellCheck={false} placeholder="O configuration_key pe linie" />
        </label>

        {inputMessage && <p className={styles.inputMessage} role="status">{inputMessage}</p>}
        <button className={styles.validateButton} type="button" onClick={runValidation} disabled={!jsonText.trim()}>Rulează validarea completă</button>
      </aside>

      <div className={styles.reportPanel}>
        {!report ? (
          <div className={styles.emptyReport}>
            <span>00</span>
            <h2>Niciun lot analizat</h2>
            <p>Încarcă un JSON normalizat sau folosește unul dintre fixture-urile controlate.</p>
          </div>
        ) : (
          <>
            <header className={`${styles.reportStatus} ${report.status === "valid" ? styles.valid : styles.rejected}`}>
              <div><span>STATUS LOT</span><strong>{report.status === "valid" ? "VALID" : "RESPINS"}</strong></div>
              <div><span>PLANURI PUBLICATE</span><strong>0</strong></div>
            </header>

            <div className={styles.summaryGrid}>
              {summaryItems(report).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>

            <section className={styles.coverage}>
              <div><span>Așteptate</span><strong>{report.coverage.expected_count}</strong></div>
              <div><span>Prezente</span><strong>{report.coverage.present_count}</strong></div>
              <p>{report.coverage.missing_keys.length === 0 ? "Nicio configurație așteptată nu lipsește." : `Lipsesc: ${report.coverage.missing_keys.join(", ")}`}</p>
              {report.coverage.extra_keys.length > 0 && <p>Suplimentare: {report.coverage.extra_keys.join(", ")}</p>}
            </section>

            <div className={styles.issueToolbar}>
              <div><p className="section-kicker">Detalii exacte</p><h2>{report.issues.length} erori blocante</h2></div>
              <label><span>Filtrează</span><select value={filter} onChange={(event) => setFilter(event.target.value as BatchIssueCategory | "all")}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>

            <div className={styles.issueList}>
              {visibleIssues.length === 0 && <p className={styles.noIssues}>Nicio eroare pentru filtrul selectat.</p>}
              {visibleIssues.map((entry, index) => (
                <article key={`${entry.code}-${entry.path}-${index}`}>
                  <header><span>{categoryLabels[entry.category]}</span><code>{entry.code}</code></header>
                  <strong>{entry.configuration_key ?? "Lot / matrice"}</strong>
                  <p>{entry.message}</p>
                  <dl>
                    <div><dt>Locație</dt><dd><code>{entry.path}</code></dd></div>
                    {entry.week_number && <div><dt>Săptămâna</dt><dd>{entry.week_number}</dd></div>}
                    {entry.day_number && <div><dt>Ziua</dt><dd>{entry.day_number}</dd></div>}
                    {entry.exercise_order && <div><dt>Exercițiul</dt><dd>{entry.exercise_order}</dd></div>}
                    {entry.value !== undefined && <div><dt>Valoare</dt><dd><code>{String(entry.value)}</code></dd></div>}
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
