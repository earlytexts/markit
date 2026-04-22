import {
  type Blockquote,
  type InlineElement,
  type Heading,
  type HeadingLine,
  type List,
  type ListItem,
  type Paragraph,
  type PlainText,
  type Table,
  type TableRow,
  type TableCell,
  type Block,
  type MarkitDocument,
  startLine,
  endLine,
  type BlockElement,
} from "../../src/types.js";

export const markit = (...lines: string[]): string => lines.join("\n");

export const markitWithId = (idLine: string) =>
  markit(idLine, "", "{#0}", "Title", "");

export const markitWithMetadata = (...metadataLines: string[]) =>
  markit("# Text", "", "[metadata]", ...metadataLines, "", "{#0}", "Title", "");

export const markitWithContent = (...contentLines: string[]) =>
  markit("# Text", "", ...contentLines, "");

export const p = (content: InlineElement[]): Paragraph => ({
  type: "paragraph",
  content,
});

export const h = (content: HeadingLine[]): Heading => ({
  type: "heading",
  content,
});

export const hl = (level: number, content: InlineElement[]): HeadingLine => ({
  type: "headingLine",
  level,
  content,
});

export const bq = (content: Paragraph[]): Blockquote => ({
  type: "blockquote",
  content,
});

export const list = (
  ordered: "ordered" | "unordered" | "verse",
  items: ListItem[],
  start?: number,
): List => ({
  type: "list",
  ordered,
  items,
  ...(start !== undefined ? { start } : {}),
});

export const li = (content: InlineElement[], nestedList?: List): ListItem => ({
  type: "listItem",
  content,
  ...(nestedList !== undefined ? { nestedList } : {}),
});

export const table = (rows: TableRow[], hasHeader: boolean): Table => ({
  type: "table",
  hasHeader,
  rows,
});

export const tr = (cells: TableCell[]): TableRow => ({
  type: "tableRow",
  cells,
});

export const tc = (content: InlineElement[]): TableCell => ({
  type: "tableCell",
  content,
});

export const pt = (text: string): PlainText => ({
  type: "plainText",
  content: text,
});

export const paragraph = (id: string, content: BlockElement[]): Block => ({
  id,
  type: "paragraph",
  content,
  [startLine]: 1,
  [endLine]: 1,
});

export const document = (id: string, blocks: Block[]): MarkitDocument => ({
  id,
  blocks,
  children: [],
  [startLine]: 1,
  [endLine]: 1,
});
