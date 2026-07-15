import type { Block, MarkitDocument } from "./types.ts";

/**
 * The inverse of `compileWithPositions`: a deep copy of a document (or a
 * single block) with every source position removed — node-level `source` and
 * `metadataSource`, and the per-character `sources` on plainText nodes — so
 * the result is the lean form `compile` produces, ready for serialisation.
 */
const stripPositions = <T extends MarkitDocument | Block>(node: T): T =>
  strip(node) as T;

export default stripPositions;

// Positions live under three property names, and only ever on grammar nodes;
// a `metadata` record is open (its keys are author data, so a key named
// "source" must survive) and can hold no positions, so it is copied verbatim.
const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip);
  if (typeof value !== "object" || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === "source" || key === "metadataSource" || key === "sources") {
      continue;
    }
    out[key] = key === "metadata" ? val : strip(val);
  }
  return out;
};
