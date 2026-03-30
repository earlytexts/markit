import type { MarkitError } from "../types.js";

type MakeErrorParams = {
  message: string;
  line: number;
  length: number;
  column?: number;
  lines?: number;
  severity?: "error" | "warning";
};

export default ({
  message,
  line,
  length,
  column = 0,
  lines = 0,
  severity = "error",
}: MakeErrorParams): MarkitError => ({
  message,
  line: line + 1, // Convert to 1-based line number
  column: column + 1, // Convert to 1-based column number
  endLine: line + lines + 1,
  endColumn: column + length + 1,
  severity,
});
