import type {
  Block,
  BlockElement,
  BlockType,
  Heading,
  HeadingLine,
  List,
  ListItem,
  MarkitDocument,
  MarkitError,
  NestableBlockElement,
  Paragraph,
  Table,
  TableCell,
  TableRow,
} from "../types.ts";
import {
  blockquoteSpec,
  endLine,
  footnoteReferenceSpec,
  listSpec,
  stageDirectionSpec,
  startLine,
  tableSpec,
} from "../types.ts";
import classifyBlockLine from "../lib/classifyBlockLine.ts";
import buildPositionMap from "./buildPositionMap.ts";
import parseElements from "./parseElements.ts";
import type { Line } from "./splitIntoBlocks.ts";
import type {
  BlockWithMetadata,
  TextTreeWithMetadata,
} from "./parseMetadata.ts";

/**
 * Parse the content of each block in the TextTree, returning a fully parsed MarkitDocument.
 */
export default (
  tree: TextTreeWithMetadata,
): [MarkitDocument, MarkitError[]] => {
  return parseTextContent(tree);
};

const parseTextContent = (
  text: TextTreeWithMetadata,
): [MarkitDocument, MarkitError[]] => {
  // Get footnote reference ids to validate footnote references
  const footnoteIds = new Set(
    text.blocks
      .filter((b) => footnoteReferenceSpec.pattern.test(b.id))
      .map((b) => b.id),
  );

  // Parse content for each block
  const blockResults = text.blocks.map((block) =>
    parseBlockContent(block, footnoteIds, text.id)
  );
  const blocks = blockResults.map((result) => result[0]);
  const blockErrors = blockResults.flatMap((result) => result[1]);

  // Parse blocks for all internal children recursively, passing merged metadata down
  const childResults = text.children.map((child) => parseTextContent(child));
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);

  // Put it all together
  const document = {
    id: text.id,
    ...(text.metadata ? { metadata: text.metadata } : {}),
    blocks,
    children,
    [startLine]: text.startLine,
    [endLine]: text.endLine,
  };

  return [document, [...blockErrors, ...childErrors]];
};

const parseBlockContent = (
  block: BlockWithMetadata,
  footnoteIds: ReadonlySet<string>,
  textId: string,
): [Block, MarkitError[]] => {
  const errors: MarkitError[] = [];

  const blockType: BlockType = block.id === "title"
    ? "title"
    : block.id.startsWith("subtitle")
    ? "subtitle"
    : footnoteReferenceSpec.pattern.test(block.id)
    ? "footnote"
    : "paragraph";

  const allowHeadings = blockType === "title" || blockType === "subtitle";

  const content = parseBlockLevelElements(
    block.lines,
    footnoteIds,
    errors,
    allowHeadings,
    "Headings are only allowed in title or subtitle blocks.",
    textId,
  );

  const parsedBlock: Block = {
    id: `${textId}.${block.id}`,
    type: blockType,
    ...(block.metadata ? { metadata: block.metadata } : {}),
    content,
    [startLine]: block.startLine,
    [endLine]: block.endLine,
  };

  return [parsedBlock, errors];
};

type HeadingEntry = { level: number; line: Line };

type ListItemEntry = {
  indent: number;
  number: number; // Item number for ordered lists (ignored for unordered)
  line: Line;
};

type TableRowEntry = { line: Line; isSeparator: boolean };

type State =
  | { kind: "none" }
  | { kind: "paragraph"; lines: Line[] }
  | { kind: "blockquote"; lines: Line[] }
  | { kind: "stageDirection"; lines: Line[] }
  | { kind: "heading"; entries: HeadingEntry[] }
  | {
    kind: "list";
    ordered: "ordered" | "unordered" | "verse";
    items: ListItemEntry[];
  }
  | { kind: "table"; rows: TableRowEntry[] };

/**
 * Parse an array of lines into block-level elements (headings, paragraphs, blockquotes).
 * When `allowHeadings` is false, any heading markers are treated as paragraph text.
 */
const parseBlockLevelElements = (
  lines: Line[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  allowHeadings: boolean,
  headingErrorMessage = "Headings are not allowed inside block quotations.",
  textId: string,
): BlockElement[] => {
  const elements: BlockElement[] = [];
  let state: State = { kind: "none" };

  // Emit the block accumulated in the current state, then reset to none.
  const flush = (): void => {
    if (state.kind === "paragraph") {
      elements.push(buildParagraph(state.lines, footnoteIds, errors, textId));
    } else if (state.kind === "blockquote") {
      flushBlockquote(state.lines, elements, footnoteIds, errors, textId);
    } else if (state.kind === "stageDirection") {
      flushStageDirection(state.lines, elements, footnoteIds, errors, textId);
    } else if (state.kind === "heading") {
      flushHeading(state.entries, elements, footnoteIds, errors, textId);
    } else if (state.kind === "list") {
      elements.push(
        buildList(state.ordered, state.items, footnoteIds, errors, textId),
      );
    } else if (state.kind === "table") {
      const table = buildTable(state.rows, footnoteIds, errors, textId);
      if (table) {
        elements.push(table);
      }
    }
    state = { kind: "none" };
  };

  for (const line of lines) {
    const content = line.content;
    const classification = classifyBlockLine(content);

    // Blank line
    if (classification.kind === "blank") {
      flush();
      continue;
    }

    // Heading line with invalid level
    if (classification.kind === "invalidHeading") {
      flush();
      errors.push({
        message: "Heading level must be between 1 and 6.",
        line: line.lineNumber + 1,
        column: line.charOffset + 1,
        endLine: line.lineNumber + 1,
        endColumn: line.charOffset + 3,
        severity: "error",
      });
      continue;
    }

    // Heading marker without a level digit
    if (classification.kind === "headingWithoutLevel") {
      flush();
      errors.push({
        message: "Heading must be given a level between 1 and 6.",
        line: line.lineNumber + 1,
        column: line.charOffset + 1,
        endLine: line.lineNumber + 1,
        endColumn: line.charOffset + 2,
        severity: "error",
      });
      continue;
    }

    // Valid heading line
    if (classification.kind === "heading") {
      if (!allowHeadings) {
        flush();
        errors.push({
          message: headingErrorMessage,
          line: line.lineNumber + 1,
          column: line.charOffset + 1,
          endLine: line.lineNumber + 1,
          endColumn: line.charOffset + content.length + 1,
          severity: "error",
        });
      } else {
        const level = classification.level;
        if (state.kind === "heading") {
          state.entries.push({ level, line });
        } else {
          flush();
          state = { kind: "heading", entries: [{ level, line }] };
        }
      }
      continue;
    }

    // Blockquote line
    if (classification.kind === "blockquote") {
      if (state.kind !== "blockquote") {
        flush();
        state = { kind: "blockquote", lines: [line] };
      } else {
        state.lines.push(line);
      }
      continue;
    }

    // Stage direction line
    if (classification.kind === "stageDirection") {
      if (state.kind !== "stageDirection") {
        flush();
        state = { kind: "stageDirection", lines: [line] };
      } else {
        state.lines.push(line);
      }
      continue;
    }

    // Unordered list item
    if (classification.kind === "unorderedListItem") {
      const { indent } = classification;
      // Validate indent is a multiple of indentSize
      if (indent % listSpec.indentSize !== 0) {
        flush();
        errors.push({
          message:
            `List item indent must be a multiple of ${listSpec.indentSize} spaces.`,
          line: line.lineNumber + 1,
          column: line.charOffset + 1,
          endLine: line.lineNumber + 1,
          endColumn: line.charOffset + indent + 1,
          severity: "error",
        });
        continue;
      }
      // If we're in a list state and this item is at base indent (0),
      // check if type matches. If not, flush and start new list.
      if (state.kind === "list") {
        if (indent === 0 && state.ordered !== "unordered") {
          flush();
          state = {
            kind: "list",
            ordered: "unordered",
            items: [{ indent, number: 0, line }],
          };
        } else {
          state.items.push({ indent, number: 0, line });
        }
      } else {
        flush();
        state = {
          kind: "list",
          ordered: "unordered",
          items: [{ indent, number: 0, line }],
        };
      }
      continue;
    }

    // Ordered list item
    if (classification.kind === "orderedListItem") {
      const { indent, number } = classification;
      // Validate indent is a multiple of indentSize
      if (indent % listSpec.indentSize !== 0) {
        flush();
        errors.push({
          message:
            `List item indent must be a multiple of ${listSpec.indentSize} spaces.`,
          line: line.lineNumber + 1,
          column: line.charOffset + 1,
          endLine: line.lineNumber + 1,
          endColumn: line.charOffset + indent + 1,
          severity: "error",
        });
        continue;
      }
      // If we're in a list state and this item is at base indent (0),
      // check if type matches. If not, flush and start new list.
      if (state.kind === "list") {
        if (indent === 0 && state.ordered !== "ordered") {
          flush();
          state = {
            kind: "list",
            ordered: "ordered",
            items: [{ indent, number, line }],
          };
        } else {
          state.items.push({ indent, number, line });
        }
      } else {
        flush();
        state = {
          kind: "list",
          ordered: "ordered",
          items: [{ indent, number, line }],
        };
      }
      continue;
    }

    // Verse line
    if (classification.kind === "verseListItem") {
      if (state.kind === "list" && state.ordered === "verse") {
        state.items.push({ indent: 0, number: 0, line });
      } else {
        flush();
        state = {
          kind: "list",
          ordered: "verse",
          items: [{ indent: 0, number: 0, line }],
        };
      }
      continue;
    }

    // Table separator row
    if (classification.kind === "tableSeparator") {
      if (state.kind === "table") {
        state.rows.push({ line, isSeparator: true });
      } else {
        flush();
        state = { kind: "table", rows: [{ line, isSeparator: true }] };
      }
      continue;
    }

    // Table row
    if (classification.kind === "tableRow") {
      if (state.kind === "table") {
        state.rows.push({ line, isSeparator: false });
      } else {
        flush();
        state = { kind: "table", rows: [{ line, isSeparator: false }] };
      }
      continue;
    }

    // Regular content line → paragraph
    if (state.kind !== "none" && state.kind !== "paragraph") {
      flush();
    }
    if (state.kind !== "paragraph") {
      state = { kind: "paragraph", lines: [line] };
    } else {
      state.lines.push(line);
    }
  }

  flush();

  return elements;
};

/**
 * Emit a heading element built from consecutive heading lines.
 */
const flushHeading = (
  entries: HeadingEntry[],
  elements: BlockElement[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): void => {
  const parsedLines: HeadingLine[] = entries.map(({ level, line }) => {
    const headingText = line.content.slice(3); // "^N " is always 3 chars
    const posMap = buildPositionMap([
      {
        lineNumber: line.lineNumber,
        charOffset: line.charOffset + 3,
        content: headingText,
      },
    ]);
    const [inlineContent, inlineErrors] = parseElements(
      headingText,
      posMap,
      footnoteIds,
      textId,
    );
    errors.push(...inlineErrors);
    return { type: "headingLine", level, content: inlineContent };
  });
  const heading: Heading = { type: "heading", content: parsedLines };
  elements.push(heading);
};

/**
 * Emit a blockquote element by recursively parsing its inner (`>`-stripped)
 * lines as block-level content. Headings are disallowed (they only belong in
 * title/subtitle blocks); everything else — paragraphs, lists, verse, tables,
 * and nested quotations/stage directions — is kept. A blockquote that contained
 * only a heading ends up empty and produces no element.
 */
const flushBlockquote = (
  bqLines: Line[],
  elements: BlockElement[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): void => {
  // Strip > prefix from each line (including "blank" > lines which become blank)
  const innerLines: Line[] = bqLines.map((line) => {
    // Strip leading > (and optional single space after it)
    const stripped = line.content
      .slice(blockquoteSpec.marker.length)
      .replace(/^ /, "");
    return {
      lineNumber: line.lineNumber,
      charOffset: line.charOffset + (line.content.length - stripped.length),
      content: stripped,
    };
  });

  const innerElements = parseBlockLevelElements(
    innerLines,
    footnoteIds,
    errors,
    false,
    "Headings are not allowed inside block quotations.",
    textId,
  );

  // The allowHeadings=false guard means no heading ever reaches this list; the
  // filter narrows the type from BlockElement to NestableBlockElement.
  const content = innerElements.filter(
    (el): el is NestableBlockElement => el.type !== "heading",
  );

  if (content.length > 0) {
    elements.push({ type: "blockquote", content });
  }
};

/**
 * Emit a stage-direction element by recursively parsing its inner (`:`-stripped)
 * lines as block-level content. As with blockquotes, headings are disallowed but
 * any other block element is kept, and an empty result produces no element.
 */
const flushStageDirection = (
  sdLines: Line[],
  elements: BlockElement[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): void => {
  // Strip the `:` prefix (and an optional single space) from each line.
  const innerLines: Line[] = sdLines.map((line) => {
    const stripped = line.content
      .slice(stageDirectionSpec.marker.length)
      .replace(/^ /, "");
    return {
      lineNumber: line.lineNumber,
      charOffset: line.charOffset + (line.content.length - stripped.length),
      content: stripped,
    };
  });

  const innerElements = parseBlockLevelElements(
    innerLines,
    footnoteIds,
    errors,
    false,
    "Headings are not allowed inside stage directions.",
    textId,
  );

  const content = innerElements.filter(
    (el): el is NestableBlockElement => el.type !== "heading",
  );

  if (content.length > 0) {
    elements.push({ type: "stageDirection", content });
  }
};

/**
 * Build a paragraph from a list of non-blank content lines.
 */
const buildParagraph = (
  lines: Line[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): Paragraph => {
  const nonBlank = lines.filter((l) => l.content !== "");

  const text = nonBlank
    .map((l) => l.content)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const posMap = buildPositionMap(nonBlank);
  const [inlineContent, inlineErrors] = parseElements(
    text,
    posMap,
    footnoteIds,
    textId,
  );
  errors.push(...inlineErrors);

  return { type: "paragraph", content: inlineContent };
};

/**
 * Build a list from a flat array of list item entries.
 * Groups items by indent level and builds nested list structure.
 */
const buildList = (
  ordered: "ordered" | "unordered" | "verse",
  items: ListItemEntry[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): List => {
  // Find the minimum indent level (base level for this list)
  const baseIndent = Math.min(...items.map((item) => item.indent));

  // Extract start number from first item at base indent if ordered and not 1
  const firstItemAtBase = items.find((item) => item.indent === baseIndent);
  const start =
    ordered === "ordered" && firstItemAtBase && firstItemAtBase.number !== 1
      ? firstItemAtBase.number
      : undefined;

  // Build list items recursively, handling nesting
  const listItems = buildListItems(
    ordered,
    items,
    baseIndent,
    footnoteIds,
    errors,
    textId,
  );

  return {
    type: "list",
    ordered,
    ...(start !== undefined ? { start } : {}),
    items: listItems,
  };
};

/**
 * Recursively build list items, handling nesting by indent level.
 */
const buildListItems = (
  ordered: "ordered" | "unordered" | "verse",
  items: ListItemEntry[],
  baseIndent: number,
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): ListItem[] => {
  const result: ListItem[] = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i]!;

    // Skip items at deeper indent (they'll be processed as nested lists)
    if (item.indent > baseIndent) {
      i++;
      continue;
    }

    // Item at current indent level - parse its content
    const line = item.line;
    // Strip the list marker prefix (e.g., "- ", "1. ", or "* ")
    const markerMatch = ordered === "ordered"
      ? /^\s*\d+\. /.exec(line.content)
      : ordered === "verse"
      ? /^\* /.exec(line.content)
      : /^\s*- /.exec(line.content);
    const markerLength = markerMatch![0].length;
    const itemText = line.content.slice(markerLength);

    const posMap = buildPositionMap([
      {
        lineNumber: line.lineNumber,
        charOffset: line.charOffset + markerLength,
        content: itemText,
      },
    ]);

    const [inlineContent, inlineErrors] = parseElements(
      itemText,
      posMap,
      footnoteIds,
      textId,
    );
    errors.push(...inlineErrors);

    const listItem: ListItem = {
      type: "listItem",
      content: inlineContent,
    };

    // Check if the next items are nested (deeper indent)
    if (i + 1 < items.length && items[i + 1]!.indent > baseIndent) {
      // Find all consecutive items at deeper indents
      const nestedStart = i + 1;
      let nestedEnd = i + 1;
      const nextIndent = items[nestedStart]!.indent;
      while (
        nestedEnd < items.length &&
        items[nestedEnd]!.indent >= nextIndent
      ) {
        nestedEnd++;
      }

      // Take these items and recursively build a nested list
      const nestedItems = items.slice(nestedStart, nestedEnd);
      // Detect nested list type from first item at the nested base indent
      const nestedBaseIndent = Math.min(
        ...nestedItems.map((item) => item.indent),
      );
      const firstNestedItem = nestedItems.find(
        (item) => item.indent === nestedBaseIndent,
      );
      const nestedOrdered: "ordered" | "unordered" = firstNestedItem!.number > 0
        ? "ordered"
        : "unordered";

      listItem.nestedList = buildList(
        nestedOrdered,
        nestedItems,
        footnoteIds,
        errors,
        textId,
      )!;

      // Skip past the nested items
      i = nestedEnd;
    } else {
      i++;
    }

    result.push(listItem);
  }

  return result;
};

/**
 * Build a table from table row entries.
 * Handles separator detection, cell parsing, and column normalization.
 */
const buildTable = (
  rowEntries: { line: Line; isSeparator: boolean }[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): Table | null => {
  // Find separator row index (if any)
  const separatorIndex = rowEntries.findIndex((entry) => entry.isSeparator);
  const hasHeader = separatorIndex === 1; // Header requires separator at index 1

  // Filter out separator rows from the data
  const dataRows = rowEntries.filter((entry) => !entry.isSeparator);

  if (dataRows.length === 0) return null;

  // Parse each row into cells
  const parsedRows: TableRow[] = dataRows.map((entry) =>
    parseTableRow(entry.line, footnoteIds, errors, textId)
  );

  // Find maximum column count
  const maxColumns = Math.max(...parsedRows.map((row) => row.cells.length), 0);

  // Normalize rows: add empty cells to rows with fewer columns
  parsedRows.forEach((row, rowIndex) => {
    const rowLineNumber = dataRows[rowIndex]!.line.lineNumber;
    if (row.cells.length < maxColumns) {
      // Emit warning for inconsistent column count
      if (row.cells.length > 0) {
        errors.push({
          message:
            `Table row has ${row.cells.length} cell(s) but expected ${maxColumns}.`,
          line: rowLineNumber + 1,
          column: 1,
          endLine: rowLineNumber + 1,
          endColumn: dataRows[rowIndex]!.line.content.length + 1,
          severity: "warning",
        });
      }
      // Add empty cells
      while (row.cells.length < maxColumns) {
        row.cells.push({ type: "tableCell", content: [] });
      }
    }
  });

  // Warn if separator exists but not in correct position
  if (separatorIndex !== -1 && separatorIndex !== 1) {
    const sepLine = rowEntries[separatorIndex]!.line;
    errors.push({
      message:
        "Table separator row should be the second row to define headers.",
      line: sepLine.lineNumber + 1,
      column: 1,
      endLine: sepLine.lineNumber + 1,
      endColumn: sepLine.content.length + 1,
      severity: "warning",
    });
  }

  return {
    type: "table",
    hasHeader,
    rows: parsedRows,
  };
};

/**
 * Parse a single table row into cells.
 */
const parseTableRow = (
  line: Line,
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  textId: string,
): TableRow => {
  const content = line.content.trim();
  const contentStart = line.content.indexOf(content);

  // Split by | and remove leading/trailing empty strings from optional
  // leading/trailing pipes, keeping each part's offset within the content
  const parts = content.split(tableSpec.cellDelimiter);
  let cursor = 0;
  const partOffsets = parts.map((part) => {
    const offset = cursor;
    cursor += part.length + 1;
    return offset;
  });

  // Remove leading empty part if line starts with |
  if (parts.length > 0 && parts[0] === "") {
    parts.shift();
    partOffsets.shift();
  }

  // Remove trailing empty part if line ends with |
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
    partOffsets.pop();
  }

  // Parse each cell
  const cells: TableCell[] = parts.map((cellText, cellIndex) => {
    const trimmed = cellText.trim();

    if (trimmed === "") {
      return { type: "tableCell", content: [] };
    }

    // Calculate char offset for this cell
    const trimStart = cellText.indexOf(trimmed);
    const charOffset = line.charOffset + contentStart +
      partOffsets[cellIndex]! + trimStart;

    const posMap = buildPositionMap([
      {
        lineNumber: line.lineNumber,
        charOffset,
        content: trimmed,
      },
    ]);

    const [inlineContent, inlineErrors] = parseElements(
      trimmed,
      posMap,
      footnoteIds,
      textId,
    );
    errors.push(...inlineErrors);

    return { type: "tableCell", content: inlineContent };
  });

  return { type: "tableRow", cells };
};
