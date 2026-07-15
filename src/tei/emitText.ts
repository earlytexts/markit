import {
  attr,
  childrenNamed,
  isElement,
  localName,
  startTagInner,
  type XmlElement,
  type XmlNode,
} from "./xml.ts";
import {
  JOIN_GLYPHS,
  langOf,
  MARGIN_PLACES,
  matchInlineRule,
  SEMANTIC_BLOCKS,
  STRUCTURAL,
  WRAPPER_TEI,
} from "./schema.ts";
import type { MetaTree } from "./header.ts";
import classifyBlockLine from "../lib/classifyBlockLine.ts";
import { wrapperElements } from "../lib/grammar.ts";
import splitOnLineBreakMarker from "../lib/splitLineBreaks.ts";
import type { FromTEIOptions, WrapperType } from "../types.ts";

/**
 * Emit a TEI text element (and, recursively, its structural sub-texts) as
 * Markit source lines pushed onto `out` — the walker behind `fromTEIXML`.
 * `header`, when given, provides the text's metadata; otherwise it derives
 * from the element's own attributes.
 */
const emitText = (
  element: XmlElement,
  level: number,
  id: string,
  header: MetaTree | null,
  options: FromTEIOptions,
  out: string[],
): void => {
  out.push(`${"#".repeat(level)} ${id}`);

  const metaLines = serializeMeta(header ?? attrMeta(element));
  if (metaLines.length > 0) {
    out.push("");
    out.push(...metaLines);
  }

  // Partition children into block-level content and structural sub-texts,
  // skipping the header (already consumed) and insignificant whitespace.
  const blockChildren: XmlNode[] = [];
  const subTexts: XmlElement[] = [];
  for (const child of element.children) {
    if (isElement(child)) {
      const name = localName(child.name);
      if (name === "teiHeader") continue;
      if (STRUCTURAL.has(name)) subTexts.push(child);
      else blockChildren.push(child);
    } else if (child.kind === "text" && child.content.trim() !== "") {
      blockChildren.push(child);
    }
  }

  const walker: Walker = { options, footnotes: [], counter: { n: 0 } };
  emitBlocks(blockChildren, level, walker, out);

  for (const footnote of walker.footnotes) {
    out.push("");
    out.push(`{#${footnote.id}}`);
    out.push(...footnote.lines);
  }

  const usedIds = new Set<string>();
  for (const sub of subTexts) {
    out.push("");
    emitText(sub, level + 1, subTextId(sub, usedIds), null, options, out);
  }
};

export default emitText;

// A per-text walker: the conversion options plus the footnotes accumulated while
// rendering this text's blocks (footnote ids run per text).
type Walker = {
  options: FromTEIOptions;
  footnotes: Footnote[];
  counter: { n: number };
};

type Footnote = { id: string; lines: string[] };

// The sentinel left in place of an end-of-line hyphen (U+E000, a private-use
// character that cannot occur in real text); `finishInline` removes it together
// with the following whitespace, closing the word up.
const JOIN = "\uE000";
const JOIN_PATTERN = new RegExp(`${JOIN}\\s*`, "g");

// --- Blocks --------------------------------------------------------------

// Emit each block-level child as its own Markit content block, numbering
// paragraphs sequentially and turning the first heading into the `title`.
const emitBlocks = (
  children: XmlNode[],
  depth: number,
  w: Walker,
  out: string[],
): void => {
  let blockN = 0;
  let headSeen = false;
  let pendingPage: string | null = null;

  // Consume the held page break, if any — the one place `pendingPage` is
  // read and cleared, so every consumption site is visible as a call.
  const takePage = (): string | null => {
    const page = pendingPage;
    pendingPage = null;
    return page;
  };

  // `guard` runs the first content line through `contentLine` so it is not
  // misread as a block construct; heading lines (which must start with `^N`)
  // opt out.
  const open = (tag: string, lines: string[], guard = true): void => {
    out.push("");
    out.push(`{#${tag}}`);
    const first = prependPage(lines[0] ?? "", takePage());
    // Guard every prose line (a paragraph split at a hard line break can put a
    // block-marker-looking word at the start of a continuation line, not just
    // the first line) so none is misread as a heading/list/table/blockquote.
    out.push(
      ...[first, ...lines.slice(1)].map((l) => (guard ? contentLine(l) : l)),
    );
  };

  for (const child of children) {
    if (!isElement(child)) {
      // Bare text runs reaching here are non-empty (emitText filters whitespace).
      open(`${++blockN}`, [finishInline(escapeMarkit(plainText(child, w)))]);
      continue;
    }

    const name = localName(child.name);

    // A stray page break between blocks is held and prepended to the next one.
    if (name === "pb") {
      pendingPage = pageBreak(child);
      continue;
    }

    if (name === "head") {
      // A `title` block must be the first block in the text; a heading that
      // follows other content becomes a `subtitle` instead.
      const tag = blockN === 0 && !headSeen ? "title" : "subtitle";
      headSeen = true;
      const level = Math.min(6, Math.max(1, depth));
      // A heading line must start with `^N`, so any pending page break goes
      // inside the heading content rather than before the marker.
      const held = takePage();
      const page = held ? `${held} ` : "";
      open(
        tag,
        [
          `^${level} ${page}${
            finishInline(renderInline(child.children, w, new Set()))
          }`,
        ],
        false,
      );
      continue;
    }

    const block = renderBlockElement(child, w);
    if (block.lines.length === 0 && !block.keep) continue;
    open(`${++blockN}${block.meta}`, block.lines, block.guard);
  }

  // A trailing page break with no following block becomes its own paragraph.
  const trailing = takePage();
  if (trailing) open(`${++blockN}`, [trailing]);
};

// `guard` marks lines that are paragraph prose (and so need the contentLine
// guard against being misread as a block construct). Verse/list/table/blockquote
// and speeches are intentional Markit block syntax and opt out.
type BlockOut = {
  lines: string[];
  meta: string;
  keep: boolean;
  guard: boolean;
};

// Convert one block-level element into its Markit source lines (without the
// `{#id}` tag). `meta` is an optional inline metadata suffix; `keep` forces an
// otherwise-empty block (e.g. an empty figure) to be emitted anyway.
const renderBlockElement = (element: XmlElement, w: Walker): BlockOut => {
  const name = localName(element.name);
  const markup = (lines: string[]): BlockOut => ({
    lines,
    meta: "",
    keep: false,
    guard: false,
  });

  if (name === "lg" || name === "l") return markup(verseLines(element, w));
  if (name === "list") return markup(listLines(element, 0, w));
  if (name === "table") return markup(tableLines(element, w));
  if (name === "quote" || name === "cit") {
    return markup(blockquoteLines(element, w));
  }
  if (name === "stage") return markup(stageLines(element, w));
  if (name === "sp") return markup(mixedContent(element.children, w, false));
  if (isFootnote(element)) {
    return {
      lines: mixedContent(element.children, w, false),
      meta: "",
      keep: false,
      guard: true,
    };
  }

  const inner = mixedContent(element.children, w, name === "p");
  const meta = SEMANTIC_BLOCKS.has(name)
    ? `, element=${JSON.stringify(name)}`
    : "";
  return { lines: inner, meta, keep: meta !== "", guard: true };
};

// A <note> without a margin @place is a footnote (place="margin" becomes an
// inline aside instead — see renderInlineNode).
const isFootnote = (element: XmlElement): boolean =>
  localName(element.name) === "note" &&
  !MARGIN_PLACES.has((attr(element, "place") ?? "").toLowerCase());

// Render block-level children as the inner content of a single block. Inline
// runs become paragraphs, consecutive verse lines (`<l>`) become one verse list,
// and recognised block elements render in place; groups are blank-line
// separated. `asParagraph` forces the whole run to a single paragraph.
const mixedContent = (
  nodes: XmlNode[],
  w: Walker,
  asParagraph: boolean,
): string[] => {
  if (asParagraph) {
    return paragraphLines(renderInline(nodes, w, new Set()));
  }
  return blockContentGroups(nodes, w).flatMap((group, i) =>
    i === 0 ? group.lines : ["", ...group.lines]
  );
};

// A run of source lines forming one block-level group, plus whether those lines
// are prose that must be guarded against being misread as block syntax (`guard`)
// or are themselves intentional block syntax (verse, lists, tables, nested
// quotes/stages) that must be emitted verbatim.
type BlockGroup = { lines: string[]; guard: boolean };

// Split block-level children into ordered groups. Inline runs become paragraph
// groups, consecutive verse lines (`<l>`) become one verse group, and recognised
// block elements render in place as their own group.
const blockContentGroups = (nodes: XmlNode[], w: Walker): BlockGroup[] => {
  if (!nodes.some(isBlockNode)) {
    const lines = paragraphLines(renderInline(nodes, w, new Set()));
    return lines.length > 0 ? [{ lines, guard: true }] : [];
  }

  const groups: BlockGroup[] = [];
  let inlineRun: XmlNode[] = [];
  let verseRun: XmlElement[] = [];
  const flushInline = (): void => {
    if (inlineRun.length === 0) return;
    const lines = paragraphLines(renderInline(inlineRun, w, new Set()));
    if (lines.length > 0) groups.push({ lines, guard: true });
    inlineRun = [];
  };
  const flushVerse = (): void => {
    if (verseRun.length === 0) return;
    groups.push({
      lines: verseRun.flatMap((l) => verseLines(l, w)),
      guard: false,
    });
    verseRun = [];
  };

  for (const node of nodes) {
    if (isElement(node) && localName(node.name) === "l") {
      flushInline();
      verseRun.push(node);
    } else if (isBlockNode(node)) {
      flushInline();
      flushVerse();
      const out = renderBlockElement(node as XmlElement, w);
      groups.push({ lines: out.lines, guard: out.guard });
    } else {
      flushVerse();
      inlineRun.push(node);
    }
  }
  flushInline();
  flushVerse();
  return groups;
};

const isBlockNode = (node: XmlNode): boolean =>
  isElement(node) && isBlockLevel(localName(node.name));

const isBlockLevel = (name: string): boolean =>
  name === "p" ||
  name === "lg" ||
  name === "l" ||
  name === "list" ||
  name === "table" ||
  name === "quote" ||
  name === "cit" ||
  name === "stage" ||
  name === "sp" ||
  SEMANTIC_BLOCKS.has(name);

// --- Verse, lists, tables, blockquotes -----------------------------------

const verseLines = (element: XmlElement, w: Walker): string[] => {
  if (localName(element.name) === "l") {
    return [`* ${finishInline(renderInline(element.children, w, new Set()))}`];
  }
  // <lg>: each <l> is a line; nested <lg> stanzas are blank-line separated.
  const lines: string[] = [];
  for (const child of element.children) {
    if (!isElement(child)) continue;
    const name = localName(child.name);
    if (name === "l") {
      lines.push(
        `* ${finishInline(renderInline(child.children, w, new Set()))}`,
      );
    } else if (name === "lg") {
      if (lines.length > 0) lines.push("");
      lines.push(...verseLines(child, w));
    }
  }
  return lines;
};

const listLines = (
  element: XmlElement,
  indent: number,
  w: Walker,
): string[] => {
  const ordered = (attr(element, "type") ?? "").toLowerCase() === "ordered";
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  let n = 0;
  for (const child of element.children) {
    if (!isElement(child)) continue;
    const name = localName(child.name);
    if (name === "item") {
      n++;
      const marker = ordered ? `${n}.` : "-";
      const nested = childrenNamed(child, "list");
      const inlineKids = child.children.filter(
        (c) => !(isElement(c) && localName(c.name) === "list"),
      );
      lines.push(
        `${pad}${marker} ${
          finishInline(renderInline(inlineKids, w, new Set()))
        }`,
      );
      for (const sub of nested) lines.push(...listLines(sub, indent + 2, w));
    } else if (name === "head") {
      // A list <head> has no list equivalent; emit it as a leading plain item.
      lines.unshift(
        `${pad}- ${finishInline(renderInline(child.children, w, new Set()))}`,
      );
    }
  }
  return lines;
};

const tableLines = (element: XmlElement, w: Walker): string[] => {
  const lines: string[] = [];
  let headerDone = false;
  for (const row of element.children) {
    if (!isElement(row) || localName(row.name) !== "row") continue;
    const cells = childrenNamed(row, "cell");
    const rendered = cells.map((cell) =>
      finishInline(renderInline(cell.children, w, new Set())).replace(
        /\|/g,
        "\\|",
      )
    );
    lines.push(`| ${rendered.join(" | ")} |`);
    if (!headerDone && (attr(row, "role") ?? "").toLowerCase() === "label") {
      lines.push(`|${cells.map(() => "---").join("|")}|`);
      headerDone = true;
    }
  }
  return lines;
};

const blockquoteLines = (element: XmlElement, w: Walker): string[] =>
  prefixedBlockContent(element, w, ">");

// A block-level <stage> becomes `:`-prefixed stage-direction lines, with a bare
// `:` separating groups (mirrors blockquoteLines).
const stageLines = (element: XmlElement, w: Walker): string[] =>
  prefixedBlockContent(element, w, ":");

// Render an element's block-level content, each line prefixed with `marker` and
// a bare `marker` separating groups. Prose groups are guarded (a line that looks
// like a block construct is escaped, since the compiler re-parses the stripped
// inner content as full block content); intentional block syntax (lists, verse,
// tables, nested quotes/stages) is emitted verbatim. Line breaks land at
// end-of-line, matching the formatter.
const prefixedBlockContent = (
  element: XmlElement,
  w: Walker,
  marker: string,
): string[] =>
  blockContentGroups(element.children, w)
    // Drop empty groups (e.g. an empty <p>) so a bare `marker` only ever
    // separates two non-empty groups.
    .filter((group) => group.lines.length > 0)
    .flatMap((group, i) => {
      const lines = group.lines.map(
        (l) => `${marker} ${group.guard ? contentLine(l) : l}`,
      );
      return i === 0 ? lines : [marker, ...lines];
    });

// --- Inline rendering ----------------------------------------------------

// `open` tracks native wrapper types lexically open at this point. Markit's
// wrapper delimiters are symmetric (`_..._`), so the same type cannot nest in
// itself; when it would, we fall back to a generic element (a fresh boundary).
const renderInline = (nodes: XmlNode[], w: Walker, open: Set<string>): string =>
  nodes.map((node) => renderInlineNode(node, w, open)).join("");

const renderInlineNode = (
  node: XmlNode,
  w: Walker,
  open: Set<string>,
): string => {
  if (node.kind === "text") return escapeMarkit(plainText(node, w));
  if (node.kind !== "element") return ""; // comments / PIs dropped

  const element = node;
  const name = localName(element.name);

  // Glyphs resolve to Unicode; end-of-line hyphens close up the word.
  if (name === "g") {
    return JOIN_GLYPHS.has(attr(element, "ref") ?? "")
      ? JOIN
      : escapeMarkit(plainText(element, w));
  }
  if (name === "pb") return pageBreak(element);
  if (name === "lb") return "\\ ";
  if (name === "gap") return "[...]";

  if (name === "foreign") {
    const lang = langOf(element);
    const inner = renderInline(element.children, w, open);
    return hoistWhitespace(
      inner,
      (core) => lang ? `$${lang}:${core}$` : `$${core}$`,
    );
  }

  // Notes: margin notes become asides; bottom/foot/end notes become footnotes.
  if (name === "note") {
    if (MARGIN_PLACES.has((attr(element, "place") ?? "").toLowerCase())) {
      return wrapNative("aside", element, w, open);
    }
    const id = `n${++w.counter.n}`;
    w.footnotes.push({ id, lines: mixedContent(element.children, w, false) });
    return `<${id}>`;
  }

  // Abbreviation choices: prefer the expansion, dropping the abbreviated form.
  if (name === "choice") {
    const target = childrenNamed(element, "expan")[0] ??
      childrenNamed(element, "abbr")[0];
    return renderInline(target ? [target] : element.children, w, open);
  }
  if (name === "am") return ""; // abbreviation marker glyph: dropped
  if (name === "expan" || name === "abbr" || name === "seg") {
    return renderInline(element.children, w, open); // unwrap, keep content
  }

  // A word tagged with a disambiguating lemma becomes a Markit word element;
  // a bare <w> (no lemma) carries no extra meaning, so keep just its content.
  if (name === "w") {
    const lemma = attr(element, "lemma");
    if (lemma === undefined) return renderInline(element.children, w, open);
    const surface = renderInline(element.children, w, new Set());
    return `[w:${escapeWord(surface)}=${escapeWord(lemma)}]`;
  }

  // Native wrapper elements.
  const type = matchInlineRule(element);
  if (type) return wrapNative(type, element, w, open);

  // The long tail: preserve verbatim as a generic element.
  const tag = startTagInner(element);
  if (element.selfClosed) return `<<${tag}/>>`;
  return hoistWhitespace(
    renderInline(element.children, w, new Set()),
    (core) => `<<${tag}>>${core}<</${element.name}>>`,
  );
};

// Move whitespace at the very start/end of an inline element's content outside
// the Markit delimiters (the compiler trims whitespace inside a wrapper, so a
// leading space in `_ text_` would be lost, fusing the word to its neighbour).
// A wrapper of pure whitespace collapses to that whitespace with no delimiters.
const hoistWhitespace = (
  inner: string,
  wrap: (core: string) => string,
): string => {
  const lead = /^\s+/.exec(inner)?.[0] ?? "";
  const trail = /\s+$/.exec(inner)?.[0] ?? "";
  const core = inner.slice(lead.length, inner.length - trail.length);
  return core === "" ? inner : `${lead}${wrap(core)}${trail}`;
};

// Wrap an element's content in the Markit delimiters for `type`. If that type is
// already open (which would re-parse flat), fall back to a generic element with
// a fresh parse boundary instead.
const wrapNative = (
  type: WrapperType,
  element: XmlElement,
  w: Walker,
  open: Set<string>,
): string => {
  if (open.has(type)) {
    const tag = WRAPPER_TEI[type].name;
    return hoistWhitespace(
      renderInline(element.children, w, new Set()),
      (core) => `<<${tag}>>${core}<</${tag}>>`,
    );
  }
  const inner = renderInline(element.children, w, new Set(open).add(type));
  return hoistWhitespace(inner, (core) => delimit(type, core));
};

// Escape the structural characters of a `[w:surface=word]` element (`=`, `]`,
// and the escape character itself) so a surface or lemma round-trips intact.
const escapeWord = (text: string): string =>
  text.replace(/[\\=\]]/g, (char) => `\\${char}`);

// The parser's own delimiter table, so emission agrees with parsing by
// construction. Every `WrapperType` is a key (the type is derived from
// `wrapperElements`), so the lookup cannot miss.
const delimiters = new Map<WrapperType, { open: string; close: string }>(
  wrapperElements.map(({ type, open, close }) => [type, { open, close }]),
);

// Wrap an inline run in the Markit delimiters for a wrapper type.
const delimit = (type: WrapperType, inner: string): string => {
  const { open, close } = delimiters.get(type)!;
  return `${open}${inner}${close}`;
};

// --- Page breaks ---------------------------------------------------------

const pageBreak = (element: XmlElement): string => {
  const ref = attr(element, "n") ?? attr(element, "facs");
  return ref ? `//${ref.replace(/\s+/g, "_")}//` : "///";
};

const prependPage = (line: string, page: string | null): string =>
  page ? (line ? `${page} ${line}` : page) : line;

// --- Text, escaping, whitespace ------------------------------------------

// Concatenate a node's descendant text, optionally modernising letterforms.
const plainText = (node: XmlNode, w: Walker): string => {
  const raw = node.kind === "text"
    ? node.content
    : node.kind === "element"
    ? node.children.map((c) => plainText(c, w)).join("")
    : "";
  return w.options.modernize ? modernize(raw) : raw;
};

const modernize = (text: string): string => text.replace(/ſ/g, "s"); // long-s

// Escape characters that would otherwise be parsed as Markit markup, collapsing
// whitespace runs to single spaces. (The JOIN sentinel is added afterwards.)
const escapeMarkit = (text: string): string =>
  text
    .replace(/\s+/g, " ")
    .replace(/[\\{~[<$"*_^#@]/g, "\\$&")
    .replace(/,(?=,)/g, "\\,")
    .replace(/\/(?=\/)/g, "\\/")
    .replace(/:(?=:)/g, "\\:");

// Close up end-of-line hyphen joins (the JOIN sentinel and following whitespace)
// and tidy spacing on a finished inline run.
const finishInline = (text: string): string =>
  text.replace(JOIN_PATTERN, "").replace(/ {2,}/g, " ").trim();

// Finish an inline run and lay it out as paragraph source lines, breaking at
// each hard line-break marker so the output matches the formatter (which places
// every `\` at end-of-line). An empty run yields no lines.
const paragraphLines = (text: string): string[] => {
  const finished = finishInline(text);
  return finished === "" ? [] : splitOnLineBreakMarker(finished);
};

// Guard a content line against being misread as a block construct (heading,
// blockquote, list, table). We consult the real classifier so the guard stays
// in lock-step with the compiler.
const contentLine = (line: string): string => {
  let result = line;
  if (result.endsWith("|")) result = result.slice(0, -1) + "\\|";
  if (classifyBlockLine(result).kind !== "paragraph") result = `\\${result}`;
  return result;
};

// --- Metadata serialisation ----------------------------------------------

const serializeMeta = (tree: MetaTree): string[] => {
  if (tree.top.length === 0 && tree.sections.length === 0) return [];
  const lines = ["[metadata]"];
  for (const [key, value] of tree.top) lines.push(kv(key, value));
  // Sections are only ever recorded with at least one pair (see headerToMetadata).
  for (const [section, pairs] of tree.sections) {
    lines.push("");
    lines.push(`[metadata.${section}]`);
    for (const [key, value] of pairs) lines.push(kv(key, value));
  }
  return lines;
};

const kv = (key: string, value: string | string[]): string =>
  Array.isArray(value)
    ? `${key} = [${value.map((v) => JSON.stringify(v)).join(", ")}]`
    : `${key} = ${JSON.stringify(value)}`;

// A <div>/<text>'s own attributes become its text metadata.
const attrMeta = (element: XmlElement): MetaTree => {
  const top: [string, string | string[]][] = [];
  const type = attr(element, "type");
  const n = attr(element, "n");
  const lang = langOf(element);
  if (type) top.push(["type", type]);
  if (n) top.push(["n", n]);
  if (lang) top.push(["lang", lang]);
  return { top, sections: [] };
};

// --- IDs -------------------------------------------------------------------

const subTextId = (element: XmlElement, used: Set<string>): string => {
  const name = localName(element.name);
  let base = name;
  if (name === "div") {
    const type = attr(element, "type")?.replace(/[\s#{}]+/g, "_");
    const n = attr(element, "n")?.replace(/[\s#{}]+/g, "_");
    base = type && n ? `${type}_${n}` : (type ?? (n ? `div_${n}` : "div"));
  }
  return uniqueId(base, used);
};

const uniqueId = (base: string, used: Set<string>): string => {
  let id = base;
  let n = 1;
  while (used.has(id)) {
    n++;
    id = `${base}_${n}`;
  }
  used.add(id);
  return id;
};
