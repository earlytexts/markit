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
  let blockPrefix = "";
  if (block.type === "paragraph") {
    if (typeof block.subsection === "string") {
      blockPrefix += `${block.subsection}. `;
    }
    if (typeof block.speaker === "string") {
      blockPrefix += `${block.speaker}. `;
    }
  }
  const parts = block.content.map((el, i) =>
    blockElementToText(el, footnoteId, i === 0 ? blockPrefix : ""),
  );
  return parts.join("\n\n").trim();
};

const blockElementToText = (
  element: BlockElement,
  footnoteId: string | null,
  blockPrefix: string = "",
): string => {
  switch (element.type) {
    case "paragraph": {
      const text = inlineElementsToText(element.content);
      return footnoteId !== null
        ? `[^${footnoteId}]: ${blockPrefix}${text}`
        : `${blockPrefix}${text}`;
    }
    case "heading":
      return element.content
        .map((l) => inlineElementsToText(l.content))
        .join("\n");
    case "blockquote":
      return element.content
        .map(
          (el, i) =>
            `    ${blockElementToText(el, null, i === 0 ? blockPrefix : "")}`,
        )
        .join("\n\n");
    case "list":
      return element.content
        .map((item, i) =>
          element.ordered
            ? `${i + 1}. ${i === 0 ? blockPrefix : ""}${inlineElementsToText(item.content)}`
            : `${i === 0 ? blockPrefix : ""}${inlineElementsToText(item.content)}`,
        )
        .join("\n");
  }
};

const inlineElementsToText = (content: InlineElement[]): string =>
  content.map(inlineElementToText).join("");

const inlineElementToText = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return element.content;
    case "lineBreak":
      return "\n";
    case "pageBreak":
      return "|";
    case "nbSpace":
      return " ";
    case "emSpace":
      return "  ";
    case "footnoteReference":
      return `<${element.id}>`;
    case "strong":
      return inlineElementsToText(element.content);
    case "emphasis":
      return inlineElementsToText(element.content);
    case "quote":
      return `"${inlineElementsToText(element.content)}"`;
    case "foreign":
      return inlineElementsToText(element.content);
    case "greek":
      return inlineElementsToText(element.content);
    case "aside":
      return "";
    case "insertion":
      return inlineElementsToText(element.content);
    case "deletion":
      return "";
    case "highlight":
      return inlineElementsToText(element.content);
    case "citation":
      return `[${inlineElementsToText(element.content)}]`;
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
