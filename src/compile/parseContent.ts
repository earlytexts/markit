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
  Paragraph,
} from "../types.js";
import {
  blockquoteSpec,
  endLine,
  footnoteReferenceSpec,
  listSpec,
  startLine,
} from "../types.js";
import classifyBlockLine from "../lib/classifyBlockLine.js";
import buildPositionMap from "./buildPositionMap.js";
import parseElements from "./parseElements.js";
import type { Line } from "./splitIntoBlocks.js";
import type {
  BlockWithMetadata,
  TextTreeWithMetadata,
} from "./parseMetadata.js";

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
  const footnoteIds = text.blocks
    .filter((b) => footnoteReferenceSpec.pattern.test(b.id))
    .map((b) => b.id);

  // Parse content for each block
  const blockResults = text.blocks.map((block) =>
    parseBlockContent(block, footnoteIds, text.id),
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
  footnoteIds: string[],
  textId: string,
): [Block, MarkitError[]] => {
  const errors: MarkitError[] = [];

  const blockType: BlockType =
    block.id === "title"
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

/**
 * Parse an array of lines into block-level elements (headings, paragraphs, blockquotes).
 * When `allowHeadings` is false, any heading markers are treated as paragraph text.
 */
const parseBlockLevelElements = (
  lines: Line[],
  footnoteIds: string[],
  errors: MarkitError[],
  allowHeadings: boolean,
  headingErrorMessage = "Headings are not allowed inside block quotations.",
  textId: string,
): BlockElement[] => {
  const elements: BlockElement[] = [];

  type HeadingEntry = { level: number; line: Line };

  type ListItemEntry = {
    indent: number;
    number: number; // Item number for ordered lists (ignored for unordered)
    line: Line;
  };

  type State =
    | { kind: "none" }
    | { kind: "paragraph"; lines: Line[] }
    | { kind: "blockquote"; lines: Line[] }
    | { kind: "heading"; entries: HeadingEntry[] }
    | { kind: "list"; ordered: boolean; items: ListItemEntry[] };

  let state: State = { kind: "none" };

  const flushParagraph = (paragraphLines: Line[]): void => {
    const el = buildParagraph(paragraphLines, footnoteIds, errors, textId);
    elements.push(el);
  };

  const flushHeading = (entries: HeadingEntry[]): void => {
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

  const flushBlockquote = (bqLines: Line[]): void => {
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

    // Recursively parse inner lines as paragraphs only (no headings, no nested blockquotes)
    const innerElements = parseBlockLevelElements(
      innerLines,
      footnoteIds,
      errors,
      false,
      "Headings are not allowed inside block quotations.",
      textId,
    );

    // Only keep paragraphs inside blockquotes (headings/blockquotes inside are handled
    // by the allowHeadings=false guard; any stray other elements are dropped)
    const paragraphs = innerElements.filter(
      (el): el is Paragraph => el.type === "paragraph",
    );

    // A blockquote with no content can't happen with valid input, but could happen if
    // a blockquote only contains a heading (which is not allowed and therefore removed)
    if (paragraphs.length > 0) {
      elements.push({ type: "blockquote", content: paragraphs });
    }
  };

  const flushList = (ordered: boolean, items: ListItemEntry[]): void => {
    const list = buildList(ordered, items, footnoteIds, errors, textId);
    if (list) {
      elements.push(list);
    }
  };

  /**
   * Build a list from a flat array of list item entries.
   * Groups items by indent level and builds nested list structure.
   */
  const buildList = (
    ordered: boolean,
    items: ListItemEntry[],
    footnoteIds: string[],
    errors: MarkitError[],
    textId: string,
  ): List | null => {
    if (items.length === 0) return null;

    // Find the minimum indent level (base level for this list)
    const baseIndent = Math.min(...items.map((item) => item.indent));

    // Extract start number from first item at base indent if ordered and not 1
    const firstItemAtBase = items.find((item) => item.indent === baseIndent);
    const start =
      ordered && firstItemAtBase && firstItemAtBase.number !== 1
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
    ordered: boolean,
    items: ListItemEntry[],
    baseIndent: number,
    footnoteIds: string[],
    errors: MarkitError[],
    textId: string,
  ): ListItem[] => {
    const result: ListItem[] = [];
    let i = 0;

    while (i < items.length) {
      const item = items[i]!;

      // Skip items at lower indent (we've moved back to parent level)
      if (item.indent < baseIndent) {
        break;
      }

      // Skip items at deeper indent (they'll be processed as nested lists)
      if (item.indent > baseIndent) {
        i++;
        continue;
      }

      // Item at current indent level - parse its content
      const line = item.line;
      // Strip the list marker prefix (e.g., "- " or "1. ")
      const markerMatch = ordered
        ? /^\s*\d+\. /.exec(line.content)
        : /^\s*- /.exec(line.content);
      const markerLength = markerMatch ? markerMatch[0].length : 0;
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
        const nestedOrdered = firstNestedItem
          ? firstNestedItem.number > 0
          : false;

        const nestedList = buildList(
          nestedOrdered,
          nestedItems,
          footnoteIds,
          errors,
          textId,
        );

        if (nestedList) {
          listItem.nestedList = nestedList;
        }

        // Skip past the nested items
        i = nestedEnd;
      } else {
        i++;
      }

      result.push(listItem);
    }

    return result;
  };

  const flush = (): void => {
    if (state.kind === "paragraph") {
      flushParagraph(state.lines);
    } else if (state.kind === "blockquote") {
      flushBlockquote(state.lines);
    } else if (state.kind === "heading") {
      flushHeading(state.entries);
    } else if (state.kind === "list") {
      flushList(state.ordered, state.items);
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

    // Unordered list item
    if (classification.kind === "unorderedListItem") {
      const { indent } = classification;
      // Validate indent is a multiple of indentSize
      if (indent % listSpec.indentSize !== 0) {
        flush();
        errors.push({
          message: `List item indent must be a multiple of ${listSpec.indentSize} spaces.`,
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
        if (indent === 0 && state.ordered) {
          flush();
          state = {
            kind: "list",
            ordered: false,
            items: [{ indent, number: 0, line }],
          };
        } else {
          state.items.push({ indent, number: 0, line });
        }
      } else {
        flush();
        state = {
          kind: "list",
          ordered: false,
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
          message: `List item indent must be a multiple of ${listSpec.indentSize} spaces.`,
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
        if (indent === 0 && !state.ordered) {
          flush();
          state = {
            kind: "list",
            ordered: true,
            items: [{ indent, number, line }],
          };
        } else {
          state.items.push({ indent, number, line });
        }
      } else {
        flush();
        state = {
          kind: "list",
          ordered: true,
          items: [{ indent, number, line }],
        };
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
 * Build a paragraph from a list of non-blank content lines.
 * Returns null if there are no content lines.
 */
const buildParagraph = (
  lines: Line[],
  footnoteIds: string[],
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
