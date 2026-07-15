import generateTextTree from "./compile/generateTextTree.ts";
import makeError from "./lib/makeError.ts";
import parseContent from "./compile/parseContent.ts";
import parseMetadata from "./compile/parseMetadata.ts";
import splitIntoBlocks from "./compile/splitIntoBlocks.ts";
import type { CompileResult } from "./types.ts";

/**
 * Compile a Markit document string into a structured, JSON-ready document.
 *
 * @returns `{ document, errors }` — the parsed document (always produced, even
 * on errors) and any diagnostics.
 */
const compile = (text: string): CompileResult => compileDocument(text, false);

export default compile;

/**
 * Like `compile`, but every `plainText` node carries per-character source
 * positions (its `sources` array), so extraction and tokenisation can map any
 * extracted offset back to a source line/column. Kept separate from `compile`
 * because the positions are plain serialisable properties and would bloat
 * catalogue JSON if they were always on.
 */
export const compileWithPositions = (text: string): CompileResult =>
  compileDocument(text, true);

const compileDocument = (text: string, positions: boolean): CompileResult => {
  // Parse the text into blocks separated by one or more blank lines
  const [firstBlock, ...otherBlocks] = splitIntoBlocks(text);
  if (!firstBlock) {
    const emptyDocument = {
      id: "empty-document",
      blocks: [],
      children: [],
      ...(positions
        ? {
          source: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
          },
        }
        : {}),
    };

    const emptyDocumentError = makeError({
      message: "Document is empty",
      line: 0,
      column: 0,
      length: 0,
    });

    return { document: emptyDocument, errors: [emptyDocumentError] };
  }

  // Generate the text tree from the blocks
  const [textTree, treeErrors] = generateTextTree([firstBlock, ...otherBlocks]);

  // Parse metadata for each text and block in the tree
  const [treeWithMetadata, metaDataErrors] = parseMetadata(textTree);

  // Parse block content for each block, including for internal children recursively
  const [document, contentErrors] = parseContent(treeWithMetadata, positions);

  // Merge and sort errors
  const errors = [...treeErrors, ...metaDataErrors, ...contentErrors].sort(
    (a, b) =>
      a.source.start.line - b.source.start.line ||
      a.source.start.column - b.source.start.column,
  );

  // return the document along with any errors
  return { document, errors };
};
