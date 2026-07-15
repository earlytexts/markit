import { emitBlank, emitLine } from "./emit.ts";
import type { State } from "./types.ts";

// Context-aware formatter for TOML metadata lines (key = value pairs)
export default (state: State, line: string): State => {
  const newState = emitLine(state, normalizeKeyValue(line));
  return { ...newState, context: "inMetadata" };
};

// Emit a [metadata] or [metadata.subkey] header line, transitioning to
// inMetadata context (blank-line separated from any previous metadata block)
export const handleMetadataHeader = (state: State, line: string): State => {
  let newState: State = state;
  if (state.context === "inMetadata") {
    newState = emitBlank(newState);
  }
  newState = emitLine(newState, line.trim());
  return { ...newState, context: "inMetadata" };
};

// Emit the opening `key = [` line of a multiline array and transition to
// array context
export const handleMetadataArrayStart = (state: State, line: string): State => {
  const newState = emitLine(state, normalizeKeyValue(line));
  return { ...newState, context: "inMetadataArray" };
};

// Emit a closing `]` or `],` line and transition back to inMetadata context
export const handleMetadataArrayEnd = (state: State, line: string): State => {
  const newState = emitLine(state, line.trim());
  return { ...newState, context: "inMetadata" };
};

// Emit an array item line (preserve indentation)
export const handleMetadataArrayItem = (state: State, line: string): State => {
  return emitLine(state, line);
};

// Normalize a `key = value` line to single spaces around the `=` (a bare
// `key =` keeps no trailing space)
const normalizeKeyValue = (line: string): string => {
  const eqIndex = line.indexOf("=");
  const key = line.slice(0, eqIndex).trim();
  const value = line.slice(eqIndex + 1).trimStart();
  return value ? `${key} = ${value}` : `${key} =`;
};
