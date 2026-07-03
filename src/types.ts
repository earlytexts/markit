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

export const startLine = Symbol("startLine");

export const endLine = Symbol("endLine");

// Metadata types
export type MetadataValue =
  | number
  | boolean
  | string
  | number[]
  | boolean[]
  | string[];

export type Metadata = Record<
  string,
  MetadataValue | (Record<string, MetadataValue> & Ranges)
> &
  Ranges;

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

export type Blockquote = {
  type: "blockquote";
  content: Paragraph[];
};

// A block-level stage direction (lines starting with `:`). Like a blockquote, it
// collapses consecutive lines into paragraphs, with a bare `:` line separating
// paragraphs.
export type StageDirection = {
  type: "stageDirection";
  content: Paragraph[];
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
  | Language
  | PageBreak
  | RawElement
  | Highlight;

export type LineBreak = { type: "lineBreak" };

export type PlainText = {
  type: "plainText";
  content: string;
};

export type Leaf = {
  type: LeafType;
};

export const leafElements = [
  { trigger: "~~", type: "emSpace" },
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

export const isWrapperElement = (element: InlineElement): element is Wrapper =>
  wrapperElements.some((wrapper) => wrapper.type === element.type);

export type Language = {
  type: "language";
  lang?: string;
  content: InlineElement[];
};

export type PageBreak = {
  type: "pageBreak";
  ref?: string;
};

// There's no "highlight" element in Markit syntax, but the type is included
// here to make it easier to highlight search results in Markit documents
// without having to change the types
export type Highlight = {
  type: "highlight";
  content: InlineElement[];
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
