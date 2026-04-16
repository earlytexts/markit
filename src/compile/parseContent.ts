import type {
  Block,
  BlockElement,
  BlockType,
  Heading,
  HeadingLine,
  MarkitDocument,
  MarkitError,
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

  type State =
    | { kind: "none" }
    | { kind: "paragraph"; lines: Line[] }
    | { kind: "blockquote"; lines: Line[] }
    | { kind: "heading"; entries: HeadingEntry[] };

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

  const flush = (): void => {
    if (state.kind === "paragraph") {
      flushParagraph(state.lines);
    } else if (state.kind === "blockquote") {
      flushBlockquote(state.lines);
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
