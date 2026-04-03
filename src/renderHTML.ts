import type { Block, Element, MarkitDocument } from "./types.js";
import { startLine } from "./types.js";

export default (document: MarkitDocument): string => {
  return `<!doctype html><html><head><meta charset="UTF-8"><title>${document.id}</title></head><body>${documentToHTML(
    document,
  )}</body></html>`;
};

const documentToHTML = (document: MarkitDocument): string => {
  const line = document[startLine];
  const blocks = document.blocks.map(blockToHTML).join("");
  const children = document.children.map(documentToHTML).join("");
  return `<section id="${document.id}" data-line="${line}">${blocks}${
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

const contentToHTML = (content: Element[]): string =>
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
