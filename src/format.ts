import formatBlockTag from "./format/formatBlockTag.js";
import formatIdBlock from "./format/formatIdBlock.js";
import formatMetadata from "./format/formatMetadata.js";
import handleBlankLine from "./format/handleBlankLine.js";
import handleContentLine from "./format/handleContentLine.js";
import { flushContent } from "./format/helpers.js";
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
  const hasColon = normalized.includes(":");
  const startsWithDash = normalized.trim().startsWith("-");
  const isMetadataKeyValue =
    (state.context === "afterId" || state.context === "inMetadata") &&
    !isBlockTag &&
    !isBlank &&
    !startsWithDash &&
    hasColon;

  // ... and conquer
  if (isBlank) return handleBlankLine(state);
  if (isId) return formatIdBlock(state, normalized);
  if (isBlockTag) return formatBlockTag(state, normalized);
  if (isMetadataKeyValue) return formatMetadata(state, normalized);
  return handleContentLine(state, normalized);
};
