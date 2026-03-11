import { compile } from "markit";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";

export default (textDocument: TextDocument): Diagnostic[] => {
  const text = textDocument.getText();
  const [, errors] = compile(text);
  return errors.map((err): Diagnostic => {
    const startLine = (err.line ?? 1) - 1; // convert 1-based to 0-based
    const startCol = (err.column ?? 1) - 1;

    let endLine: number;
    let endCol: number;

    if (err.endLine !== undefined && err.endColumn !== undefined) {
      // Use explicit range from error
      endLine = err.endLine - 1;
      endCol = err.endColumn - 1;
    } else {
      // Infer a reasonable range from the document
      const lineText = textDocument
        .getText({
          start: { line: startLine, character: 0 },
          end: { line: startLine + 1, character: 0 },
        })
        .replace(/\n$/, "");

      // Find the end of the current token or extend to end of line
      let tokenEnd = startCol;
      const remaining = lineText.slice(startCol);

      // If we're at a non-whitespace character, extend to the end of the token
      if (remaining && !/^\s/.test(remaining)) {
        const match = remaining.match(/^[^\s]+/)!; // given the regex, this will always match at least one character
        tokenEnd = startCol + match[0].length;
      } else {
        // If we're at whitespace or empty, just highlight one character
        tokenEnd = startCol + 1;
      }

      endLine = startLine;
      endCol = Math.min(tokenEnd, lineText.length);
    }

    return {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: startLine, character: startCol },
        end: { line: endLine, character: endCol },
      },
      message: err.message,
      source: "markit",
    };
  });
};
