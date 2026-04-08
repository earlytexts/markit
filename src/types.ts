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

// Metadata base type
export type Metadata = Record<string, MetadataValue>;

// Metadata types
export type MetadataValue =
  | number
  | boolean
  | string
  | number[]
  | boolean[]
  | string[];

// Document type
export type MarkitDocument<
  TextMetadata extends Metadata = {},
  BlockMetadata extends Metadata = {},
> = {
  id: string;
  blocks: Block<BlockMetadata>[];
  children: MarkitDocument<TextMetadata, BlockMetadata>[];
  [startLine]: number; // used by the language server
  [endLine]: number; // used by the language server
} & TextMetadata; // allow custom metadata fields

export const RESERVED_TEXT_KEYS = ["id", "blocks", "children"];

// Block types
export type BlockType = "title" | "subtitle" | "footnote" | "paragraph";

export type Block<BlockMetadata extends Metadata = {}> = {
  id: string;
  type: BlockType;
  content: BlockElement[];
  [startLine]: number; // used by the language server
  [endLine]: number; // used by the language server
} & BlockMetadata; // allow custom metadata fields

export const RESERVED_BLOCK_KEYS = ["id", "type", "content"];

// Source range symbols (used by the language server)
export const startLine = Symbol("startLine");

export const endLine = Symbol("endLine");

// Block-level element types
export type BlockElement = Heading | Paragraph | Blockquote | List;

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
  content: (Paragraph | List)[];
};

export type List = {
  type: "list";
  ordered: boolean;
  content: ListItem[];
};

export type ListItem = {
  type: "listItem";
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

// Inline element types
export type InlineElement = PlainText | Leaf | FootnoteReference | Wrapper;

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
  { open: "$$", close: "$$", type: "greek" },
  { open: "$", close: "$", type: "foreign" },
  { open: "@", close: "@", type: "aside" },
  { open: "++", close: "++", type: "insertion" },
  { open: "--", close: "--", type: "deletion" },
  { open: "==", close: "==", type: "highlight" },
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
