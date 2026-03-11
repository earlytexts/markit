import { emitBlank, emitLine, flushContent } from "./helpers.js";
import type { State } from "./types.js";

// Context aware formatter for lines starting with block tags
export default (state: State, line: string): State => {
  let newState = flushContent(state);

  // Add blank before block tag (unless just after ID or at start)
  if (newState.context === "inContent") {
    newState = emitBlank(newState);
  } else if (newState.context === "inMetadata") {
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

const formatBlockTag = (line: string) => {
  const trimmed = line.trim();

  const closingBrace = trimmed.indexOf("}");
  if (closingBrace === -1) {
    // Malformed - return unchanged
    return { tag: line, content: "" };
  }

  const inner = trimmed.slice(2, closingBrace);
  const rest = trimmed.slice(closingBrace + 1).trim();

  // Split on commas, but respect quoted strings
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let escapeNext = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      current += char;
      continue;
    }

    if (char === "," && !inQuote) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }
  parts.push(current);

  // Format each part
  const formattedParts = parts.map(formatBlockTagPart);

  const formattedTag = `{#${formattedParts.join(", ")}}`;
  return { tag: formattedTag, content: rest };
};

const formatBlockTagPart = (part: string, index: number) => {
  const trimmedPart = part.trim();
  if (index === 0) {
    // First part is the ID - just remove spaces
    return trimmedPart;
  }

  // Metadata pairs: key=value (no spaces around =)
  const eqIndex = trimmedPart.indexOf("=");
  if (eqIndex === -1) {
    // No equals sign - return as-is (e.g., "standalone")
    return trimmedPart;
  }

  const key = trimmedPart.slice(0, eqIndex).trim();
  const value = trimmedPart.slice(eqIndex + 1).trim();
  return `${key}=${value}`;
};
