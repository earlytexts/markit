import canonicaliseCharacterModes from "./canonicaliseCharacterModes.ts";
import formatBlockTag from "./formatBlockTag.ts";
import formatIdBlock from "./formatIdBlock.ts";
import formatMetadata from "./formatMetadata.ts";
import handleBlankLine from "./handleBlankLine.ts";
import handleContentLine from "./handleContentLine.ts";
import { emitBlank, emitLine } from "./helpers.ts";
import type { State } from "./types.ts";

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

  // Trim trailing whitespace and collapse internal whitespace to single spaces.
  // Metadata lines keep their own handling; content lines route through a
  // marker-aware normaliser so the indentation after a leading `>`/`:` prefix
  // (which encodes nested-list depth) survives.
  const inMetadata = state.context === "inMetadata" ||
    state.context === "inMetadataArray";
  const normalized = inMetadata
    ? line.trimEnd().replace(/(?<=\S)\s+/g, " ")
    : normalizeContentLine(line);

  // Divide...
  const isBlank = normalized.trim() === "";
  const isId = /^(#+)\s+(.+)$/.test(normalized.trim());

  // Bracket header: [metadata], [metadata.subkey], or any [header]
  const isMetadataHeader =
    (state.context === "afterId" || state.context === "inMetadata") &&
    /^\[.+\]$/.test(normalized.trim());

  // TOML key = value line (only in metadata context, after a header)
  const isMetadataKeyValue = state.context === "inMetadata" &&
    !isBlank &&
    !isMetadataHeader &&
    normalized.includes("=") &&
    !normalized.trim().startsWith("[");

  // Multiline array start: key = [ with no closing ] on the same line
  const isMetadataArrayStart = state.context === "inMetadata" &&
    !isBlank &&
    /^\w+\s*=\s*\[$/.test(normalized.trim());

  // Inside a multiline array
  const isMetadataArrayEnd = state.context === "inMetadataArray" &&
    (normalized.trim() === "]" || normalized.trim() === "],");

  const isMetadataArrayItem = state.context === "inMetadataArray" && !isBlank &&
    !isMetadataArrayEnd;

  // ... and conquer
  if (isBlank) return handleBlankLine(state);
  if (isId) return formatIdBlock(state, normalized);
  if (isMetadataHeader) return handleMetadataHeader(state, normalized);
  if (isMetadataArrayStart) return handleMetadataArrayStart(state, normalized);
  if (isMetadataArrayEnd) return handleMetadataArrayEnd(state, normalized);
  if (isMetadataArrayItem) return handleMetadataArrayItem(state, normalized);
  if (isMetadataKeyValue) return formatMetadata(state, normalized);
  // Content lines (only) get their character/Greek-mode spans canonicalised
  // to the final Unicode they compile to; metadata, IDs, and block tags keep
  // their braces literal.
  const canonical = canonicaliseCharacterModes(normalized);
  // An empty list/verse item — a marker holding only a nested list — carries a
  // significant trailing space (`- `, `N. `, `* `) that the trimming above
  // strips, leaving a bare marker the classifier would misread (a lone `-`
  // becomes a table separator). Re-attach the marker's space so it stays a
  // list item through the rest of the pipeline.
  const emptyItem = /^(\s*)(-|\d+\.|\*)$/.exec(canonical);
  return handleContentLine(
    state,
    emptyItem ? `${emptyItem[1]}${emptyItem[2]} ` : canonical,
  );
};

// Normalise a content line, collapsing internal whitespace to single spaces.
// A leading run of blockquote/stage markers (`>`/`:`, each followed by one
// separator space) is peeled off first so that any indentation on the content
// that follows the final marker — which encodes nested-list depth — is kept,
// while the interior whitespace of that content is still collapsed. The
// recursive block extractor re-normalises the nesting levels from there.
const normalizeContentLine = (line: string): string => {
  const trimmed = line.trimEnd();

  // Non-marked lines: collapse interior whitespace; leading indentation (which
  // is not preceded by a non-space) is preserved by the lookbehind as before.
  if (!/^[>:]/.test(trimmed)) {
    return trimmed.replace(/(?<=\S)\s+/g, " ");
  }

  // Peel stacked markers (`> > `, `> : `, …), normalising the whitespace
  // between them to a single space.
  let prefix = "";
  let rest = trimmed;
  let stacked: RegExpExecArray | null;
  while ((stacked = /^([>:])\s+(?=[>:])/.exec(rest))) {
    prefix += `${stacked[1]} `;
    rest = rest.slice(stacked[0].length);
  }

  // Final marker: keep a single separator space, preserve the indentation of
  // the content after it, and collapse that content's interior whitespace.
  const marker = rest[0]!;
  const afterMarker = rest.slice(1);
  const hasSeparator = afterMarker.startsWith(" ");
  const content = (hasSeparator ? afterMarker.slice(1) : afterMarker).replace(
    /(?<=\S)\s+/g,
    " ",
  );
  return `${prefix}${marker}${hasSeparator ? " " : ""}${content}`;
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
