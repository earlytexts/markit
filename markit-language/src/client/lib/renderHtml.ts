/**
 * The extension's own HTML renderer for the live preview and the
 * "Compile to HTML" command. Markit deliberately ships no HTML renderer —
 * presentation is a decision each consumer owns — so this is the extension's
 * copy, kept deliberately in step with the web sites' shared Preact renderer
 * (web/ui/src/components/Blocks.tsx): the same semantic classes (block IDs,
 * `entity-*`, footnote apparatus, `heading-line`s), styled by the same reading
 * conventions, so the preview looks like the published pages.
 *
 * It differs from Blocks.tsx in two ways the preview needs and the sites don't:
 * it wraps a whole document (recursing into its section `children`) rather than
 * a run of blocks, and it stamps `data-line` onto every section and block so
 * media/preview.js can sync the preview's scroll to the editor's cursor.
 */

import type {
  Block,
  BlockElement,
  HeadingLine,
  InlineElement,
  List,
  MarkitDocument,
  Table,
} from "@earlytexts/markit";

export default (document: MarkitDocument): string =>
  `<!doctype html><html><head><meta charset="UTF-8"><title>${escapeText(
    document.id,
  )}</title></head><body><div class="reading">${documentToHtml(
    document,
  )}</div></body></html>`;

const documentToHtml = (document: MarkitDocument): string => {
  const blocks = document.blocks.map(blockToHtml).join("");
  const children = document.children.map(documentToHtml).join("");
  return `<section id="${escapeAttr(document.id)}" data-line="${
    document.source?.start.line ?? 0
  }">${blocks}${children}</section>`;
};

const blockToHtml = (block: Block): string => {
  // The whole document is on one page, so anchor each block by its full id
  // (footnote references target the full id too — see inlineElementToHtml —
  // so the two line up and footnote links resolve). The visible labels below
  // still show the short, reader-facing form.
  const id = escapeAttr(block.id);
  const line = block.source?.start.line ?? 0;
  const content = block.content.map(blockElementToHtml).join("");
  switch (block.type) {
    case "title":
      return `<header id="${id}" class="titlepage" data-line="${line}">${content}</header>`;
    case "subtitle":
      return `<div id="${id}" class="subtitle" data-line="${line}">${content}</div>`;
    case "footnote":
      return `<div id="${id}" class="text-block-wrapper" data-line="${line}"><span class="block-id">${escapeText(
        footnoteLabel(lastSegment(block.id)),
      )}.</span><div class="text-block footnote">${content}</div></div>`;
    case "paragraph": {
      const subsection = metaString(block, "subsection");
      const marker =
        subsection === undefined
          ? ""
          : `<span class="subsection-marker">${escapeText(subsection)}</span>`;
      return `<div id="${id}" class="text-block-wrapper" data-line="${line}"><span class="block-id">${escapeText(
        blockLabel(block.id),
      )}</span><div class="text-block">${marker}${content}</div></div>`;
    }
  }
};

const blockElementToHtml = (element: BlockElement): string => {
  switch (element.type) {
    case "heading":
      return `<div class="heading">${element.content
        .map(headingLineToHtml)
        .join("")}</div>`;
    case "paragraph":
      return `<p>${inlineToHtml(element.content)}</p>`;
    case "blockquote":
      return `<blockquote>${element.content
        .map(blockElementToHtml)
        .join("")}</blockquote>`;
    case "stageDirection":
      return `<div class="stage-direction">${element.content
        .map(blockElementToHtml)
        .join("")}</div>`;
    case "list":
      return listToHtml(element);
    case "table":
      return tableToHtml(element);
  }
};

const listToHtml = (list: List): string => {
  const items = list.items
    .map(
      (item) =>
        `<li>${inlineToHtml(item.content)}${
          item.nestedList ? listToHtml(item.nestedList) : ""
        }</li>`,
    )
    .join("");
  switch (list.ordered) {
    case "ordered":
      return `<ol${
        list.start !== undefined ? ` start="${list.start}"` : ""
      }>${items}</ol>`;
    case "unordered":
      return `<ul>${items}</ul>`;
    case "verse":
      return `<ul class="verse">${items}</ul>`;
  }
};

const tableToHtml = (table: Table): string => {
  const head = table.hasHeader
    ? `<thead><tr>${(table.rows[0]?.cells ?? [])
        .map((cell) => `<th>${inlineToHtml(cell.content)}</th>`)
        .join("")}</tr></thead>`
    : "";
  const body = `<tbody>${table.rows
    .slice(table.hasHeader ? 1 : 0)
    .map(
      (row) =>
        `<tr>${row.cells
          .map((cell) => `<td>${inlineToHtml(cell.content)}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody>`;
  return `<table>${head}${body}</table>`;
};

const headingLineToHtml = (line: HeadingLine): string =>
  `<div class="heading-line level-${line.level}">${inlineToHtml(
    line.content,
  )}</div>`;

const inlineToHtml = (content: InlineElement[]): string =>
  content.map(inlineElementToHtml).join("");

const inlineElementToHtml = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return escapeText(element.content);
    case "lineBreak":
      return "<br />";
    case "tab":
      return "&emsp;";
    case "nbSpace":
      return "&nbsp;";
    case "illegible":
      return '<span class="illegible" title="illegible in source">[…]</span>';
    case "footnoteReference":
      return `<sup class="fnref"><a href="#${escapeAttr(element.id)}">[${escapeText(
        lastSegment(element.id),
      )}]</a></sup>`;
    case "pageBreak":
      return `<span class="pagebreak" title="${
        element.ref === undefined
          ? "page break"
          : `page ${escapeAttr(element.ref)}`
      }"></span>`;
    case "quote":
      return `<q>${inlineToHtml(element.content)}</q>`;
    case "strong":
      return `<strong>${inlineToHtml(element.content)}</strong>`;
    case "emphasis":
      return `<em>${inlineToHtml(element.content)}</em>`;
    case "superscript":
      return `<sup>${inlineToHtml(element.content)}</sup>`;
    case "subscript":
      return `<sub>${inlineToHtml(element.content)}</sub>`;
    case "aside":
      return `<span class="aside">${inlineToHtml(element.content)}</span>`;
    case "speaker":
      return `<span class="speaker">${inlineToHtml(element.content)}</span>`;
    case "stageDirection":
      return `<span class="stage-direction">${inlineToHtml(
        element.content,
      )}</span>`;
    case "insertion":
      return `<ins title="editorial insertion">${inlineToHtml(
        element.content,
      )}</ins>`;
    case "deletion":
      return `<del title="editorial deletion">${inlineToHtml(
        element.content,
      )}</del>`;
    case "uncertain":
      return `<span class="uncertain" title="uncertain reading">${inlineToHtml(
        element.content,
      )}</span>`;
    case "person":
    case "place":
    case "org":
      return `<span class="entity-${element.type}">${inlineToHtml(
        element.content,
      )}</span>`;
    case "citation":
      return `<cite>${inlineToHtml(element.content)}</cite>`;
    case "language":
      return `<span class="foreign"${
        element.lang !== undefined ? ` lang="${escapeAttr(element.lang)}"` : ""
      }>${inlineToHtml(element.content)}</span>`;
    case "highlight":
      return `<mark>${inlineToHtml(element.content)}</mark>`;
    case "word":
      return `<span class="word" data-word="${escapeAttr(element.word)}">${inlineToHtml(
        element.content,
      )}</span>`;
    case "element":
      return `<span class="element" data-tag="${escapeAttr(element.tag)}">${inlineToHtml(
        element.content,
      )}</span>`;
  }
};

const escapeText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttr = (text: string): string =>
  escapeText(text).replace(/"/g, "&quot;");

// Mirror the id helpers in web/ui's Blocks.tsx so anchors and labels line up
// with the published pages.
const lastSegment = (id: string): string => {
  const parts = id.split(/[./]/);
  return parts[parts.length - 1] ?? id;
};

const blockLabel = (id: string): string => {
  const dot = id.indexOf(".");
  return dot !== -1 ? id.slice(dot + 1) : id;
};

const footnoteLabel = (id: string): string => id.replace(/^n(?=\d)/, "");

const metaString = (block: Block, key: string): string | undefined => {
  const value = block.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};
