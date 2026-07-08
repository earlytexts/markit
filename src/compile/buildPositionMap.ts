import type { Line } from "./splitIntoBlocks.ts";

export type PositionInfo = {
  line: number;
  column: number;
};

/**
 * Build a position map for a sequence of content lines, mapping each character
 * back to its original line and column in the source file.
 * (Used for error reporting in the language server.)
 *
 * Lines are joined with a single space separator (blank lines are skipped).
 * The returned array has one entry per character in that joined string.
 */
const buildPositionMap = (lines: Line[]): PositionInfo[] => {
  const map: PositionInfo[] = [];
  const nonBlank = lines.filter((l) => l.content !== "");

  nonBlank.forEach((line, lineIndex) => {
    for (let i = 0; i < line.content.length; i++) {
      map.push({ line: line.lineNumber, column: line.charOffset + i });
    }
    // Space separator between lines (except after the last line)
    if (lineIndex < nonBlank.length - 1) {
      map.push({
        line: line.lineNumber,
        column: line.charOffset + line.content.length,
      });
    }
  });

  return map;
};

export default buildPositionMap;
