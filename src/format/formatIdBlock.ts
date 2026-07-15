import { emitBlank, emitLine, flushContent } from "./emit.ts";
import type { State } from "./types.ts";

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
  // Only called when the line matches this pattern (the dispatcher tested it)
  const match = line.trim().match(/^(#+)\s+(.+)$/)!;
  return `${match[1]!} ${match[2]!.trim()}`;
};
