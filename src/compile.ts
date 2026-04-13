import { readFileSync } from "node:fs";
import compileExternalChildren from "./compile/compileExternalChildren.js";
import generateTextTree from "./compile/generateTextTree.js";
import makeError from "./compile/makeError.js";
import parseContent from "./compile/parseContent.js";
import parseMetadata from "./compile/parseMetadata.js";
import splitIntoBlocks from "./compile/splitIntoBlocks.js";
import type {
  CompileOptions,
  MarkitDocument,
  MarkitError,
  Metadata,
} from "./types.js";
import { endLine, startLine } from "./types.js";

/**
 * Compile a Markit document string into a structured JSON-ready object.
 *
 * @param text The input Markit document as a string.
 * @param options Optional compilation options including file loader and file path.
 * @returns A tuple of:
 *   [0] The parsed document (always produced, even if there are errors)
 *   [1] An array of any errors and warnings encountered during parsing and validation
 */
export default <TextMetadata extends Metadata = {}>(
  text: string,
  options: Partial<CompileOptions> = {},
): [MarkitDocument<TextMetadata>, MarkitError[]] => {
  const loadingStack = new Set(options.filePath ? [options.filePath] : []);
  return compile<TextMetadata>(text, options, loadingStack);
};

const compile = <TextMetadata extends Metadata>(
  text: string,
  optionOverrides: Partial<CompileOptions>,
  loadingStack: Set<string> = new Set(),
): [MarkitDocument<TextMetadata>, MarkitError[]] => {
  const options: CompileOptions = {
    embedExternalChildren: true,
    fileLoader: (path: string) => readFileSync(path, "utf-8"),
    filePath: "",
    ...optionOverrides,
  };

  // Parse the text into blocks separated by one or more blank lines
  const [firstBlock, ...otherBlocks] = splitIntoBlocks(text);
  if (!firstBlock) {
    const emptyDocument = {
      id: "empty-document",
      blocks: [],
      children: [],
      [startLine]: 0,
      [endLine]: 0,
    } as unknown as MarkitDocument<TextMetadata>;

    const emptyDocumentError = makeError({
      message: "Document is empty",
      line: 0,
      column: 0,
      length: 0,
    });

    return [emptyDocument, [emptyDocumentError]];
  }

  // Generate the text tree from the blocks
  const [textTree, treeErrors] = generateTextTree([firstBlock, ...otherBlocks]);

  // Parse metadata for each text and block in the tree
  const [treeWithMetadata, metaDataErrors] =
    parseMetadata<TextMetadata>(textTree);

  // Parse block content for each block, including for internal children recursively
  const [document, contentErrors] = parseContent(treeWithMetadata);

  // Optionally compile external children recursively for embedding in the final document
  const [externalChildren, externalChildrenErrors] =
    options.embedExternalChildren
      ? compileExternalChildren<TextMetadata>(
          treeWithMetadata,
          options,
          loadingStack,
          compile,
        )
      : [[], []];

  // Create full document with metadata inlined and external children included
  const fullDocument = {
    ...document,
    children: [...document.children, ...externalChildren],
    [startLine]: document[startLine],
    [endLine]: document[endLine],
  } as MarkitDocument<TextMetadata>;

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
