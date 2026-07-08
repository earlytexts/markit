import compile from "../compile.ts";
import type {
  Block,
  BlockElement,
  Heading,
  InlineElement,
  List,
  MarkitDocument,
  Metadata,
  Table,
} from "../types.ts";
import { escapeAttribute, escapeText } from "./xml.ts";
import { metadataToHeader, type MetaObject } from "./header.ts";
import { TEI_NS, WRAPPER_TEI } from "./schema.ts";

// Convert Markit (`.mit`) source into canonical TEI P5 XML — the inverse of
// fromTei.ts. The root text becomes the `<TEI>` element (its metadata rebuilds a
// `<teiHeader>`); structural sub-texts become `<text>`/`<front>`/`<body>`/
// `<back>`/`<div>`; native Markit inline elements map back to their canonical TEI
// tags; footnote references re-inline as `<note>`; and generic `<<tag>>` elements
// are emitted verbatim. The output is standard P5, not a reproduction of any
// particular source document's chrome.
export const toTEIXML = (mit: string): string => {
  const [document] = compile(mit);
  const header = metadataToHeader(document.metadata as MetaObject | undefined);
  return `<TEI xmlns="${TEI_NS}">${header}${contentXml(document)}</TEI>`;
};

// --- Structural texts ----------------------------------------------------

// A text's blocks (footnotes excluded — they re-inline at their references)
// followed by its structural sub-texts.
const contentXml = (document: MarkitDocument): string => {
  const footnotes = new Map<string, Block>();
  for (const block of document.blocks) {
    if (block.type === "footnote") footnotes.set(block.id, block);
  }
  const blocks = document.blocks
    .filter((b) => b.type !== "footnote")
    .map((b) => blockXml(b, footnotes))
    .join("");
  const children = document.children.map(textXml).join("");
  return blocks + children;
};

const textXml = (document: MarkitDocument): string => {
  const { name, attrs } = texElement(document);
  return `<${name}${attrs}>${contentXml(document)}</${name}>`;
};

// Infer the TEI element for a sub-text. A `type`/`n` metadata pair marks a
// `<div>`; otherwise the text's own id names the element (front/body/back/
// group/text); anything else defaults to `<div>`. An `xml:lang` is added from
// `lang` metadata.
const texElement = (
  document: MarkitDocument,
): { name: string; attrs: string } => {
  const lastId = document.id.split(".").pop()!;
  const type = metaStr(document.metadata, "type");
  const n = metaStr(document.metadata, "n");
  const lang = metaStr(document.metadata, "lang");

  let name: string;
  let attrs = "";
  if (type !== undefined || n !== undefined) {
    name = "div";
    if (type !== undefined) attrs += ` type="${escapeAttribute(type)}"`;
    if (n !== undefined) attrs += ` n="${escapeAttribute(n)}"`;
  } else if (["front", "body", "back", "group", "text"].includes(lastId)) {
    name = lastId;
  } else {
    name = "div";
  }
  if (lang !== undefined) attrs += ` xml:lang="${escapeAttribute(lang)}"`;
  return { name, attrs };
};

// --- Blocks --------------------------------------------------------------

const blockXml = (block: Block, footnotes: Map<string, Block>): string => {
  if (block.type === "title" || block.type === "subtitle") {
    return `<head>${
      block.content.map((e) => blockElementBody(e, footnotes)).join("")
    }</head>`;
  }

  const element = metaStr(block.metadata, "element");
  if (element !== undefined) {
    if (block.content.length === 0) return `<${element}/>`;
    const body = block.content
      .map((e) =>
        e.type === "paragraph" && block.content.length === 1
          ? inlineXml(e.content, footnotes)
          : blockElementXml(e, footnotes)
      )
      .join("");
    return `<${element}>${body}</${element}>`;
  }

  // No wrapper: a lone paragraph becomes <p>; structural elements map natively.
  return block.content
    .map((e) =>
      e.type === "paragraph"
        ? `<p>${inlineXml(e.content, footnotes)}</p>`
        : blockElementXml(e, footnotes)
    )
    .join("");
};

// A non-paragraph block element rendered to its native TEI form.
const blockElementXml = (
  element: BlockElement,
  footnotes: Map<string, Block>,
): string => {
  switch (element.type) {
    case "paragraph":
      return `<p>${inlineXml(element.content, footnotes)}</p>`;
    /* v8 ignore next 2 -- headings occur only in title/subtitle blocks, handled by blockElementBody */
    case "heading":
      return `<head>${headingInline(element, footnotes)}</head>`;
    case "blockquote":
      // <quote> uses TEI's macro.specialPara, so any nested block element
      // (paragraphs, lists, verse, tables, nested quotes/stages) is valid.
      return `<quote>${
        element.content
          .map((e) => blockElementXml(e, footnotes))
          .join("")
      }</quote>`;
    case "stageDirection":
      // <stage> also takes macro.specialPara. Bare paragraphs are joined into a
      // single phrase-level run (no <p> wrapper); any other block element is
      // rendered in its native TEI form.
      return `<stage>${
        element.content
          .map((e) =>
            e.type === "paragraph"
              ? inlineXml(e.content, footnotes)
              : blockElementXml(e, footnotes)
          )
          .join(" ")
      }</stage>`;
    case "list":
      return listXml(element, footnotes);
    case "table":
      return tableXml(element, footnotes);
  }
};

// Like blockElementXml but without the <p> wrapper for a bare paragraph — used
// inside <head> and inside element-wrapped blocks.
const blockElementBody = (
  element: BlockElement,
  footnotes: Map<string, Block>,
): string =>
  element.type === "heading"
    ? headingInline(element, footnotes)
    : element.type === "paragraph"
    ? inlineXml(element.content, footnotes)
    : blockElementXml(element, footnotes);

const headingInline = (
  heading: Heading,
  footnotes: Map<string, Block>,
): string =>
  heading.content
    .map((line) => inlineXml(line.content, footnotes))
    .join("<lb/>");

const listXml = (list: List, footnotes: Map<string, Block>): string => {
  if (list.ordered === "verse") {
    return `<lg>${
      list.items
        .map((item) => `<l>${inlineXml(item.content, footnotes)}</l>`)
        .join("")
    }</lg>`;
  }
  const type = list.ordered === "ordered" ? ` type="ordered"` : "";
  return `<list${type}>${
    list.items
      .map(
        (item) =>
          `<item>${inlineXml(item.content, footnotes)}${
            item.nestedList ? listXml(item.nestedList, footnotes) : ""
          }</item>`,
      )
      .join("")
  }</list>`;
};

const tableXml = (table: Table, footnotes: Map<string, Block>): string =>
  `<table>${
    table.rows
      .map((row, i) => {
        const role = table.hasHeader && i === 0 ? ` role="label"` : "";
        const cells = row.cells
          .map((cell) => `<cell>${inlineXml(cell.content, footnotes)}</cell>`)
          .join("");
        return `<row${role}>${cells}</row>`;
      })
      .join("")
  }</table>`;

// --- Inline --------------------------------------------------------------

const inlineXml = (
  elements: InlineElement[],
  footnotes: Map<string, Block>,
): string => elements.map((e) => inlineElementXml(e, footnotes)).join("");

const inlineElementXml = (
  element: InlineElement,
  footnotes: Map<string, Block>,
): string => {
  switch (element.type) {
    case "plainText":
      return escapeText(element.content);
    case "quote":
    case "strong":
    case "emphasis":
    case "superscript":
    case "subscript":
    case "aside":
    case "speaker":
    case "insertion":
    case "deletion":
    case "uncertain":
    case "person":
    case "place":
    case "org":
    case "stageDirection":
    case "citation": {
      const { name, attrs } = WRAPPER_TEI[element.type]!;
      const open = (attrs ?? []).map(([k, v]) => ` ${k}="${v}"`).join("");
      return `<${name}${open}>${
        inlineXml(element.content, footnotes)
      }</${name}>`;
    }
    case "language":
      return element.lang !== undefined
        ? `<foreign xml:lang="${escapeAttribute(element.lang)}">${
          inlineXml(element.content, footnotes)
        }</foreign>`
        : `<foreign>${inlineXml(element.content, footnotes)}</foreign>`;
    case "illegible":
      return "<gap/>";
    case "nbSpace":
      return "&#160;";
    case "emSpace":
      return "&#160;&#160;";
    case "lineBreak":
      return "<lb/>";
    case "pageBreak":
      return element.ref !== undefined
        ? `<pb n="${escapeAttribute(element.ref)}"/>`
        : "<pb/>";
    case "footnoteReference": {
      const note = footnotes.get(element.id);
      return note
        ? `<note place="bottom">${noteBody(note, footnotes)}</note>`
        : `<ref>${escapeText(element.id)}</ref>`;
    }
    case "element": {
      const attrs = element.attributes
        .map((a) => ` ${a.name}="${a.value}"`)
        .join("");
      return element.selfClosing
        ? `<${element.tag}${attrs}/>`
        : `<${element.tag}${attrs}>${
          inlineXml(element.content, footnotes)
        }</${element.tag}>`;
    }
    /* v8 ignore next 2 -- `highlight` is a search artefact, never produced by compile */
    case "highlight":
      return inlineXml(element.content, footnotes);
  }
};

// A footnote block's content, rendered for inclusion inside its <note>.
const noteBody = (note: Block, footnotes: Map<string, Block>): string =>
  note.content
    .map((e) =>
      e.type === "paragraph" && note.content.length === 1
        ? inlineXml(e.content, footnotes)
        : blockElementXml(e, footnotes)
    )
    .join("");

// --- Metadata helpers ----------------------------------------------------

const metaStr = (
  metadata: Metadata | undefined,
  key: string,
): string | undefined => {
  const value = metadata?.[key];
  return typeof value === "string"
    ? value
    : typeof value === "number"
    ? String(value)
    : undefined;
};

export default toTEIXML;
