import type {
  Block,
  BlockElement,
  Blockquote,
  BlockType,
  Heading,
  HeadingLine,
  List,
  ListItem,
  MarkitDocument,
  MarkitError,
  NestableBlockElement,
  Paragraph,
  StageDirection,
  Table,
  TableCell,
  TableRow,
} from "../types.ts";
import {
  blockquoteSpec,
  footnoteReferenceSpec,
  listSpec,
  stageDirectionSpec,
  tableSpec,
} from "../lib/grammar.ts";
import classifyBlockLine from "../lib/classifyBlockLine.ts";
import buildPositionMap from "./buildPositionMap.ts";
import lineRange from "../lib/lineRange.ts";
import makeError from "../lib/makeError.ts";
import parseElements, { type ParseContext } from "./parseElements.ts";
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
  positions: boolean,
): [MarkitDocument, MarkitError[]] => parseTextContent(tree, positions);

const parseTextContent = (
  text: TextTreeWithMetadata,
  positions: boolean,
): [MarkitDocument, MarkitError[]] => {
  // Get footnote reference ids to validate footnote references
  const footnoteIds = new Set(
    text.blocks
      .filter((b) => footnoteReferenceSpec.pattern.test(b.id))
      .map((b) => b.id),
  );

  // Parse content for each block
  const blockResults = text.blocks.map((block) =>
    parseBlockContent(block, footnoteIds, text.id, positions)
  );
  const blocks = blockResults.map((result) => result[0]);
  const blockErrors = blockResults.flatMap((result) => result[1]);

  // Parse blocks for all internal children recursively
  const childResults = text.children.map((child) =>
    parseTextContent(child, positions)
  );
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);

  // Put it all together
  const document = {
    id: text.id,
    ...(text.metadata ? { metadata: text.metadata } : {}),
    blocks,
    children,
    ...(positions
      ? {
        source: lineRange(text.startLine, text.endLine),
        ...(text.metadataSource ? { metadataSource: text.metadataSource } : {}),
      }
      : {}),
  };

  return [document, [...blockErrors, ...childErrors]];
};

const parseBlockContent = (
  block: BlockWithMetadata,
  footnoteIds: ReadonlySet<string>,
  textId: string,
  positions: boolean,
): [Block, MarkitError[]] => {
  const errors: MarkitError[] = [];
  const ctx: ParseContext = { footnoteIds, errors, textId, positions };

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
    allowHeadings
      ? null
      : "Headings are only allowed in title or subtitle blocks.",
    ctx,
  );

  const parsedBlock: Block = {
    id: `${textId}.${block.id}`,
    type: blockType,
    ...(block.metadata ? { metadata: block.metadata } : {}),
    content,
    ...(positions
      ? {
        source: lineRange(block.startLine, block.endLine),
        ...(block.metadataSource
          ? { metadataSource: block.metadataSource }
          : {}),
      }
      : {}),
  };

  return [parsedBlock, errors];
};

type HeadingEntry = { level: number; line: Line };

type ListItemEntry = {
  indent: number;
  // The item number for ordered items; 0 for unordered/verse items, which also
  // marks the item kind when a nested list's type is detected in buildListItems.
  number: number;
  markerLength: number;
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
 * Parse an array of lines into block-level elements (headings, paragraphs,
 * blockquotes, stage directions, lists, tables). `headingError` is null when
 * headings are allowed (title/subtitle blocks); otherwise it is the diagnostic
 * to report for any heading line, whose content is then dropped.
 */
const parseBlockLevelElements = (
  lines: Line[],
  headingError: string | null,
  ctx: ParseContext,
): BlockElement[] => {
  const elements: BlockElement[] = [];
  let state: State = { kind: "none" };

  // Emit the block accumulated in the current state, then reset to none.
  const flush = (): void => {
    const element = buildElement(state, ctx);
    if (element) elements.push(element);
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
      ctx.errors.push(
        makeError({
          message: "Heading level must be between 1 and 6.",
          line: line.lineNumber,
          column: line.charOffset,
          length: 2,
        }),
      );
      continue;
    }

    // Heading marker without a level digit
    if (classification.kind === "headingWithoutLevel") {
      flush();
      ctx.errors.push(
        makeError({
          message: "Heading must be given a level between 1 and 6.",
          line: line.lineNumber,
          column: line.charOffset,
          length: 1,
        }),
      );
      continue;
    }

    // Valid heading line
    if (classification.kind === "heading") {
      if (headingError !== null) {
        flush();
        ctx.errors.push(
          makeError({
            message: headingError,
            line: line.lineNumber,
            column: line.charOffset,
            length: content.length,
          }),
        );
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

    // List item (ordered, unordered, or verse)
    if (
      classification.kind === "unorderedListItem" ||
      classification.kind === "orderedListItem" ||
      classification.kind === "verseListItem"
    ) {
      const ordered: "ordered" | "unordered" | "verse" =
        classification.kind === "orderedListItem"
          ? "ordered"
          : classification.kind === "unorderedListItem"
          ? "unordered"
          : "verse";
      const indent = classification.kind === "verseListItem"
        ? 0
        : classification.indent;
      const number = classification.kind === "orderedListItem"
        ? classification.number
        : 0;

      // Validate indent is a multiple of indentSize (verse is never indented)
      if (indent % listSpec.indentSize !== 0) {
        flush();
        ctx.errors.push(
          makeError({
            message:
              `List item indent must be a multiple of ${listSpec.indentSize} spaces.`,
            line: line.lineNumber,
            column: line.charOffset,
            length: indent,
          }),
        );
        continue;
      }

      const entry: ListItemEntry = {
        indent,
        number,
        markerLength: classification.markerLength,
        line,
      };
      // A base-indent item of a different list kind starts a new list; anything
      // else (same kind, or an indented item of either kind) joins the current
      // one — nested list kinds are detected later, in buildListItems.
      if (state.kind === "list" && (indent > 0 || state.ordered === ordered)) {
        state.items.push(entry);
      } else {
        flush();
        state = { kind: "list", ordered, items: [entry] };
      }
      continue;
    }

    // Table row or separator row
    if (
      classification.kind === "tableRow" ||
      classification.kind === "tableSeparator"
    ) {
      const row: TableRowEntry = {
        line,
        isSeparator: classification.kind === "tableSeparator",
      };
      if (state.kind === "table") {
        state.rows.push(row);
      } else {
        flush();
        state = { kind: "table", rows: [row] };
      }
      continue;
    }

    // Regular content line → paragraph
    if (state.kind !== "paragraph") {
      flush();
      state = { kind: "paragraph", lines: [line] };
    } else {
      state.lines.push(line);
    }
  }

  flush();

  return elements;
};

/**
 * Build the block element for a finished state, or null when there is nothing
 * to emit — the none state, an empty table, or a blockquote/stage direction
 * whose content vanished (it contained only a heading).
 */
const buildElement = (
  state: State,
  ctx: ParseContext,
): BlockElement | null => {
  switch (state.kind) {
    case "none":
      return null;
    case "paragraph":
      return buildParagraph(state.lines, ctx);
    case "blockquote":
      return buildNested("blockquote", state.lines, ctx);
    case "stageDirection":
      return buildNested("stageDirection", state.lines, ctx);
    case "heading":
      return buildHeading(state.entries, ctx);
    case "list":
      return buildList(state.ordered, state.items, ctx);
    case "table":
      return buildTable(state.rows, ctx);
  }
};

/**
 * Build a heading element from consecutive heading lines.
 */
const buildHeading = (
  entries: HeadingEntry[],
  ctx: ParseContext,
): Heading => {
  const parsedLines: HeadingLine[] = entries.map(({ level, line }) => {
    const headingText = line.content.slice(3); // "^N " is always 3 chars
    const posMap = buildPositionMap([
      {
        lineNumber: line.lineNumber,
        charOffset: line.charOffset + 3,
        content: headingText,
      },
    ]);
    const content = parseElements(headingText, posMap, ctx);
    return { type: "headingLine", level, content };
  });
  return { type: "heading", content: parsedLines };
};

// What distinguishes the two marker-prefixed nested elements: the line marker
// to strip, and the diagnostic for a heading found inside.
const nestedSpecs = {
  blockquote: {
    marker: blockquoteSpec.marker,
    headingError: "Headings are not allowed inside block quotations.",
    emptyError: "Block quotation must not be empty.",
  },
  stageDirection: {
    marker: stageDirectionSpec.marker,
    headingError: "Headings are not allowed inside stage directions.",
    emptyError: "Stage direction must not be empty.",
  },
} as const;

/**
 * Build a blockquote or stage direction by recursively parsing its inner
 * (marker-stripped) lines as block-level content. Headings are disallowed
 * (they only belong in title/subtitle blocks); everything else — paragraphs,
 * lists, verse, tables, and nested quotations/stage directions — is kept. An
 * element that contained only a heading ends up empty and returns null.
 */
const buildNested = (
  type: "blockquote" | "stageDirection",
  lines: Line[],
  ctx: ParseContext,
): Blockquote | StageDirection | null => {
  const { marker, headingError, emptyError } = nestedSpecs[type];

  // Strip the marker (and an optional single space after it) from each line;
  // a bare marker line becomes a blank separator.
  const innerLines: Line[] = lines.map((line) => {
    const stripped = line.content.slice(marker.length).replace(/^ /, "");
    return {
      lineNumber: line.lineNumber,
      charOffset: line.charOffset + (line.content.length - stripped.length),
      content: stripped,
    };
  });

  const innerElements = parseBlockLevelElements(innerLines, headingError, ctx);

  // The heading guard means no heading ever reaches this list; the filter
  // narrows the type from BlockElement to NestableBlockElement.
  const content = innerElements.filter(
    (el): el is NestableBlockElement => el.type !== "heading",
  );

  if (content.length === 0) {
    // An element whose inner lines are all blank (nothing but bare markers) is
    // empty by mistake — flag it. When a non-blank line was present but produced
    // no content (a lone heading), that line's own diagnostic already fired.
    if (innerLines.every((line) => line.content === "")) {
      ctx.errors.push(
        makeError({
          message: emptyError,
          line: lines[0]!.lineNumber,
          column: lines[0]!.charOffset,
          length: marker.length,
        }),
      );
    }
    return null;
  }

  return { type, content };
};

/**
 * Build a paragraph from a list of non-blank content lines.
 */
const buildParagraph = (lines: Line[], ctx: ParseContext): Paragraph => {
  const nonBlank = lines.filter((l) => l.content !== "");

  const text = nonBlank
    .map((l) => l.content)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const posMap = buildPositionMap(nonBlank);
  const content = parseElements(text, posMap, ctx);

  return { type: "paragraph", content };
};

/**
 * Build a list from a flat array of list item entries.
 * Groups items by indent level and builds nested list structure.
 */
const buildList = (
  ordered: "ordered" | "unordered" | "verse",
  items: ListItemEntry[],
  ctx: ParseContext,
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
  const listItems = buildListItems(items, baseIndent, ctx);

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
  items: ListItemEntry[],
  baseIndent: number,
  ctx: ParseContext,
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
    const itemText = line.content.slice(item.markerLength);

    const posMap = buildPositionMap([
      {
        lineNumber: line.lineNumber,
        charOffset: line.charOffset + item.markerLength,
        content: itemText,
      },
    ]);

    const content = parseElements(itemText, posMap, ctx);

    const listItem: ListItem = {
      type: "listItem",
      content,
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

      listItem.nestedList = buildList(nestedOrdered, nestedItems, ctx);

      // Skip past the nested items
      i = nestedEnd;
    } else {
      i++;
    }

    // An item with neither content nor a nested list is empty by mistake. (A
    // bare marker that only carries a nested list is legitimate — its content
    // is empty but `nestedList` is set.)
    if (content.length === 0 && listItem.nestedList === undefined) {
      ctx.errors.push(
        makeError({
          message: "List item must not be empty.",
          line: line.lineNumber,
          column: line.charOffset,
          length: item.markerLength,
        }),
      );
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
  rowEntries: TableRowEntry[],
  ctx: ParseContext,
): Table | null => {
  // Find separator row index (if any)
  const separatorIndex = rowEntries.findIndex((entry) => entry.isSeparator);
  const hasHeader = separatorIndex === 1; // Header requires separator at index 1

  // Filter out separator rows from the data
  const dataRows = rowEntries.filter((entry) => !entry.isSeparator);

  if (dataRows.length === 0) return null;

  // Parse each row into cells
  const parsedRows: TableRow[] = dataRows.map((entry) =>
    parseTableRow(entry.line, ctx)
  );

  // Find maximum column count
  const maxColumns = Math.max(...parsedRows.map((row) => row.cells.length), 0);

  // Normalize rows: add empty cells to rows with fewer columns
  parsedRows.forEach((row, rowIndex) => {
    const rowLineNumber = dataRows[rowIndex]!.line.lineNumber;
    if (row.cells.length < maxColumns) {
      // Emit warning for inconsistent column count
      if (row.cells.length > 0) {
        ctx.errors.push(
          makeError({
            message:
              `Table row has ${row.cells.length} cell(s) but expected ${maxColumns}.`,
            line: rowLineNumber,
            length: dataRows[rowIndex]!.line.content.length,
            severity: "warning",
          }),
        );
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
    ctx.errors.push(
      makeError({
        message:
          "Table separator row should be the second row to define headers.",
        line: sepLine.lineNumber,
        length: sepLine.content.length,
        severity: "warning",
      }),
    );
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
const parseTableRow = (line: Line, ctx: ParseContext): TableRow => {
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

    const content = parseElements(trimmed, posMap, ctx);

    return { type: "tableCell", content };
  });

  return { type: "tableRow", cells };
};
