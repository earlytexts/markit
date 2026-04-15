import type {
  Block,
  BlockElement,
  InlineElement,
  MarkitDocument,
} from "./types.js";
import { startLine } from "./types.js";

export default (document: MarkitDocument): string => {
  return `<!doctype html><html><head><meta charset="UTF-8"><title>${document.id}</title></head><body>${documentToHTML(
    document,
  )}</body></html>`;
};

const documentToHTML = (
  document: MarkitDocument,
  depth: number = 0,
): string => {
  const line = document[startLine];
  const blocks = document.blocks
    .map((block) => blockToHTML(block, depth))
    .join("");
  const children = document.children
    .map((child) => documentToHTML(child, depth + 1))
    .join("");
  return `<section id="${document.id}" data-line="${line}">${blocks}${
    children.length > 0 ? children : ""
  }</section>`;
};

const blockToHTML = (block: Block, depth: number): string => {
  const line = block[startLine];
  const headingDepth = block.type === "subtitle" ? depth + 1 : depth;
  const footnoteId = block.type === "footnote" ? block.id : null;
  const inner = block.content
    .map((el) => blockElementToHTML(el, footnoteId, headingDepth))
    .join("");
  return `<div data-line="${line}">${inner}</div>`;
};

const blockElementToHTML = (
  element: BlockElement,
  footnotePrefix: string | null,
  depth: number,
): string => {
  switch (element.type) {
    case "paragraph": {
      const fnPrefix =
        footnotePrefix !== null ? `<sup>${footnotePrefix}</sup> ` : "";
      return `<p>${fnPrefix}${inlineElementsToHTML(element.content)}</p>`;
    }
    case "heading": {
      const hLevel = Math.min(depth + 1, 6);
      const inner = element.content
        .map(
          (l) =>
            `<span class="size-${l.level}">${inlineElementsToHTML(l.content)}</span>`,
        )
        .join("");
      return `<h${hLevel}>${inner}</h${hLevel}>`;
    }
    case "blockquote":
      return `<blockquote>${element.content
        .map((el) => blockElementToHTML(el, null, depth))
        .join("")}</blockquote>`;
    case "list": {
      const tag = element.ordered ? "ol" : "ul";
      return `<${tag}>${element.content
        .map((item) => `<li>${inlineElementsToHTML(item.content)}</li>`)
        .join("")}</${tag}>`;
    }
  }
};

const inlineElementsToHTML = (content: InlineElement[]): string =>
  content.map(inlineElementToHTML).join("");

const inlineElementToHTML = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return element.content.replace(/&/g, "&amp;");
    case "lineBreak":
      return "<br />";
    case "pageBreak":
      return '<span class="page-break">|</span>';
    case "nbSpace":
      return "&nbsp;";
    case "emSpace":
      return "&emsp;";
    case "illegible":
      return '<span class="illegible">&lt;illegible&gt;</span>';
    case "footnoteReference":
      return `<a href="#footnote-${element.id}" id="footnote-ref-${element.id}"><sup>${element.id}</sup></a>`;
    case "strong":
      return `<strong>${inlineElementsToHTML(element.content)}</strong>`;
    case "emphasis":
      return `<em>${inlineElementsToHTML(element.content)}</em>`;
    case "quote":
      return `<q>${inlineElementsToHTML(element.content)}</q>`;
    case "foreign":
      return `<em class="foreign">${inlineElementsToHTML(element.content)}</em>`;
    case "greek":
      return `<em class="greek">${inlineElementsToHTML(element.content)}</em>`;
    case "latin":
      return `<em class="latin">${inlineElementsToHTML(element.content)}</em>`;
    case "french":
      return `<em class="french">${inlineElementsToHTML(element.content)}</em>`;
    case "aside":
      return `<span class="aside">${inlineElementsToHTML(element.content)}</span>`;
    case "insertion":
      return `<ins>${inlineElementsToHTML(element.content)}</ins>`;
    case "deletion":
      return `<del>${inlineElementsToHTML(element.content)}</del>`;
    case "uncertain":
      return `<span class="uncertain">${inlineElementsToHTML(element.content)}</span>`;
    case "highlight":
      return `<mark>${inlineElementsToHTML(element.content)}</mark>`;
    case "citation":
      return `<cite>${inlineElementsToHTML(element.content)}</cite>`;
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
