import type { MarkitError } from "../types.js";
import makeError from "./makeError.js";
import type { RawBlock } from "./splitIntoBlocks.js";

/**
 * Generate a text tree from an array of blocks, noting any structural errors on the way.
 * Capture the id and level along the way.
 */
export type TextTree = {
  id: string;
  level: number;
  startLine: number;
  endLine: number;
  blocks: RawBlock[];
  children: TextTree[];
};

export default (
  blocks: [RawBlock, ...RawBlock[]],
): [TextTree, MarkitError[]] => {
  // Create array of errors to collect any errors encountered during text tree generation
  const errors: MarkitError[] = [];

  // The first block must be a level 1 text heading that defines the root of the text tree
  const rootLine = blocks[0].lines[0];
  const [rootLevel, rootId] = readTextHeading(rootLine.content);
  if (rootLevel !== 1) {
    const message =
      rootLevel === 0
        ? "Document must begin with a level 1 header (e.g. # Document.Id)"
        : `Expected level 1 header but found level ${rootLevel}`;
    errors.push(
      makeError({
        message,
        line: 0,
        length: rootLine.content.length,
      }),
    );
  }

  // Create the root node of the text tree
  const rootText: TextTree = {
    id: rootId,
    level: rootLevel,
    startLine: blocks[0].startLine,
    endLine: blocks[0].endLine,
    blocks: [],
    children: [],
  };

  // Iterate through the remaining blocks and build a flat list of text sections
  let currentLevel = rootLevel; // must be 1 at this point
  const flatTexts: [TextTree, ...TextTree[]] = [rootText];
  blocks.slice(1).forEach((block) => {
    const firstLine = block.lines[0];
    const [level, id] = readTextHeading(firstLine.content);

    if (level > 0) {
      // jumping more than one level at a time is not allowed
      if (level > currentLevel + 1) {
        errors.push(
          makeError({
            message: `Level ${level} header cannot follow level ${currentLevel} header without an intermediate level`,
            line: block.startLine,
            length: firstLine.content.length,
          }),
        );
      }

      // in any case, start a new text and update the current level
      flatTexts.push({
        level,
        id,
        startLine: block.startLine,
        endLine: block.endLine,
        blocks: [],
        children: [],
      });
      currentLevel = level;
    } else {
      // add to the current text section
      const currentText = flatTexts.at(-1)!;
      currentText.blocks.push(block);
      currentText.endLine = block.endLine;
    }
  });

  // Iterate through the flat list to generate the tree structure
  flatTexts.slice(1).forEach((text, index) => {
    // Find the parent text for this text by looking backwards for the nearest text with a lower level
    // note we can be sure to find one because the first text is the root with level 1
    // error handling for invalid levels is done in the previous loop
    const parent = flatTexts
      .slice(0, index + 1)
      .reverse()
      .find((t) => t.level < text.level)!;
    parent.children.push(text);
  });

  // Fix the end lines of all texts to be the end line of their last child (if any)
  fixEndLines(rootText);

  // Return the root text (now with its full tree of children) and any errors
  return [rootText, errors];
};

const readTextHeading = (line: string) => {
  const idMatch = line.trim().match(/^(#+)\s*(.+)$/);
  const level = idMatch ? idMatch[1]!.length : 0;
  const id = idMatch ? idMatch[2]!.trim() : "missing-id";
  return [level, id] as const;
};

const fixEndLines = (text: TextTree): void => {
  if (text.children.length > 0) {
    text.children.forEach(fixEndLines);
    text.endLine = text.children.at(-1)!.endLine;
  }
};
