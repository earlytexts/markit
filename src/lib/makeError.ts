import type { MarkitError } from "../types.ts";

type MakeErrorParams = {
  message: string;
  line: number;
  length: number;
  column?: number;
  severity?: "error" | "warning";
};

export default ({
  message,
  line,
  length,
  column = 0,
  severity = "error",
}: MakeErrorParams): MarkitError => ({
  message,
  severity,
  source: {
    start: { line, column },
    end: { line, column: column + length },
  },
});
