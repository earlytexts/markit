import { findClosingBrace, splitTopLevelCommas } from "../lib/blockTagLexer.ts";
import { emitBlank, emitLine, flushContent } from "./helpers.ts";
import type { State } from "./types.ts";

// Context aware formatter for lines starting with block tags
export default (state: State, line: string): State => {
  let newState = flushContent(state);

  // Add blank before block tag (unless just after ID or at start)
  if (newState.context === "inContent") {
    newState = emitBlank(newState);
  } else if (
    newState.context === "inMetadata" ||
    newState.context === "inMetadataArray"
  ) {
    newState = emitBlank(newState);
    newState = { ...newState, context: "afterMetadata" };
  }

  // Format block tag and split content if present
  const { tag, content } = formatBlockTag(line);
  newState = emitLine(newState, tag);

  // If there's content after the tag, add it to buffer
  if (content) {
    newState = {
      ...newState,
      contentBuffer: [content],
      context: "inContent",
    };
  } else {
    newState = { ...newState, context: "inContent" };
  }

  return newState;
};

const formatBlockTag = (line: string): { tag: string; content: string } => {
  const trimmed = line.trimStart();
  const closingBrace = findClosingBrace(trimmed, 2);
  if (closingBrace === -1) {
    // Malformed — return unchanged (minus leading/trailing whitespace)
    return { tag: trimmed.trimEnd(), content: "" };
  }

  const chunks = splitTopLevelCommas(trimmed.slice(2, closingBrace));
  const rest = trimmed.slice(closingBrace + 1).trim();

  if (chunks.length === 0) {
    // Empty tag like "{#}" — preserve as-is
    return { tag: "{#}", content: rest };
  }

  const id = chunks[0]!.content;
  const pairs = chunks.slice(1).map((c) => formatPair(c.content));
  const inner = [`#${id}`, ...pairs].join(", ");

  return { tag: `{${inner}}`, content: rest };
};

// Canonicalise a single `key=value` pair: strip whitespace around `=`, preserve
// string contents verbatim, and normalise spacing inside array literals.
const formatPair = (chunk: string): string => {
  const match = /^(\w+)\s*=\s*(.*)$/s.exec(chunk);
  if (!match) {
    // Malformed pair — leave as-is so the compiler's diagnostic still points
    // at the intact text.
    return chunk;
  }
  const [, key, rawValue] = match;
  return `${key}=${formatValue(rawValue!)}`;
};

// Canonicalise a value: arrays get one space after each top-level comma;
// strings and scalars are returned verbatim (modulo outer trimming).
const formatValue = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const items = splitTopLevelCommas(trimmed.slice(1, -1));
    return `[${items.map((i) => i.content).join(", ")}]`;
  }
  return trimmed;
};
