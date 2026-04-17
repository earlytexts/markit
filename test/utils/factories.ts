import type {
  Blockquote,
  InlineElement,
  Heading,
  HeadingLine,
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

export const pt = (text: string): PlainText => ({
  type: "plainText",
  content: text,
});
