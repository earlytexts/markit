import type { SourceRange } from "../types.ts";

/**
 * The whole-line source range of a node spanning source lines `start` to `end`
 * inclusive (both 0-based): from column 0 of the first line to column 0 of the
 * line after the last, end-exclusive like every `SourceRange`.
 */
export default (start: number, end: number): SourceRange => ({
  start: { line: start, column: 0 },
  end: { line: end + 1, column: 0 },
});
