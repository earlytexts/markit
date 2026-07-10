/**
 * Language-server adapter for folding: compile the document (via the shared
 * cache), collect its foldable extents with the pure planner, and tag each as
 * an LSP region range. The walk lives in lib/foldingPlan.ts.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { FoldingRange, FoldingRangeKind } from "vscode-languageserver/node";
import { compileDocument } from "./compileCache.ts";
import planFoldingRanges from "../lib/foldingPlan.ts";

export default (textDocument: TextDocument): FoldingRange[] => {
  const [document] = compileDocument(textDocument);
  return planFoldingRanges(document).map((range) => ({
    startLine: range.startLine,
    endLine: range.endLine,
    kind: FoldingRangeKind.Region,
  }));
};
