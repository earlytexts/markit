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
      if (element.ordered === "verse") {
        const lines = element.items
          .map(
            (item) => `<p class="l">${inlineElementsToHTML(item.content)}</p>`,
          )
          .join("");
        return `<div class="lg">${lines}</div>`;
      }
      const tag = element.ordered === "ordered" ? "ol" : "ul";
      const startAttr =
        element.ordered === "ordered" && element.start !== undefined
          ? ` start="${element.start}"`
          : "";
      const items = element.items
        .map((item) => {
          const content = inlineElementsToHTML(item.content);
          const nested = item.nestedList
            ? blockElementToHTML(item.nestedList, null, depth)
            : "";
          return `<li>${content}${nested}</li>`;
        })
        .join("");
      return `<${tag}${startAttr}>${items}</${tag}>`;
    }
    case "table": {
      const headerRow =
        element.hasHeader && element.rows.length > 0 ? element.rows[0] : null;
      const dataRows = element.hasHeader ? element.rows.slice(1) : element.rows;

      const theadHTML = headerRow
        ? `<thead><tr>${headerRow.cells
            .map((cell) => `<th>${inlineElementsToHTML(cell.content)}</th>`)
            .join("")}</tr></thead>`
        : "";

      const tbodyHTML = `<tbody>${dataRows
        .map(
          (row) =>
            `<tr>${row.cells
              .map((cell) => `<td>${inlineElementsToHTML(cell.content)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;

      return `<table>${theadHTML}${tbodyHTML}</table>`;
    }
  }
};

const inlineElementsToHTML = (content: InlineElement[]): string =>
  content.map(inlineElementToHTML).join("");

const inlineElementToHTML = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return element.content.replace(/&/g, "&amp;");
    case "nbSpace":
      return "&nbsp;";
    case "emSpace":
      return "&emsp;";
    case "lineBreak":
      return "<br />";
    case "illegible":
      return '<span class="illegible">&lt;illegible&gt;</span>';
    case "footnoteReference":
      return `<a href="#footnote-${element.id}" id="footnote-ref-${element.id}"><sup>${element.id}</sup></a>`;
    case "quote":
      return `<q>${inlineElementsToHTML(element.content)}</q>`;
    case "strong":
      return `<strong>${inlineElementsToHTML(element.content)}</strong>`;
    case "emphasis":
      return `<em>${inlineElementsToHTML(element.content)}</em>`;
    case "superscript":
      return `<sup>${inlineElementsToHTML(element.content)}</sup>`;
    case "subscript":
      return `<sub>${inlineElementsToHTML(element.content)}</sub>`;
    case "aside":
      return `<span class="aside">${inlineElementsToHTML(element.content)}</span>`;
    case "speaker":
      return `<span class="speaker">${inlineElementsToHTML(element.content)}</span>`;
    case "insertion":
      return `<ins>${inlineElementsToHTML(element.content)}</ins>`;
    case "deletion":
      return `<del>${inlineElementsToHTML(element.content)}</del>`;
    case "uncertain":
      return `<span class="uncertain">${inlineElementsToHTML(element.content)}</span>`;
    case "person":
      return `<span class="person">${inlineElementsToHTML(element.content)}</span>`;
    case "place":
      return `<span class="place">${inlineElementsToHTML(element.content)}</span>`;
    case "org":
      return `<span class="org">${inlineElementsToHTML(element.content)}</span>`;
    case "citation":
      return `<cite>${inlineElementsToHTML(element.content)}</cite>`;
    case "language":
      return element.lang !== undefined
        ? `<em lang="${element.lang}">${inlineElementsToHTML(element.content)}</em>`
        : `<em class="foreign">${inlineElementsToHTML(element.content)}</em>`;
    case "pageBreak":
      return element.ref !== undefined
        ? `<span class="pageBreak" data-ref="${element.ref}"></span>`
        : `<span class="pageBreak"></span>`;
    case "highlight":
      return `<mark>${inlineElementsToHTML(element.content)}</mark>`;
    /* v8 ignore next 2 */
    default:
      return element satisfies never;
  }
};
