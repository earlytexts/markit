import compile from "./compile.js";
import type { Block, Element, MarkitDocument, MarkitError } from "./types.js";
import { startLine } from "./types.js";

export default (input: string): [string, MarkitError[]] => {
  const [markit, errors] = compile(input);
  return [
    `<!doctype html><html><head><meta charset="UTF-8"><title>${markit.id}</title></head><body>${textToHTML(
      markit,
    )}</body></html>`,
    errors,
  ];
};

const textToHTML = (text: MarkitDocument): string => {
  const line = text[startLine];
  const blocks = text.blocks.map(blockToHTML).join("");
  const children = text.children.map(textToHTML).join("");
  return `<section id="${text.id}" data-line="${line}">${blocks}${
    children.length > 0 ? children : ""
  }</section>`;
};

const blockToHTML = (block: Block): string => {
  const line = block[startLine];
  const innerHTML = block.id.startsWith("n")
    ? `<sup>${block.id}</sup> ${contentToHTML(block.content)}`
    : contentToHTML(block.content);
  const outerHTML = `<div data-line="${line}"><p>${innerHTML}</p></div>`;
  return outerHTML.replace(/<p><\/p>/g, "");
};

const contentToHTML = (content: ReadonlyArray<Element>): string =>
  content.map(elementToHTML).join("");

const elementToHTML = (element: Element): string => {
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
    case "heading":
      return `</p><h${element.level}>${contentToHTML(
        element.content,
      )}</h${element.level}><p>`;
    case "footnoteReference":
      return `<a href="#footnote-${element.id}" id="footnote-ref-${element.id}"><sup>${element.id}</sup></a>`;
    case "strong":
      return `<strong>${contentToHTML(element.content)}</strong>`;
    case "emphasis":
      return `<em>${contentToHTML(element.content)}</em>`;
    case "quote":
      return `<q>${contentToHTML(element.content)}</q>`;
    case "blockquote":
      return `</p><blockquote>${contentToHTML(
        element.content,
      )}</blockquote><p>`;
    case "foreign":
      return `<em class="foreign">${contentToHTML(element.content)}</em>`;
    case "greek":
      return `<em class="greek">${contentToHTML(element.content)}</em>`;
    case "aside":
      return `<span class="aside">${contentToHTML(element.content)}</span>`;
    case "insertion":
      return `<ins>${contentToHTML(element.content)}</ins>`;
    case "deletion":
      return `<del>${contentToHTML(element.content)}</del>`;
    case "citation":
      return `<cite>${contentToHTML(element.content)}</cite>`;
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
