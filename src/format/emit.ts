import extractBlockElements from "./extractBlockElements.ts";
import type { State } from "./types.ts";

// Emit the given line
export const emitLine = (state: State, line: string): State => {
  return {
    ...state,
    acc: [...state.acc, line],
    lastEmitted: "nonblank",
  };
};

// Emit a blank line (only if last wasn't blank)
export const emitBlank = (state: State): State => {
  if (state.lastEmitted === "blank") return state;
  return {
    ...state,
    acc: [...state.acc, ""],
    lastEmitted: "blank",
  };
};

// Flush the content buffer: re-format its lines as block-level elements
// (see extractBlockElements) and emit them.
export const flushContent = (state: State): State => {
  if (state.contentBuffer.length === 0) return state;

  const outputLines = extractBlockElements(state.contentBuffer);

  return {
    ...state,
    acc: [...state.acc, ...outputLines],
    contentBuffer: [],
    lastEmitted: "nonblank",
  };
};
