import { emitBlank, emitLine, flushContent } from "./helpers.js";
import type { State } from "./types.js";

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

const formatBlockTag = (line: string) => {
  const trimmed = line.trim();

  const closingBrace = trimmed.indexOf("}");
  if (closingBrace === -1) {
    // Malformed - return unchanged
    return { tag: line, content: "" };
  }

  const inner = trimmed.slice(2, closingBrace).trim();
  const rest = trimmed.slice(closingBrace + 1).trim();

  const formattedTag = `{#${inner}}`;
  return { tag: formattedTag, content: rest };
};
