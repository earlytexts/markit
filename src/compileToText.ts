import compile from "./compile.js";
import type { Block, Element, MarkitDocument, MarkitError } from "./types.js";

export default (input: string): [string, MarkitError[]] => {
  const [markit, errors] = compile(input);
  return [markitToText(markit) + "\n", errors];
};

const markitToText = (markit: MarkitDocument): string => {
  const blocks = markit.blocks.map(blockToText).join("\n\n");
  const children = markit.children.map(markitToText).join("\n\n");
  return `${blocks}${children ? `\n\n${children}` : ""}`;
};

const blockToText = (block: Block): string =>
  block.id.startsWith("n")
    ? `[^${block.id}]: ${contentToText(block.content)}`.trim()
    : contentToText(block.content).trim();

const contentToText = (content: ReadonlyArray<Element>): string =>
  content.map(elementToText).join("");

const elementToText = (element: Element): string => {
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
    case "heading":
      return `${contentToText(element.content)}\n\n`;
    case "footnoteReference":
      return `<${element.id}>`;
    case "strong":
      return contentToText(element.content);
    case "emphasis":
      return contentToText(element.content);
    case "quote":
      return `"${contentToText(element.content)}"`;
    case "blockquote":
      return `\n\n    ${contentToText(element.content)}\n\n`;
    case "foreign":
      return contentToText(element.content);
    case "greek":
      return contentToText(element.content);
    case "aside":
      return "";
    case "insertion":
      return contentToText(element.content);
    case "deletion":
      return "";
    case "citation":
      return `[${contentToText(element.content)}]`;
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
