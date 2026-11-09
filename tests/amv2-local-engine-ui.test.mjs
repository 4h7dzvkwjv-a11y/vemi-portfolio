import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("CP219P păstrează calendarul ca navigație și istoric editabil, fără lifecycle de sesiune", async () => {
  const [client, calendar, route] = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/monthly-workout-calendar.tsx"),
    read("app/antrenamentul-meu-v2/page.tsx"),
  ]);
  assert.match(client, /data-amv2-checkpoint="cp219p"/);
  assert.match(client, /data-amv2-route="calendar-workout-log"/);
  assert.match(client, /data-local-model="workout-day-v1"/);
  assert.match(calendar, /Luna anterioară|Luna următoare|Astăzi/);
  assert.match(client, /Amv2Hero/);
  assert.match(client, /formatSelectedDate\(selectedDate\)/);
  assert.match(route, /Calendarul local VEMI/);

  const visible = client + route;
  for (const obsolete of [
    /Numele antrenamentului/i,
    /Salvează antrenamentul/i,
    /Începe antrenamentul/i,
    /Reia antrenamentul/i,
    /Încheie antrenamentul/i,
    /Abandonează/i,
    /Istoric local/i,
    /definition modified|definiție modificată/i,
  ]) assert.doesNotMatch(visible, obsolete);
});

test("editorul are doar persistență locală pe exercițiu și redă cele patru metrici", async () => {
  const [editor, card, client] = await Promise.all([
    read("components/amv2/editable-exercise-card.tsx"),
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("components/amv2/amv2-client.tsx"),
  ]);
  for (const copy of ["Adaugă", "Salvează modificările", "Anulează", "Adaugă serie", "Durată totală"]) {
    assert.match(editor, new RegExp(copy));
  }
  for (const metric of ["repetitions_weight", "repetitions_only", "time_per_set", "total_duration"]) {
    assert.match(editor + card, new RegExp(metric));
  }
  assert.match(card, /Șterge/);
  assert.match(card, /Modifică/);
  assert.match(card, /ExerciseHistoryButton/);
  assert.match(card, /Confirmă/);
  assert.match(client, /Adaugă exercițiu/);
  assert.doesNotMatch(client + editor + card, /target versus actual|Țintă|Valoare efectivă|completion checkbox/i);
});

test("cardurile zilei păstrează reprezentarea detaliată și nu oferă ștergere globală", async () => {
  const [card, client] = await Promise.all([
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("components/amv2/amv2-client.tsx"),
  ]);
  for (const copy of ["Seria", "Repetări", "Greutate", "Timp", "Durată totală"]) {
    assert.match(card, new RegExp(copy));
  }
  assert.match(card, /exercise\.sets\.map/);
  assert.doesNotMatch(card, /ordinal|editChevron/);
  assert.doesNotMatch(card, /3 serii ·/);
  assert.doesNotMatch(client + card, /Șterge antrenamentul zilei|Șterge ziua/i);
});

test("UI-ul calendaristic păstrează scrierea locală și nu accesează direct Supabase", async () => {
  const files = await Promise.all([
    read("components/amv2/amv2-client.tsx"),
    read("components/amv2/add-exercises-panel.tsx"),
    read("components/amv2/editable-exercise-card.tsx"),
    read("components/amv2/monthly-workout-calendar.tsx"),
    read("components/amv2/workout-day-exercise-card.tsx"),
    read("lib/amv2/workout-day-domain.mjs"),
    read("lib/amv2/workout-calendar-local.mjs"),
    read("lib/amv2/durable-local-store.mjs"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /supabase\s*\.\s*from\(|\.rpc\(|XMLHttpRequest|sendBeacon|service_role|drizzle/i);
  assert.match(source, /commitWorkoutDayMutation/);
  assert.match(source, /indexedDB|openAmv2DurableStore/);
  assert.doesNotMatch(files[0], /writeWorkoutCalendar\(window\.localStorage/);
  assert.doesNotMatch(source, /value\s*\|\|\s*(?:10|30|900|null)/);
});
