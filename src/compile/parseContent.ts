import type { Block, MarkitDocument, MarkitError } from "../types.js";
import { endLine, footnoteReferenceSpec, startLine } from "../types.js";
import buildPositionMap from "./buildPositionMap.js";
import type {
  BlockWithMetadata,
  TextTreeWithMetadata,
} from "./parseMetadata.js";
import parseElements from "./parseElements.js";

/**
 * Parse the content of each block in the TextTree, returning a fully parsed MarkitDocument.
 */
export default (
  tree: TextTreeWithMetadata,
): [MarkitDocument, MarkitError[]] => {
  return parseTextContent(tree);
};

const parseTextContent = (
  text: TextTreeWithMetadata,
): [MarkitDocument, MarkitError[]] => {
  const footnoteIds = text.blocks
    .filter((b) => footnoteReferenceSpec.pattern.test(b.id))
    .map((b) => b.id);

  const blockResults = text.blocks.map((block) =>
    parseBlockContent(block, footnoteIds),
  );
  const blocks = blockResults.map((result) => result[0]);
  const blockErrors = blockResults.flatMap((result) => result[1]);

  const childResults = text.children.map(parseTextContent);
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);

  const document: MarkitDocument = {
    id: text.id,
    metadata: text.metadata,
    blocks,
    children,
    [startLine]: text.startLine,
    [endLine]: text.endLine,
  };

  return [document, [...blockErrors, ...childErrors]];
};

const parseBlockContent = (
  block: BlockWithMetadata,
  footnoteIds: string[],
): [Block, MarkitError[]] => {
  // Step 1: Join lines with spaces and collapse whitespace
  const text = block.lines
    .map((line) => line.content)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Step 2: Build position map to track character positions back to original file locations
  const positionMap = buildPositionMap(block);

  // Step 3: Parse content
  const [content, errors] = parseElements(text, positionMap, footnoteIds);

  const parsedBlock = {
    id: block.id,
    metadata: block.metadata,
    content,
    [startLine]: block.startLine,
    [endLine]: block.endLine,
  };
  return [parsedBlock, errors];
};
