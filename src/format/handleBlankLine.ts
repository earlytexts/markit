import { emitBlank, flushContent } from "./helpers.js";
import type { State } from "./types.js";

// Context aware handler for blank lines
// (decides whether to include them or not, and flushes content buffer)
export default (state: State): State => {
  // Don't emit blanks at the very start
  if (state.context === "start") {
    return state;
  }
  // Flush content buffer if we have content
  let newState = flushContent(state);
  // Only emit one blank at a time
  return emitBlank(newState);
};
