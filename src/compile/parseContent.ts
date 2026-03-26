import type { Block, Element, MarkitDocument, MarkitError } from "../types.js";
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
export default (
  tree: TextTreeWithMetadata,
  externalChildren: MarkitDocument[] = [],
): [MarkitDocument, MarkitError[]] => {
  return parseTextContent(tree, externalChildren);
};

const parseTextContent = (
  text: TextTreeWithMetadata,
  externalChildren: MarkitDocument[] = [],
): [MarkitDocument, MarkitError[]] => {
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

  // Parse blocks for all internal children recursively
  const childResults = text.children.map((child) => parseTextContent(child));
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);

  // Put it all together
  // @ts-expect-error: TypeScript complains that `id`, `blocks`, and `children` aren't compatible with `MetadataValue`
  const document: MarkitDocument = {
    ...text.metadata,
    id: text.id,
    blocks,
    children: [...children, ...externalChildren],
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

  // Put it all together
  // @ts-expect-error: TypeScript complains that `id` and `content` aren't compatible with `MetadataValue`
  const parsedBlock: Block = {
    ...block.metadata,
    id: block.id,
    content,
    [startLine]: block.startLine,
    [endLine]: block.endLine,
  };

  return [parsedBlock, errors];
};
