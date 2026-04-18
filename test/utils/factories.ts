import type {
  Blockquote,
  InlineElement,
  Heading,
  HeadingLine,
  List,
  ListItem,
  Paragraph,
  PlainText,
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
  ordered: boolean,
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

export const pt = (text: string): PlainText => ({
  type: "plainText",
  content: text,
});
