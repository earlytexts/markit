// Error type
export type MarkitError = Readonly<{
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}>;

// Document type
export type MarkitDocument = Readonly<{
  id: string;
  metadata: Record<string, MetadataValue>;
  blocks: ReadonlyArray<Block>;
  children: ReadonlyArray<MarkitDocument>;
  [startLine]: number; // used by the language server
  [endLine]: number; // used by the language server
}>;

export const RESERVED_TEXT_KEYS: ReadonlyArray<string> = [
  "id",
  "blocks",
  "children",
  "metadata",
];

// Metadata types
export type MetadataValue =
  | number
  | boolean
  | string
  | number[]
  | boolean[]
  | string[];

// Block types
export type Block = Readonly<{
  id: string;
  metadata: Record<string, MetadataValue>;
  content: ReadonlyArray<Element>;
  [startLine]: number; // used by the language server
  [endLine]: number; // used by the language server
}>;

export const RESERVED_BLOCK_KEYS: ReadonlyArray<string> = [
  "id",
  "type",
  "content",
  "metadata",
];

// Source range symbols (used by the language server)
export const startLine = Symbol("startLine");

export const endLine = Symbol("endLine");

// Content types
export type Element = PlainText | Leaf | Heading | FootnoteReference | Wrapper;

export type PlainText = Readonly<{
  type: "plainText";
  content: string;
}>;

export type Leaf = Readonly<{
  type: LeafType;
}>;

export const leafElements = [
  { trigger: "~~", type: "emSpace" },
  { trigger: "~", type: "nbSpace" },
  { trigger: "//", type: "lineBreak" },
  { trigger: "|", type: "pageBreak" },
] as const;

export type LeafType = (typeof leafElements)[number]["type"];

export type Heading = Readonly<{
  type: "heading";
  level: number;
  content: ReadonlyArray<Element>;
}>;

export const headingSpec = {
  marker: "£",
  minLevel: 1,
  maxLevel: 6,
  blockLevel: true,
} as const;

export type FootnoteReference = Readonly<{
  type: "footnoteReference";
  id: string;
}>;

export const footnoteReferenceSpec = {
  open: "<",
  close: ">",
  pattern: /^n[a-zA-Z0-9.*]+$/,
  type: "footnoteReference",
} as const;

export type Wrapper = Readonly<{
  type: WrapperType;
  content: ReadonlyArray<Element>;
}>;

export const wrapperElements = [
  { open: '""', close: '""', type: "blockquote" },
  { open: '"', close: '"', type: "quote" },
  { open: "*", close: "*", type: "strong" },
  { open: "_", close: "_", type: "emphasis" },
  { open: "$$", close: "$$", type: "greek" },
  { open: "$", close: "$", type: "foreign" },
  { open: "@", close: "@", type: "aside" },
  { open: "++", close: "++", type: "insertion" },
  { open: "--", close: "--", type: "deletion" },
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

export const isWrapperElement = (element: Element): element is Wrapper =>
  wrapperElements.some((wrapper) => wrapper.type === element.type);

export const isBlockLevelType = (type: Element["type"]): boolean =>
  type === "heading" || type === "blockquote" || type === "lineBreak";
