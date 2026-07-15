/**
 * The pure core of the language server's diagnostics: translate Markit's
 * compile errors into position-only diagnostics. Markit's `source` ranges are
 * 0-based like the LSP, so this is a flattening of shape only, kept free of
 * the LSP types so it can be unit-tested. surface/diagnostics.ts maps the
 * result onto the LSP's Diagnostic shape.
 */

import type { MarkitError } from "@earlytexts/markit";

export type PlainDiagnostic = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
};

export default (errors: MarkitError[]): PlainDiagnostic[] =>
  errors.map((error) => ({
    startLine: error.source.start.line,
    startColumn: error.source.start.column,
    endLine: error.source.end.line,
    endColumn: error.source.end.column,
    message: error.message,
    severity: error.severity,
  }));
