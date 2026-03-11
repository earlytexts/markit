import generateTextTree from "./compile/generateTextTree.js";
import makeError from "./compile/makeError.js";
import parseContent from "./compile/parseContent.js";
import parseMetadata from "./compile/parseMetadata.js";
import splitIntoBlocks from "./compile/splitIntoBlocks.js";
import { endLine, startLine } from "./types.js";
import type { MarkitDocument, MarkitError } from "./types.js";

/**
 * Compile a Markit document string into a structured JSON-ready object.
 *
 * @param text The input Markit document as a string.
 * @returns A tuple of:
 *   [0] The parsed document (always produced, even if there are errors)
 *   [1] An array of any errors and warnings encountered during parsing and validation
 */
export default (text: string): [MarkitDocument, MarkitError[]] => {
  // Step 1: parse the text into blocks separated by one or more blank lines
  const [firstBlock, ...otherBlocks] = splitIntoBlocks(text);
  if (!firstBlock) {
    return [emptyDocument, [emptyDocumentError]];
  }

  // Step 2: generate the text tree from the blocks
  const [textTree, treeErrors] = generateTextTree([firstBlock, ...otherBlocks]);

  // Step 3: parse metadata for each text and block in the tree
  const [treeWithMetadata, metaDataErrors] = parseMetadata(textTree);

  // Step 4: parse block content for every text
  const [document, contentErrors] = parseContent(treeWithMetadata);

  // Return document and all errors
  const errors = [...treeErrors, ...metaDataErrors, ...contentErrors].sort(
    (a, b) => a.line - b.line || a.column - b.column,
  );
  return [document, errors];
};

const emptyDocument = {
  id: "empty-document",
  blocks: [],
  children: [],
  metadata: {},
  [startLine]: 0,
  [endLine]: 0,
};

const emptyDocumentError = makeError({
  message: "Document is empty",
  line: 0,
  length: 0,
});
