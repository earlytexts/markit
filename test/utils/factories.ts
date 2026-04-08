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
  markit("# Text", "", ...metadataLines, "", "{#0}", "Title", "");

export const markitWithContent = (...contentLines: string[]) =>
  markit("# Text", "", ...contentLines, "");

export const p = (content: InlineElement[]): Paragraph => ({
  type: "paragraph",
  content,
});

// Convenience shorthand for a single-line heading group
export const h = (content: HeadingLine[]): Heading => ({
  type: "heading",
  content,
});

export const hl = (level: number, content: InlineElement[]): HeadingLine => ({
  type: "headingLine",
  level,
  content,
});

export const bq = (content: (Paragraph | List)[]): Blockquote => ({
  type: "blockquote",
  content,
});

export const list = (ordered: boolean, content: ListItem[]): List => ({
  type: "list",
  ordered,
  content,
});

export const li = (content: InlineElement[]): ListItem => ({
  type: "listItem",
  content,
});

export const pt = (text: string): PlainText => ({
  type: "plainText",
  content: text,
});
