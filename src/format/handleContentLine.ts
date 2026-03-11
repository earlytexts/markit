import { emitLine } from "./helpers.js";
import type { State } from "./types.js";

// Context aware handler for content lines
export default (state: State, line: string): State => {
  // Handle content lines
  if (state.context === "inContent" || state.context === "afterMetadata") {
    return {
      ...state,
      contentBuffer: [...state.contentBuffer, line],
      context: "inContent",
    };
  }

  // If we're in afterId context but this line doesn't match any pattern,
  // treat it as content
  if (state.context === "afterId") {
    return {
      ...state,
      contentBuffer: [line],
      context: "inContent",
    };
  }

  // Fallback: emit line as-is
  return emitLine(state, line);
};
