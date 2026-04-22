import type {
  Block,
  BlockElement,
  InlineElement,
  MarkitDocument,
} from "./types.js";

export default (document: MarkitDocument): string =>
  documentToText(document) + "\n";

const documentToText = (document: MarkitDocument): string => {
  const blocks = document.blocks.map(blockToText).join("\n\n");
  const children = document.children.map(documentToText).join("\n\n");
  return `${blocks}${children ? `\n\n${children}` : ""}`;
};

const blockToText = (block: Block): string => {
  const footnoteId = block.type === "footnote" ? block.id : null;
  const parts = block.content.map((el) => blockElementToText(el, footnoteId));
  return parts.join("\n\n").trim();
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
        .map((el) => `    ${blockElementToText(el, null)}`)
        .join("\n\n");
    case "list":
      return listToText(element, 0, element.start ?? 1);
    case "table":
      return tableToText(element);
  }
};

const tableToText = (table: import("./types.js").Table): string => {
  // Render table as plain text with simple formatting
  return table.rows
    .map((row) => {
      const cells = row.cells.map((cell) => inlineElementsToText(cell.content));
      return cells.join(" | ");
    })
    .join("\n");
};

const listToText = (
  list: import("./types.js").List,
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

const inlineElementsToText = (content: InlineElement[]): string =>
  content.map(inlineElementToText).join("");

const inlineElementToText = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return element.content;
    case "nbSpace":
      return " ";
    case "emSpace":
      return "  ";
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
    case "language":
      return inlineElementsToText(element.content);
    case "pageBreak":
      return "";
    case "highlight":
      return inlineElementsToText(element.content);
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
