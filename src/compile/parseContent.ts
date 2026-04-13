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
  Metadata,
  Paragraph,
} from "../types.js";
import {
  blockquoteSpec,
  endLine,
  footnoteReferenceSpec,
  startLine,
} from "../types.js";
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
export default <TextMetadata extends Metadata>(
  tree: TextTreeWithMetadata<TextMetadata>,
  externalChildren: MarkitDocument<TextMetadata>[] = [],
): [MarkitDocument<TextMetadata>, MarkitError[]] => {
  return parseTextContent(tree, externalChildren, {} as TextMetadata);
};

const parseTextContent = <TextMetadata extends Metadata>(
  text: TextTreeWithMetadata<TextMetadata>,
  externalChildren: MarkitDocument<TextMetadata>[] = [],
  parentMetadata: TextMetadata,
): [MarkitDocument<TextMetadata>, MarkitError[]] => {
  // Get footnote reference ids to validate footnote references
  const footnoteIds = text.blocks
    .filter((b) => footnoteReferenceSpec.pattern.test(b.id))
    .map((b) => b.id);

  // Parse content for each block
  const blockResults = text.blocks.map((block) =>
    parseBlockContent(block, footnoteIds),
  );
  const blocks = blockResults.map((result) => result[0]);
  const blockErrors = blockResults.flatMap((result) => result[1]);

  // Merge parent metadata with this text's own metadata (child overrides parent)
  const mergedMetadata = { ...parentMetadata, ...text.metadata };

  // Parse blocks for all internal children recursively, passing merged metadata down
  const childResults = text.children.map((child) =>
    parseTextContent(child, [], mergedMetadata),
  );
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);

  // Put it all together
  const document = {
    ...mergedMetadata,
    id: text.id,
    blocks,
    children: [...children, ...externalChildren],
    [startLine]: text.startLine,
    [endLine]: text.endLine,
  } as MarkitDocument<TextMetadata>;

  return [document, [...blockErrors, ...childErrors]];
};

const parseBlockContent = (
  block: BlockWithMetadata,
  footnoteIds: string[],
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
  );

  const parsedBlock: Block = {
    ...block.metadata,
    id: block.id,
    type: blockType,
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
): BlockElement[] => {
  const elements: BlockElement[] = [];

  type HeadingEntry = { level: number; line: Line };

  type State =
    | { kind: "none" }
    | { kind: "paragraph"; lines: Line[] }
    | { kind: "blockquote"; lines: Line[] }
    | { kind: "list"; ordered: boolean; lines: Line[] }
    | { kind: "heading"; entries: HeadingEntry[] };

  let state: State = { kind: "none" };

  const flushParagraph = (paragraphLines: Line[]): void => {
    const el = buildParagraph(paragraphLines, footnoteIds, errors);
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
      );
      errors.push(...inlineErrors);
      return { type: "headingLine", level, content: inlineContent };
    });
    const heading: Heading = { type: "heading", content: parsedLines };
    elements.push(heading);
  };

  const flushList = (listLines: Line[], ordered: boolean): void => {
    const items: ListItem[] = listLines.map((line) => {
      const prefixLen = ordered ? line.content.match(/^\d+\. /)![0]!.length : 2; // "- "
      const itemContent = line.content.slice(prefixLen);
      const posMap = buildPositionMap([
        {
          lineNumber: line.lineNumber,
          charOffset: line.charOffset + prefixLen,
          content: itemContent,
        },
      ]);
      const [inlineContent, inlineErrors] = parseElements(
        itemContent,
        posMap,
        footnoteIds,
      );
      errors.push(...inlineErrors);
      return { type: "listItem", content: inlineContent };
    });
    elements.push({ type: "list", ordered, content: items });
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
    );

    // Only keep paragraphs and lists inside blockquotes (headings/blockquotes inside are handled
    // by the allowHeadings=false guard; any stray other elements are dropped)
    const paragraphsAndLists = innerElements.filter(
      (el): el is Paragraph | List =>
        el.type === "paragraph" || el.type === "list",
    );

    // A blockquote with no content can't happen with valid input, but could happen if
    // a blockquote only contains a heading (which is not allowed and therefore removed)
    if (paragraphsAndLists.length > 0) {
      elements.push({ type: "blockquote", content: paragraphsAndLists });
    }
  };

  const flush = (): void => {
    if (state.kind === "paragraph") {
      flushParagraph(state.lines);
    } else if (state.kind === "blockquote") {
      flushBlockquote(state.lines);
    } else if (state.kind === "list") {
      flushList(state.lines, state.ordered);
    } else if (state.kind === "heading") {
      flushHeading(state.entries);
    }
    state = { kind: "none" };
  };

  for (const line of lines) {
    const content = line.content;

    // Blank line
    if (content === "") {
      flush();
      continue;
    }

    // Heading line: ^ followed by a digit 1-6 and a space
    const headingMatch = /^\^([1-6]) /.exec(content);
    if (headingMatch) {
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
        const level = parseInt(headingMatch[1]!, 10);
        if (state.kind === "heading") {
          state.entries.push({ level, line });
        } else {
          flush();
          state = { kind: "heading", entries: [{ level, line }] };
        }
      }
      continue;
    }

    // Blockquote line: starts with >
    if (content.startsWith(blockquoteSpec.marker)) {
      if (state.kind !== "blockquote") {
        flush();
        state = { kind: "blockquote", lines: [line] };
      } else {
        state.lines.push(line);
      }
      continue;
    }

    // Unordered list line: starts with "- " (bare "-" falls through to paragraph)
    if (content.startsWith("- ")) {
      if (state.kind === "list" && !state.ordered) {
        state.lines.push(line);
      } else {
        flush();
        state = { kind: "list", ordered: false, lines: [line] };
      }
      continue;
    }

    // Ordered list line: starts with digits + ". " (e.g. "1. ", "12. ")
    if (/^\d+\. /.test(content)) {
      if (state.kind === "list" && state.ordered) {
        state.lines.push(line);
      } else {
        flush();
        state = { kind: "list", ordered: true, lines: [line] };
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
  );
  errors.push(...inlineErrors);

  return { type: "paragraph", content: inlineContent };
};
