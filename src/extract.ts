import type {
  Block,
  BlockElement,
  Extraction,
  Frame,
  InlineElement,
  List,
  NestableBlockElement,
  SourcePosition,
  Span,
  Version,
} from "./types.ts";

/**
 * The analysis projection of a block (the display projection is `renderText`):
 * its plain text with all markup furniture dropped, resolved to one `version`
 * of the editorial markup (default `edited`), plus one `Span` per contributing
 * source element carrying the wrapper context around it. See `Extraction`.
 *
 * Every character of the text is either one element's contribution — verbatim
 * plainText content; U+00A0 for a non-breaking space (`~`), so a marked
 * multi-word unit reads as one token; `\t` for a tab; `\n` for a line break;
 * `[...]` for illegible text; a space for a loose page break (a tight,
 * mid-word break contributes nothing, so the word joins); nothing for a
 * footnote reference — or a synthetic joiner between structure (`\n` between
 * block elements, list items, table rows, and heading lines; `" | "` between
 * table cells), which belongs to no span.
 *
 * `highlight` and `resolve` are driven by the same walk, so character offsets
 * measured against an extraction can always be mapped back into the block.
 */
export const extractText = (
  block: Block,
  options?: { version?: Version },
): Extraction => {
  const { text, spans } = extract(block, options?.version ?? "edited");
  return { text, spans };
};

/**
 * A copy of the block resolved to the given version (default `edited`), with
 * the given ranges of its extracted text wrapped in Markit `highlight`
 * elements. The ranges must be measured against
 * `extractText(block, { version }).text` and be sorted and non-overlapping:
 * this is the same walk, so offsets line up. Only plainText nodes are ever
 * split; characters contributed by other elements are passed over, so a range
 * spanning a line break or page break simply resumes marking after it.
 */
export const highlight = (
  block: Block,
  ranges: { start: number; end: number }[],
  version: Version = "edited",
): Block => walkBlock(block, makeState(version, ranges));

/**
 * A copy of the block resolved to the given version, with no highlights: the
 * editorial markup is stripped down to one side's plain reading text
 * (insertions kept and deletions dropped for `edited`; the reverse for
 * `original`; the kept side unwrapped).
 */
export const resolve = (block: Block, version: Version): Block =>
  highlight(block, [], version);

/**
 * An `Extraction` extended with, per character of `text`, the source position
 * it came from (or `null` for synthetic characters and for documents compiled
 * without positions). Internal — `tokenize` uses it to give tokens source
 * spans; the public surface is `extractText`.
 */
export type SourcedExtraction = Extraction & {
  sources: (SourcePosition | null)[];
};

/** The full extraction of a block, per-character sources included. */
export const extract = (
  block: Block,
  version: Version,
): SourcedExtraction => {
  const state = makeState(version, []);
  walkBlock(block, state);
  return {
    text: state.text.join(""),
    spans: state.spans,
    sources: state.sources,
  };
};

/**
 * The extracted text of bare inline content, by the same rules as a block's
 * extraction. Internal — the compiler uses it to check that a `[w:]` surface
 * is exactly one token.
 */
export const extractInlineText = (
  elements: InlineElement[],
  version: Version,
): string => {
  const state = makeState(version, []);
  walkInline(elements, state);
  return state.text.join("");
};

type HighlightRange = { start: number; end: number };

type State = {
  /** Characters of extracted text contributed so far. */
  pos: number;
  /** Which version's text the walk emits and keeps. */
  version: Version;
  /** Sorted, merged ranges to highlight; empty when only extracting. */
  ranges: HighlightRange[];
  /** The wrapper stack around the walk's current position, outermost first. */
  context: Frame[];
  /** Chunks of the extracted text, in order. */
  text: string[];
  /** One span per source-element contribution. */
  spans: Span[];
  /** Per character of the text: its source position, or null. */
  sources: (SourcePosition | null)[];
};

const makeState = (version: Version, ranges: HighlightRange[]): State => ({
  pos: 0,
  version,
  ranges,
  context: [],
  text: [],
  spans: [],
  sources: [],
});

const walkBlock = (block: Block, state: State): Block => ({
  ...block,
  content: block.content.map((element, i) => {
    if (i > 0) joiner(state, "\n");
    return walkElement(element, state);
  }),
});

const walkElement = (
  element: BlockElement,
  state: State,
): BlockElement =>
  element.type === "heading"
    ? {
      ...element,
      content: element.content.map((line, i) => {
        if (i > 0) joiner(state, "\n");
        return { ...line, content: walkInline(line.content, state) };
      }),
    }
    : walkNestable(element, state);

const walkNestable = (
  element: NestableBlockElement,
  state: State,
): NestableBlockElement => {
  switch (element.type) {
    case "paragraph":
      return { ...element, content: walkInline(element.content, state) };
    case "blockquote":
    case "stageDirection":
      return {
        ...element,
        content: element.content.map((child, i) => {
          if (i > 0) joiner(state, "\n");
          return walkNestable(child, state);
        }),
      };
    case "list":
      return walkList(element, state);
    case "table":
      return {
        ...element,
        rows: element.rows.map((row, i) => {
          if (i > 0) joiner(state, "\n");
          return {
            ...row,
            cells: row.cells.map((cell, j) => {
              if (j > 0) joiner(state, " | ");
              return { ...cell, content: walkInline(cell.content, state) };
            }),
          };
        }),
      };
  }
};

const walkList = (list: List, state: State): List => ({
  ...list,
  items: list.items.map((item, i) => {
    if (i > 0) joiner(state, "\n");
    const content = walkInline(item.content, state);
    if (item.nestedList === undefined) return { ...item, content };
    joiner(state, "\n");
    return { ...item, content, nestedList: walkList(item.nestedList, state) };
  }),
});

const walkInline = (
  elements: InlineElement[],
  state: State,
): InlineElement[] =>
  elements.flatMap((element): InlineElement[] => {
    if (element.type === "plainText") {
      const start = state.pos;
      contribute(state, element.content, element.sources);
      const marked = state.ranges.some((range) =>
        range.start < state.pos && range.end > start
      );
      return marked
        ? splitPlainText(element.content, start, state.ranges)
        : [element];
    }
    if (element.type === "insertion" || element.type === "deletion") {
      const dropped = element.type === "insertion"
        ? state.version === "original"
        : state.version === "edited";
      if (dropped) return []; // contribute nothing; the side is gone
      // The kept side is unwrapped to plain reading text, so editorial
      // wrappers never appear in a context stack.
      return walkInline(element.content, state);
    }
    if ("content" in element) {
      state.context.push(frameOf(element));
      const content = walkInline(element.content, state);
      state.context.pop();
      return [{ ...element, content }];
    }
    contribute(state, leafText(element));
    return [element];
  });

/**
 * One source element's contribution: extend the text and record a span
 * carrying the current context. `charSources` — a plainText node's
 * per-character positions, present only under `compileWithPositions` — gives
 * the span its source span and the characters their positions.
 */
const contribute = (
  state: State,
  text: string,
  charSources?: SourcePosition[],
): void => {
  if (text.length === 0) return;
  const start = state.pos;
  state.pos += text.length;
  state.text.push(text);
  for (let i = 0; i < text.length; i++) {
    state.sources.push(charSources?.[i] ?? null);
  }
  const first = charSources?.[0];
  const last = charSources?.[text.length - 1];
  state.spans.push({
    start,
    end: state.pos,
    ...(first && last
      ? {
        source: {
          start: first,
          end: { line: last.line, column: last.column + 1 },
        },
      }
      : {}),
    context: [...state.context],
  });
};

/** A synthetic joiner between structure: extends the text, belongs to no span. */
const joiner = (state: State, text: string): void => {
  state.pos += text.length;
  state.text.push(text);
  for (let i = 0; i < text.length; i++) state.sources.push(null);
};

/** Constant text contributed by inline elements without nested content. */
const leafText = (
  element:
    | { type: "tab" | "nbSpace" | "illegible" | "lineBreak" }
    | { type: "footnoteReference"; id: string }
    | { type: "pageBreak"; ref?: string; tight?: boolean },
): string => {
  switch (element.type) {
    case "lineBreak":
      return "\n";
    case "nbSpace":
      // U+00A0, faithfully: this is what lets `a~priori` read as one token,
      // with no adjacency bookkeeping (tokens normalise it back to a space).
      return "\u00A0";
    case "tab":
      return "\t";
    case "illegible":
      return "[...]"; // no word characters — never a fake token
    case "footnoteReference":
      return "";
    case "pageBreak":
      // A tight break falls inside a word (contributes nothing, joining its
      // two sides); a loose break is a word boundary, so it contributes a space.
      return element.tight ? "" : " ";
  }
};

/** The context frame an inline element with nested content pushes. */
const frameOf = (
  element: Extract<InlineElement, { content: InlineElement[] }>,
): Frame => {
  switch (element.type) {
    case "word":
      return { type: "word", word: element.word };
    case "language":
      return element.lang !== undefined
        ? { type: "language", lang: element.lang }
        : { type: "language" };
    case "element":
      return {
        type: "element",
        tag: element.tag,
        attributes: element.attributes,
      };
    default:
      return { type: element.type };
  }
};

/**
 * Split a plainText node's content (whose extracted text spans
 * [start, start + content.length)) into plain and highlighted pieces.
 */
const splitPlainText = (
  content: string,
  start: number,
  ranges: HighlightRange[],
): InlineElement[] => {
  const end = start + content.length;
  const out: InlineElement[] = [];
  let cursor = start;
  for (const range of ranges) {
    if (range.end <= cursor) continue;
    if (range.start >= end) break;
    const from = Math.max(range.start, cursor);
    const to = Math.min(range.end, end);
    if (from > cursor) {
      out.push({
        type: "plainText",
        content: content.slice(cursor - start, from - start),
      });
    }
    out.push({
      type: "highlight",
      content: [{
        type: "plainText",
        content: content.slice(from - start, to - start),
      }],
    });
    cursor = to;
  }
  if (cursor < end) {
    out.push({ type: "plainText", content: content.slice(cursor - start) });
  }
  return out;
};
