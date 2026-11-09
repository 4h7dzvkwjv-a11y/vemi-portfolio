# Import și validare batch VEMI

Acest modul implementează numai etapele de import normalizat, validare și raport. Nu conține o operație de salvare, aprobare, publicare sau activare.

## Fluxul actual

1. Un lot JSON este citit local de panoul admin.
2. Fiecare configurație este verificată față de `data/plan-engine/plan-config.schema.json`.
3. Validatorul semantic existent verifică profilul, săptămânile, zilele, progresia, prescripțiile și referințele `exercise_key`.
4. Validatorul batch verifică duplicatele, ambiguitatea și acoperirea față de o matrice opțională de chei așteptate.
5. Este generat un raport unic pentru întregul lot.
6. `publication.published_configurations` rămâne întotdeauna `0`, iar `active_data_changed` rămâne `false`.

Orice eroare blocantă produce `status: "rejected"`. Configurațiile valide dintr-un lot respins nu sunt tratate ca import parțial.

## Viitorul adaptor Word

`PlanSourceAdapter<TSource>` definește limita dintre documentul uman și validator:

`Word structurat → adaptor separat → PlanBatchEnvelope → același validator batch`

Adaptorul Word va normaliza conținutul, dar nu va putea valida, aproba sau activa planuri. Formatul documentului nu este presupus în această etapă.
