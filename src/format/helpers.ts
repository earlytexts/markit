import classifyBlockLine from "../lib/classifyBlockLine.js";
import type { State } from "./types.js";

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

// Process content buffer lines, preserving block-level structure and normalizing whitespace.
const extractBlockElements = (buffer: string[]): string[] => {
  const output: string[] = [];
  let paragraphLines: string[] = [];
  let blockquoteLines: string[] = [];
  let headingLines: string[] = [];
  let listLines: string[] = [];
  let listType: "ordered" | "unordered" | "verse" | null = null;
  let listStart: number | undefined = undefined;
  let tableLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphLines.length === 0) return;
    const collapsed = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    output.push(...splitOnLineBreakMarker(collapsed));
    paragraphLines = [];
  };

  const flushBlockquote = (): void => {
    if (blockquoteLines.length === 0) return;
    const inner = extractBlockElements(blockquoteLines);
    // Add blank line before blockquote if needed
    if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }
    for (const line of inner) {
      output.push(line === "" ? ">" : `> ${line}`);
    }
    blockquoteLines = [];
  };

  const flushHeading = (): void => {
    if (headingLines.length === 0) return;
    // Add blank line before heading group if we already have content
    if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }
    // Emit all heading lines with no blank lines between them
    for (const line of headingLines) {
      output.push(line);
    }
    headingLines = [];
  };

  const flushList = (): void => {
    if (listLines.length === 0) return;
    // Add blank line before list if needed
    if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }

    if (listType === "verse") {
      output.push(...listLines);
      listLines = [];
      listType = null;
      listStart = undefined;
      return;
    }

    // Build a map of actual indent to normalized level
    const indents = listLines
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

    for (const line of listLines) {
      // Detect ordered list item
      const orderedMatch = /^(\s*)(\d+)\. (.+)$/.exec(line);
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
          listStart !== undefined &&
          processedLines.length === 0
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
        // Unordered list item
        const unorderedMatch = /^(\s*)- (.+)$/.exec(line)!;
        const indent = unorderedMatch[1]!.length;
        const content = unorderedMatch[2]!;

        // Get normalized level
        const level = indentToLevel.get(indent)!;

        processedLines.push(`${"  ".repeat(level)}- ${content}`);
      }
    }

    output.push(...processedLines);
    listLines = [];
    listType = null;
    listStart = undefined;
  };

  const flushTable = (): void => {
    if (tableLines.length === 0) return;
    // Add blank line before table if needed
    if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }

    // Parse table rows and calculate column widths
    const rows: { cells: string[]; isSeparator: boolean }[] = tableLines.map(
      (line) => {
        const trimmed = line.trim();
        // Check if it's a separator row
        const isSeparator = /^\|?\s*-+\s*(\|\s*-+\s*)*\|?\s*$/.test(trimmed);

        // Split by | and remove leading/trailing empty parts
        let parts = trimmed.split("|");
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
        const separatorCells = columnWidths.map((width) =>
          "-".repeat(width + 2),
        );
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

    tableLines = [];
  };

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer[i]!;
    const trimmed = line.trim();
    // Classify using original line to preserve indent information for lists
    const classification = classifyBlockLine(line);

    // Blank line — separator between block-level elements
    if (classification.kind === "blank") {
      flushParagraph();
      flushBlockquote();
      flushHeading();
      flushList();
      flushTable();
      // Only emit a blank line if we've already output something
      if (output.length > 0 && output.at(-1) !== "") {
        output.push("");
      }
      continue;
    }

    // Heading line
    if (classification.kind === "heading") {
      flushParagraph();
      flushBlockquote();
      flushList();
      flushTable();
      headingLines.push(trimmed);
      continue;
    }

    // Blockquote line
    if (classification.kind === "blockquote") {
      flushParagraph();
      flushHeading();
      flushList();
      flushTable();
      const inner = trimmed.slice(1).trim();
      if (inner) {
        blockquoteLines.push(inner);
      } else {
        // Bare ">" acts as a paragraph separator within blockquotes
        blockquoteLines.push("");
      }
      continue;
    }

    // Unordered list item
    if (classification.kind === "unorderedListItem") {
      flushParagraph();
      flushHeading();
      flushBlockquote();
      flushTable();
      // If we were accumulating an ordered or verse list at base indent, flush it first
      if (
        listLines.length > 0 &&
        listType !== "unordered" &&
        classification.indent === 0
      ) {
        flushList();
      }
      if (listLines.length === 0) {
        listType = "unordered";
      }
      listLines.push(line);
      continue;
    }

    // Ordered list item
    if (classification.kind === "orderedListItem") {
      flushParagraph();
      flushHeading();
      flushBlockquote();
      flushTable();
      // If we were accumulating an unordered or verse list at base indent, flush it first
      if (
        listLines.length > 0 &&
        listType !== "ordered" &&
        classification.indent === 0
      ) {
        flushList();
      }
      // Detect start number from first item at base indent
      if (listLines.length === 0) {
        listType = "ordered";
        const { number } = classification;
        listStart = number !== 1 ? number : undefined;
      }
      listLines.push(line);
      continue;
    }

    // Verse line
    if (classification.kind === "verseListItem") {
      flushParagraph();
      flushHeading();
      flushBlockquote();
      flushTable();
      if (listLines.length > 0 && listType !== "verse") {
        flushList();
      }
      if (listLines.length === 0) {
        listType = "verse";
      }
      listLines.push(line);
      continue;
    }

    // Table row or separator
    if (
      classification.kind === "tableRow" ||
      classification.kind === "tableSeparator"
    ) {
      flushParagraph();
      flushHeading();
      flushBlockquote();
      flushList();
      tableLines.push(line);
      continue;
    }

    // Regular content line (paragraph) — also handles invalid heading variants
    // Invalid headings and headings without level are treated as regular content
    flushBlockquote();
    flushHeading();
    flushList();
    flushTable();
    // Add blank line before paragraph if we already have content
    if (
      paragraphLines.length === 0 &&
      output.length > 0 &&
      output.at(-1) !== ""
    ) {
      output.push("");
    }
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushBlockquote();
  flushHeading();
  flushList();
  flushTable();

  // Strip any trailing blank or bare blockquote separator lines
  while (output.at(-1) === "" || output.at(-1) === ">") output.pop();

  return output;
};

// Split content on '\' markers at line break positions to create line breaks
const splitOnLineBreakMarker = (text: string): string[] => {
  return text
    .replace(/(\S)\\(?= |$)/g, "$1 \\")
    .split(/\\(?= |$)/)
    .map((part, index, array) => {
      const trimmed = part.trim();
      return index < array.length - 1 ? `${trimmed} \\` : trimmed;
    })
    .filter((part) => part !== "");
};
