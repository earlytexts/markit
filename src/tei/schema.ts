// The P5 TEI schema adapter. This isolates everything specific to the shape of
// the XML, so the two walkers (fromTei.ts / toTei.ts) stay readable. It targets
// standard TEI P5 as published by the Text Creation Partnership: the TEI
// namespace, lowercase element names, a <teiHeader>, and a
// <text>/<front>/<body>/<back>/<div> body. The mapping favours native Markit
// features and reserves the generic <<tag>> escape hatch for the long tail.

import { attr, localName, type XmlElement } from "./xml.js";

// The TEI P5 namespace, re-emitted on the root element by toTei.
export const TEI_NS = "http://www.tei-c.org/ns/1.0";

// Elements that carry document structure and become nested Markit texts.
export const STRUCTURAL = new Set([
  "text",
  "group",
  "front",
  "body",
  "back",
  "div",
]);

// Block-level semantic wrappers with no native Markit block type. They become a
// plain paragraph block tagged with a single readable `element` metadata key
// (e.g. `{#3, element="trailer"}`), which toTei turns back into the wrapper.
export const SEMANTIC_BLOCKS = new Set([
  "trailer",
  "closer",
  "opener",
  "argument",
  "byline",
  "epigraph",
  "label",
  "dateline",
  "salute",
  "signed",
  "figure",
]);

// --- Inline mapping ------------------------------------------------------

// The Markit wrapper types that have a single canonical TEI form. Used by toTei
// to turn a Markit inline element back into TEI, and as the target vocabulary of
// the forward rules below.
export const WRAPPER_TEI: Record<
  string,
  { name: string; attrs?: [string, string][] }
> = {
  quote: { name: "q" },
  strong: { name: "hi", attrs: [["rend", "smallcaps"]] },
  emphasis: { name: "hi", attrs: [["rend", "italic"]] },
  superscript: { name: "hi", attrs: [["rend", "superscript"]] },
  subscript: { name: "hi", attrs: [["rend", "subscript"]] },
  aside: { name: "note", attrs: [["place", "margin"]] },
  speaker: { name: "speaker" },
  insertion: { name: "add" },
  deletion: { name: "del" },
  uncertain: { name: "unclear" },
  person: { name: "persName" },
  place: { name: "placeName" },
  org: { name: "orgName" },
  citation: { name: "bibl" },
  stageDirection: { name: "stage" },
};

// Forward rules: a TEI inline element matches the first rule whose `tei` name
// matches and whose optional attribute constraint is satisfied, mapping it to a
// Markit wrapper type. `value: ""` means "attribute absent or empty"; an
// omitted `attr` matches regardless of attributes. Order matters: specific
// `hi` rends precede the bare-`hi` rule so an unknown rend falls through to the
// generic escape hatch instead of being silently treated as italic.
export type InlineRule = {
  tei: string;
  attr?: string;
  value?: string;
  type: string;
};

export const INLINE_RULES: InlineRule[] = [
  { tei: "hi", attr: "rend", value: "italic", type: "emphasis" },
  { tei: "hi", attr: "rend", value: "i", type: "emphasis" },
  { tei: "hi", attr: "rend", value: "sup", type: "superscript" },
  { tei: "hi", attr: "rend", value: "superscript", type: "superscript" },
  { tei: "hi", attr: "rend", value: "sub", type: "subscript" },
  { tei: "hi", attr: "rend", value: "subscript", type: "subscript" },
  { tei: "hi", attr: "rend", value: "smallcaps", type: "strong" },
  { tei: "hi", attr: "rend", value: "sc", type: "strong" },
  { tei: "hi", attr: "rend", value: "bold", type: "strong" },
  { tei: "hi", attr: "rend", value: "b", type: "strong" },
  { tei: "hi", attr: "rend", value: "", type: "emphasis" }, // bare <hi> renders italic
  { tei: "q", type: "quote" },
  { tei: "quote", type: "quote" },
  { tei: "said", type: "quote" },
  { tei: "speaker", type: "speaker" },
  { tei: "stage", type: "stageDirection" },
  { tei: "persName", type: "person" },
  { tei: "placeName", type: "place" },
  { tei: "orgName", type: "org" },
  { tei: "name", attr: "type", value: "person", type: "person" },
  { tei: "name", attr: "type", value: "place", type: "place" },
  { tei: "name", attr: "type", value: "org", type: "org" },
  { tei: "add", type: "insertion" },
  { tei: "ex", type: "insertion" }, // editor-supplied expansion letters
  { tei: "del", type: "deletion" },
  { tei: "unclear", type: "uncertain" },
  { tei: "bibl", type: "citation" },
  { tei: "title", type: "citation" },
];

// Find the Markit wrapper type for a TEI inline element, if any rule applies.
export const matchInlineRule = (element: XmlElement): string | undefined => {
  const name = localName(element.name);
  for (const rule of INLINE_RULES) {
    if (rule.tei !== name) continue;
    if (rule.attr === undefined) return rule.type;
    const value = (attr(element, rule.attr) ?? "").toLowerCase();
    if (rule.value === "" ? value === "" : value === rule.value)
      return rule.type;
  }
  return undefined;
};

// --- Glyphs --------------------------------------------------------------

// `<g ref="char:EOLhyphen"/>` and `EOLunhyphen` mark a word broken across a line
// end; both are dropped and the break is closed up (the word is rejoined). Every
// other <g> resolves to its own text content (combining marks, punctuation).
export const JOIN_GLYPHS = new Set(["char:EOLhyphen", "char:EOLunhyphen"]);

// --- Notes ---------------------------------------------------------------

// A <note> whose @place is one of these (or absent) is a footnote; place="margin"
// becomes an inline aside instead (see WRAPPER_TEI.aside).
export const MARGIN_PLACES = new Set(["margin", "marg"]);

// --- Language ------------------------------------------------------------

// Read an element's language code from either the namespaced or bare attribute.
export const langOf = (element: XmlElement): string | undefined =>
  attr(element, "xml:lang") ?? attr(element, "lang");
