import { emitBlank } from "./emit.ts";
import type { State } from "./types.ts";

// Context-aware handler for blank lines.
// Inside a content block, blank lines separate block-level elements and are
// preserved in the content buffer; everywhere else a single blank is emitted.
// (The content buffer is only ever non-empty in the inContent context, so no
// other branch needs to flush it.)
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
    return { ...emitBlank(state), context: "inMetadata" };
  }

  // Between blocks: emit a blank
  return emitBlank(state);
};
