import type { MetadataValue } from "../types.js";

export type ValueDiagnostic = "invalid-value" | "mixed-array";

// Parse a single metadata value string (the right-hand side of a `key = value`
// pair, or a single item inside a multiline array). Accepts booleans, numbers,
// strings, and homogeneous arrays of these.
//
// Always returns a value — on parse failure the raw string is returned as a
// fallback so callers can still assign it to their metadata record. The
// `diagnostics` list is empty on success.
export default (
  valueString: string,
): { value: MetadataValue; diagnostics: ValueDiagnostic[] } => {
  const diagnostics: ValueDiagnostic[] = [];

  let value: MetadataValue;
  try {
    value = JSON.parse(valueString) as MetadataValue;
    if (
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      typeof value !== "string" &&
      !Array.isArray(value)
    ) {
      throw new Error("invalid type");
    }
  } catch {
    return { value: valueString, diagnostics: ["invalid-value"] };
  }

  if (Array.isArray(value)) {
    const types = new Set(
      (value as (number | boolean | string)[]).map((item) => typeof item),
    );
    if (types.size > 1) {
      diagnostics.push("mixed-array");
    }
  }

  return { value, diagnostics };
};
