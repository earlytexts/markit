import compile from "../compile.js";
import type {
  Block,
  BlockElement,
  InlineElement,
  MarkitDocument,
  Metadata,
} from "../types.js";
import { decodeEntities, escapeText } from "./xml.js";
import { KEYS, markitToTeiInline } from "./schema.js";

// Convert Markit (`.mit`) source produced by `fromTEIXML` (or written by hand)
// back into TCP/TEI XML. Structural texts become their original elements (read
// from the `tei` provenance metadata), blocks become their original block
// elements, native inline elements map back to their TEI tags, and generic
// `<<TAG>>` elements are emitted verbatim. The result reproduces the original
// document up to insignificant whitespace and the added IDs.
export const toTEIXML = (mit: string): string => {
  const [document] = compile(mit);
  const prolog = metaString(document.metadata, KEYS.prolog) ?? "";
  return prolog + textToXml(document, "TEXT");
};

const textToXml = (document: MarkitDocument, fallbackName: string): string => {
  const tei = metaString(document.metadata, KEYS.tei);
  const name = tei ? tagName(tei) : fallbackName;
  const open = tei ?? fallbackName;

  // Raw-metadata children (HEADER, IDG) are stored verbatim and come first.
  const rawMeta = [KEYS.rawPrefix + "Header", KEYS.rawPrefix + "Idg"]
    .map((k) => metaString(document.metadata, k))
    .filter((v): v is string => v !== undefined)
    .join("");

  // Re-interleave blocks and sub-texts using the recorded order, if any.
  const order =
    metaString(document.metadata, KEYS.order) ??
    "b".repeat(document.blocks.length) + "t".repeat(document.children.length);

  let blockI = 0;
  let childI = 0;
  let content = "";
  for (const kind of order) {
    if (kind === "b") {
      const block = document.blocks[blockI++];
      if (block) content += blockToXml(block);
    } else {
      const child = document.children[childI++];
      if (child) content += textToXml(child, "DIV");
    }
  }

  return `<${open}>${rawMeta}${content}</${name}>`;
};

const blockToXml = (block: Block): string => {
  const comment = metaString(block.metadata, KEYS.comment);
  if (comment !== undefined) return comment;
  const inner = block.content.map(blockElementToXml).join("");
  if (metaBool(block.metadata, KEYS.bareText)) return inner;
  const tei = metaString(block.metadata, KEYS.tei);
  if (!tei) return `<P>${inner}</P>`;
  if (metaBool(block.metadata, KEYS.void) && inner === "") return `<${tei}/>`;
  return `<${tei}>${inner}</${tagName(tei)}>`;
};

const blockElementToXml = (element: BlockElement): string => {
  switch (element.type) {
    case "paragraph":
      return inlineToXml(element.content);
    case "heading":
      return element.content.map((l) => inlineToXml(l.content)).join("");
    case "blockquote":
      return element.content.map(blockElementToXml).join("");
    case "list":
      return element.items
        .map(
          (item) =>
            inlineToXml(item.content) +
            (item.nestedList ? blockElementToXml(item.nestedList) : ""),
        )
        .join("");
    case "table":
      return element.rows
        .map((row) => row.cells.map((c) => inlineToXml(c.content)).join(""))
        .join("");
  }
};

const inlineToXml = (elements: InlineElement[]): string =>
  elements.map(inlineElementToXml).join("");

const inlineElementToXml = (element: InlineElement): string => {
  switch (element.type) {
    case "plainText":
      return escapeText(element.content);
    case "element": {
      if (element.tag === KEYS.nop) return "";
      if (element.tag === KEYS.comment) {
        const v = element.attributes.find((a) => a.name === "v")?.value ?? "";
        return `<!--${decodeEntities(v)}-->`;
      }
      const attrs = element.attributes
        .map((a) => ` ${a.name}="${a.value}"`)
        .join("");
      if (element.selfClosing) return `<${element.tag}${attrs}/>`;
      return `<${element.tag}${attrs}>${inlineToXml(element.content)}</${element.tag}>`;
    }
    case "lineBreak":
      return "<LB/>";
    case "emphasis":
    case "quote":
    case "superscript":
    case "subscript": {
      const tag = markitToTeiInline(element.type)!;
      return `<${tag}>${inlineToXml(element.content)}</${tag}>`;
    }
    case "strong":
      return `<HI REND="bold">${inlineToXml(element.content)}</HI>`;
    case "aside":
      return `<NOTE PLACE="marg">${inlineToXml(element.content)}</NOTE>`;
    case "speaker":
      return `<SPEAKER>${inlineToXml(element.content)}</SPEAKER>`;
    case "insertion":
      return `<ADD>${inlineToXml(element.content)}</ADD>`;
    case "deletion":
      return `<DEL>${inlineToXml(element.content)}</DEL>`;
    case "uncertain":
      return `<UNCLEAR>${inlineToXml(element.content)}</UNCLEAR>`;
    case "person":
      return `<NAME TYPE="person">${inlineToXml(element.content)}</NAME>`;
    case "place":
      return `<NAME TYPE="place">${inlineToXml(element.content)}</NAME>`;
    case "org":
      return `<NAME TYPE="org">${inlineToXml(element.content)}</NAME>`;
    case "citation":
      return `<BIBL>${inlineToXml(element.content)}</BIBL>`;
    case "language":
      return element.lang !== undefined
        ? `<FOREIGN LANG="${element.lang}">${inlineToXml(element.content)}</FOREIGN>`
        : `<FOREIGN>${inlineToXml(element.content)}</FOREIGN>`;
    case "illegible":
      return "<GAP/>";
    case "pageBreak":
      return element.ref !== undefined ? `<PB REF="${element.ref}"/>` : "<PB/>";
    case "nbSpace":
      return "&#160;";
    case "emSpace":
      return "&#160;&#160;";
    case "footnoteReference":
      return `<REF>${element.id}</REF>`;
    /* v8 ignore next 2 -- `highlight` is a search artefact, never produced by compile */
    case "highlight":
      return inlineToXml(element.content);
  }
};

// --- helpers -------------------------------------------------------------

// The provenance string always begins with the element name (attributes, if any,
// follow a space), so the first space-delimited token is the tag name.
const tagName = (tei: string): string => tei.split(" ")[0]!;

const metaString = (
  metadata: Metadata | undefined,
  key: string,
): string | undefined => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const metaBool = (metadata: Metadata | undefined, key: string): boolean =>
  metadata?.[key] === true;

export default toTEIXML;
