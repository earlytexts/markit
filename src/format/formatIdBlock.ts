import { emitBlank, emitLine, flushContent } from "./helpers.js";
import type { State } from "./types.js";

// Context aware formatter for ID lines
export default (state: State, line: string): State => {
  let newState = flushContent(state);

  // Ensure blank before ID block (unless at start)
  if (newState.context !== "start") {
    newState = emitBlank(newState);
  }

  // Emit formatted ID block
  const formattedLine = formatIdBlock(line);
  newState = emitLine(newState, formattedLine);

  // Ensure blank after ID block
  newState = emitBlank(newState);

  return { ...newState, context: "afterId" };
};

const formatIdBlock = (line: string): string => {
  // This function is only called if the line matches the ID pattern
  const match = line.trim().match(/^(#+)\s+(.+)$/)!;
  const [, hashes, id] = match;
  return `${hashes} ${id?.trim()}`;
};
