/**
 * Parse the input text into blocks of lines.
 *
 * Blocks are delimited by:
 *   - Text ID lines (# id, ## id, etc.) — always start a new block
 *   - Bracket header lines ([metadata], [metadata.sub], etc.) — always start a new block
 *   - Block tag lines ({#id}) — always start a new block
 *   - Blank lines *outside* a content block — act as separators, so the next
 *     non-blank line starts a new block (same behaviour as the old splitter)
 *
 * Blank lines *inside* a content block (i.e. after a {#id} tag and before the
 * next {#id} tag or text-ID line) are preserved as empty Line entries so that
 * the content parser can use them as block-level element boundaries.
 */
export type RawBlock = {
  startLine: number;
  endLine: number;
  lines: [Line, ...Line[]];
};

export type Line = {
  lineNumber: number;
  charOffset: number;
  content: string; // empty string represents a blank line inside a content block
};

export default (text: string): RawBlock[] => {
  const lines = text.split("\n");

  let insideContentBlock = false;
  // True when we've just seen one or more blank lines outside a content block.
  // The next non-blank, non-ID, non-blockTag line should start a new block.
  let blankBreak = false;

  const blocks: RawBlock[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Text ID line: one or more # followed by whitespace
    if (/^#+\s/.test(trimmed)) {
      insideContentBlock = false;
      blankBreak = false;
      blocks.push({
        startLine: index,
        endLine: index,
        lines: [
          {
            lineNumber: index,
            charOffset: line.indexOf(trimmed),
            content: trimmed,
          },
        ],
      });
      return;
    }

    // Bracket header line: [metadata], [metadata.subkey], etc.
    if (/^\[.+\]$/.test(trimmed)) {
      insideContentBlock = false;
      blankBreak = false;
      blocks.push({
        startLine: index,
        endLine: index,
        lines: [
          {
            lineNumber: index,
            charOffset: line.indexOf(trimmed),
            content: trimmed,
          },
        ],
      });
      return;
    }

    // Block tag line: starts with {#
    if (trimmed.startsWith("{#")) {
      insideContentBlock = true;
      blankBreak = false;
      blocks.push({
        startLine: index,
        endLine: index,
        lines: [
          {
            lineNumber: index,
            charOffset: line.indexOf(trimmed),
            content: trimmed,
          },
        ],
      });
      return;
    }

    // Blank line
    if (trimmed === "") {
      if (insideContentBlock) {
        // Preserve blank lines inside content blocks as element separators
        const lastBlock = blocks.at(-1)!;
        lastBlock.lines.push({
          lineNumber: index,
          charOffset: 0,
          content: "",
        });
      } else {
        // Outside content blocks, record the break so the next line starts fresh
        blankBreak = true;
      }
      return;
    }

    // Regular content line
    const lastBlock = blocks.at(-1);
    if (lastBlock && !blankBreak) {
      // Append to current block
      // For content blocks, preserve original content (including leading/trailing spaces)
      // to maintain indentation for lists and empty list markers
      const content = insideContentBlock ? line : trimmed;
      lastBlock.lines.push({
        lineNumber: index,
        charOffset: insideContentBlock ? 0 : line.indexOf(trimmed),
        content,
      });
      lastBlock.endLine = index;
    } else {
      // Start a new block (either no block yet, or a blank break occurred)
      blankBreak = false;
      const content = insideContentBlock ? line : trimmed;
      blocks.push({
        startLine: index,
        endLine: index,
        lines: [
          {
            lineNumber: index,
            charOffset: insideContentBlock ? 0 : line.indexOf(trimmed),
            content,
          },
        ],
      });
    }
  });

  return blocks;
};
