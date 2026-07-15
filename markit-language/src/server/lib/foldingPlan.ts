/**
 * The pure core of the language server's folding ranges: walk a compiled
 * document and collect every foldable extent — the document (and each nested
 * section), its metadata block and each nested metadata table, and every
 * content block. Markit records these extents as whole-line, end-exclusive
 * `source`/`metadataSource` ranges on each node (positions compile only).
 * surface/foldingRanges.ts tags the result as LSP region ranges.
 */

import type { MarkitDocument, SourceRange } from "@earlytexts/markit";

export type PlainFoldingRange = { startLine: number; endLine: number };

export default (document: MarkitDocument): PlainFoldingRange[] => {
  const ranges: PlainFoldingRange[] = [];
  collect(document, ranges);
  return ranges;
};

const collect = (
  document: MarkitDocument,
  ranges: PlainFoldingRange[],
): void => {
  if (document.source) ranges.push(lines(document.source));

  if (document.metadataSource) {
    ranges.push(lines(document.metadataSource.source));
    for (const sub of Object.values(document.metadataSource.nested ?? {})) {
      ranges.push(lines(sub));
    }
  }

  for (const block of document.blocks) {
    if (block.source) ranges.push(lines(block.source));
  }

  for (const child of document.children) {
    collect(child, ranges);
  }
};

// Node ranges are whole-line and end-exclusive; folding wants inclusive lines.
const lines = (source: SourceRange): PlainFoldingRange => ({
  startLine: source.start.line,
  endLine: source.end.line - 1,
});
