// Error type
export type MarkitError = {
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: "error" | "warning";
};

// Ranges type (used by the language server for code folding)
export type Ranges = {
  [startLine]: number;
  [endLine]: number;
};

export const startLine: unique symbol = Symbol("startLine");

export const endLine: unique symbol = Symbol("endLine");

// Metadata types
export type MetadataValue =
  | number
  | boolean
  | string
  | number[]
  | boolean[]
  | string[];

export type Metadata =
  & Record<
    string,
    MetadataValue | (Record<string, MetadataValue> & Ranges)
  >
  & Ranges;

// Document type
export type MarkitDocument = {
  id: string;
  metadata?: Metadata;
  blocks: Block[];
  children: MarkitDocument[];
} & Ranges;

// Block types
export type BlockType = "title" | "subtitle" | "footnote" | "paragraph";

export type Block = {
  id: string;
  type: BlockType;
  metadata?: Metadata;
  content: BlockElement[];
} & Ranges;

// Block-level element types
export type BlockElement =
  | Heading
  | Paragraph
  | Blockquote
  | StageDirection
  | List
  | Table;

export type Heading = {
  type: "heading";
  content: HeadingLine[];
};

export type HeadingLine = {
  type: "headingLine";
  level: number;
  content: InlineElement[];
};

export type Paragraph = {
  type: "paragraph";
  content: InlineElement[];
};

// The block-level elements permitted inside a block quotation or stage
// direction: any block content except headings (which are only meaningful in
// title/subtitle blocks). This lets a quotation or stage direction contain
// lists, verse, tables, and nested quotations/stage directions, not just
// paragraphs.
export type NestableBlockElement =
  | Paragraph
  | Blockquote
  | StageDirection
  | List
  | Table;

export type Blockquote = {
  type: "blockquote";
  content: NestableBlockElement[];
};

// A block-level stage direction (lines starting with `:`). Like a blockquote, it
// may contain any nestable block content; consecutive plain lines collapse into
// paragraphs, with a bare `:` line separating paragraphs.
export type StageDirection = {
  type: "stageDirection";
  content: NestableBlockElement[];
};

export type List = {
  type: "list";
  ordered: "ordered" | "unordered" | "verse";
  start?: number;
  items: ListItem[];
};

export type ListItem = {
  type: "listItem";
  content: InlineElement[];
  nestedList?: List;
};

export type Table = {
  type: "table";
  hasHeader: boolean;
  rows: TableRow[];
};

export type TableRow = {
  type: "tableRow";
  cells: TableCell[];
};

export type TableCell = {
  type: "tableCell";
  content: InlineElement[];
};

export const headingSpec = {
  marker: "^",
  minLevel: 1,
  maxLevel: 6,
} as const;

export const blockquoteSpec = {
  marker: ">",
} as const;

export const stageDirectionSpec = {
  marker: ":",
} as const;

export const listSpec = {
  unorderedMarker: "-",
  orderedMarker: ".",
  verseMarker: "*",
  indentSize: 2,
} as const;

export const tableSpec = {
  cellDelimiter: "|",
  separatorPattern: /^\s*\|?\s*-+\s*(\|\s*-+\s*)*\|?\s*$/,
} as const;

// Inline element types
export type InlineElement =
  | PlainText
  | Leaf
  | LineBreak
  | FootnoteReference
  | Wrapper
  | Word
  | Language
  | PageBreak
  | RawElement
  | Highlight;

export type LineBreak = { type: "lineBreak" };

export type PlainText = {
  type: "plainText";
  content: string;
  /**
   * Per-character source positions, one per `content` character. Populated only
   * when compiling with `{ tokens: true }` (so `tokenize` can map a rendered
   * offset back to source); absent otherwise, so ordinary compiles stay lean.
   */
  sources?: SourcePosition[];
};

export type Leaf = {
  type: LeafType;
};

export const leafElements = [
  { trigger: "~~", type: "tab" },
  { trigger: "~", type: "nbSpace" },
  { trigger: "[...]", type: "illegible" },
] as const;

export type LeafType = (typeof leafElements)[number]["type"];

export type FootnoteReference = {
  type: "footnoteReference";
  id: string;
};

export const footnoteReferenceSpec = {
  open: "<",
  close: ">",
  pattern: /^n[^\s#{}]+$/,
  type: "footnoteReference",
} as const;

export type Wrapper = {
  type: WrapperType;
  content: InlineElement[];
};

export const wrapperElements = [
  { open: '"', close: '"', type: "quote" },
  { open: "*", close: "*", type: "strong" },
  { open: "_", close: "_", type: "emphasis" },
  { open: "^", close: "^", type: "superscript" },
  { open: ",,", close: ",,", type: "subscript" },
  { open: "#", close: "#", type: "aside" },
  { open: "@", close: "@", type: "speaker" },
  { open: "::", close: "::", type: "stageDirection" },
  { open: "[+", close: "+]", type: "insertion" },
  { open: "[-", close: "-]", type: "deletion" },
  { open: "[?", close: "?]", type: "uncertain" },
  { open: "[p:", close: "]", type: "person" },
  { open: "[l:", close: "]", type: "place" },
  { open: "[o:", close: "]", type: "org" },
  { open: "[", close: "]", type: "citation" },
] as const;

export type WrapperType = (typeof wrapperElements)[number]["type"];

const wrapperTypes: ReadonlySet<string> = new Set(
  wrapperElements.map((wrapper) => wrapper.type),
);

export const isWrapperElement = (element: InlineElement): element is Wrapper =>
  wrapperTypes.has(element.type);

// A disambiguated word: the surface form as it is printed in the text, tagged
// with the intended (disambiguated) word for search and indexing. Written
// `[w:surface=word]`, e.g. `[w:humane=human]` — where "humane" is printed and
// "human" is the disambiguation. `content` is the surface, parsed as inline
// content so transliteration and nested markup still work; `word` is the plain
// disambiguated form. `=` and `]` are structural inside `[w:...]`, so escape
// them (`\=`, `\]`) to use them literally.
export type Word = {
  type: "word";
  word: string;
  content: InlineElement[];
};

export const wordSpec = {
  open: "[w:",
  separator: "=",
  close: "]",
  type: "word",
} as const;

export type Language = {
  type: "language";
  lang?: string;
  content: InlineElement[];
};

export type PageBreak = {
  type: "pageBreak";
  ref?: string;
  // Whether the break falls inside a word — no whitespace on either side in the
  // source (`be///ginning`). A tight break joins the text around it (renders to
  // nothing, so tokenisation reads one word); a loose break (whitespace on at
  // least one side, or a paragraph edge) is a word boundary. Absent means loose.
  tight?: boolean;
};

// There's no "highlight" element in Markit syntax, but the type is included
// here to make it easier to highlight search results in Markit documents
// without having to change the types
export type Highlight = {
  type: "highlight";
  content: InlineElement[];
};

/** A source position: 0-based line and column, as `buildPositionMap` reports. */
export type SourcePosition = { line: number; column: number };

/**
 * One word token of a document's rendered text (see `tokenize`). `text` is the
 * word with any non-breaking spaces normalised to a plain space (so `a~priori`
 * reads `"a priori"`); `start`/`end` are `[start, end)` offsets into
 * `renderText`'s output (which holds the raw U+00A0), for highlighting. `source`
 * — present only on tokens from `compile(text, { tokens: true })` — is the
 * token's span in the source, `end` exclusive.
 */
export type Token = {
  text: string;
  start: number;
  end: number;
  source?: { start: SourcePosition; end: SourcePosition };
};

// A generic, "raw" element: an escape hatch for markup that has no native
// Markit equivalent (e.g. when importing from TEI/TCP XML). It carries an
// arbitrary tag name plus ordered attributes, and wraps further inline content.
// Surface syntax mirrors XML but with doubled angle brackets so it never clashes
// with footnote references (`<nID>`):
//
//   <<TAG attr="value">>content<</TAG>>   (with content)
//   <<TAG attr="value"/>>                 (self-closing / empty)
//
// This keeps lossless round-tripping possible without polluting the core
// language: native elements are used wherever one fits, and this is reserved
// for the long tail.
export type RawElement = {
  type: "element";
  tag: string;
  attributes: ElementAttribute[];
  selfClosing?: boolean;
  content: InlineElement[];
};

export type ElementAttribute = {
  name: string;
  value: string;
};

export const elementSpec = {
  open: "<<",
  close: ">>",
  endOpen: "<</",
} as const;
