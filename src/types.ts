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
  content: BlockElement[];
} & Ranges;

// Block-level element types
export type BlockElement = Heading | Paragraph | Blockquote;

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

export const headingSpec = {
  marker: "^",
  minLevel: 1,
  maxLevel: 6,
} as const;

export const blockquoteSpec = {
  marker: ">",
} as const;

// Inline element types
export type Language = {
  type: "language";
  lang?: string;
  content: InlineElement[];
};

export type PageBreak = {
  type: "pageBreak";
  ref?: string;
};

export type InlineElement =
  | PlainText
  | Leaf
  | FootnoteReference
  | Wrapper
  | Language
  | PageBreak;

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
  { trigger: "//", type: "lineBreak" },
  { trigger: "???", type: "illegible" },
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
  { open: "@", close: "@", type: "aside" },
  { open: "%", close: "%", type: "speaker" },
  { open: "++", close: "++", type: "insertion" },
  { open: "--", close: "--", type: "deletion" },
  { open: "??", close: "??", type: "uncertain" },
  { open: "==", close: "==", type: "highlight" },
  { open: "!person[", close: "]", type: "person" },
  { open: "!place[", close: "]", type: "place" },
  { open: "[", close: "]", type: "citation" },
] as const;

export type WrapperType = (typeof wrapperElements)[number]["type"];

export const braceCodes = [
  { code: "SS", result: "§" },
  { code: "ae", result: "æ" },
  { code: "AE", result: "Æ" },
  { code: "oe", result: "œ" },
  { code: "OE", result: "Œ" },
  { code: "-", result: "–" },
  { code: "--", result: "—" },
] as const;

export const isWrapperElement = (element: InlineElement): element is Wrapper =>
  wrapperElements.some((wrapper) => wrapper.type === element.type);
