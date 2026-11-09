"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { getAmv2CategoryPresentation } from "@/lib/amv2/category-presentation.mjs";
import {
  CANONICAL_EXERCISE_CATEGORIES,
  filterCanonicalExerciseCatalog,
} from "@/lib/amv2/exercise-catalog.mjs";
import type { PersonalExercise } from "@/lib/amv2/personal-exercise-domain.mjs";
import {
  ExerciseCategoryBadge,
  ExerciseMediaControl,
} from "./exercise-visual-controls";
import styles from "./amv2.module.css";

export type CatalogSource = "vemi" | "personal";

type AddExercisesPanelProps = {
  source: CatalogSource;
  onSourceChange: (source: CatalogSource) => void;
  existingExerciseKeys: readonly string[];
  capacityFull: boolean;
  onSelectExercise: (exerciseKey: string) => void;
  personalExercises: readonly PersonalExercise[];
  existingPersonalExerciseIds: readonly string[];
  onSelectPersonalExercise: (personalExerciseId: string) => void;
  onCreatePersonalExercise: () => void;
  onEditPersonalExercise: (personalExerciseId: string) => void;
  onArchivePersonalExercise: (personalExerciseId: string) => void;
  localOnlyPersonalCount: number;
  onImportPersonalExercises: () => void;
  onOpenV1Import: () => void;
  playableExerciseKeys: ReadonlySet<string>;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("ro-RO")
  .trim();

function categoryVariables(category: string | null, active: boolean) {
  if (category === null) {
    return {
      "--amv2-category-surface": active ? "#2e8052" : "#edf2ee",
      "--amv2-category-ink": active ? "#ffffff" : "#0b2d1b",
    } as CSSProperties;
  }
  const theme = getAmv2CategoryPresentation(category);
  return {
    "--amv2-category-surface": theme.surface,
    "--amv2-category-ink": theme.ink,
  } as CSSProperties;
}

export function AddExercisesPanel({
  source,
  onSourceChange,
  existingExerciseKeys,
  capacityFull,
  onSelectExercise,
  personalExercises,
  existingPersonalExerciseIds,
  onSelectPersonalExercise,
  onCreatePersonalExercise,
  onEditPersonalExercise,
  onArchivePersonalExercise,
  localOnlyPersonalCount,
  onImportPersonalExercises,
  onOpenV1Import,
  playableExerciseKeys,
}: AddExercisesPanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalize(deferredQuery);
  const existingKeySet = useMemo(() => new Set(existingExerciseKeys), [existingExerciseKeys]);
  const existingPersonalSet = useMemo(() => new Set(existingPersonalExerciseIds), [existingPersonalExerciseIds]);
  const canonicalResults = useMemo(() => filterCanonicalExerciseCatalog({
    query: deferredQuery,
    category,
  }), [category, deferredQuery]);
  const personalResults = useMemo(() => personalExercises.filter((exercise) => {
    if (exercise.archivedAt !== null) return false;
    if (category !== null && exercise.category !== category) return false;
    if (!normalizedQuery) return true;
    return normalize(`${exercise.name} ${exercise.category}`).includes(normalizedQuery);
  }), [category, normalizedQuery, personalExercises]);

  return (
    <section className={styles.addExercisesPanel} id="amv2-exercise-catalog" aria-labelledby="amv2-catalog-title">
      <header className={styles.catalogFinalHeader}>
        <h2 id="amv2-catalog-title">Catalog Exerciții</h2>
        <div className={styles.catalogSourceSelector} role="group" aria-label="Sursa exercițiilor">
          <button type="button" aria-pressed={source === "vemi"} onClick={() => onSourceChange("vemi")}>VEMI</button>
          <button type="button" aria-pressed={source === "personal"} onClick={() => onSourceChange("personal")}>Personal</button>
        </div>
      </header>

      <label className={styles.catalogSearch}>
        <span className={styles.catalogSearchIcon} aria-hidden="true">⌕</span>
        <span className={styles.srOnly}>Caută exerciții</span>
        <input
          type="search"
          value={query}
          placeholder="Caută exercițiu..."
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <div className={styles.catalogCategories} aria-label="Filtrează după categoria canonică">
        <button
          type="button"
          style={categoryVariables(null, category === null)}
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
        >Toate</button>
        {CANONICAL_EXERCISE_CATEGORIES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            style={categoryVariables(candidate, category === candidate)}
            aria-pressed={category === candidate}
            onClick={() => setCategory(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>

      {capacityFull ? (
        <p className={styles.capacityFullNotice} role="status">
          Ziua are deja 10 exerciții. Modifică sau șterge un exercițiu înainte să adaugi altul.
        </p>
      ) : null}

      {source === "vemi" ? (
        <div className={styles.catalogResults} aria-label="Catalog VEMI">
          {canonicalResults.length === 0 ? (
            <p className={styles.catalogEmpty}>Nu am găsit exerciții pentru căutarea curentă.</p>
          ) : canonicalResults.map((exercise) => {
            const alreadyAdded = existingKeySet.has(exercise.exerciseKey);
            const badgeCategory = category === "Acasă" ? "Acasă" : exercise.category;
            return (
              <article className={styles.catalogExerciseRow} key={exercise.exerciseKey}>
                <ExerciseMediaControl
                  exerciseKey={exercise.exerciseKey}
                  exerciseName={exercise.displayName}
                  playable={playableExerciseKeys.has(exercise.exerciseKey)}
                />
                <button
                  className={styles.catalogExerciseInfo}
                  type="button"
                  disabled={capacityFull && !alreadyAdded}
                  onClick={() => onSelectExercise(exercise.exerciseKey)}
                >
                  <strong>{exercise.displayName}</strong>
                  <ExerciseCategoryBadge category={badgeCategory} />
                </button>
                <button
                  className={styles.catalogAddExercise}
                  type="button"
                  disabled={capacityFull && !alreadyAdded}
                  aria-label={alreadyAdded ? `Modifică ${exercise.displayName}` : `Adaugă ${exercise.displayName}`}
                  onClick={() => onSelectExercise(exercise.exerciseKey)}
                >+</button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.personalSource}>
          <div className={styles.personalSourceActions}>
            <button type="button" onClick={onCreatePersonalExercise}><span aria-hidden="true">+</span> Creează exercițiu</button>
          </div>
          <div className={styles.catalogResults} aria-label="Exerciții Personal">
            {personalResults.length === 0 ? (
              <p className={styles.catalogEmpty}>Nu ai exerciții Personal pentru filtrul curent.</p>
            ) : personalResults.map((exercise) => {
              const alreadyAdded = existingPersonalSet.has(exercise.id);
              return (
                <article className={styles.personalCatalogCard} key={exercise.id}>
                  <div className={styles.catalogExerciseRow}>
                    <ExerciseMediaControl
                      exerciseKey={exercise.templateExerciseKey}
                      exerciseName={exercise.name}
                      playable={false}
                    />
                    <button
                      className={styles.catalogExerciseInfo}
                      type="button"
                      disabled={capacityFull && !alreadyAdded}
                      onClick={() => onSelectPersonalExercise(exercise.id)}
                    >
                      <strong>{exercise.name}</strong>
                      <ExerciseCategoryBadge category={exercise.category} />
                    </button>
                    <button
                      className={styles.catalogAddExercise}
                      type="button"
                      disabled={capacityFull && !alreadyAdded}
                      aria-label={alreadyAdded ? `Modifică ${exercise.name}` : `Adaugă ${exercise.name}`}
                      onClick={() => onSelectPersonalExercise(exercise.id)}
                    >+</button>
                  </div>
                  {pendingDeleteId === exercise.id ? (
                    <div className={styles.personalDeleteConfirmation} role="group" aria-label={`Confirmă ștergerea ${exercise.name}`}>
                      <button type="button" onClick={() => setPendingDeleteId(null)}>Anulează</button>
                      <button type="button" onClick={() => {
                        onArchivePersonalExercise(exercise.id);
                        setPendingDeleteId(null);
                      }}>Șterge</button>
                    </div>
                  ) : (
                    <div className={styles.personalManagementActions}>
                      <button type="button" onClick={() => setPendingDeleteId(exercise.id)}>Șterge</button>
                      <button type="button" onClick={() => onEditPersonalExercise(exercise.id)}>
                        <span className={styles.personalActionIcon} aria-hidden="true">✎</span>
                        Modifică
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <button className={styles.v1ImportLink} type="button" onClick={onOpenV1Import}>Copiază explicit din V1</button>
          {localOnlyPersonalCount > 0 ? (
            <button className={styles.accountImportLink} type="button" onClick={onImportPersonalExercises}>Salvează în cont</button>
          ) : null}
        </div>
      )}
    </section>
  );
}
