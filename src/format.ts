import formatLine, { initialState } from "./format/formatLine.js";
import { flushContent } from "./format/helpers.js";

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
  const penultimateState = lines.reduce(formatLine, initialState);

  // Flush any remaining content and remove trailing blank lines
  const { acc: finalLines } = flushContent(penultimateState);
  while (finalLines.length > 0 && finalLines.at(-1) === "") {
    finalLines.pop();
  }

  // Join lines with LF and ensure document ends with a single LF
  return finalLines.join("\n") + "\n";
};
