"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  PERSONAL_EXERCISE_CATEGORIES,
  PERSONAL_EXERCISE_METRIC_TYPES,
} from "@/lib/amv2/personal-exercise-domain.mjs";
import type { PersonalExercise } from "@/lib/amv2/personal-exercise-domain.mjs";
import { ExerciseCategoryBadge } from "./exercise-visual-controls";
import styles from "./amv2.module.css";

type PersonalMetricType = (typeof PERSONAL_EXERCISE_METRIC_TYPES)[number];

type PersonalExerciseEditorProps = {
  existing?: PersonalExercise | null;
  onSave: (input: { name: string; category: string; metricType: PersonalMetricType }) => void;
  onCancel: () => void;
};

const metricLabels: Readonly<Record<PersonalMetricType, string>> = {
  repetitions_weight: "Repetări + greutate",
  repetitions_only: "Repetări",
  time_per_set: "Timp",
};

function initialMetric(existing?: PersonalExercise | null): PersonalMetricType {
  return PERSONAL_EXERCISE_METRIC_TYPES.includes(existing?.metricType as PersonalMetricType)
    ? existing?.metricType as PersonalMetricType
    : "repetitions_weight";
}

export function PersonalExerciseEditor({ existing = null, onSave, onCancel }: PersonalExerciseEditorProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? PERSONAL_EXERCISE_CATEGORIES[0]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [metricType, setMetricType] = useState<PersonalMetricType>(initialMetric(existing));
  const [message, setMessage] = useState<string | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);

  const closeCategorySelector = () => {
    setCategoryOpen(false);
    categoryTriggerRef.current?.focus();
  };

  const handleCategoryKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (event.key !== "Escape" || !categoryOpen) return;
    event.preventDefault();
    closeCategorySelector();
  };

  const submit = () => {
    if (!name.trim()) {
      setMessage("Scrie un nume pentru exercițiul personal.");
      return;
    }
    onSave({ name: name.trim(), category, metricType });
  };

  return (
    <section className={styles.personalExerciseEditor} aria-labelledby="amv2-personal-title">
      <header className={styles.personalEditorHeader}>
        <h2 id="amv2-personal-title">{existing ? "Modifică exercițiul" : "Creează exercițiu"}</h2>
      </header>

      <label className={styles.personalField}>
        <span>NUME</span>
        <input
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="Ex: Ridicări laterale la scripete"
          autoComplete="off"
        />
      </label>

      <fieldset className={styles.personalChoiceField} onKeyDown={handleCategoryKeyDown}>
        <legend>CATEGORIE</legend>
        <button
          ref={categoryTriggerRef}
          className={styles.personalCategoryTrigger}
          type="button"
          aria-expanded={categoryOpen}
          aria-haspopup="listbox"
          aria-controls="amv2-personal-category-options"
          aria-label={`Categorie selectată: ${category}`}
          onClick={() => setCategoryOpen((current) => !current)}
        >
          <ExerciseCategoryBadge category={category} />
          <svg
            className={`${styles.personalCategoryChevron} ${categoryOpen ? styles.personalCategoryChevronOpen : ""}`}
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
          </svg>
        </button>
        {categoryOpen ? (
          <div
            id="amv2-personal-category-options"
            className={styles.personalCategoryList}
            role="listbox"
            aria-label="Categorie"
          >
            {PERSONAL_EXERCISE_CATEGORIES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                role="option"
                aria-selected={category === candidate}
                onClick={() => {
                  setCategory(candidate);
                  closeCategorySelector();
                }}
              >
                <ExerciseCategoryBadge category={candidate} />
                <span aria-hidden="true">{category === candidate ? "✓" : ""}</span>
              </button>
            ))}
          </div>
        ) : null}
      </fieldset>

      <label className={styles.personalField}>
        <span>TIP EXERCIȚIU</span>
        <select value={metricType} onChange={(event) => setMetricType(event.currentTarget.value as PersonalMetricType)}>
          {PERSONAL_EXERCISE_METRIC_TYPES.map((candidate) => (
            <option value={candidate} key={candidate}>{metricLabels[candidate]}</option>
          ))}
        </select>
      </label>

      {message ? <p className={styles.inlineError} role="alert">{message}</p> : null}
      <div className={styles.exerciseEditorActions}>
        <button type="button" onClick={onCancel}>Anulează</button>
        <button type="button" onClick={submit}>{existing ? "Salvează modificările" : "Salvează exercițiul"}</button>
      </div>
    </section>
  );
}
