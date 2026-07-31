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
import { WRAPPER_TEI } from "./schema.ts";

/**
 * Render a compiled document's content as the body of its TEI element — the
 * walker behind `toTEIXML`: a text's blocks (footnotes excluded — they
 * re-inline at their references) followed by its structural sub-texts.
 */
const contentXml = (document: MarkitDocument): string =>
  blocksXml(document) + document.children.map(textXml).join("");

export default contentXml;

/**
 * Render a compiled root document as a TEI `<text>` element, putting back the
 * shell `fromTEIXML` flattens away: the root's own blocks are its title page,
 * a `front`/`back` sub-text is the matter around the body, a `group` stands
 * beside the body, and every other sub-text is body content.
 */
export const shellXml = (document: MarkitDocument): string => {
  const front: string[] = [];
  const body: string[] = [];
  let group = "";
  let back = "";

  const titlePage = blocksXml(document);
  if (titlePage !== "") front.push(`<div type="title_page">${titlePage}</div>`);

  for (const child of document.children) {
    switch (matterOf(child)) {
      case "front":
        front.push(contentXml(child));
        break;
      case "back":
        back += contentXml(child);
        break;
      case "group":
        group += `<group>${contentXml(child)}</group>`;
        break;
      default:
        body.push(textXml(child));
    }
  }

  const lang = metaStr(document.metadata, "lang");
  // TEI requires a body or a group; an empty <body> is the honest filler when
  // a document is nothing but front matter.
  return `<text${
    lang === undefined ? "" : ` xml:lang="${escapeAttribute(lang)}"`
  }>` +
    (front.length > 0 ? `<front>${front.join("")}</front>` : "") +
    group +
    (group !== "" && body.length === 0 ? "" : `<body>${body.join("")}</body>`) +
    (back !== "" ? `<back>${back}</back>` : "") +
    `</text>`;
};

// Where a root sub-text belongs in the shell. A `type`/`n` pair marks a
// division of the work, so it is body content whatever it is called.
const matterOf = (document: MarkitDocument): string => {
  if (
    metaStr(document.metadata, "type") !== undefined ||
    metaStr(document.metadata, "n") !== undefined
  ) return "body";
  return document.id.split(".").pop()!;
};

// A text's own blocks, footnotes excluded — they re-inline at their references.
const blocksXml = (document: MarkitDocument): string => {
  const footnotes = new Map<string, Block>();
  for (const block of document.blocks) {
    if (block.type === "footnote") footnotes.set(block.id, block);
  }
  return document.blocks
    .filter((b) => b.type !== "footnote")
    .map((b) => blockXml(b, footnotes))
    .join("");
};

const textXml = (document: MarkitDocument): string => {
  if (isHoistedRun(document)) return blocksXml(document);
  const { name, attrs } = subTextElement(document);
  return `<${name}${attrs}>${contentXml(document)}</${name}>`;
};

// A text that exists only to hold a run of blocks which could not sit after a
// sibling text (see `partitionChildren`) is not a division of the work: it has
// no metadata, no sub-texts, and `fromTEIXML` named it after the very TEI
// element its blocks came from — a `<trailer>` closing a chapter, say. Emitting
// such a text bare puts the run back where it was written, rather than inside a
// `<div>` that was never in the source.
const isHoistedRun = (document: MarkitDocument): boolean => {
  if (document.metadata !== undefined || document.children.length > 0) {
    return false;
  }
  const blocks = document.blocks.filter((b) => b.type !== "footnote");
  const id = document.id.split(".").pop()!;
  return blocks.length > 0 &&
    blocks.every((block) =>
      block.type === "paragraph" &&
      (metaStr(block.metadata, "element") ?? "p") === id
    );
};

// Infer the TEI element for a sub-text. A `type`/`n` metadata pair marks a
// `<div>`; otherwise the text's own id names the element (front/body/back/
// group/text); anything else defaults to `<div>`. An `xml:lang` is added from
// `lang` metadata.
const subTextElement = (
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
    return `<${element}>${bodyXml(block.content, footnotes)}</${element}>`;
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
    // Headings occur only in title/subtitle blocks, which blockElementBody
    // handles before this switch, so this case is unreachable.
    // deno-coverage-ignore
    case "heading":
      // deno-coverage-ignore
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

// A block's content rendered as the body of a wrapping element (a generic
// element or a footnote's <note>): a LONE bare paragraph unwraps to a
// phrase-level run; anything else renders in its native TEI form.
const bodyXml = (
  content: BlockElement[],
  footnotes: Map<string, Block>,
): string =>
  content
    .map((e) =>
      e.type === "paragraph" && content.length === 1
        ? inlineXml(e.content, footnotes)
        : blockElementXml(e, footnotes)
    )
    .join("");

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
      const { name, attrs } = WRAPPER_TEI[element.type];
      const open = (attrs ?? []).map(([k, v]) => ` ${k}="${v}"`).join("");
      return `<${name}${open}>${
        inlineXml(element.content, footnotes)
      }</${name}>`;
    }
    case "word":
      return `<w lemma="${escapeAttribute(element.word)}">${
        inlineXml(element.content, footnotes)
      }</w>`;
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
    case "tab":
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
        ? `<note place="bottom">${bodyXml(note.content, footnotes)}</note>`
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
    // `highlight` is a search artefact, never produced by compile, so this
    // case is unreachable.
    // deno-coverage-ignore
    case "highlight":
      // deno-coverage-ignore
      return inlineXml(element.content, footnotes);
  }
};

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
