# VEMI plan engine — contract de import

Fișierul `mock-data.ts` conține numai date demonstrative pentru infrastructura nouă. Nu este conectat la planurile gratuite existente și nu reprezintă recomandări fitness finale.

## Fluxul de import ulterior

1. Sursa editorială (Word sau Excel) este normalizată într-un tabel cu profil, săptămână, zi, ordine și `exercise_key`.
2. Tabelul este transformat într-un JSON care respectă `plan-config.schema.json` și tipurile din `lib/plan-engine/contracts.ts`.
3. Fiecare `configuration_key` este reconstruită determinist din profil.
4. Întregul lot este verificat de `validatePlanConfiguration` față de registrul canonic de exerciții.
5. Importul este oprit dacă există chei duplicate, zile lipsă, săptămâni inconsistente ori referințe inexistente, inactive sau retrase.
6. După validare, datele mock pot fi înlocuite de lotul real fără schimbarea resolverului sau a interfeței.

Planurile conțin doar `exercise_key`. Denumirea afișată, statusul și referința video rămân în registrul separat, astfel încât pot fi schimbate fără rescrierea planurilor.
