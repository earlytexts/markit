/**
 * Language-server adapter for diagnostics: compile the document (via the shared
 * cache) and hand its errors to the pure planner, then map the plain result
 * onto the LSP's Diagnostic shape. All the position logic lives in
 * lib/diagnosticPlan.ts; this module only touches the LSP types.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { compileDocument } from "./compileCache.ts";
import planDiagnostics, { type PlainDiagnostic } from "./lib/diagnosticPlan.ts";

export default (textDocument: TextDocument): Diagnostic[] => {
  const { errors } = compileDocument(textDocument);
  return planDiagnostics(errors).map(toDiagnostic);
};

const toDiagnostic = (diagnostic: PlainDiagnostic): Diagnostic => ({
  severity:
    diagnostic.severity === "warning"
      ? DiagnosticSeverity.Warning
      : DiagnosticSeverity.Error,
  range: {
    start: { line: diagnostic.startLine, character: diagnostic.startColumn },
    end: { line: diagnostic.endLine, character: diagnostic.endColumn },
  },
  message: diagnostic.message,
  source: "markit",
});
