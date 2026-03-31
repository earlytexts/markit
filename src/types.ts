// Error type
export type MarkitError = {
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  file?: string;
  severity: "error" | "warning";
};

// Compile options
export type CompileOptions = {
  fileLoader: (path: string) => string;
  filePath: string;
  embedExternalChildren: boolean;
};

// Document type
export type MarkitDocument = {
  id: string;
  blocks: Block[];
  children: MarkitDocument[];
  [startLine]: number; // used by the language server
  [endLine]: number; // used by the language server
} & Record<string, MetadataValue>; // allow any other metadata fields

export const RESERVED_TEXT_KEYS = ["id", "blocks", "children"];

// Metadata types
export type MetadataValue =
  | number
  | boolean
  | string
  | number[]
  | boolean[]
  | string[];

// Block types
export type Block = {
  id: string;
  content: Element[];
  [startLine]: number; // used by the language server
  [endLine]: number; // used by the language server
} & Record<string, MetadataValue>; // allow any other metadata fields

export const RESERVED_BLOCK_KEYS = ["id", "content"];

// Source range symbols (used by the language server)
export const startLine = Symbol("startLine");

export const endLine = Symbol("endLine");

// Content types
export type Element = PlainText | Leaf | Heading | FootnoteReference | Wrapper;

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
  { trigger: "|", type: "pageBreak" },
] as const;

export type LeafType = (typeof leafElements)[number]["type"];

export type Heading = {
  type: "heading";
  level: number;
  content: Element[];
};

export const headingSpec = {
  marker: "£",
  minLevel: 1,
  maxLevel: 6,
  blockLevel: true,
} as const;

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
  content: Element[];
};

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
