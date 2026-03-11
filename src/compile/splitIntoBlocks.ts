/**
 * Parse the input text into blocks of lines, where blocks are separated by one or more blank lines.
 * Store the starting line number of each block for later error reporting.
 */
export type RawBlock = {
  startLine: number;
  endLine: number;
  lines: [Line, ...Line[]];
};

export type Line = {
  charOffset: number;
  content: string;
};

export default (text: string): RawBlock[] => {
  const lines = text.split("\n");

  let blankLines = 0;
  const blocks: RawBlock[] = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      blankLines++;
    } else {
      const lineObject = {
        charOffset: line.indexOf(trimmed),
        content: trimmed,
      };
      if (blankLines > 0) {
        blocks.push({ startLine: index, endLine: index, lines: [lineObject] });
        blankLines = 0;
      } else {
        const lastBlock = blocks.at(-1);
        if (!lastBlock) {
          blocks.push({
            startLine: index,
            endLine: index,
            lines: [lineObject],
          });
        } else {
          lastBlock.lines.push(lineObject);
          lastBlock.endLine = index;
        }
      }
    }
  });

  return blocks;
};
