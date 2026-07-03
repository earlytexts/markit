import formatBlockTag from "./formatBlockTag.js";
import formatIdBlock from "./formatIdBlock.js";
import formatMetadata from "./formatMetadata.js";
import handleBlankLine from "./handleBlankLine.js";
import handleContentLine from "./handleContentLine.js";
import { emitBlank, emitLine } from "./helpers.js";
import type { State } from "./types.js";

export const initialState: State = {
  context: "start",
  acc: [],
  contentBuffer: [],
  lastEmitted: "blank",
};

export default (state: State, line: string): State => {
  // Block tags are handled before whitespace normalisation so that strings
  // inside the tag keep their internal whitespace intact.
  if (line.trimStart().startsWith("{#")) {
    return formatBlockTag(state, line);
  }

  // Trim trailing whitespace and collapse internal whitespace to single spaces
  const normalized = line.trimEnd().replace(/(?<=\S)\s+/g, " ");

  // Divide...
  const isBlank = normalized.trim() === "";
  const isId = /^(#+)\s+(.+)$/.test(normalized.trim());

  // Bracket header: [metadata], [metadata.subkey], or any [header]
  const isMetadataHeader =
    (state.context === "afterId" || state.context === "inMetadata") &&
    /^\[.+\]$/.test(normalized.trim());

  // TOML key = value line (only in metadata context, after a header)
  const isMetadataKeyValue =
    state.context === "inMetadata" &&
    !isBlank &&
    !isMetadataHeader &&
    normalized.includes("=") &&
    !normalized.trim().startsWith("[");

  // Multiline array start: key = [ with no closing ] on the same line
  const isMetadataArrayStart =
    state.context === "inMetadata" &&
    !isBlank &&
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
  if (isMetadataHeader) return handleMetadataHeader(state, normalized);
  if (isMetadataArrayStart) return handleMetadataArrayStart(state, normalized);
  if (isMetadataArrayEnd) return handleMetadataArrayEnd(state, normalized);
  if (isMetadataArrayItem) return handleMetadataArrayItem(state, normalized);
  if (isMetadataKeyValue) return formatMetadata(state, normalized);
  // An empty list/verse item — a marker holding only a nested list — carries a
  // significant trailing space (`- `, `N. `, `* `) that the trimming above
  // strips, leaving a bare marker the classifier would misread (a lone `-`
  // becomes a table separator). Re-attach the marker's space so it stays a
  // list item through the rest of the pipeline.
  const emptyItem = /^(\s*)(-|\d+\.|\*)$/.exec(normalized);
  return handleContentLine(
    state,
    emptyItem ? `${emptyItem[1]}${emptyItem[2]} ` : normalized,
  );
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
