import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AMV2_CATEGORY_ORDER,
  AMV2_CATEGORY_PRESENTATION,
} from "../lib/amv2/category-presentation.mjs";
import { PERSONAL_EXERCISE_CATEGORIES } from "../lib/amv2/personal-exercise-domain.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("copy-ul și ordinea categoriilor urmează cadrul Figma final", async () => {
  const panel = await read("components/amv2/add-exercises-panel.tsx");
  assert.match(panel, /Catalog Exerciții/);
  assert.match(panel, />VEMI<\/button>/);
  assert.match(panel, />Personal<\/button>/);
  assert.doesNotMatch(panel, /Alege un exercițiu|Personale|rezultate|Catalog canonic/);
  assert.deepEqual(AMV2_CATEGORY_ORDER, [
    "Piept", "Spate", "Umeri", "Biceps", "Triceps", "Picioare", "Abdomen", "Cardio", "Acasă",
  ]);
  assert.deepEqual(Object.keys(AMV2_CATEGORY_PRESENTATION), AMV2_CATEGORY_ORDER);
});

test("hero-ul și calendarul final nu expun locația", async () => {
  const [hero, client, calendar, css] = await Promise.all([
    read("components/amv2/amv2-hero.tsx"),
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/monthly-workout-calendar.tsx"),
    read("components/amv2/amv2.module.css"),
  ]);
  assert.doesNotMatch(hero, /INSTRUMENT GRATUIT/);
  assert.match(hero, /Antrenamentul meu/);
  assert.match(hero, /Creează și adaptează antrenamentele tale/);
  assert.match(client, /<Amv2Hero \/>/);
  assert.match(client, /window\.scrollTo\(\{ top: 0/);
  assert.match(calendar, /calendarDateNumber/);
  assert.match(calendar, /weekdays\.map\(\(weekday, index\)/);
  assert.match(css, /compactHero/);
  assert.doesNotMatch(css, /\.compactHero > span/);
  assert.match(css, /\.compactHero\s*\{[^}]*height:\s*99px;/);
  assert.match(css, /\.compactHero h1 \{[\s\S]*?margin: 0;/);
  assert.match(css, /calendarDay/);
  assert.doesNotMatch(client, /LOCAȚIE|Acasă \/ La sală|locationCopy|setLocation/);
});

test("sursele VEMI și Personal sunt separate și folosesc același filtru", async () => {
  const panel = await read("components/amv2/add-exercises-panel.tsx");
  assert.match(panel, /source === "vemi"/);
  assert.match(panel, /source === "personal"/);
  assert.match(panel, /CANONICAL_EXERCISE_CATEGORIES\.map/);
  assert.match(panel, /Creează exercițiu/);
  assert.match(panel, /ExerciseMediaControl/);
  assert.match(panel, /playable=\{playableExerciseKeys\.has\(exercise\.exerciseKey\)\}/);
  assert.match(panel, /playable=\{false\}/);
  assert.doesNotMatch(panel, /type="checkbox"|pendingExercise|locationLabel|result count/i);
});

test("formularul Personal final este comun pentru creare și editare", async () => {
  const editor = await read("components/amv2/personal-exercise-editor.tsx");
  assert.match(editor, /existing \? "Modifică exercițiul" : "Creează exercițiu"/);
  assert.match(editor, /PERSONAL_EXERCISE_CATEGORIES\.map/);
  assert.match(editor, /role="listbox"/);
  assert.match(editor, /aria-selected/);
  assert.match(editor, /Repetări \+ greutate/);
  assert.match(editor, /Salvează exercițiul/);
  assert.match(editor, /Salvează modificările/);
  assert.match(editor, /Anulează/);
  assert.doesNotMatch(editor, /Model VEMI|La sală|Durată totală/);
});

test("selectorul categoriei Personal pornește restrâns și păstrează selecția explicită", async () => {
  const [editor, css] = await Promise.all([
    read("components/amv2/personal-exercise-editor.tsx"),
    read("components/amv2/amv2.module.css"),
  ]);

  assert.deepEqual(PERSONAL_EXERCISE_CATEGORIES, [
    "Piept", "Spate", "Umeri", "Biceps", "Triceps", "Picioare", "Abdomen", "Cardio", "Acasă",
  ]);
  assert.match(editor, /existing\?\.category \?\? PERSONAL_EXERCISE_CATEGORIES\[0\]/);
  assert.match(editor, /const \[categoryOpen, setCategoryOpen\] = useState\(false\)/);
  assert.match(editor, /aria-expanded=\{categoryOpen\}/);
  assert.match(editor, /aria-haspopup="listbox"/);
  assert.match(editor, /<ExerciseCategoryBadge category=\{category\} \/>/);
  assert.match(editor, /categoryOpen \? \(/);
  assert.match(editor, /setCategory\(candidate\);[\s\S]*?closeCategorySelector\(\);/);
  assert.match(editor, /event\.key !== "Escape"/);
  assert.match(editor, /onSave\(\{ name: name\.trim\(\), category, metricType \}\)/);
  assert.match(css, /\.personalCategoryTrigger \{[\s\S]*?justify-content: space-between;/);
  assert.match(css, /\.personalCategoryChevronOpen \{ transform: rotate\(180deg\); \}/);
});

test("editorul final conectează Istoric contextual, fără X și păstrează cele patru metrici", async () => {
  const [editor, controls] = await Promise.all([
    read("components/amv2/editable-exercise-card.tsx"),
    read("components/amv2/exercise-visual-controls.tsx"),
  ]);
  assert.match(editor, /<ExerciseHistoryButton onClick=\{onOpenHistory \?/);
  assert.match(editor, /<ExerciseRecentHistory/);
  assert.match(controls, /const disabled = typeof onClick !== "function"/);
  assert.match(controls, /disabled=\{disabled\}/);
  assert.match(controls, /Istoric/);
  assert.doesNotMatch(editor, /aria-label="Închide|topClose/);
  for (const copy of ["Adaugă", "Salvează modificările", "Anulează", "Adaugă serie"]) {
    assert.match(editor, new RegExp(copy));
  }
  for (const metric of ["repetitions_weight", "repetitions_only", "total_duration"]) {
    assert.match(editor, new RegExp(metric));
  }
  assert.match(editor, /TimePerSet/);
  assert.match(editor, />Timp<\/span>/);
});

test("cardul final este detaliat și expune numai acțiunile aprobate", async () => {
  const [card, client] = await Promise.all([
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("components/amv2/amv2-client.tsx"),
  ]);
  assert.match(card, /ExerciseHistoryButton/);
  assert.match(card, /Modifică/);
  assert.match(card, /Șterge/);
  assert.match(card, /exercise\.sets\.map/);
  assert.match(client, /Adaugă exercițiu/);
  assert.doesNotMatch(card, /ordinal|editChevron|3 serii ·/);
  assert.doesNotMatch(client + card, /Șterge antrenamentul zilei|Salvează antrenamentul|Începe antrenamentul|Încheie antrenamentul/);
});

test("acțiunile Personal rămân compacte, iar Istoric folosește icon outline cu stare contextuală", async () => {
  const [panel, controls, card, editor, css] = await Promise.all([
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/exercise-visual-controls.tsx"),
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("components/amv2/editable-exercise-card.tsx"),
    read("components/amv2/amv2.module.css"),
  ]);

  assert.match(panel, /personalManagementActions/);
  assert.match(panel, /personalActionIcon/);
  assert.match(css, /\.personalCatalogCard \{[\s\S]*?border-radius: 10px;[\s\S]*?gap: 8px;/);
  assert.match(css, /\.personalManagementActions \{[\s\S]*?display: flex;[\s\S]*?justify-content: space-between;/);
  assert.match(css, /\.personalManagementActions button \{[\s\S]*?height: 22px;[\s\S]*?font-size: 9px;/);
  assert.match(css, /\.personalManagementActions button::after \{[\s\S]*?inset: -10px -6px;/);
  assert.match(controls, /<svg className=\{styles\.historyIcon\} viewBox="0 0 24 24"/);
  assert.match(controls, /disabled=\{disabled\}/);
  assert.match(card, /<ExerciseHistoryButton onClick=\{onOpenHistory\} \/>/);
  assert.match(editor, /<ExerciseHistoryButton onClick=\{onOpenHistory \?/);
  assert.doesNotMatch(controls, /▦/);
});

test("Final Effects Pass folosește un buget controlat, pointer hover și reduced motion", async () => {
  const css = await read("components/amv2/amv2.module.css");

  for (const token of [
    "--amv2-shadow-flat",
    "--amv2-shadow-card",
    "--amv2-shadow-elevated",
    "--amv2-shadow-lime",
    "--amv2-control-transition",
  ]) {
    assert.match(css, new RegExp(token));
  }

  assert.match(css, /\.compactHero\s*\{[\s\S]*?background-image:[\s\S]*?box-shadow: var\(--amv2-shadow-elevated\)/);
  assert.match(css, /\.compactHero::before\s*\{[\s\S]*?pointer-events: none;/);
  assert.match(css, /\.statisticsLauncher\s*\{[\s\S]*?box-shadow: var\(--amv2-shadow-card\)/);
  assert.match(css, /\.exerciseEditorPanel\s*\{[\s\S]*?box-shadow: var\(--amv2-shadow-card\)/);
  assert.match(css, /\.exerciseRecentHistoryList > article\s*\{[\s\S]*?box-shadow: var\(--amv2-shadow-card\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /\.statisticsLauncher:active:not\(:disabled\)[\s\S]*?transform: translateY\(0\) scale\(\.995\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: \.01ms !important;/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*?--amv2-shadow-card/);
  assert.doesNotMatch(css, /@keyframes|filter:\s*blur\(|animation\s*:/);
  assert.deepEqual(
    [...css.matchAll(/backdrop-filter:\s*([^;]+);/g)].map((match) => match[1].trim()),
    ["none"],
  );
});
