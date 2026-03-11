import type { BlockWithMetadata } from "./parseMetadata.js";

export type PositionInfo = {
  line: number;
  column: number;
};

/**
 * Build a position map for the block's content, mapping each character back to
 * its original line and column in the source file.
 * (Used for error reporting in the language server.)
 */
export default (block: BlockWithMetadata): PositionInfo[] => {
  const map: PositionInfo[] = [];

  // Determine if the tag line was removed
  const originalLineCount = block.endLine - block.startLine + 1;
  const contentLineCount = block.lines.length;
  const tagOnOwnLine = contentLineCount < originalLineCount;

  // If tag was on its own line, content starts on the next line
  const lineOffset = tagOnOwnLine ? 1 : 0;

  block.lines.forEach((line, lineIndex) => {
    const actualLine = block.startLine + lineOffset + lineIndex;
    for (let i = 0; i < line.content.length; i++) {
      map.push({
        line: actualLine,
        column: line.charOffset + i,
      });
    }
    // Add position for the space separator (except after the last line)
    if (lineIndex < block.lines.length - 1) {
      map.push({
        line: actualLine,
        column: line.charOffset + line.content.length,
      });
    }
  });

  return map;
};
