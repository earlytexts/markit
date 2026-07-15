// Imported only for the `typeof` queries that derive LeafType/WrapperType from
// these tables (a type-level use, hence `import type`).
import type { leafElements, wrapperElements } from "./lib/grammar.ts";

/**
 * A compiler diagnostic: a syntax error or warning found while compiling a
 * Markit document. `source` spans the offending text. Diagnostics never stop
 * compilation — `compile` always returns a best-effort document alongside its
 * errors.
 */
export type MarkitError = {
  message: string;
  severity: "error" | "warning";
  source: SourceRange;
};

/**
 * The extent of a metadata node in the source, kept as a sibling of the
 * `metadata` property (`Metadata` is an open record, so a range property
 * inside it could collide with a metadata key). `source` covers the whole
 * metadata extent — a block tag's metadata pairs, or a text's `[metadata]`
 * block(s) from first to last; `nested` holds one range per
 * `[metadata.<key>]` sub-block, keyed by that key. Populated only by
 * `compileWithPositions`; whole-line ranges (see `MarkitDocument.source`).
 */
export type MetadataSource = {
  source: SourceRange;
  nested?: Record<string, SourceRange>;
};

/**
 * A value permitted in a Markit metadata block: boolean, number, string, or a
 * homogeneous array of one of those (see SPECIFICATION.md §1.2).
 */
export type MetadataValue =
  | number
  | boolean
  | string
  | number[]
  | boolean[]
  | string[];

/**
 * The parsed `[metadata]` block attached to a text or a block: arbitrary
 * `key = value` pairs, plus at most one level of nested objects (from a
 * `[metadata.<key>]` sub-block). There is no fixed schema — any keys are
 * preserved as given.
 */
export type Metadata = Record<
  string,
  MetadataValue | Record<string, MetadataValue>
>;

/**
 * A compiled text and its subtree, as produced by `compile`. `id` is the
 * text's own ID for the root, or the dot-joined path from the root for a
 * nested text (e.g. `Title.Chapter1.Section2`). `children` holds the texts one
 * heading level deeper (`##` inside a `#` text, and so on).
 *
 * `source` and `metadataSource` — present only on `compileWithPositions`
 * output — locate the node in the source for editor tooling (code folding,
 * error attribution). Node-level ranges are whole-line and end-exclusive: a
 * node spanning source lines 2-3 has `start` `{ line: 2, column: 0 }` and
 * `end` `{ line: 4, column: 0 }`.
 */
export type MarkitDocument = {
  id: string;
  metadata?: Metadata;
  metadataSource?: MetadataSource;
  blocks: Block[];
  children: MarkitDocument[];
  source?: SourceRange;
};

/**
 * The kind of a content block, determined by its block ID (see
 * SPECIFICATION.md §1.3): `title` (at most one, first in the text),
 * `subtitle` (any number, anywhere), `footnote` (IDs starting with `n`, must
 * follow all paragraph blocks), or `paragraph` (anything else).
 */
export type BlockType = "title" | "subtitle" | "footnote" | "paragraph";

/**
 * A single `{#id, ...}` content block and its parsed block-level content.
 * `source`/`metadataSource` as on `MarkitDocument`: whole-line ranges,
 * populated only by `compileWithPositions`.
 */
export type Block = {
  id: string;
  type: BlockType;
  metadata?: Metadata;
  metadataSource?: MetadataSource;
  content: BlockElement[];
  source?: SourceRange;
};

/** The block-level elements a `Block`'s `content` can contain. */
export type BlockElement =
  | Heading
  | Paragraph
  | Blockquote
  | StageDirection
  | List
  | Table;

/**
 * A heading, built from one or more consecutive `^N text` lines (only valid in
 * `title`/`subtitle` blocks). Each source line becomes one `HeadingLine`.
 */
export type Heading = {
  type: "heading";
  content: HeadingLine[];
};

/** One `^N text` line of a `Heading`; `level` is the number after the `^` (1–6). */
export type HeadingLine = {
  type: "headingLine";
  level: number;
  content: InlineElement[];
};

/** A run of consecutive plain lines, collapsed into one paragraph. */
export type Paragraph = {
  type: "paragraph";
  content: InlineElement[];
};

/**
 * The block-level elements permitted inside a block quotation or stage
 * direction: any block content except headings (which are only meaningful in
 * title/subtitle blocks). This lets a quotation or stage direction contain
 * lists, verse, tables, and nested quotations/stage directions, not just
 * paragraphs.
 */
export type NestableBlockElement =
  | Paragraph
  | Blockquote
  | StageDirection
  | List
  | Table;

/**
 * A block quotation (lines starting with `>`). May contain any
 * `NestableBlockElement`, including a nested quotation (doubled marker `>>`).
 */
export type Blockquote = {
  type: "blockquote";
  content: NestableBlockElement[];
};

/**
 * A block-level stage direction (lines starting with `:`). Like a blockquote, it
 * may contain any nestable block content; consecutive plain lines collapse into
 * paragraphs, with a bare `:` line separating paragraphs.
 */
export type StageDirection = {
  type: "stageDirection";
  content: NestableBlockElement[];
};

/**
 * An ordered, unordered, or verse list. `ordered` distinguishes the three
 * (verse lines start with `*`); `start` is the first item's number for an
 * ordered list (default 1), ignored otherwise.
 */
export type List = {
  type: "list";
  ordered: "ordered" | "unordered" | "verse";
  start?: number;
  items: ListItem[];
};

/** One list item; `nestedList` holds a sub-list indented beneath it, if any. */
export type ListItem = {
  type: "listItem";
  content: InlineElement[];
  nestedList?: List;
};

/** A pipe-delimited table. `hasHeader` is true when a separator row follows the first row. */
export type Table = {
  type: "table";
  hasHeader: boolean;
  rows: TableRow[];
};

/** One row of a `Table`. */
export type TableRow = {
  type: "tableRow";
  cells: TableCell[];
};

/** One cell of a `TableRow`. */
export type TableCell = {
  type: "tableCell";
  content: InlineElement[];
};

/** The inline elements a block element's `content` can contain. */
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

/** An explicit line break (`\\` in the source). */
export type LineBreak = { type: "lineBreak" };

/** A run of ordinary, unmarked text. */
export type PlainText = {
  type: "plainText";
  content: string;
  /**
   * Per-character source positions, one per `content` character. Populated only
   * by `compileWithPositions` (so extraction and tokenisation can map an
   * extracted offset back to a source line/column); absent from plain
   * `compile` output, so ordinary compiles stay lean and serialisable output
   * stays small.
   */
  sources?: SourcePosition[];
};

/**
 * A leaf inline element with no content of its own: a non-breaking space
 * (`~`), a tab (`~~`), or illegible text (`[...]`) — see `LeafType`.
 */
export type Leaf = {
  type: LeafType;
};

/** The `Leaf` element kinds: `"tab"`, `"nbSpace"`, or `"illegible"`. */
export type LeafType = (typeof leafElements)[number]["type"];

/** A footnote reference (`<nID>`), matching a `footnote` block in the same text. */
export type FootnoteReference = {
  type: "footnoteReference";
  id: string;
};

/**
 * An inline element that wraps further inline content — quotation, strong,
 * emphasis, superscript, subscript, aside, speaker, stage direction,
 * insertion, deletion, uncertain, person, place, org, or citation. See
 * `WrapperType` for the full set and SPECIFICATION.md §3.1 for their syntax.
 */
export type Wrapper = {
  type: WrapperType;
  content: InlineElement[];
};

/** The `Wrapper` element kinds (see SPECIFICATION.md §3.1 for their syntax). */
export type WrapperType = (typeof wrapperElements)[number]["type"];

/**
 * A disambiguated word: the surface form as it is printed in the text, tagged
 * with the intended (disambiguated) word for search and indexing. Written
 * `[w:surface=word]`, e.g. `[w:humane=human]` — where "humane" is printed and
 * "human" is the disambiguation. `content` is the surface, parsed as inline
 * content so transliteration and nested markup still work; `word` is the plain
 * disambiguated form. `=` and `]` are structural inside `[w:...]`, so escape
 * them (`\=`, `\]`) to use them literally.
 */
export type Word = {
  type: "word";
  word: string;
  content: InlineElement[];
};

/**
 * A run of foreign-language text (`$text$` or `$xx:text$`). `lang`, when
 * present, is the ISO 639 code from the `xx:` prefix.
 */
export type Language = {
  type: "language";
  lang?: string;
  content: InlineElement[];
};

/** A page break (`///` or `//ref//`), optionally carrying a page reference. */
export type PageBreak = {
  type: "pageBreak";
  ref?: string;
  // Whether the break falls inside a word — no whitespace on either side in the
  // source (`be///ginning`). A tight break joins the text around it (renders to
  // nothing, so tokenisation reads one word); a loose break (whitespace on at
  // least one side, or a paragraph edge) is a word boundary. Absent means loose.
  tight?: boolean;
};

/**
 * Not a Markit syntax element — a synthetic wrapper for marking up search-result
 * highlights within an already-compiled document, without needing separate types.
 */
export type Highlight = {
  type: "highlight";
  content: InlineElement[];
};

/** A source position: 0-based line and column, as `buildPositionMap` reports. */
export type SourcePosition = { line: number; column: number };

/** A span of source text: `start` inclusive, `end` exclusive. */
export type SourceRange = { start: SourcePosition; end: SourcePosition };

/** The result of compiling a Markit document string; see `compile`. */
export type CompileResult = {
  document: MarkitDocument;
  errors: MarkitError[];
};

/**
 * The two resolutions of a block's editorial markup: `edited` keeps insertions
 * and drops deletions (the curated reading text); `original` the reverse (the
 * printed text, character for character). Extraction and tokenisation are
 * always relative to one version.
 */
export type Version = "edited" | "original";

/**
 * The analysis projection of a block (see `extractText`): its extracted plain
 * text and, per contributing source element, the span it contributed with the
 * wrapper context around it. Characters between spans are synthetic joiners
 * (newlines between block elements, `" | "` between table cells).
 */
export type Extraction = { text: string; spans: Span[] };

/**
 * One source element's contribution to a block's extracted text: the
 * `[start, end)` range it occupies (into `Extraction.text`), the wrapper
 * context around it (outermost first), and — from `compileWithPositions` only —
 * its source span (`end` exclusive).
 */
export type Span = {
  start: number;
  end: number;
  source?: SourceRange;
  context: Frame[];
};

/**
 * One enclosing element in a span's or token's wrapper context: a plain
 * wrapper (quote, strong, person, citation, …), a language run with its ISO
 * code, a `[w:surface=word]` element with its disambiguated word, a generic
 * raw element with its tag and attributes, or a synthetic highlight. Editorial
 * insertions/deletions never appear — extraction resolves them to one version
 * and unwraps the kept side.
 */
export type Frame =
  | { type: WrapperType }
  | { type: "language"; lang?: string }
  | { type: "word"; word: string }
  | { type: "element"; tag: string; attributes: ElementAttribute[] }
  | { type: "highlight" };

/**
 * One word token of a block's extracted text (see `tokenize`). `text` is the
 * word with any non-breaking spaces normalised to a plain space (so `a~priori`
 * reads `"a priori"`); `start`/`end` are `[start, end)` offsets into
 * `extractText(block, { version }).text` (which holds the raw U+00A0). The
 * `context` is the full wrapper stack around the token (outermost first);
 * `word` and `lang` distil the common lookups from it — the nearest enclosing
 * `[w:…=word]` value and language code. `source` — present only on tokens
 * from a `compileWithPositions` document — is the token's span in the source,
 * `end` exclusive.
 */
export type Token = {
  text: string;
  start: number;
  end: number;
  source?: SourceRange;
  context: Frame[];
  word?: string;
  lang?: string;
};

/**
 * A generic, "raw" element: an escape hatch for markup that has no native
 * Markit equivalent (e.g. when importing from TEI/TCP XML). It carries an
 * arbitrary tag name plus ordered attributes, and wraps further inline content.
 * Surface syntax mirrors XML but with doubled angle brackets so it never clashes
 * with footnote references (`<nID>`):
 *
 *   <<TAG attr="value">>content<</TAG>>   (with content)
 *   <<TAG attr="value"/>>                 (self-closing / empty)
 *
 * This keeps lossless round-tripping possible without polluting the core
 * language: native elements are used wherever one fits, and this is reserved
 * for the long tail.
 */
export type RawElement = {
  type: "element";
  tag: string;
  attributes: ElementAttribute[];
  selfClosing?: boolean;
  content: InlineElement[];
};

/** One `name="value"` attribute of a `RawElement`. */
export type ElementAttribute = {
  name: string;
  value: string;
};
