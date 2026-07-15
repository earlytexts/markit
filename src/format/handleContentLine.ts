import { emitLine } from "./emit.ts";
import type { State } from "./types.ts";

// Context aware handler for content lines
export default (state: State, line: string): State => {
  // A content line in (or entering) a content block joins the buffer. The
  // buffer is empty in the afterId and afterMetadata contexts, so one spread
  // covers all three.
  if (
    state.context === "inContent" ||
    state.context === "afterMetadata" ||
    state.context === "afterId"
  ) {
    return {
      ...state,
      contentBuffer: [...state.contentBuffer, line],
      context: "inContent",
    };
  }

  // Fallback: emit line as-is
  return emitLine(state, line);
};
