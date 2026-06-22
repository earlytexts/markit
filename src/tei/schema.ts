// The TCP/TEI schema adapter. This isolates everything that is specific to the
// shape of the source XML, so a different flavour (e.g. true TEI P5) could be
// supported later by swapping these tables. It currently targets the TCP
// "displayable XML" schema used by the EEBO/ECCO corpora (uppercase element
// names, numbered <DIV1>..<DIV7>, an <ETS> envelope).

// Elements that carry document structure and become nested Markit texts.
export const STRUCTURAL = new Set([
  "ETS",
  "EEBO",
  "ECCO",
  "GROUP",
  "TEXT",
  "FRONT",
  "BODY",
  "BACK",
  "DIV",
  "DIV1",
  "DIV2",
  "DIV3",
  "DIV4",
  "DIV5",
  "DIV6",
  "DIV7",
]);

// Elements that are pure metadata/chrome, preserved verbatim as a raw-XML string
// on the enclosing text rather than walked into Markit content.
export const RAW_META = new Set(["HEADER", "IDG"]);

// Reserved metadata keys used by the converter.
export const KEYS = {
  // The element's start-tag interior (name + attributes), e.g. `DIV1 TYPE="play"`.
  tei: "tei",
  // The XML declaration / PIs / doctype that precede the root element.
  prolog: "teiProlog",
  // Raw-XML metadata children, keyed by lowercased element name (teiHeader, teiIdg).
  rawPrefix: "tei",
  // The original child ordering, when it is not simply "blocks then sub-texts".
  order: "teiKids",
  // Marks a block whose content should be emitted without a wrapping element
  // (a bare text run that sat directly inside a structural element).
  bareText: "teiText",
  // Marks a block whose element was self-closed (`<PB/>` rather than `<PB></PB>`).
  void: "teiVoid",
  // Holds a raw XML comment preserved as its own block.
  comment: "teiComment",
  // A do-nothing element appended to neutralise a content line that would
  // otherwise be misread as a table (e.g. a line ending in `|`). Dropped on
  // the way back to XML.
  nop: "teiNop",
} as const;

// Native inline correspondences, used in BOTH directions. A TEI element maps to a
// Markit inline type only when it carries NO attributes; an attribute-bearing
// variant falls back to the generic element so its attributes are preserved.
export type InlineMapping = { tei: string; markit: string };

export const INLINE_MAP: InlineMapping[] = [
  { tei: "HI", markit: "emphasis" }, // bare <HI> renders as italic in TCP
  { tei: "Q", markit: "quote" },
  { tei: "SUP", markit: "superscript" },
  { tei: "SUB", markit: "subscript" },
  { tei: "LB", markit: "lineBreak" },
];

export const teiToMarkitInline = (name: string): string | undefined =>
  INLINE_MAP.find((m) => m.tei === name)?.markit;

export const markitToTeiInline = (type: string): string | undefined =>
  INLINE_MAP.find((m) => m.markit === type)?.tei;

// The lowercased raw-meta metadata key for an element (HEADER -> teiHeader).
export const rawMetaKey = (name: string): string =>
  KEYS.rawPrefix + name.charAt(0) + name.slice(1).toLowerCase();
