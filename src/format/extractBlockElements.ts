import classifyBlockLine from "../lib/classifyBlockLine.ts";
import splitOnLineBreakMarker from "../lib/splitLineBreaks.ts";
import { tableSpec } from "../lib/grammar.ts";

/**
 * Re-format a content block's buffered lines, preserving block-level structure
 * and normalizing whitespace. Block-level elements are line-based:
 *   - lines matching ^[1-6] space     → heading (consecutive lines form a group)
 *   - lines starting with > or :      → blockquote / stage direction
 *   - list / verse / table lines      → list / table
 *   - blank lines                     → element separator
 *   - everything else                 → paragraph line (consecutive lines are collapsed)
 */
const extractBlockElements = (buffer: string[]): string[] => {
  const acc: BlockAccumulator = {
    output: [],
    kind: null,
    lines: [],
    listType: null,
    listStart: undefined,
  };

  for (const line of buffer) {
    const trimmed = line.trim();
    // Classify using the original line to preserve indent information for lists
    const classification = classifyBlockLine(line);

    // Blank line — separator between block-level elements
    if (classification.kind === "blank") {
      flush(acc);
      pushSeparator(acc);
      continue;
    }

    // Heading line
    if (classification.kind === "heading") {
      bufferLine(acc, "heading", trimmed);
      continue;
    }

    // Blockquote / stage-direction line: strip the marker and a single
    // separator space only; keep any further indentation, which encodes
    // nested-list depth for the recursive pass. A bare marker strips to a
    // blank line, the paragraph separator within the element.
    if (
      classification.kind === "blockquote" ||
      classification.kind === "stageDirection"
    ) {
      bufferLine(acc, classification.kind, trimmed.slice(1).replace(/^ /, ""));
      continue;
    }

    // List item (ordered, unordered, or verse); the untrimmed line keeps the
    // indentation that encodes nesting
    if (
      classification.kind === "unorderedListItem" ||
      classification.kind === "orderedListItem" ||
      classification.kind === "verseListItem"
    ) {
      const listType = classification.kind === "orderedListItem"
        ? "ordered"
        : classification.kind === "unorderedListItem"
        ? "unordered"
        : "verse";
      const indent = classification.kind === "verseListItem"
        ? 0
        : classification.indent;
      // A base-indent item of a different list kind ends the current list
      if (acc.kind === "list" && indent === 0 && acc.listType !== listType) {
        flush(acc);
      }
      // Record the list kind — and, for an ordered list not starting at 1,
      // its start number — from the first item
      if (acc.kind !== "list") {
        flush(acc);
        acc.listType = listType;
        acc.listStart = classification.kind === "orderedListItem" &&
            classification.number !== 1
          ? classification.number
          : undefined;
      }
      bufferLine(acc, "list", line);
      continue;
    }

    // Table row or separator
    if (
      classification.kind === "tableRow" ||
      classification.kind === "tableSeparator"
    ) {
      bufferLine(acc, "table", line);
      continue;
    }

    // Regular content line (paragraph) — invalid heading variants included
    bufferLine(acc, "paragraph", trimmed);
  }

  flush(acc);

  // Strip any trailing blank or bare blockquote/stage-direction separator lines
  while (
    acc.output.at(-1) === "" || acc.output.at(-1) === ">" ||
    acc.output.at(-1) === ":"
  ) {
    acc.output.pop();
  }

  return acc.output;
};

export default extractBlockElements;

// The kinds of block-level element the extractor buffers lines for.
type BufferKind =
  | "paragraph"
  | "blockquote"
  | "stageDirection"
  | "heading"
  | "list"
  | "table";

// The mutable state threaded through the block extractor: the emitted output
// plus ONE buffer of consecutive lines and the element kind they belong to —
// a boundary (a blank line, or a line of a different kind) flushes it.
// `listType`/`listStart` qualify the buffer when its kind is "list".
type BlockAccumulator = {
  output: string[];
  kind: BufferKind | null;
  lines: string[];
  listType: "ordered" | "unordered" | "verse" | null;
  listStart: number | undefined;
};

// Add a line to the buffer, first flushing it if it holds a different kind.
const bufferLine = (
  acc: BlockAccumulator,
  kind: BufferKind,
  line: string,
): void => {
  if (acc.kind !== kind) flush(acc);
  acc.kind = kind;
  acc.lines.push(line);
};

// Emit the buffered lines as their block element, separated from any earlier
// output by one blank line, then reset the buffer. (A blockquote or stage
// direction of bare markers formats to nothing, and emits nothing.)
const flush = (acc: BlockAccumulator): void => {
  if (acc.kind === null) return;
  const lines = formatElement(acc.kind, acc);
  acc.kind = null;
  acc.lines = [];
  acc.listType = null;
  acc.listStart = undefined;
  if (lines.length === 0) return;
  pushSeparator(acc);
  acc.output.push(...lines);
};

// One blank line between block elements (never at the very start).
const pushSeparator = (acc: BlockAccumulator): void => {
  if (acc.output.length > 0 && acc.output.at(-1) !== "") {
    acc.output.push("");
  }
};

// The formatted output lines for the buffered element. (`listType` is always
// set before the first line of a list is buffered, hence the assertion.)
const formatElement = (kind: BufferKind, acc: BlockAccumulator): string[] => {
  switch (kind) {
    case "paragraph":
      return formatParagraph(acc.lines);
    case "blockquote":
      return formatMarked(acc.lines, ">");
    case "stageDirection":
      return formatMarked(acc.lines, ":");
    case "heading":
      // Heading lines pass through as a group, with no blank lines between
      return acc.lines;
    case "list":
      return formatList(acc.lines, acc.listType!, acc.listStart);
    case "table":
      return formatTable(acc.lines);
  }
};

// Collapse the paragraph lines into a single whitespace-normalized paragraph,
// split back out at any explicit line-break markers.
const formatParagraph = (lines: string[]): string[] =>
  splitOnLineBreakMarker(lines.join(" ").replace(/\s+/g, " ").trim());

// Recursively format a blockquote or stage direction's inner lines and
// re-prefix each with its marker (a bare marker for the blank separator lines).
const formatMarked = (lines: string[], marker: string): string[] =>
  extractBlockElements(lines).map((line) =>
    line === "" ? marker : `${marker} ${line}`
  );

// Normalize a list's indentation to two-space levels and renumber ordered
// items (verse lists pass through unchanged).
const formatList = (
  lines: string[],
  listType: "ordered" | "unordered" | "verse",
  listStart: number | undefined,
): string[] => {
  if (listType === "verse") return lines;

  const indentToLevel = mapIndentsToLevels(lines);

  // Process list lines: normalize indentation and renumber ordered lists
  const processedLines: string[] = [];
  const numberStack: number[] = []; // Track numbering at each indent level
  const firstNumberAtLevel: Map<number, number> = new Map(); // Track first number at each level

  for (const line of lines) {
    // Detect ordered list item (content may be empty: an item that holds
    // only a nested list renders as a bare `N. ` marker).
    const orderedMatch = /^(\s*)(\d+)\. (.*)$/.exec(line);
    if (orderedMatch) {
      const indent = orderedMatch[1]!.length;
      const originalNumber = parseInt(orderedMatch[2]!, 10);
      const content = orderedMatch[3]!;

      // Get normalized level
      const level = indentToLevel.get(indent)!;

      // Track first number at this level
      if (!firstNumberAtLevel.has(level)) {
        firstNumberAtLevel.set(level, originalNumber);
      }

      // Ensure numberStack has enough levels
      while (numberStack.length <= level) {
        const initNumber = firstNumberAtLevel.get(numberStack.length) ?? 1;
        numberStack.push(initNumber);
      }

      // For level 0, use listStart if available and this is the first item
      if (
        level === 0 && listStart !== undefined && processedLines.length === 0
      ) {
        numberStack[level] = listStart;
        firstNumberAtLevel.set(0, listStart);
      }

      const number = numberStack[level]!;
      processedLines.push(`${"  ".repeat(level)}${number}. ${content}`);

      // Increment for this level, reset deeper levels
      numberStack[level] = numberStack[level]! + 1;
      numberStack.splice(level + 1);
    } else {
      // Unordered list item (content may be empty: an item that holds only a
      // nested list renders as a bare `- ` marker).
      const unorderedMatch = /^(\s*)- (.*)$/.exec(line)!;
      const indent = unorderedMatch[1]!.length;
      const content = unorderedMatch[2]!;

      // Get normalized level
      const level = indentToLevel.get(indent)!;

      processedLines.push(`${"  ".repeat(level)}- ${content}`);
    }
  }

  return processedLines;
};

// Map each distinct indent used in the list, in increasing order, to a
// normalized nesting level (0, 1, 2, …).
const mapIndentsToLevels = (lines: string[]): Map<number, number> => {
  const indents = lines
    .map((line) => {
      const match = /^(\s*)(?:-|\d+\.)/.exec(line);
      return match![1]!.length;
    })
    .filter((indent, index, arr) => arr.indexOf(indent) === index)
    .sort((a, b) => a - b);

  const indentToLevel = new Map<number, number>();
  indents.forEach((indent, index) => {
    indentToLevel.set(indent, index);
  });
  return indentToLevel;
};

// Detect separator rows, compute per-column widths, and re-render every table
// row padded to those widths.
const formatTable = (lines: string[]): string[] => {
  const output: string[] = [];

  // Parse table rows and calculate column widths
  const rows: { cells: string[]; isSeparator: boolean }[] = lines.map(
    (line) => {
      const trimmed = line.trim();
      const isSeparator = tableSpec.separatorPattern.test(trimmed);

      // Split by | and remove leading/trailing empty parts
      const parts = trimmed.split("|");
      if (parts.length > 0 && parts[0] === "") {
        parts.shift();
      }
      if (parts.length > 0 && parts[parts.length - 1] === "") {
        parts.pop();
      }

      const cells = parts.map((cell) => cell.trim());
      return { cells, isSeparator };
    },
  );

  // Find maximum column count
  const maxColumns = Math.max(
    ...rows.map((row) => (row.isSeparator ? 0 : row.cells.length)),
    0,
  );

  // Calculate column widths (maximum width for each column)
  const columnWidths: number[] = new Array(maxColumns).fill(0);
  for (const row of rows) {
    if (!row.isSeparator) {
      for (let i = 0; i < row.cells.length; i++) {
        columnWidths[i] = Math.max(columnWidths[i]!, row.cells[i]!.length);
      }
    }
  }

  // Format each row
  for (const row of rows) {
    if (row.isSeparator) {
      // Format separator row - fill column width plus spaces with dashes
      const separatorCells = columnWidths.map((width) => "-".repeat(width + 2));
      output.push(`|${separatorCells.join("|")}|`);
    } else {
      // Format data row with padding
      const paddedCells = row.cells.map((cell, i) => {
        const width = columnWidths[i]!;
        return cell.padEnd(width, " ");
      });
      // Add empty cells for missing columns
      while (paddedCells.length < maxColumns) {
        const width = columnWidths[paddedCells.length]!;
        paddedCells.push("".padEnd(width, " "));
      }
      output.push(`|${paddedCells.map((cell) => ` ${cell} `).join("|")}|`);
    }
  }

  return output;
};
