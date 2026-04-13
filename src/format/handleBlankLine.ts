import { emitBlank, flushContent } from "./helpers.js";
import type { State } from "./types.js";

// Context-aware handler for blank lines.
// Inside a content block, blank lines separate block-level elements and are
// preserved in the content buffer. Outside content blocks, a blank line flushes
// the buffer and emits one blank line.
export default (state: State): State => {
  // Don't emit blanks at the very start
  if (state.context === "start") {
    return state;
  }

  // Inside a content block: add blank to buffer so flushContent can preserve
  // element boundaries when it processes the buffer.
  if (state.context === "inContent") {
    return {
      ...state,
      contentBuffer: [...state.contentBuffer, ""],
    };
  }

  // Inside a multiline array: blank line ends the array, transition back to metadata
  if (state.context === "inMetadataArray") {
    let newState = flushContent(state);
    newState = emitBlank(newState);
    return { ...newState, context: "inMetadata" };
  }

  // Outside content blocks: flush any buffered content and emit a blank.
  let newState = flushContent(state);
  return emitBlank(newState);
};
