import type {
  Block,
  BlockElement,
  InlineElement,
  List,
  MarkitDocument,
  SourcePosition,
  Table,
} from "./types.ts";

/**
 * Rendered text paired with, per character, the source position it came from (or
 * `null` for synthetic characters — separators, wrapper furniture, and the
 * spaces/tabs leaf elements render to). `sources` always has one entry per
 * character of `text`. Source positions are present only when the document was
 * compiled with `{ tokens: true }` (so its `plainText` nodes carry `sources`);
 * otherwise every entry is `null`. Consumed by `tokenize`.
 */
export type Sourced = { text: string; sources: (SourcePosition | null)[] };

/** Like the default export, but each character of the result carries its source position; see `Sourced`. */
export const renderSourced = (document: MarkitDocument): Sourced =>
  concat([documentToText(document), raw("\n")]);

/**
 * Render a compiled document to its plain-text projection: block-level
 * structure becomes blank-line separation and indentation, and inline
 * elements render to the text a reader would see (wrapper furniture such as
 * emphasis markers is dropped; quotes keep their `"..."`, citations their
 * `[...]`).
 */
export default (document: MarkitDocument): string =>
  renderSourced(document).text;

const documentToText = (document: MarkitDocument): Sourced => {
  const blocks = join(document.blocks.map(blockToText), "\n\n");
  const children = join(document.children.map(documentToText), "\n\n");
  return children.text ? concat([blocks, raw("\n\n"), children]) : blocks;
};

const blockToText = (block: Block): Sourced => {
  const footnoteId = block.type === "footnote" ? block.id : null;
  const parts = block.content.map((el) => blockElementToText(el, footnoteId));
  return trim(join(parts, "\n\n"));
};

const blockElementToText = (
  element: BlockElement,
  footnoteId: string | null,
): Sourced => {
  switch (element.type) {
    case "paragraph": {
      const text = inlineElementsToText(element.content);
      return footnoteId !== null
        ? concat([raw(`[^${footnoteId}]: `), text])
        : text;
    }
    case "heading":
      return join(
        element.content.map((l) => inlineElementsToText(l.content)),
        "\n",
      );
    case "blockquote":
      return join(
        element.content.map((el) =>
          indentLines(blockElementToText(el, null), "    ")
        ),
        "\n\n",
      );
    case "stageDirection":
      return join(
        element.content.map((el) => blockElementToText(el, null)),
        "\n\n",
      );
    case "list":
      return listToText(element, 0, element.start ?? 1);
    case "table":
      return tableToText(element);
  }
};

const listToText = (
  list: List,
  indentLevel: number,
  startNumber: number,
): Sourced => {
  if (list.ordered === "verse") {
    return join(
      list.items.map((item) =>
        concat([raw("* "), inlineElementsToText(item.content)])
      ),
      "\n",
    );
  }
  const indent = "  ".repeat(indentLevel);
  let currentNumber = startNumber;
  return join(
    list.items.map((item) => {
      const marker = list.ordered === "ordered" ? `${currentNumber++}. ` : "- ";
      const content = inlineElementsToText(item.content);
      const nested = item.nestedList
        ? concat([
          raw("\n"),
          listToText(
            item.nestedList,
            indentLevel + 1,
            item.nestedList.start ?? 1,
          ),
        ])
        : raw("");
      return concat([raw(`${indent}${marker}`), content, nested]);
    }),
    "\n",
  );
};

const tableToText = (table: Table): Sourced =>
  join(
    table.rows.map((row) =>
      join(row.cells.map((cell) => inlineElementsToText(cell.content)), " | ")
    ),
    "\n",
  );

const inlineElementsToText = (content: InlineElement[]): Sourced =>
  concat(content.map(inlineElementToText));

const inlineElementToText = (element: InlineElement): Sourced => {
  switch (element.type) {
    case "plainText": {
      const sources = element.sources ??
        new Array<SourcePosition | null>(element.content.length).fill(null);
      return { text: element.content, sources };
    }
    case "nbSpace":
      return raw(" ");
    case "tab":
      return raw("\t");
    case "lineBreak":
      return raw("\n");
    case "illegible":
      return raw("<illegible>");
    case "footnoteReference":
      return raw(`<${element.id}>`);
    case "quote":
      return concat([
        raw('"'),
        inlineElementsToText(element.content),
        raw('"'),
      ]);
    case "strong":
      return inlineElementsToText(element.content);
    case "emphasis":
      return inlineElementsToText(element.content);
    case "superscript":
      return inlineElementsToText(element.content);
    case "subscript":
      return inlineElementsToText(element.content);
    case "aside":
      return raw("");
    case "speaker":
      return inlineElementsToText(element.content);
    case "stageDirection":
      return inlineElementsToText(element.content);
    case "insertion":
      return inlineElementsToText(element.content);
    case "deletion":
      return raw("");
    case "uncertain":
      return inlineElementsToText(element.content);
    case "person":
      return inlineElementsToText(element.content);
    case "place":
      return inlineElementsToText(element.content);
    case "org":
      return inlineElementsToText(element.content);
    case "citation":
      return concat([
        raw("["),
        inlineElementsToText(element.content),
        raw("]"),
      ]);
    case "word":
      return inlineElementsToText(element.content);
    case "language":
      return inlineElementsToText(element.content);
    case "pageBreak":
      // A tight break falls inside a word (renders to nothing, joining its two
      // sides); a loose break is a word boundary, so it renders a space.
      return raw(element.tight ? "" : " ");
    case "highlight":
      return inlineElementsToText(element.content);
    case "element":
      return inlineElementsToText(element.content);
    // deno-coverage-ignore
    default:
      // deno-coverage-ignore
      return raw(element satisfies never);
  }
};

/* -------------------------- sourced-string helpers ------------------------- */

/** Literal text with no source (synthetic characters). */
const raw = (text: string): Sourced => ({
  text,
  sources: new Array<SourcePosition | null>(text.length).fill(null),
});

/** Concatenate sourced parts, keeping every character's source aligned. */
const concat = (parts: Sourced[]): Sourced => {
  let text = "";
  const sources: (SourcePosition | null)[] = [];
  for (const part of parts) {
    text += part.text;
    for (const source of part.sources) sources.push(source);
  }
  return { text, sources };
};

/** Join sourced parts with a synthetic separator. */
const join = (parts: Sourced[], separator: string): Sourced => {
  const withSeparators: Sourced[] = [];
  parts.forEach((part, index) => {
    if (index > 0) withSeparators.push(raw(separator));
    withSeparators.push(part);
  });
  return concat(withSeparators);
};

/** Trim leading and trailing whitespace, keeping sources aligned. */
const trim = (sourced: Sourced): Sourced => {
  const leading = sourced.text.length - sourced.text.trimStart().length;
  const end = sourced.text.trimEnd().length;
  return {
    text: sourced.text.slice(leading, end),
    sources: sourced.sources.slice(leading, end),
  };
};

/** Prefix every non-empty line with `prefix`, keeping sources aligned. */
const indentLines = (sourced: Sourced, prefix: string): Sourced =>
  join(
    splitLines(sourced).map((line) =>
      line.text === "" ? line : concat([raw(prefix), line])
    ),
    "\n",
  );

/** Split on newlines, keeping each line's sources. */
const splitLines = (sourced: Sourced): Sourced[] => {
  const lines: Sourced[] = [];
  let start = 0;
  for (let i = 0; i <= sourced.text.length; i++) {
    if (i === sourced.text.length || sourced.text[i] === "\n") {
      lines.push({
        text: sourced.text.slice(start, i),
        sources: sourced.sources.slice(start, i),
      });
      start = i + 1;
    }
  }
  return lines;
};
