import formatLine, { finish, initialState } from "./format/formatLine.ts";

/**
 * Format a Markit document string by normalizing whitespace and ensuring consistent line breaks.
 *
 * @param text The input Markit document as a string.
 * @returns A formatted version of the input string.
 */
export default (text: string): string => {
  // Split lines at line breaks, normalizing to LF
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // Process lines with state machine to handle context-sensitive formatting
  const finalState = lines.reduce(formatLine, initialState);

  // Flush any remaining content, drop trailing blanks, and join with LF,
  // ensuring the document ends with a single LF
  return finish(finalState).join("\n") + "\n";
};
