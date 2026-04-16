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
    case "nbSpace":
      return " ";
    case "emSpace":
      return "  ";
    case "illegible":
      return "<illegible>";
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
    case "latin":
      return inlineElementsToText(element.content);
    case "french":
      return inlineElementsToText(element.content);
    case "speaker":
      return inlineElementsToText(element.content);
    case "aside":
      return "";
    case "insertion":
      return inlineElementsToText(element.content);
    case "deletion":
      return "";
    case "uncertain":
      return inlineElementsToText(element.content);
    case "highlight":
      return inlineElementsToText(element.content);
    case "citation":
      return `[${inlineElementsToText(element.content)}]`;
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
