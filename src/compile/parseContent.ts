import type { Block, MarkitDocument, MarkitError, Metadata } from "../types.js";
import { endLine, footnoteReferenceSpec, startLine } from "../types.js";
import buildPositionMap from "./buildPositionMap.js";
import parseElements from "./parseElements.js";
import type {
  BlockWithMetadata,
  TextTreeWithMetadata,
} from "./parseMetadata.js";

/**
 * Parse the content of each block in the TextTree, returning a fully parsed MarkitDocument.
 */
export default <TextMetadata extends Metadata, BlockMetadata extends Metadata>(
  tree: TextTreeWithMetadata<TextMetadata, BlockMetadata>,
  externalChildren: MarkitDocument<TextMetadata, BlockMetadata>[] = [],
): [MarkitDocument<TextMetadata, BlockMetadata>, MarkitError[]] => {
  return parseTextContent(tree, externalChildren, {} as TextMetadata);
};

const parseTextContent = <
  TextMetadata extends Metadata,
  BlockMetadata extends Metadata,
>(
  text: TextTreeWithMetadata<TextMetadata, BlockMetadata>,
  externalChildren: MarkitDocument<TextMetadata, BlockMetadata>[] = [],
  parentMetadata: TextMetadata,
): [MarkitDocument<TextMetadata, BlockMetadata>, MarkitError[]] => {
  // Get footnote reference ids to validate footnote references
  const footnoteIds = text.blocks
    .filter((b) => footnoteReferenceSpec.pattern.test(b.id))
    .map((b) => b.id);

  // Parse content for each block
  const blockResults = text.blocks.map((block) =>
    parseBlockContent(block, footnoteIds),
  );
  const blocks = blockResults.map((result) => result[0]);
  const blockErrors = blockResults.flatMap((result) => result[1]);

  // Merge parent metadata with this text's own metadata (child overrides parent)
  const mergedMetadata = { ...parentMetadata, ...text.metadata };

  // Parse blocks for all internal children recursively, passing merged metadata down
  const childResults = text.children.map((child) =>
    parseTextContent(child, [], mergedMetadata),
  );
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);

  // Put it all together
  const document = {
    ...mergedMetadata,
    id: text.id,
    blocks,
    children: [...children, ...externalChildren],
    [startLine]: text.startLine,
    [endLine]: text.endLine,
  } as MarkitDocument<TextMetadata, BlockMetadata>;

  return [document, [...blockErrors, ...childErrors]];
};

const parseBlockContent = <BlockMetadata extends Metadata>(
  block: BlockWithMetadata<BlockMetadata>,
  footnoteIds: string[],
): [Block<BlockMetadata>, MarkitError[]] => {
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

  // Put it all together
  const parsedBlock = {
    ...block.metadata,
    id: block.id,
    content,
    [startLine]: block.startLine,
    [endLine]: block.endLine,
  } as Block<BlockMetadata>;

  return [parsedBlock, errors];
};
