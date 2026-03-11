import { emitLine } from "./helpers.js";
import type { State } from "./types.js";

// Context aware formatter for metadata lines (key: value pairs)
export default (state: State, line: string): State => {
  const formattedMetadata = formatMetadata(line);
  const newState = emitLine(state, formattedMetadata);
  return { ...newState, context: "inMetadata" };
};

const formatMetadata = (line: string): string => {
  // Preserve leading whitespace for YAML indentation
  const leadingSpace = line.match(/^\s*/)?.[0] || "";
  const trimmed = line.trim();

  // This function is only called if there is a colon
  const colonIndex = trimmed.indexOf(":");
  const key = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 1).trimStart();

  // If no value, just return key: (e.g., "draft:")
  if (!value) return `${leadingSpace}${key}:`;

  return `${leadingSpace}${key}: ${value}`;
};
