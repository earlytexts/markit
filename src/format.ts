import formatBlockTag from "./format/formatBlockTag.js";
import formatIdBlock from "./format/formatIdBlock.js";
import formatMetadata from "./format/formatMetadata.js";
import handleBlankLine from "./format/handleBlankLine.js";
import handleContentLine from "./format/handleContentLine.js";
import { emitBlank, emitLine, flushContent } from "./format/helpers.js";
import type { State } from "./format/types.js";

/**
 * Format a Markit document string by normalizing whitespace and ensuring consistent line breaks.
 *
 * @param text The input Markit document as a string.
 * @returns A formatted version of the input string.
 */
export default (text: string): string => {
  // Split lines at line breaks, normalizing to LF
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // Process lines with state machine to handle context-sensitive formatting
  const penultimateState = lines.reduce(formatLine, initialState);

  // Flush any remaining content and remove trailing blank lines
  const { acc: finalLines } = flushContent(penultimateState);
  while (finalLines.length > 0 && finalLines.at(-1) === "") {
    finalLines.pop();
  }

  // Join lines with LF and ensure document ends with a single LF
  return finalLines.join("\n") + "\n";
};

const initialState: State = {
  context: "start",
  acc: [],
  contentBuffer: [],
  lastEmitted: "blank",
};

const formatLine = (state: State, line: string): State => {
  // Trim trailing whitespace and collapse internal whitespace to single spaces
  const normalized = line.trimEnd().replace(/(?<=\S)\s+/g, " ");

  // Divide...
  const isBlank = normalized.trim() === "";
  const isId = /^(#+)\s+(.+)$/.test(normalized.trim());
  const isBlockTag = normalized.trim().startsWith("{#");

  // Bracket header: [metadata], [metadata.subkey], or any [header]
  const isMetadataHeader =
    (state.context === "afterId" || state.context === "inMetadata") &&
    /^\[.+\]$/.test(normalized.trim());

  // TOML key = value line (only in metadata context, after a header)
  const isMetadataKeyValue =
    state.context === "inMetadata" &&
    !isBlank &&
    !isBlockTag &&
    !isMetadataHeader &&
    normalized.includes("=") &&
    !normalized.trim().startsWith("[");

  // Multiline array start: key = [ with no closing ] on the same line
  const isMetadataArrayStart =
    state.context === "inMetadata" &&
    !isBlank &&
    !isBlockTag &&
    /^\w+\s*=\s*\[$/.test(normalized.trim());

  // Inside a multiline array
  const isMetadataArrayEnd =
    state.context === "inMetadataArray" &&
    (normalized.trim() === "]" || normalized.trim() === "],");

  const isMetadataArrayItem =
    state.context === "inMetadataArray" && !isBlank && !isMetadataArrayEnd;

  // ... and conquer
  if (isBlank) return handleBlankLine(state);
  if (isId) return formatIdBlock(state, normalized);
  if (isBlockTag) return formatBlockTag(state, normalized);
  if (isMetadataHeader) return handleMetadataHeader(state, normalized);
  if (isMetadataArrayStart) return handleMetadataArrayStart(state, normalized);
  if (isMetadataArrayEnd) return handleMetadataArrayEnd(state, normalized);
  if (isMetadataArrayItem) return handleMetadataArrayItem(state, normalized);
  if (isMetadataKeyValue) return formatMetadata(state, normalized);
  return handleContentLine(state, normalized);
};

// Emit a [metadata] or [metadata.subkey] header line, transitioning to inMetadata context
const handleMetadataHeader = (state: State, line: string): State => {
  let newState: State = state;
  if (state.context === "inMetadata") {
    newState = emitBlank(newState);
  }
  newState = emitLine(newState, line.trim());
  return { ...newState, context: "inMetadata" };
};

// Emit the opening `key = [` line and transition to array context
const handleMetadataArrayStart = (state: State, line: string): State => {
  const formatted = formatMetadataArrayKey(line);
  const newState = emitLine(state, formatted);
  return { ...newState, context: "inMetadataArray" };
};

// Emit a closing `]` or `],` line and transition back to inMetadata context
const handleMetadataArrayEnd = (state: State, line: string): State => {
  const newState = emitLine(state, line.trim());
  return { ...newState, context: "inMetadata" };
};

// Emit an array item line (preserve indentation)
const handleMetadataArrayItem = (state: State, line: string): State => {
  return emitLine(state, line);
};

// Normalize the `key = [` line (spaces around `=`)
const formatMetadataArrayKey = (line: string): string => {
  const eqIndex = line.indexOf("=");
  const key = line.slice(0, eqIndex).trim();
  const rest = line.slice(eqIndex + 1).trim(); // should be "["
  return `${key} = ${rest}`;
};
