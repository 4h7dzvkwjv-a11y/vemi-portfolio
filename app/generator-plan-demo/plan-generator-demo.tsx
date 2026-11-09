"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlanProfile, PlanResolution } from "../../lib/plan-engine/contracts";
import { getDemoExercise, resolveDemoPlan } from "../../lib/plan-engine/demo-service";
import styles from "./plan-generator-demo.module.css";

type ProfileDraft = Partial<PlanProfile>;
type ProfileField = keyof PlanProfile;
type Choice = { label: string; value: string | number };

const steps: Array<{ field: ProfileField; eyebrow: string; title: string; choices: Choice[] }> = [
  { field: "gender", eyebrow: "Pasul 1 din 6", title: "Alege genul", choices: [{ label: "Masculin", value: "male" }, { label: "Feminin", value: "female" }] },
  { field: "age_group", eyebrow: "Pasul 2 din 6", title: "Selectează categoria de vârstă", choices: [{ label: "18–29 ani", value: "18_29" }, { label: "30–44 ani", value: "30_44" }, { label: "45–59 ani", value: "45_59" }, { label: "60+ ani", value: "60_plus" }] },
  { field: "goal", eyebrow: "Pasul 3 din 6", title: "Care este obiectivul?", choices: [{ label: "Slăbire", value: "weight_loss" }, { label: "Masă musculară", value: "muscle_gain" }, { label: "Formă fizică", value: "general_fitness" }] },
  { field: "location", eyebrow: "Pasul 4 din 6", title: "Unde are loc antrenamentul?", choices: [{ label: "Acasă", value: "home" }, { label: "La sală", value: "gym" }] },
  { field: "level", eyebrow: "Pasul 5 din 6", title: "Alege nivelul", choices: [{ label: "Începător", value: "beginner" }, { label: "Intermediar", value: "intermediate" }, { label: "Avansat", value: "advanced" }] },
  { field: "days_per_week", eyebrow: "Pasul 6 din 6", title: "Câte zile pe săptămână?", choices: [{ label: "3 zile", value: 3 }, { label: "4 zile", value: 4 }, { label: "5 zile", value: 5 }] },
];

const labels: Record<string, string> = {
  male: "Masculin", female: "Feminin", "18_29": "18–29 ani", "30_44": "30–44 ani", "45_59": "45–59 ani", "60_plus": "60+ ani",
  weight_loss: "Slăbire", muscle_gain: "Masă musculară", general_fitness: "Formă fizică", home: "Acasă", gym: "La sală",
  beginner: "Începător", intermediate: "Intermediar", advanced: "Avansat",
};

const fiveDayDemo: PlanProfile = {
  gender: "male", age_group: "18_29", goal: "weight_loss", location: "gym", level: "advanced", days_per_week: 5,
};

function isCompleteProfile(profile: ProfileDraft): profile is PlanProfile {
  return Boolean(profile.gender && profile.age_group && profile.goal && profile.location && profile.level && profile.days_per_week);
}

function formatTarget(target: { kind: "repetitions" | "duration_seconds"; min: number; max: number }) {
  const range = target.min === target.max ? String(target.min) : `${target.min}–${target.max}`;
  return target.kind === "duration_seconds" ? `${range} sec` : `${range} rep`;
}

export function PlanGeneratorDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<ProfileDraft>({});
  const [resolution, setResolution] = useState<PlanResolution | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const currentStep = steps[stepIndex];
  const selectedProfile = useMemo(() => steps.map((step) => ({ field: step.field, value: profile[step.field] })).filter((item) => item.value !== undefined), [profile]);

  function choose(field: ProfileField, value: string | number) {
    const nextProfile = { ...profile, [field]: value } as ProfileDraft;
    setProfile(nextProfile);
    setResolution(null);
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
    else if (isCompleteProfile(nextProfile)) {
      setActiveWeek(1);
      setResolution(resolveDemoPlan(nextProfile));
    }
  }

  function editStep(index: number) {
    setProfile(Object.fromEntries(steps.slice(0, index).map((step) => [step.field, profile[step.field]])) as ProfileDraft);
    setStepIndex(index);
    setResolution(null);
  }

  function loadDemoProfile() {
    setProfile(fiveDayDemo);
    setStepIndex(steps.length - 1);
    setActiveWeek(1);
    setResolution(resolveDemoPlan(fiveDayDemo));
  }

  function reset() {
    setProfile({});
    setStepIndex(0);
    setResolution(null);
    setActiveWeek(1);
  }

  const foundPlan = resolution?.status === "found" ? resolution.plan : null;
  const visibleWeek = foundPlan?.weeks.find((week) => week.week_number === activeWeek);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Înapoi la VEMI">VEMI</Link>
        <Link className={styles.backHome} href="/">← Înapoi la site</Link>
      </header>

      <section className={styles.hero}>
        <div><p className={styles.kicker}>Infrastructură nouă · Etapa 1</p><h1>Un profil clar.<br />O configurație exactă.</h1></div>
        <p className={styles.heroCopy}>Acest ecran testează motorul data-driven. Conținutul este placeholder și nu înlocuiește planurile gratuite existente.</p>
      </section>

      <div className={styles.mockNotice} role="note">
        <span>DEMO TEHNIC</span><p>Fără generare fitness prin AI · fără fallback automat · fără salvarea progresului</p>
      </div>

      {!resolution && (
        <section className={styles.selector} aria-labelledby="generator-step-title">
          <div className={styles.selectorHead}>
            <div><p className={styles.kicker}>{currentStep.eyebrow}</p><h2 id="generator-step-title">{currentStep.title}</h2></div>
            <span className={styles.stepCount}>{String(stepIndex + 1).padStart(2, "0")} / 06</span>
          </div>
          {selectedProfile.length > 0 && (
            <div className={styles.path} aria-label="Selecțiile curente">
              {selectedProfile.map((item, index) => (
                <button key={item.field} type="button" onClick={() => editStep(index)}>
                  {typeof item.value === "number" ? `${item.value} zile` : labels[String(item.value)]}<span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
          <div className={styles.choices}>
            {currentStep.choices.map((choice, index) => (
              <button className={styles.choice} key={String(choice.value)} type="button" onClick={() => choose(currentStep.field, choice.value)}>
                <span>0{index + 1}</span><strong>{choice.label}</strong><i aria-hidden="true">→</i>
              </button>
            ))}
          </div>
          <div className={styles.selectorActions}>
            {stepIndex > 0 ? <button type="button" onClick={() => editStep(stepIndex - 1)}>← Înapoi</button> : <span />}
            <button type="button" onClick={loadDemoProfile}>Încarcă exemplul valid de 5 zile</button>
          </div>
        </section>
      )}

      {resolution?.status === "not_found" && (
        <section className={styles.stateCard} aria-live="polite">
          <span className={styles.stateIcon}>—</span><p className={styles.kicker}>Stare controlată</p><h2>Configurația nu există încă.</h2>
          <p>{resolution.message}</p><code>{resolution.configuration_key}</code>
          <div className={styles.stateActions}><button type="button" onClick={reset}>Alege alt profil</button><button type="button" onClick={loadDemoProfile}>Vezi exemplul valid</button></div>
        </section>
      )}

      {resolution && ["invalid_profile", "invalid_configuration", "ambiguous_configuration"].includes(resolution.status) && (
        <section className={styles.stateCard} aria-live="assertive">
          <span className={styles.stateIcon}>!</span><p className={styles.kicker}>Configurație blocată în siguranță</p><h2>Datele nu pot fi afișate.</h2>
          <p>{resolution.message}</p>{"issues" in resolution && <small>{resolution.issues.length} probleme detectate de validator.</small>}
          <div className={styles.stateActions}><button type="button" onClick={reset}>Reia selecția</button></div>
        </section>
      )}

      {foundPlan && visibleWeek && (
        <section className={styles.result} aria-live="polite">
          <div className={styles.resultHead}>
            <div><p className={styles.kicker}>Configurație găsită determinist</p><h2>{foundPlan.metadata.title}</h2><p>{foundPlan.metadata.summary}</p></div>
            <button type="button" onClick={reset}>Modifică profilul</button>
          </div>
          <div className={styles.profileSummary}>
            {Object.entries(foundPlan.profile).map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><strong>{typeof value === "number" ? `${value} zile` : labels[String(value)]}</strong></div>)}
          </div>
          <div className={styles.resultGrid}>
            <aside className={styles.weekPanel}>
              <span>Config key</span><code>{foundPlan.configuration_key}</code>
              <div className={styles.weekTabs}>
                {foundPlan.weeks.map((week) => <button className={week.week_number === activeWeek ? styles.activeWeek : ""} key={week.week_number} type="button" onClick={() => setActiveWeek(week.week_number)}><span>Săptămâna</span><strong>{week.week_number}</strong></button>)}
              </div>
              <p><strong>Progresie:</strong> {visibleWeek.progression.summary}</p>
            </aside>
            <div className={styles.days}>
              {visibleWeek.days.map((day) => (
                <article className={styles.dayCard} key={day.day_number}>
                  <header><div><span>{day.display_label}</span><h3>{day.title}</h3></div>{day.estimated_minutes && <small>{day.estimated_minutes} min</small>}</header>
                  <div className={styles.exercises}>
                    {day.exercises.map((exercise) => {
                      const definition = getDemoExercise(exercise.exercise_key);
                      return <div key={`${day.day_number}-${exercise.order}`}><span>{String(exercise.order).padStart(2, "0")}</span><p><strong>{definition?.display_name ?? exercise.exercise_key}</strong><code>{exercise.exercise_key}</code></p><b>{exercise.sets} × {formatTarget(exercise.target)}</b><small>{exercise.rest_seconds} sec pauză</small></div>;
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
