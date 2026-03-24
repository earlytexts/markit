import compileExternalChildren from "./compile/compileExternalChildren.js";
import generateTextTree from "./compile/generateTextTree.js";
import makeError from "./compile/makeError.js";
import parseContent from "./compile/parseContent.js";
import parseMetadata from "./compile/parseMetadata.js";
import splitIntoBlocks from "./compile/splitIntoBlocks.js";
import type { CompileOptions, MarkitDocument, MarkitError } from "./types.js";
import { endLine, startLine } from "./types.js";

/**
 * Compile a Markit document string into a structured JSON-ready object.
 *
 * @param text The input Markit document as a string.
 * @param options Optional compilation options including file loader and current file path.
 * @returns A tuple of:
 *   [0] The parsed document (always produced, even if there are errors)
 *   [1] An array of any errors and warnings encountered during parsing and validation
 */
export default (
  text: string,
  options: CompileOptions = {},
): [MarkitDocument, MarkitError[]] => {
  const loadingStack = new Set(
    options.currentFilePath ? [options.currentFilePath] : [],
  );
  return compile(text, options, loadingStack);
};

const compile = (
  text: string,
  options: CompileOptions,
  loadingStack: Set<string> = new Set(),
): [MarkitDocument, MarkitError[]] => {
  // Parse the text into blocks separated by one or more blank lines
  const [firstBlock, ...otherBlocks] = splitIntoBlocks(text);
  if (!firstBlock) {
    return [emptyDocument, [emptyDocumentError]];
  }

  // Generate the text tree from the blocks
  const [textTree, treeErrors] = generateTextTree([firstBlock, ...otherBlocks]);

  // Parse metadata for each text and block in the tree
  const [treeWithMetadata, metaDataErrors] = parseMetadata(textTree);

  // Parse block content for each block, including for internal children recursively
  const [document, contentErrors] = parseContent(treeWithMetadata);

  // Compile external children recursively
  const [externalChildren, externalChildrenErrors] = compileExternalChildren(
    treeWithMetadata,
    options,
    loadingStack,
    compile,
  );

  // Merge external children with internal children
  const fullDocument = {
    ...document,
    children: [...document.children, ...externalChildren],
  };

  // Merge and sort errors
  const errors = [
    ...treeErrors,
    ...metaDataErrors,
    ...externalChildrenErrors,
    ...contentErrors,
  ].sort((a, b) => a.line - b.line || a.column - b.column);

  // return the full document along with any errors
  return [fullDocument, errors];
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
  column: 0,
  length: 0,
});
