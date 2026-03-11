import { compile, endLine, startLine, type MarkitDocument } from "markit";
import { TextDocument } from "vscode-languageserver-textdocument";
import { FoldingRange, FoldingRangeKind } from "vscode-languageserver/node";

export default (textDocument: TextDocument): FoldingRange[] => {
  const text = textDocument.getText();
  const [doc] = compile(text);
  const ranges: FoldingRange[] = [];
  collectFoldingRanges(doc, ranges);
  return ranges;
};

const collectFoldingRanges = (doc: MarkitDocument, ranges: FoldingRange[]) => {
  ranges.push({
    startLine: doc[startLine],
    endLine: doc[endLine],
    kind: FoldingRangeKind.Region,
  });

  for (const block of doc.blocks) {
    ranges.push({
      startLine: block[startLine],
      endLine: block[endLine],
      kind: FoldingRangeKind.Region,
    });
  }

  for (const child of doc.children) {
    collectFoldingRanges(child, ranges);
  }
};
