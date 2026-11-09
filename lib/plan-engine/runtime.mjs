const PROFILE_VALUES = {
  gender: new Set(["male", "female"]),
  age_group: new Set(["18_29", "30_44", "45_59", "60_plus"]),
  goal: new Set(["weight_loss", "muscle_gain", "general_fitness"]),
  location: new Set(["home", "gym"]),
  level: new Set(["beginner", "intermediate", "advanced"]),
};

// Compatibil cu cheile canonice VEMI existente (kebab-case) și cu noul
// contract data-driven (snake_case). Cheia rămâne stabilă și nu este derivată
// niciodată din denumirea afișată.
const EXERCISE_KEY_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const issue = (code, path, message) => ({ code, path, message });

export function makeProfileConfigurationKey(profile) {
  return `plan:v1:${profile.gender}:${profile.age_group}:${profile.goal}:${profile.location}:${profile.level}:${profile.days_per_week}`;
}

export function validatePlanProfile(profile) {
  if (!isObject(profile)) {
    return { valid: false, issues: [issue("invalid_profile", "profile", "Profilul trebuie să fie un obiect.")] };
  }
  const issues = [];
  for (const [field, values] of Object.entries(PROFILE_VALUES)) {
    if (!values.has(profile[field])) {
      issues.push(issue("invalid_profile_value", `profile.${field}`, `Valoarea pentru ${field} nu este acceptată.`));
    }
  }
  if (!Number.isInteger(profile.days_per_week) || profile.days_per_week < 1 || profile.days_per_week > 7) {
    issues.push(issue("invalid_days_per_week", "profile.days_per_week", "Numărul de zile trebuie să fie între 1 și 7."));
  }
  return { valid: issues.length === 0, issues };
}

export function validateExerciseRegistry(registry) {
  if (!Array.isArray(registry)) {
    return { valid: false, issues: [issue("invalid_registry", "exercise_registry", "Registrul trebuie să fie o listă.")] };
  }
  const issues = [];
  const seen = new Set();
  registry.forEach((entry, index) => {
    const path = `exercise_registry[${index}]`;
    if (!isObject(entry)) {
      issues.push(issue("invalid_registry_entry", path, "Înregistrarea trebuie să fie un obiect."));
      return;
    }
    if (typeof entry.exercise_key !== "string" || !EXERCISE_KEY_PATTERN.test(entry.exercise_key)) {
      issues.push(issue("invalid_exercise_key", `${path}.exercise_key`, "exercise_key nu respectă formatul canonic."));
    } else if (seen.has(entry.exercise_key)) {
      issues.push(issue("duplicate_exercise_key", `${path}.exercise_key`, "exercise_key apare de mai multe ori."));
    } else seen.add(entry.exercise_key);
    if (typeof entry.display_name !== "string" || !entry.display_name.trim()) {
      issues.push(issue("missing_display_name", `${path}.display_name`, "Denumirea afișată este obligatorie."));
    }
    if (!["active", "inactive", "retired"].includes(entry.status)) {
      issues.push(issue("invalid_exercise_status", `${path}.status`, "Statusul exercițiului nu este acceptat."));
    }
    if (!Array.isArray(entry.available_locations) || entry.available_locations.length === 0) {
      issues.push(issue("missing_exercise_locations", `${path}.available_locations`, "Este necesar cel puțin un loc disponibil."));
    }
  });
  return { valid: issues.length === 0, issues };
}

function validateTarget(target, path, issues) {
  if (!isObject(target) || !["repetitions", "duration_seconds"].includes(target.kind)) {
    issues.push(issue("invalid_target", path, "Ținta trebuie să fie un interval de repetări sau de secunde."));
    return;
  }
  if (!isPositiveInteger(target.min) || !isPositiveInteger(target.max) || target.max < target.min) {
    issues.push(issue("invalid_target_range", path, "Intervalul trebuie să conțină valori pozitive și max ≥ min."));
  }
}

export function validatePlanConfiguration(configuration, exerciseRegistry) {
  const issues = [...validateExerciseRegistry(exerciseRegistry).issues];
  const registryByKey = new Map(
    Array.isArray(exerciseRegistry)
      ? exerciseRegistry.filter((entry) => isObject(entry) && typeof entry.exercise_key === "string").map((entry) => [entry.exercise_key, entry])
      : [],
  );

  if (!isObject(configuration)) {
    return { valid: false, issues: [...issues, issue("invalid_configuration", "configuration", "Configurația trebuie să fie un obiect.")] };
  }
  if (configuration.schema_version !== 1) {
    issues.push(issue("invalid_schema_version", "schema_version", "Versiunea contractului trebuie să fie 1."));
  }

  const profileValidation = validatePlanProfile(configuration.profile);
  issues.push(...profileValidation.issues);
  if (profileValidation.valid) {
    const expectedKey = makeProfileConfigurationKey(configuration.profile);
    if (configuration.configuration_key !== expectedKey) {
      issues.push(issue("configuration_key_mismatch", "configuration_key", `Cheia deterministă trebuie să fie ${expectedKey}.`));
    }
  }

  if (!isObject(configuration.metadata)) {
    issues.push(issue("missing_metadata", "metadata", "Metadatele sunt obligatorii."));
  } else {
    for (const field of ["title", "summary", "language", "content_status"]) {
      if (typeof configuration.metadata[field] !== "string" || !configuration.metadata[field].trim()) {
        issues.push(issue("missing_required_field", `metadata.${field}`, `Câmpul ${field} este obligatoriu.`));
      }
    }
    if (!["mock", "draft", "published"].includes(configuration.metadata.content_status)) {
      issues.push(issue("invalid_content_status", "metadata.content_status", "Statusul conținutului nu este acceptat."));
    }
  }

  if (!isPositiveInteger(configuration.number_of_weeks)) {
    issues.push(issue("invalid_week_count", "number_of_weeks", "Numărul de săptămâni trebuie să fie pozitiv."));
  }
  if (!Array.isArray(configuration.weeks) || configuration.weeks.length === 0) {
    issues.push(issue("missing_weeks", "weeks", "Configurația trebuie să conțină săptămâni."));
    return { valid: false, issues };
  }
  if (configuration.weeks.length !== configuration.number_of_weeks) {
    issues.push(issue("week_count_mismatch", "weeks", "Numărul săptămânilor nu corespunde câmpului number_of_weeks."));
  }

  const expectedDays = profileValidation.valid ? configuration.profile.days_per_week : null;
  configuration.weeks.forEach((week, weekIndex) => {
    const weekPath = `weeks[${weekIndex}]`;
    if (!isObject(week)) {
      issues.push(issue("invalid_week", weekPath, "Săptămâna trebuie să fie un obiect."));
      return;
    }
    if (week.week_number !== weekIndex + 1) {
      issues.push(issue("inconsistent_week_number", `${weekPath}.week_number`, "Săptămânile trebuie numerotate consecutiv."));
    }
    if (typeof week.display_label !== "string" || !week.display_label.trim()) {
      issues.push(issue("missing_required_field", `${weekPath}.display_label`, "Eticheta săptămânii este obligatorie."));
    }
    if (!isObject(week.progression) || typeof week.progression.summary !== "string" || !week.progression.summary.trim()) {
      issues.push(issue("missing_progression", `${weekPath}.progression.summary`, "Fiecare săptămână trebuie să descrie progresia."));
    }
    if (!Array.isArray(week.days) || week.days.length === 0) {
      issues.push(issue("missing_days", `${weekPath}.days`, "Săptămâna trebuie să conțină zile."));
      return;
    }
    if (expectedDays !== null && week.days.length !== expectedDays) {
      issues.push(issue("days_per_week_mismatch", `${weekPath}.days`, `Săptămâna trebuie să conțină exact ${expectedDays} zile.`));
    }

    week.days.forEach((day, dayIndex) => {
      const dayPath = `${weekPath}.days[${dayIndex}]`;
      if (!isObject(day)) {
        issues.push(issue("invalid_day", dayPath, "Ziua trebuie să fie un obiect."));
        return;
      }
      if (day.day_number !== dayIndex + 1) {
        issues.push(issue("inconsistent_day_number", `${dayPath}.day_number`, "Zilele trebuie numerotate consecutiv."));
      }
      for (const field of ["display_label", "title"]) {
        if (typeof day[field] !== "string" || !day[field].trim()) {
          issues.push(issue("missing_required_field", `${dayPath}.${field}`, `Câmpul ${field} este obligatoriu.`));
        }
      }
      if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
        issues.push(issue("empty_training_day", `${dayPath}.exercises`, "O zi trebuie să conțină exerciții."));
        return;
      }

      day.exercises.forEach((exercise, exerciseIndex) => {
        const exercisePath = `${dayPath}.exercises[${exerciseIndex}]`;
        if (!isObject(exercise)) {
          issues.push(issue("invalid_plan_exercise", exercisePath, "Exercițiul trebuie să fie un obiect."));
          return;
        }
        if (exercise.order !== exerciseIndex + 1) {
          issues.push(issue("inconsistent_exercise_order", `${exercisePath}.order`, "Ordinea trebuie să fie consecutivă."));
        }
        if (typeof exercise.exercise_key !== "string" || !EXERCISE_KEY_PATTERN.test(exercise.exercise_key)) {
          issues.push(issue("invalid_exercise_key", `${exercisePath}.exercise_key`, "exercise_key nu respectă formatul canonic."));
        } else {
          const registryEntry = registryByKey.get(exercise.exercise_key);
          if (!registryEntry) {
            issues.push(issue("unknown_exercise_key", `${exercisePath}.exercise_key`, `Exercițiul ${exercise.exercise_key} nu există.`));
          } else if (registryEntry.status !== "active") {
            issues.push(issue(
              registryEntry.status === "retired" ? "retired_exercise_reference" : "inactive_exercise_reference",
              `${exercisePath}.exercise_key`,
              `Exercițiul ${exercise.exercise_key} nu este activ.`,
            ));
          } else if (profileValidation.valid && !registryEntry.available_locations.includes(configuration.profile.location)) {
            issues.push(issue("exercise_location_mismatch", `${exercisePath}.exercise_key`, "Exercițiul nu este disponibil pentru locul profilului."));
          }
        }
        if (!isPositiveInteger(exercise.sets)) {
          issues.push(issue("invalid_sets", `${exercisePath}.sets`, "Numărul de seturi trebuie să fie pozitiv."));
        }
        validateTarget(exercise.target, `${exercisePath}.target`, issues);
        if (!Number.isInteger(exercise.rest_seconds) || exercise.rest_seconds < 0) {
          issues.push(issue("invalid_rest", `${exercisePath}.rest_seconds`, "Pauza trebuie exprimată în secunde și nu poate fi negativă."));
        }
      });
    });
  });
  return { valid: issues.length === 0, issues };
}

export function resolvePlanConfiguration(profile, configurations, exerciseRegistry) {
  const profileValidation = validatePlanProfile(profile);
  if (!profileValidation.valid) {
    return {
      status: "invalid_profile",
      configuration_key: null,
      message: "Profilul este incomplet sau conține valori neacceptate.",
      issues: profileValidation.issues,
    };
  }
  const configurationKey = makeProfileConfigurationKey(profile);
  const matches = Array.isArray(configurations)
    ? configurations.filter((configuration) => configuration?.configuration_key === configurationKey)
    : [];
  if (matches.length === 0) {
    return {
      status: "not_found",
      configuration_key: configurationKey,
      message: "Nu există o configurație pentru această combinație. Nu a fost aplicat niciun fallback automat.",
    };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous_configuration",
      configuration_key: configurationKey,
      message: "Există mai multe configurații pentru aceeași cheie de profil.",
      issues: [issue("duplicate_configuration_key", "configurations", "Cheia de profil trebuie să fie unică.")],
    };
  }
  const validation = validatePlanConfiguration(matches[0], exerciseRegistry);
  if (!validation.valid) {
    return {
      status: "invalid_configuration",
      configuration_key: configurationKey,
      message: "Configurația există, dar nu trece validarea și nu poate fi afișată.",
      issues: validation.issues,
    };
  }
  return { status: "found", configuration_key: configurationKey, plan: matches[0] };
}
