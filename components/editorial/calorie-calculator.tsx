"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  calculateCalorieEstimate,
  formatKcalRange,
  formatKcalRangeAccessible,
} from "@/lib/calorie-calculator/formulas";
import type {
  CalculatorErrors,
  CalculatorField,
  CalorieGoal,
  RawCalculatorInput,
} from "@/lib/calorie-calculator/types";
import { validateCalculatorInput } from "@/lib/calorie-calculator/validation";

const initialValues: RawCalculatorInput = {
  sex: "",
  age: "",
  heightCm: "",
  weightKg: "",
  activity: "",
  goal: "",
};

const activityOptions = [
  {
    value: "1.4",
    title: "Activitate redusă",
    description: "Cea mai mare parte a zilei este petrecută așezat, cu puțin mers și activități ușoare.",
    example: "Exemplu: muncă la birou, transport motorizat și puține deplasări pe jos. Două sau trei antrenamente scurte nu mută automat o săptămână sedentară la nivel ridicat.",
  },
  {
    value: "1.6",
    title: "Activitate moderată",
    description: "Ziua include mers și mișcare regulată, dar fără muncă fizică susținută.",
    example: "Exemplu: birou plus mers zilnic și antrenamente regulate sau muncă mai ales în picioare, cu efort ușor. Acesta este nivelul potrivit pentru mulți oameni care se antrenează, dar stau jos multe ore.",
  },
  {
    value: "1.8",
    title: "Activitate ridicată",
    description: "O parte mare din zi implică mers, stat în picioare sau efort fizic, împreună cu activitate planificată regulată.",
    example: "Exemplu: muncă activă, multe deplasări pe jos și antrenamente solicitante frecvente. Nu îl selecta doar pentru 4–5 ședințe de sală dacă restul săptămânii este sedentar.",
  },
  {
    value: "2.0",
    title: "Activitate foarte ridicată",
    description: "Efort fizic susținut în majoritatea zilelor, prin muncă solicitantă și/sau mai multe ore de activitate viguroasă.",
    example: "Exemplu: muncă fizică grea ori volum sportiv mare menținut. Nu înseamnă doar «merg des la sală»; este un stil de viață rar și greu de menținut.",
  },
] as const;

const goalOptions: ReadonlyArray<{ value: CalorieGoal; title: string; description: string }> = [
  { value: "maintenance", title: "Menținere", description: "Un interval orientativ în jurul necesarului estimat de menținere." },
  { value: "loss", title: "Slăbire", description: "Un deficit orientativ de aproximativ 10–20%, cu gate de siguranță." },
  { value: "gain", title: "Creștere în greutate / susținerea masei musculare", description: "Un surplus orientativ de aproximativ 5–10% pentru creștere în greutate și susținerea antrenamentului de forță." },
];

const goalLabels: Record<CalorieGoal, string> = {
  maintenance: "menținere",
  loss: "slăbire",
  gain: "creștere în greutate",
};

const fieldTargets: Record<CalculatorField, string> = {
  sex: "calorie-sex-female",
  age: "calorie-age",
  heightCm: "calorie-height",
  weightKg: "calorie-weight",
  activity: "calorie-activity-14",
  goal: "calorie-goal-maintenance",
};

const errorOrder: CalculatorField[] = ["sex", "age", "heightCm", "weightKg", "activity", "goal"];

function describedBy(hintId: string, errorId: string, hasError: boolean) {
  return hasError ? `${hintId} ${errorId}` : hintId;
}

export function CalorieCalculator() {
  const [values, setValues] = useState<RawCalculatorInput>(initialValues);
  const [errors, setErrors] = useState<CalculatorErrors>({});
  const [result, setResult] = useState<ReturnType<typeof calculateCalorieEstimate>>(null);
  const [needsRecalculation, setNeedsRecalculation] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result) resultTitleRef.current?.focus();
  }, [result]);

  function updateField(field: keyof RawCalculatorInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field as CalculatorField];
      return next;
    });
    if (result) {
      setResult(null);
      setNeedsRecalculation(true);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateCalculatorInput(values);

    if (!validation.valid) {
      setResult(null);
      setNeedsRecalculation(false);
      setErrors(validation.errors);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    const nextResult = calculateCalorieEstimate(validation.value);
    if (!nextResult) {
      setResult(null);
      setErrors({ form: "Estimarea nu a putut fi calculată în siguranță. Verifică valorile și încearcă din nou." });
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setErrors({});
    setNeedsRecalculation(false);
    setResult(nextResult);
  }

  function focusInvalidField(event: React.MouseEvent<HTMLAnchorElement>, field: CalculatorField) {
    event.preventDefault();
    document.getElementById(fieldTargets[field])?.focus();
  }

  const activeGoal = values.goal === "maintenance" || values.goal === "loss" || values.goal === "gain"
    ? values.goal
    : null;

  return (
    <section className="calorie-calculator-shell" aria-labelledby="calorie-form-title">
      <form className="calorie-calculator-form" autoComplete="off" onSubmit={handleSubmit} data-private="true">
        <header className="calorie-form-header">
          <p className="section-kicker">Estimare locală</p>
          <h2 id="calorie-form-title">Date pentru estimare</h2>
          <p>Datele rămân doar în memoria acestei pagini și nu sunt salvate sau trimise către VEMI.</p>
        </header>

        {Object.keys(errors).length > 0 ? (
          <div className="calorie-error-summary" ref={errorSummaryRef} tabIndex={-1}>
            <h3>Verifică următoarele câmpuri</h3>
            {errors.form ? <p>{errors.form}</p> : null}
            <ul>
              {errorOrder.filter((field) => errors[field]).map((field) => (
                <li key={field}><a href={`#${fieldTargets[field]}`} onClick={(event) => focusInvalidField(event, field)}>{errors[field]}</a></li>
              ))}
            </ul>
          </div>
        ) : null}

        <fieldset className="calorie-fieldset" aria-invalid={errors.sex ? true : undefined} aria-describedby={describedBy("calorie-sex-hint", "calorie-sex-error", Boolean(errors.sex))}>
          <legend>Sex biologic utilizat în ecuație</legend>
          <p className="calorie-hint" id="calorie-sex-hint">Ecuația publicată are două ramuri biologice. Dacă opțiunile nu descriu corect situația ta, inclusiv în contextul unei tranziții sau al unui tratament hormonal, formula nu are un coeficient validat pentru o estimare responsabilă; discută cu un dietetician sau medic ori folosește calorimetria indirectă.</p>
          <div className="calorie-radio-grid compact">
            {([{"value":"female","label":"Feminin"},{"value":"male","label":"Masculin"}] as const).map((option, index) => (
              <label className="calorie-radio-card" key={option.value}>
                <input
                  ref={index === 0 ? firstFieldRef : undefined}
                  id={`calorie-sex-${option.value}`}
                  name="calorie-sex"
                  type="radio"
                  value={option.value}
                  checked={values.sex === option.value}
                  aria-describedby={describedBy("calorie-sex-hint", "calorie-sex-error", Boolean(errors.sex))}
                  onChange={(event) => updateField("sex", event.target.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.sex ? <p className="calorie-field-error" id="calorie-sex-error">{errors.sex}</p> : null}
        </fieldset>

        <div className="calorie-number-grid">
          <div className="calorie-input-field">
            <label htmlFor="calorie-age">Vârsta <span>ani</span></label>
            <input id="calorie-age" name="calorie-age" type="text" inputMode="numeric" autoComplete="off" value={values.age} aria-invalid={errors.age ? true : undefined} aria-describedby={describedBy("calorie-age-hint", "calorie-age-error", Boolean(errors.age))} onChange={(event) => updateField("age", event.target.value)} />
            <p className="calorie-hint" id="calorie-age-hint">Introdu vârsta în ani împliniți, între 19 și 78.</p>
            {errors.age ? <p className="calorie-field-error" id="calorie-age-error">{errors.age}</p> : null}
          </div>
          <div className="calorie-input-field">
            <label htmlFor="calorie-height">Înălțimea <span>cm</span></label>
            <input id="calorie-height" name="calorie-height" type="text" inputMode="decimal" autoComplete="off" value={values.heightCm} aria-invalid={errors.heightCm ? true : undefined} aria-describedby={describedBy("calorie-height-hint", "calorie-height-error", Boolean(errors.heightCm))} onChange={(event) => updateField("heightCm", event.target.value)} />
            <p className="calorie-hint" id="calorie-height-hint">Exemplu: 178 sau 178,5. Interval acceptat: 146–201 cm.</p>
            {errors.heightCm ? <p className="calorie-field-error" id="calorie-height-error">{errors.heightCm}</p> : null}
          </div>
          <div className="calorie-input-field">
            <label htmlFor="calorie-weight">Greutatea actuală <span>kg</span></label>
            <input id="calorie-weight" name="calorie-weight" type="text" inputMode="decimal" autoComplete="off" value={values.weightKg} aria-invalid={errors.weightKg ? true : undefined} aria-describedby={describedBy("calorie-weight-hint", "calorie-weight-error", Boolean(errors.weightKg))} onChange={(event) => updateField("weightKg", event.target.value)} />
            <p className="calorie-hint" id="calorie-weight-hint">Exemplu: 72 sau 72,5. Interval acceptat: 46–143 kg.</p>
            {errors.weightKg ? <p className="calorie-field-error" id="calorie-weight-error">{errors.weightKg}</p> : null}
          </div>
        </div>

        <div className="calorie-form-divider" />
        <h3 className="calorie-form-subtitle">Activitate și obiectiv</h3>

        <fieldset className="calorie-fieldset" aria-invalid={errors.activity ? true : undefined} aria-describedby={describedBy("calorie-activity-hint", "calorie-activity-error", Boolean(errors.activity))}>
          <legend>Nivelul tău obișnuit de activitate</legend>
          <p className="calorie-hint" id="calorie-activity-hint">Evaluează întreaga săptămână obișnuită: muncă, mers, treburi zilnice și antrenamente. Dacă oscilezi între două niveluri, începe cu cel mai mic și ajustează ulterior după evoluția reală.</p>
          <div className="calorie-radio-grid activity">
            {activityOptions.map((option) => (
              <label className="calorie-radio-card detailed" key={option.value}>
                <input id={`calorie-activity-${option.value.replace(".", "")}`} name="calorie-activity" type="radio" value={option.value} checked={values.activity === option.value} aria-describedby={describedBy("calorie-activity-hint", "calorie-activity-error", Boolean(errors.activity))} onChange={(event) => updateField("activity", event.target.value)} />
                <span><strong>{option.value.replace(".", ",")} — {option.title}</strong><small>{option.description}</small><em>{option.example}</em></span>
              </label>
            ))}
          </div>
          {errors.activity ? <p className="calorie-field-error" id="calorie-activity-error">{errors.activity}</p> : null}
        </fieldset>

        <fieldset className="calorie-fieldset" aria-invalid={errors.goal ? true : undefined} aria-describedby={describedBy("calorie-goal-hint", "calorie-goal-error", Boolean(errors.goal))}>
          <legend>Obiectivul estimării</legend>
          <p className="calorie-hint" id="calorie-goal-hint">Selectează un singur obiectiv. Rezultatul principal va fi calculat numai pentru acesta.</p>
          <div className="calorie-radio-grid goals">
            {goalOptions.map((option) => (
              <label className="calorie-radio-card detailed" key={option.value}>
                <input id={`calorie-goal-${option.value}`} name="calorie-goal" type="radio" value={option.value} checked={values.goal === option.value} aria-describedby={describedBy("calorie-goal-hint", "calorie-goal-error", Boolean(errors.goal))} onChange={(event) => updateField("goal", event.target.value)} />
                <span><strong>{option.title}</strong><small>{option.description}</small></span>
              </label>
            ))}
          </div>
          {errors.goal ? <p className="calorie-field-error" id="calorie-goal-error">{errors.goal}</p> : null}
        </fieldset>

        <p className="calorie-envelope-note">Intervalele de vârstă, greutate și înălțime sunt anvelopa lotului original al ecuației, nu clasificări ale unor valori „normale” sau „sănătoase”. Versiunea actuală nu extrapolează în afara lor.</p>
        <button className="calorie-submit" type="submit">Estimează necesarul caloric</button>
      </form>

      {needsRecalculation ? <p className="calorie-recalculation-note" role="status">Valorile s-au schimbat. Estimează din nou.</p> : null}

      {result && activeGoal ? (
        <section className={`calorie-result-card${result.weightLossTargetBlocked ? " blocked" : ""}`} aria-live="polite" data-private="true">
          <p className="section-kicker">Estimare pentru {goalLabels[activeGoal]}</p>
          <h2 ref={resultTitleRef} tabIndex={-1}>Necesar caloric estimat</h2>
          {result.weightLossTargetBlocked ? (
            <>
              <p className="calorie-result-range blocked-copy">Ținta de slăbire necesită evaluare profesională</p>
              <p>Limita inferioară brută a estimării ar coborî sub 1.200 kcal/zi. Nu o rotunjim în sus și nu afișăm un target de slăbire. Discută cu un dietetician sau medic pentru o strategie potrivită situației tale.</p>
            </>
          ) : (
            <>
              <p className="calorie-result-range" aria-label={formatKcalRangeAccessible(result.goalRange!)}>{formatKcalRange(result.goalRange!)}</p>
              <p>{activeGoal === "maintenance" ? "Interval orientativ în jurul necesarului estimat de menținere." : activeGoal === "loss" ? "Interval orientativ pentru un deficit de aproximativ 10–20%, fără promisiunea unui anumit ritm de slăbire." : "Interval orientativ pentru creștere în greutate și susținerea antrenamentului de forță. Surplusul nu garantează că greutatea câștigată va fi masă musculară."}</p>
            </>
          )}
          <p className="calorie-maintenance-line">Estimare de menținere: <strong aria-label={formatKcalRangeAccessible(result.maintenanceRange)}>{formatKcalRange(result.maintenanceRange)}</strong></p>
          <p className="calorie-uncertainty">Aceasta este o estimare, nu o măsurare a metabolismului. Necesarul real poate varia în funcție de activitatea zilnică, compoziția corporală și răspunsul individual. Folosește intervalul ca punct de pornire și ajustează-l treptat după evoluția observată în câteva săptămâni.</p>
          <button className="calorie-edit-values" type="button" onClick={() => firstFieldRef.current?.focus()}>Modifică valorile</button>
        </section>
      ) : null}
    </section>
  );
}
