import canonicaliseCharacterModes from "./canonicaliseCharacterModes.ts";
import formatBlockTag from "./formatBlockTag.ts";
import formatIdBlock from "./formatIdBlock.ts";
import formatMetadata, {
  handleMetadataArrayEnd,
  handleMetadataArrayItem,
  handleMetadataArrayStart,
  handleMetadataHeader,
} from "./formatMetadata.ts";
import handleBlankLine from "./handleBlankLine.ts";
import handleContentLine from "./handleContentLine.ts";
import { flushContent } from "./emit.ts";
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
  // Content lines route through a marker-aware normaliser so the indentation
  // after a leading `>`/`:` prefix (which encodes nested-list depth) survives.
  const inMetadata = state.context === "inMetadata" ||
    state.context === "inMetadataArray";
  const normalized = inMetadata
    ? collapseWhitespace(line)
    : normalizeContentLine(line);
  const trimmed = normalized.trim();

  // Divide...
  const isBlank = trimmed === "";
  const isId = /^(#+)\s+(.+)$/.test(trimmed);

  // Bracket header: [metadata], [metadata.subkey], or any [header]
  const isMetadataHeader =
    (state.context === "afterId" || state.context === "inMetadata") &&
    /^\[.+\]$/.test(trimmed);

  // TOML key = value line (only in metadata context, after a header)
  const isMetadataKeyValue = state.context === "inMetadata" &&
    !isBlank &&
    !isMetadataHeader &&
    normalized.includes("=") &&
    !trimmed.startsWith("[");

  // Multiline array start: key = [ with no closing ] on the same line
  const isMetadataArrayStart = state.context === "inMetadata" &&
    !isBlank &&
    /^\w+\s*=\s*\[$/.test(trimmed);

  // Inside a multiline array
  const isMetadataArrayEnd = state.context === "inMetadataArray" &&
    (trimmed === "]" || trimmed === "],");

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

/**
 * Finish the run: flush any remaining buffered content and drop trailing
 * blank lines, returning the final output lines.
 */
export const finish = (state: State): string[] => {
  const { acc } = flushContent(state);
  while (acc.length > 0 && acc.at(-1) === "") {
    acc.pop();
  }
  return acc;
};

// Trim trailing whitespace and collapse interior whitespace runs to single
// spaces; leading indentation (not preceded by a non-space) survives the
// lookbehind.
const collapseWhitespace = (line: string): string =>
  line.trimEnd().replace(/(?<=\S)\s+/g, " ");

// Normalise a content line, collapsing internal whitespace to single spaces.
// A leading run of blockquote/stage markers (`>`/`:`, each followed by one
// separator space) is peeled off first so that any indentation on the content
// that follows the final marker — which encodes nested-list depth — is kept,
// while the interior whitespace of that content is still collapsed. The
// recursive block extractor re-normalises the nesting levels from there.
const normalizeContentLine = (line: string): string => {
  const trimmed = line.trimEnd();

  // Non-marked lines: collapse interior whitespace, keeping leading indentation.
  if (!/^[>:]/.test(trimmed)) {
    return collapseWhitespace(trimmed);
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
  const content = collapseWhitespace(
    hasSeparator ? afterMarker.slice(1) : afterMarker,
  );
  return `${prefix}${marker}${hasSeparator ? " " : ""}${content}`;
};
