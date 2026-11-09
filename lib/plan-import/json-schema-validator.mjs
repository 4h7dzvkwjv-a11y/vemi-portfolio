const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function joinPath(basePath, property) {
  return basePath ? `${basePath}.${property}` : property;
}

function indexPath(basePath, index) {
  return `${basePath}[${index}]`;
}

function resolveReference(rootSchema, reference) {
  if (typeof reference !== "string" || !reference.startsWith("#/")) return null;
  return reference
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, segment) => isObject(current) ? current[segment] : undefined, rootSchema);
}

function issue(code, path, message, value) {
  return { code, path, message, value };
}

function matchesType(value, type) {
  if (type === "object") return isObject(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "null") return value === null;
  return typeof value === type;
}

/**
 * Validator JSON Schema restrâns la cuvintele-cheie folosite de contractul
 * VEMI. Citește schema existentă la runtime; nu duplică structura planului.
 */
export function validateAgainstSchema(value, schema, options = {}) {
  const rootSchema = options.rootSchema ?? schema;
  const basePath = options.basePath ?? "";
  const issues = [];

  function visit(currentValue, currentSchema, path) {
    if (!isObject(currentSchema)) {
      issues.push(issue("schema_invalid", path, "Schema de validare este invalidă.", currentValue));
      return;
    }

    if (currentSchema.$ref) {
      const referenced = resolveReference(rootSchema, currentSchema.$ref);
      if (!referenced) {
        issues.push(issue("schema_reference_invalid", path, `Referința ${currentSchema.$ref} nu poate fi rezolvată.`, currentValue));
        return;
      }
      visit(currentValue, referenced, path);
      return;
    }

    if (Object.hasOwn(currentSchema, "const") && !Object.is(currentValue, currentSchema.const)) {
      issues.push(issue("schema_const", path, `Valoarea trebuie să fie ${JSON.stringify(currentSchema.const)}.`, currentValue));
    }
    if (Array.isArray(currentSchema.enum) && !currentSchema.enum.some((allowed) => Object.is(allowed, currentValue))) {
      issues.push(issue("schema_enum", path, `Valoarea nu se află în lista acceptată: ${currentSchema.enum.join(", ")}.`, currentValue));
    }

    if (currentSchema.type && !matchesType(currentValue, currentSchema.type)) {
      issues.push(issue("schema_type", path, `Valoarea trebuie să fie de tip ${currentSchema.type}.`, currentValue));
      return;
    }

    if (currentSchema.type === "object" && isObject(currentValue)) {
      const required = Array.isArray(currentSchema.required) ? currentSchema.required : [];
      for (const field of required) {
        if (!Object.hasOwn(currentValue, field)) {
          issues.push(issue("schema_required", joinPath(path, field), `Câmpul obligatoriu ${field} lipsește.`, undefined));
        }
      }
      const properties = isObject(currentSchema.properties) ? currentSchema.properties : {};
      for (const [field, fieldValue] of Object.entries(currentValue)) {
        if (Object.hasOwn(properties, field)) visit(fieldValue, properties[field], joinPath(path, field));
        else if (currentSchema.additionalProperties === false) {
          issues.push(issue("schema_additional_property", joinPath(path, field), `Câmpul ${field} nu este permis de contract.`, fieldValue));
        }
      }
    }

    if (currentSchema.type === "array" && Array.isArray(currentValue)) {
      if (Number.isInteger(currentSchema.minItems) && currentValue.length < currentSchema.minItems) {
        issues.push(issue("schema_min_items", path, `Lista trebuie să conțină cel puțin ${currentSchema.minItems} element(e).`, currentValue.length));
      }
      if (currentSchema.items) currentValue.forEach((item, index) => visit(item, currentSchema.items, indexPath(path, index)));
    }

    if (currentSchema.type === "string" && typeof currentValue === "string") {
      if (Number.isInteger(currentSchema.minLength) && currentValue.length < currentSchema.minLength) {
        issues.push(issue("schema_min_length", path, `Textul trebuie să conțină cel puțin ${currentSchema.minLength} caracter(e).`, currentValue));
      }
      if (typeof currentSchema.pattern === "string" && !new RegExp(currentSchema.pattern).test(currentValue)) {
        issues.push(issue("schema_pattern", path, "Valoarea nu respectă formatul definit de contract.", currentValue));
      }
    }

    if ((currentSchema.type === "integer" || currentSchema.type === "number") && typeof currentValue === "number") {
      if (typeof currentSchema.minimum === "number" && currentValue < currentSchema.minimum) {
        issues.push(issue("schema_minimum", path, `Valoarea minimă permisă este ${currentSchema.minimum}.`, currentValue));
      }
      if (typeof currentSchema.maximum === "number" && currentValue > currentSchema.maximum) {
        issues.push(issue("schema_maximum", path, `Valoarea maximă permisă este ${currentSchema.maximum}.`, currentValue));
      }
    }
  }

  visit(value, schema, basePath);
  return { valid: issues.length === 0, issues };
}
