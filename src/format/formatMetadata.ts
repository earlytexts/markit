import { emitLine } from "./helpers.js";
import type { State } from "./types.js";

// Context-aware formatter for TOML metadata lines (key = value pairs)
export default (state: State, line: string): State => {
  const formattedMetadata = formatMetadata(line);
  const newState = emitLine(state, formattedMetadata);
  return { ...newState, context: "inMetadata" };
};

const formatMetadata = (line: string): string => {
  const eqIndex = line.indexOf("=");
  const key = line.slice(0, eqIndex).trim();
  const value = line.slice(eqIndex + 1).trimStart();

  // If no value, just return key =
  if (!value) return `${key} =`;

  return `${key} = ${value}`;
};
