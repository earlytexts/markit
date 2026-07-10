/**
 * The pure core of the language server's folding ranges: walk a compiled
 * document and collect every foldable extent — the document (and each nested
 * section), its metadata block and each nested metadata table, and every
 * content block. Markit records these extents as the `startLine`/`endLine`
 * symbols on each node. surface/foldingRanges.ts tags the result as LSP
 * region ranges.
 */

import {
  endLine,
  type MarkitDocument,
  type Ranges,
  startLine,
} from "@earlytexts/markit";

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
  ranges.push({ startLine: document[startLine], endLine: document[endLine] });

  if (document.metadata) {
    ranges.push({
      startLine: document.metadata[startLine],
      endLine: document.metadata[endLine],
    });
    for (const value of Object.values(document.metadata)) {
      if (typeof value === "object" && !Array.isArray(value)) {
        const sub = value as Record<string, unknown> & Ranges;
        ranges.push({ startLine: sub[startLine], endLine: sub[endLine] });
      }
    }
  }

  for (const block of document.blocks) {
    ranges.push({ startLine: block[startLine], endLine: block[endLine] });
  }

  for (const child of document.children) {
    collect(child, ranges);
  }
};
