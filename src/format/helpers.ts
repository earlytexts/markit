import classifyBlockLine from "../lib/classifyBlockLine.ts";
import splitOnLineBreakMarker from "../lib/splitLineBreaks.ts";
import type { State } from "./types.ts";

// Emit the given line
export const emitLine = (state: State, line: string): State => {
  return {
    ...state,
    acc: [...state.acc, line],
    lastEmitted: "nonblank",
  };
};

// Emit a blank line (only if last wasn't blank)
export const emitBlank = (state: State): State => {
  if (state.lastEmitted === "blank") return state;
  return {
    ...state,
    acc: [...state.acc, ""],
    lastEmitted: "blank",
  };
};

// Flush content buffer.
// Block-level elements are line-based:
//   - lines matching ^[1-6] space     → heading (consecutive heading lines form a group)
//   - lines starting with >           → blockquote
//   - blank lines                     → element separator
//   - everything else                 → paragraph line (consecutive lines are collapsed)
// Consecutive paragraph lines are joined and whitespace is collapsed.
export const flushContent = (state: State): State => {
  if (state.contentBuffer.length === 0) return state;

  const outputLines = extractBlockElements(state.contentBuffer);

  return {
    ...state,
    acc: [...state.acc, ...outputLines],
    contentBuffer: [],
    lastEmitted: "nonblank",
  };
};

// The mutable state threaded through the block extractor: the emitted output
// plus one buffer per block-level element kind, accumulating consecutive lines
// until a boundary flushes them.
type BlockAccumulator = {
  output: string[];
  paragraphLines: string[];
  blockquoteLines: string[];
  stageLines: string[];
  headingLines: string[];
  listLines: string[];
  listType: "ordered" | "unordered" | "verse" | null;
  listStart: number | undefined;
  tableLines: string[];
};

// Process content buffer lines, preserving block-level structure and normalizing whitespace.
const extractBlockElements = (buffer: string[]): string[] => {
  const acc: BlockAccumulator = {
    output: [],
    paragraphLines: [],
    blockquoteLines: [],
    stageLines: [],
    headingLines: [],
    listLines: [],
    listType: null,
    listStart: undefined,
    tableLines: [],
  };

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer[i]!;
    const trimmed = line.trim();
    // Classify using original line to preserve indent information for lists
    const classification = classifyBlockLine(line);

    // Blank line — separator between block-level elements
    if (classification.kind === "blank") {
      flushParagraph(acc);
      flushBlockquote(acc);
      flushStageDirection(acc);
      flushHeading(acc);
      flushList(acc);
      flushTable(acc);
      // Only emit a blank line if we've already output something
      if (acc.output.length > 0 && acc.output.at(-1) !== "") {
        acc.output.push("");
      }
      continue;
    }

    // Heading line
    if (classification.kind === "heading") {
      flushParagraph(acc);
      flushBlockquote(acc);
      flushStageDirection(acc);
      flushList(acc);
      flushTable(acc);
      acc.headingLines.push(trimmed);
      continue;
    }

    // Blockquote line
    if (classification.kind === "blockquote") {
      flushParagraph(acc);
      flushHeading(acc);
      flushStageDirection(acc);
      flushList(acc);
      flushTable(acc);
      // Strip the marker and a single separator space only; keep any further
      // indentation, which encodes nested-list depth for the recursive pass.
      const inner = trimmed.slice(1).replace(/^ /, "");
      if (inner) {
        acc.blockquoteLines.push(inner);
      } else {
        // Bare ">" acts as a paragraph separator within blockquotes
        acc.blockquoteLines.push("");
      }
      continue;
    }

    // Stage direction line
    if (classification.kind === "stageDirection") {
      flushParagraph(acc);
      flushHeading(acc);
      flushBlockquote(acc);
      flushList(acc);
      flushTable(acc);
      // Strip the marker and a single separator space only; keep any further
      // indentation, which encodes nested-list depth for the recursive pass.
      const inner = trimmed.slice(1).replace(/^ /, "");
      if (inner) {
        acc.stageLines.push(inner);
      } else {
        // Bare ":" acts as a paragraph separator within stage directions
        acc.stageLines.push("");
      }
      continue;
    }

    // Unordered list item
    if (classification.kind === "unorderedListItem") {
      flushParagraph(acc);
      flushHeading(acc);
      flushBlockquote(acc);
      flushStageDirection(acc);
      flushTable(acc);
      // If we were accumulating an ordered or verse list at base indent, flush it first
      if (
        acc.listLines.length > 0 &&
        acc.listType !== "unordered" &&
        classification.indent === 0
      ) {
        flushList(acc);
      }
      if (acc.listLines.length === 0) {
        acc.listType = "unordered";
      }
      acc.listLines.push(line);
      continue;
    }

    // Ordered list item
    if (classification.kind === "orderedListItem") {
      flushParagraph(acc);
      flushHeading(acc);
      flushBlockquote(acc);
      flushStageDirection(acc);
      flushTable(acc);
      // If we were accumulating an unordered or verse list at base indent, flush it first
      if (
        acc.listLines.length > 0 &&
        acc.listType !== "ordered" &&
        classification.indent === 0
      ) {
        flushList(acc);
      }
      // Detect start number from first item at base indent
      if (acc.listLines.length === 0) {
        acc.listType = "ordered";
        const { number } = classification;
        acc.listStart = number !== 1 ? number : undefined;
      }
      acc.listLines.push(line);
      continue;
    }

    // Verse line
    if (classification.kind === "verseListItem") {
      flushParagraph(acc);
      flushHeading(acc);
      flushBlockquote(acc);
      flushStageDirection(acc);
      flushTable(acc);
      if (acc.listLines.length > 0 && acc.listType !== "verse") {
        flushList(acc);
      }
      if (acc.listLines.length === 0) {
        acc.listType = "verse";
      }
      acc.listLines.push(line);
      continue;
    }

    // Table row or separator
    if (
      classification.kind === "tableRow" ||
      classification.kind === "tableSeparator"
    ) {
      flushParagraph(acc);
      flushHeading(acc);
      flushBlockquote(acc);
      flushStageDirection(acc);
      flushList(acc);
      acc.tableLines.push(line);
      continue;
    }

    // Regular content line (paragraph) — also handles invalid heading variants
    // Invalid headings and headings without level are treated as regular content
    flushBlockquote(acc);
    flushStageDirection(acc);
    flushHeading(acc);
    flushList(acc);
    flushTable(acc);
    // Add blank line before paragraph if we already have content
    if (
      acc.paragraphLines.length === 0 &&
      acc.output.length > 0 &&
      acc.output.at(-1) !== ""
    ) {
      acc.output.push("");
    }
    acc.paragraphLines.push(trimmed);
  }

  flushParagraph(acc);
  flushBlockquote(acc);
  flushStageDirection(acc);
  flushHeading(acc);
  flushList(acc);
  flushTable(acc);

  // Strip any trailing blank or bare blockquote/stage-direction separator lines
  while (
    acc.output.at(-1) === "" || acc.output.at(-1) === ">" ||
    acc.output.at(-1) === ":"
  ) {
    acc.output.pop();
  }

  return acc.output;
};

// Collapse the buffered paragraph lines into a single whitespace-normalized
// paragraph, split back out at any explicit line-break markers.
const flushParagraph = (acc: BlockAccumulator): void => {
  if (acc.paragraphLines.length === 0) return;
  const collapsed = acc.paragraphLines.join(" ").replace(/\s+/g, " ").trim();
  acc.output.push(...splitOnLineBreakMarker(collapsed));
  acc.paragraphLines = [];
};

// Emit the buffered blockquote: recursively format its inner lines and re-prefix
// each with `>` (bare `>` for the blank separator lines).
const flushBlockquote = (acc: BlockAccumulator): void => {
  if (acc.blockquoteLines.length === 0) return;
  const inner = extractBlockElements(acc.blockquoteLines);
  // Add blank line before blockquote if needed
  if (acc.output.length > 0 && acc.output.at(-1) !== "") {
    acc.output.push("");
  }
  for (const line of inner) {
    acc.output.push(line === "" ? ">" : `> ${line}`);
  }
  acc.blockquoteLines = [];
};

// Emit the buffered stage direction: recursively format its inner lines and
// re-prefix each with `:` (bare `:` for the blank separator lines).
const flushStageDirection = (acc: BlockAccumulator): void => {
  if (acc.stageLines.length === 0) return;
  const inner = extractBlockElements(acc.stageLines);
  // Add blank line before the stage direction if needed
  if (acc.output.length > 0 && acc.output.at(-1) !== "") {
    acc.output.push("");
  }
  for (const line of inner) {
    acc.output.push(line === "" ? ":" : `: ${line}`);
  }
  acc.stageLines = [];
};

// Emit the buffered heading group with no blank lines between its lines.
const flushHeading = (acc: BlockAccumulator): void => {
  if (acc.headingLines.length === 0) return;
  // Add blank line before heading group if we already have content
  if (acc.output.length > 0 && acc.output.at(-1) !== "") {
    acc.output.push("");
  }
  // Emit all heading lines with no blank lines between them
  for (const line of acc.headingLines) {
    acc.output.push(line);
  }
  acc.headingLines = [];
};

// Emit the buffered list: normalize indentation to two-space levels and renumber
// ordered lists (verse lists pass through unchanged).
const flushList = (acc: BlockAccumulator): void => {
  if (acc.listLines.length === 0) return;
  // Add blank line before list if needed
  if (acc.output.length > 0 && acc.output.at(-1) !== "") {
    acc.output.push("");
  }

  if (acc.listType === "verse") {
    acc.output.push(...acc.listLines);
    acc.listLines = [];
    acc.listType = null;
    acc.listStart = undefined;
    return;
  }

  // Build a map of actual indent to normalized level
  const indents = acc.listLines
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

  // Process list lines: normalize indentation and renumber ordered lists
  const processedLines: string[] = [];
  const numberStack: number[] = []; // Track numbering at each indent level
  const firstNumberAtLevel: Map<number, number> = new Map(); // Track first number at each level

  for (const line of acc.listLines) {
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
        level === 0 &&
        acc.listStart !== undefined &&
        processedLines.length === 0
      ) {
        numberStack[level] = acc.listStart;
        firstNumberAtLevel.set(0, acc.listStart);
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

  acc.output.push(...processedLines);
  acc.listLines = [];
  acc.listType = null;
  acc.listStart = undefined;
};

// Emit the buffered table: detect separator rows, compute per-column widths, and
// re-render every row padded to those widths.
const flushTable = (acc: BlockAccumulator): void => {
  if (acc.tableLines.length === 0) return;
  // Add blank line before table if needed
  if (acc.output.length > 0 && acc.output.at(-1) !== "") {
    acc.output.push("");
  }

  // Parse table rows and calculate column widths
  const rows: { cells: string[]; isSeparator: boolean }[] = acc.tableLines.map(
    (line) => {
      const trimmed = line.trim();
      // Check if it's a separator row
      const isSeparator = /^\|?\s*-+\s*(\|\s*-+\s*)*\|?\s*$/.test(trimmed);

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
      acc.output.push(`|${separatorCells.join("|")}|`);
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
      acc.output.push(`|${paddedCells.map((cell) => ` ${cell} `).join("|")}|`);
    }
  }

  acc.tableLines = [];
};
