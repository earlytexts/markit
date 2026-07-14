/**
 * The pure core of the language server's diagnostics: translate Markit's
 * compile errors into position-only diagnostics. Markit reports 1-based line
 * and column positions; the LSP (and the editor) count from 0, so the whole of
 * the logic here is that impedance conversion, kept free of the LSP types so it
 * can be unit-tested. surface/diagnostics.ts maps the result onto the LSP's
 * Diagnostic shape.
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
    startLine: error.line - 1,
    startColumn: error.column - 1,
    endLine: error.endLine - 1,
    endColumn: error.endColumn - 1,
    message: error.message,
    severity: error.severity,
  }));
