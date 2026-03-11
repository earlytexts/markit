import type { MarkitError } from "../types.js";

type MakeErrorParams = {
  message: string;
  line: number;
  length: number;
  column?: number;
  lines?: number;
};

export default ({
  message,
  line,
  length,
  column = 0,
  lines = 0,
}: MakeErrorParams): MarkitError => ({
  message,
  line: line + 1, // Convert to 1-based line number
  column: column + 1, // Convert to 1-based column number
  endLine: line + lines + 1,
  endColumn: column + length + 1,
});
