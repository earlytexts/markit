import generateTextTree from "./compile/generateTextTree.ts";
import makeError from "./lib/makeError.ts";
import parseContent from "./compile/parseContent.ts";
import parseMetadata from "./compile/parseMetadata.ts";
import splitIntoBlocks from "./compile/splitIntoBlocks.ts";
import tokenize from "./tokenize.ts";
import { withProvenance } from "./compile/provenance.ts";
import type { MarkitDocument, MarkitError, Token } from "./types.ts";
import { endLine, startLine } from "./types.ts";

type CompileResult = [MarkitDocument, MarkitError[]];
type CompileWithTokens = [MarkitDocument, MarkitError[], Token[]];

type Compile = {
  /**
   * Compile a Markit document string into a structured JSON-ready object.
   *
   * @returns `[document, errors]` — the parsed document (always produced, even on
   * errors) and any diagnostics.
   */
  (text: string): CompileResult;
  /**
   * Compile and also tokenize, in one pass: `[document, errors, tokens]`. The
   * tokens carry `source` spans (see `Token`), which a bare `tokenize(document)`
   * cannot recover.
   */
  (text: string, options: { tokens: true }): CompileWithTokens;
};

// Cast: an implementation whose single signature returns the union of both
// overloads' results is not structurally assignable to the overloaded type, so
// the shape is declared by `Compile` above and asserted here.
/**
 * Compile a Markit document string into a structured, JSON-ready document.
 * Overloaded — pass `{ tokens: true }` to also tokenize in the same pass; see
 * the two call signatures on `Compile` above for details of each form.
 */
const compile = ((
  text: string,
  options?: { tokens?: boolean },
): CompileResult | CompileWithTokens => {
  if (options?.tokens) {
    const [document, errors] = withProvenance(() => compileDocument(text));
    return [document, errors, tokenize(document)];
  }
  return compileDocument(text);
}) as Compile;

export default compile;

const compileDocument = (text: string): CompileResult => {
  // Parse the text into blocks separated by one or more blank lines
  const [firstBlock, ...otherBlocks] = splitIntoBlocks(text);
  if (!firstBlock) {
    const emptyDocument = {
      id: "empty-document",
      blocks: [],
      children: [],
      [startLine]: 0,
      [endLine]: 0,
    };

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
  const [treeWithMetadata, metaDataErrors] = parseMetadata(textTree);

  // Parse block content for each block, including for internal children recursively
  const [document, contentErrors] = parseContent(treeWithMetadata);

  // Merge and sort errors
  const errors = [...treeErrors, ...metaDataErrors, ...contentErrors].sort(
    (a, b) => a.line - b.line || a.column - b.column,
  );

  // return the document along with any errors
  return [document, errors];
};
