import type {
  Block,
  BlockElement,
  InlineElement,
  List,
  MarkitDocument,
  Table,
} from "./types.ts";

/**
 * Render a compiled document to its plain-text projection: block-level
 * structure becomes blank-line separation and indentation, and inline
 * elements render to the text a reader would see (wrapper furniture such as
 * emphasis markers is dropped; quotes keep their `"..."`, citations their
 * `[...]`).
 *
 * This is the DISPLAY projection, and is not for analysis: string furniture
 * (quote marks, citation brackets, `<illegible>` markers, footnote anchors)
 * stays in the output. Extraction and tokenisation go through `extractText`
 * and `tokenize`, which drop all furniture and carry provenance.
 */
export default (document: MarkitDocument): string =>
  documentToText(document) + "\n";

const documentToText = (document: MarkitDocument): string => {
  const blocks = document.blocks.map(blockToText).join("\n\n");
  const children = document.children.map(documentToText).join("\n\n");
  return children ? `${blocks}\n\n${children}` : blocks;
};

const blockToText = (block: Block): string => {
  const footnoteId = block.type === "footnote" ? block.id : null;
  return block.content
    .map((el) => blockElementToText(el, footnoteId))
    .join("\n\n")
    .trim();
};

const blockElementToText = (
  element: BlockElement,
  footnoteId: string | null,
): string => {
  switch (element.type) {
    case "paragraph": {
      const text = inlineElementsToText(element.content);
      return footnoteId !== null ? `[^${footnoteId}]: ${text}` : text;
    }
    case "heading":
      return element.content
        .map((l) => inlineElementsToText(l.content))
        .join("\n");
    case "blockquote":
      return element.content
        .map((el) => indentLines(blockElementToText(el, null), "    "))
        .join("\n\n");
    case "stageDirection":
      return element.content
        .map((el) => blockElementToText(el, null))
        .join("\n\n");
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
): string => {
  if (list.ordered === "verse") {
    return list.items
      .map((item) => `* ${inlineElementsToText(item.content)}`)
      .join("\n");
  }
  const indent = "  ".repeat(indentLevel);
  let currentNumber = startNumber;
  return list.items
    .map((item) => {
      const marker = list.ordered === "ordered" ? `${currentNumber++}. ` : "- ";
      const content = inlineElementsToText(item.content);
      const nested = item.nestedList
        ? "\n" +
          listToText(
            item.nestedList,
            indentLevel + 1,
            item.nestedList.start ?? 1,
          )
        : "";
      return `${indent}${marker}${content}${nested}`;
    })
    .join("\n");
};

const tableToText = (table: Table): string =>
  table.rows
    .map((row) =>
      row.cells.map((cell) => inlineElementsToText(cell.content)).join(" | ")
    )
    .join("\n");

const inlineElementsToText = (content: InlineElement[]): string =>
  content.map(inlineElementToText).join("");

const inlineElementToText = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return element.content;
    case "nbSpace":
      return "\u00A0";
    case "tab":
      return "\t";
    case "lineBreak":
      return "\n";
    case "illegible":
      return "<illegible>";
    case "footnoteReference":
      return `<${element.id}>`;
    case "quote":
      return `"${inlineElementsToText(element.content)}"`;
    case "strong":
      return inlineElementsToText(element.content);
    case "emphasis":
      return inlineElementsToText(element.content);
    case "superscript":
      return inlineElementsToText(element.content);
    case "subscript":
      return inlineElementsToText(element.content);
    case "aside":
      return "";
    case "speaker":
      return inlineElementsToText(element.content);
    case "stageDirection":
      return inlineElementsToText(element.content);
    case "insertion":
      return inlineElementsToText(element.content);
    case "deletion":
      return "";
    case "uncertain":
      return inlineElementsToText(element.content);
    case "person":
      return inlineElementsToText(element.content);
    case "place":
      return inlineElementsToText(element.content);
    case "org":
      return inlineElementsToText(element.content);
    case "citation":
      return `[${inlineElementsToText(element.content)}]`;
    case "word":
      return inlineElementsToText(element.content);
    case "language":
      return inlineElementsToText(element.content);
    case "pageBreak":
      // A tight break falls inside a word (renders to nothing, joining its two
      // sides); a loose break is a word boundary, so it renders a space.
      return element.tight ? "" : " ";
    case "highlight":
      return inlineElementsToText(element.content);
    case "element":
      return inlineElementsToText(element.content);
    // deno-coverage-ignore
    default:
      // deno-coverage-ignore
      return element satisfies never;
  }
};

/** Prefix every non-empty line with `prefix`. */
const indentLines = (text: string, prefix: string): string =>
  text
    .split("\n")
    .map((line) => (line === "" ? line : `${prefix}${line}`))
    .join("\n");
