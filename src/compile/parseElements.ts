import type {
  ElementAttribute,
  InlineElement,
  Language,
  MarkitError,
  PlainText,
} from "../types.ts";
import {
  elementSpec,
  footnoteReferenceSpec,
  isWrapperElement,
  leafElements,
  wordSpec,
  wrapperElements,
} from "../lib/grammar.ts";
import type { PositionInfo } from "./buildPositionMap.ts";
import makeError from "../lib/makeError.ts";
import processGreekMode from "./greekMode.ts";
import processCharacterMode from "./characterMode.ts";
import { extractInlineText } from "../extract.ts";
import { wordPattern } from "../tokenize.ts";

/**
 * The invariants of one block's content parse, threaded through the block-level
 * and inline parsers as a single argument: the text's footnote ids (for
 * reference validation), its id (prefixed onto compiled ids), the shared error
 * sink, and whether to record source positions.
 */
export type ParseContext = {
  footnoteIds: ReadonlySet<string>;
  errors: MarkitError[];
  textId: string;
  positions: boolean;
};

/**
 * Parse a run of inline content into elements, reporting any diagnostics into
 * `ctx.errors`. `positionMap` gives each input character's source position.
 */
export default (
  input: string,
  positionMap: PositionInfo[],
  ctx: ParseContext,
): InlineElement[] => {
  const [elements] = parseElements(input, 0, null, false, positionMap, ctx);
  return cleanupElements(elements);
};

// The grammar's leaf and wrapper specs, pre-sorted longest-trigger-first so the
// parser always matches the most specific marker (e.g. `~~` before `~`).
const leafElementsByLength = [...leafElements].sort(
  (a, b) => b.trigger.length - a.trigger.length,
);
const wrapperElementsByLength = [...wrapperElements].sort(
  (a, b) => b.open.length - a.open.length,
);

// Every character that can begin a non-plain-text construct, derived from the
// grammar specs. The parser consumes whole runs of non-special characters as a
// single slice of plain text, so only the (rare) special characters pay for the
// full construct dispatch below. Close markers whose first character is not in
// this table (`+]`, `-]`, `?]`) are handled by an extra per-call check.
const specialChars = new Uint8Array(128);
for (const char of "\\{/<$") specialChars[char.charCodeAt(0)] = 1;
for (const leaf of leafElements) specialChars[leaf.trigger.charCodeAt(0)] = 1;
for (const wrapper of wrapperElements) {
  specialChars[wrapper.open.charCodeAt(0)] = 1;
}

/**
 * Parse inline elements from `input` starting at `startPos`, stopping at
 * `closeMarker` (or the end of input). Returns the parsed elements, the
 * position after the last consumed character, and whether the close marker
 * was actually found and consumed — callers report an "unclosed" diagnostic
 * when it wasn't.
 */
const parseElements = (
  input: string,
  startPos: number,
  closeMarker: string | null,
  suppressEscape: boolean,
  positionMap: PositionInfo[],
  ctx: ParseContext,
): [InlineElement[], number, boolean] => {
  const result: InlineElement[] = [];
  let pos = startPos;
  let plainTextBuffer = "";
  let bufferPositions: PositionInfo[] = [];
  const closeChar = closeMarker === null ? -1 : closeMarker.charCodeAt(0);

  const flushPlainText = () => {
    if (plainTextBuffer.length > 0) {
      result.push({
        type: "plainText",
        content: plainTextBuffer,
        ...(ctx.positions ? { sources: bufferPositions } : {}),
      });
      plainTextBuffer = "";
      bufferPositions = [];
    }
  };

  // Append the source characters `input[from..to)` to the plain-text buffer,
  // tracking each one's source position for provenance while recording.
  const appendSource = (from: number, to: number) => {
    plainTextBuffer += input.slice(from, to);
    if (ctx.positions) {
      for (let k = from; k < to; k++) bufferPositions.push(positionMap[k]!);
    }
  };
  // Append `char` (already resolved, e.g. an unescaped character) mapping it to
  // the single source index `at`.
  const appendChar = (char: string, at: number) => {
    plainTextBuffer += char;
    if (ctx.positions) bufferPositions.push(positionMap[at]!);
  };
  // Positions for a transformed run (Greek/character mode) whose rendered length
  // may differ from its source: map each output char onto a source char, holding
  // at the last one once the source runs out.
  const spanPositions = (
    start: number,
    sourceLen: number,
    outLen: number,
  ): PositionInfo[] =>
    Array.from(
      { length: outLen },
      (_, i) => positionMap[start + Math.min(i, sourceLen - 1)]!,
    );

  // Consume a braced input-method span (`{{...}}` Greek mode, `{...}` character
  // mode) at `pos`. The resolved text merges into the running plain-text
  // buffer: the braces are an input method, not a document structure, so
  // `x{{s}}y` and its resolved spelling compile to the identical single
  // plainText node. An unclosed span reports a diagnostic and the open marker
  // is kept as plain text.
  const inputMode = (
    open: string,
    close: string,
    label: string,
    process: (content: string) => string,
  ): void => {
    const closePos = input.indexOf(close, pos + open.length);
    if (closePos === -1) {
      const position = positionMap[pos]!;
      ctx.errors.push(
        makeError({
          message: `Unclosed ${label}`,
          line: position.line,
          column: position.column,
          length: open.length,
        }),
      );
      appendSource(pos, pos + open.length);
      pos += open.length;
      return;
    }
    const content = input.slice(pos + open.length, closePos);
    const resolved = process(content);
    plainTextBuffer += resolved;
    if (ctx.positions) {
      bufferPositions.push(
        ...spanPositions(pos + open.length, content.length, resolved.length),
      );
    }
    pos = closePos + close.length;
  };

  while (pos < input.length) {
    // Fast path: consume a whole run of plain text, up to the next character
    // that could begin a construct or the current close marker
    const code = input.charCodeAt(pos);
    if (code !== closeChar && (code >= 128 || specialChars[code] === 0)) {
      let end = pos + 1;
      while (end < input.length) {
        const c = input.charCodeAt(end);
        if (c === closeChar || (c < 128 && specialChars[c] === 1)) break;
        end++;
      }
      appendSource(pos, end);
      pos = end;
      continue;
    }

    // Check for close marker
    if (closeMarker && input.startsWith(closeMarker, pos)) {
      flushPlainText();
      return [result, pos + closeMarker.length, true];
    }

    // 1. Backslash (suppressed inside language wrappers): a hard line break
    // when followed by whitespace or the end of input, otherwise an escape
    if (!suppressEscape && input[pos] === "\\") {
      const next = pos + 1;
      if (next >= input.length || /\s/.test(input[next]!)) {
        flushPlainText();
        result.push({ type: "lineBreak" });
        pos = next;
      } else {
        appendChar(input[next]!, next);
        pos += 2;
      }
      continue;
    }

    // 2. Greek mode: {{...}}
    if (input.startsWith("{{", pos)) {
      inputMode("{{", "}}", "Greek mode", processGreekMode);
      continue;
    }

    // 3. Character mode: {...}
    if (input[pos] === "{") {
      inputMode("{", "}", "character mode", processCharacterMode);
      continue;
    }

    // 4. Leaf elements (check longest first)
    let leafMatched = false;
    for (const leaf of leafElementsByLength) {
      if (input.startsWith(leaf.trigger, pos)) {
        flushPlainText();
        result.push({ type: leaf.type });
        pos += leaf.trigger.length;
        leafMatched = true;
        break;
      }
    }
    if (leafMatched) continue;

    // 5. Page break: /// (bare) or //ref// (with reference)
    if (!suppressEscape && input.startsWith("//", pos)) {
      if (input[pos + 2] === "/") {
        flushPlainText();
        const tight = isTightBreak(input[pos - 1], input[pos + 3]);
        result.push({ type: "pageBreak", ...(tight ? { tight } : {}) });
        pos += 3;
        continue;
      }
      const closePos = input.indexOf("//", pos + 2);
      if (closePos !== -1) {
        const ref = input.slice(pos + 2, closePos);
        if (ref.length > 0 && !/\s/.test(ref)) {
          flushPlainText();
          const tight = isTightBreak(input[pos - 1], input[closePos + 2]);
          result.push({ type: "pageBreak", ref, ...(tight ? { tight } : {}) });
          pos = closePos + 2;
          continue;
        }
      }
      appendSource(pos, pos + 1);
      pos++;
      continue;
    }

    // 6. Generic raw element: <<TAG attr="v">>content<</TAG>> or <<TAG/>>
    // (checked before footnote references, which use a single `<`)
    if (input.startsWith(elementSpec.open, pos)) {
      const tagEnd = input.indexOf(
        elementSpec.close,
        pos + elementSpec.open.length,
      );
      if (tagEnd !== -1) {
        const startTag = parseRawStartTag(
          input.slice(pos + elementSpec.open.length, tagEnd),
        );
        if (startTag) {
          const { tag, attributes, selfClosing } = startTag;
          const afterTag = tagEnd + elementSpec.close.length;

          if (selfClosing) {
            flushPlainText();
            result.push({
              type: "element",
              tag,
              attributes,
              selfClosing: true,
              content: [],
            });
            pos = afterTag;
            continue;
          }

          const endMarker = `${elementSpec.endOpen}${tag}${elementSpec.close}`;
          const [elementContent, newPos, closed] = parseElements(
            input,
            afterTag,
            endMarker,
            suppressEscape,
            positionMap,
            ctx,
          );

          if (!closed) {
            const position = positionMap[pos]!;
            ctx.errors.push(
              makeError({
                message: `Unclosed element: ${elementSpec.open}${tag}`,
                line: position.line,
                column: position.column,
                length: elementSpec.open.length + tag.length,
              }),
            );
          }

          flushPlainText();
          result.push({
            type: "element",
            tag,
            attributes,
            content: elementContent,
          });
          pos = newPos;
          continue;
        }
      }
    }

    // 7. Footnote reference
    if (input[pos] === "<") {
      const closeAnglePos = input.indexOf(">", pos + 1);
      if (closeAnglePos !== -1) {
        const refId = input.slice(pos + 1, closeAnglePos);
        if (footnoteReferenceSpec.pattern.test(refId)) {
          flushPlainText();
          result.push({
            type: "footnoteReference",
            id: `${ctx.textId}.${refId}`,
          });

          if (!ctx.footnoteIds.has(refId)) {
            const position = positionMap[pos]!;
            ctx.errors.push(
              makeError({
                message: `Footnote not found: ${refId}`,
                line: position.line,
                column: position.column,
                length: closeAnglePos - pos + 1,
              }),
            );
          }

          pos = closeAnglePos + 1;
          continue;
        }
      }
    }

    // 8. Language wrapper: $lang:...$  or generic foreign $...$
    if (input[pos] === "$") {
      const langMatch = /[a-z]+:/y;
      langMatch.lastIndex = pos + 1;
      const match = langMatch.exec(input);
      const lang = match ? match[0].slice(0, -1) : undefined;
      const openMarker = match ? `$${match[0]}` : "$";
      const startAfterOpen = pos + openMarker.length;

      const [wrapperContent, newPos, closed] = parseElements(
        input,
        startAfterOpen,
        "$",
        false,
        positionMap,
        ctx,
      );

      if (!closed) {
        const position = positionMap[pos]!;
        ctx.errors.push(
          makeError({
            message: `Unclosed formatting: ${openMarker}`,
            line: position.line,
            column: position.column,
            length: openMarker.length,
          }),
        );
      }

      flushPlainText();
      const languageElement: Language = lang !== undefined
        ? { type: "language", lang, content: wrapperContent }
        : { type: "language", content: wrapperContent };
      result.push(languageElement);
      pos = newPos;
      continue;
    }

    // 9. Word disambiguation: [w:surface=word] (e.g. [w:humane=human]). The
    // surface is parsed as inline content; the disambiguated word is a plain
    // string. Checked before the wrapper loop, where `[` opens a citation.
    if (input.startsWith(wordSpec.open, pos)) {
      const surfaceStart = pos + wordSpec.open.length;
      const [separator, close] = scanWordDelimiters(input, surfaceStart);
      if (separator !== -1) {
        // The surface is parsed as an isolated substring (restarting at 0), so
        // its position map is sliced to match.
        const [surface] = parseElements(
          input.slice(surfaceStart, separator),
          0,
          null,
          suppressEscape,
          positionMap.slice(surfaceStart, separator),
          ctx,
        );
        const word = input
          .slice(separator + 1, close)
          .replace(/\\(.)/g, "$1")
          .trim();
        // `w` assigns a disambiguated word to one token, so the surface must
        // tokenize to exactly one token — in both versions, since editorial
        // markup inside the surface could otherwise make the count
        // version-dependent. (`[w:a~priori=x]` is legal: `~` extracts as
        // U+00A0, which the word pattern joins across.)
        const singleToken = (["edited", "original"] as const).every(
          (version) =>
            [...extractInlineText(surface, version).matchAll(wordPattern)]
              .length === 1,
        );
        if (!singleToken) {
          const position = positionMap[pos]!;
          ctx.errors.push(
            makeError({
              message:
                "Word surface must be exactly one token (mark a multi-word unit with ~).",
              line: position.line,
              column: position.column,
              length: close + 1 - pos,
            }),
          );
        }
        flushPlainText();
        result.push({ type: "word", word, content: surface });
        pos = close + 1;
        continue;
      }
      const position = positionMap[pos]!;
      ctx.errors.push(
        makeError({
          message: "Malformed word element; expected [w:surface=word].",
          line: position.line,
          column: position.column,
          length: wordSpec.open.length,
        }),
      );
      appendSource(pos, pos + 1);
      pos++;
      continue;
    }

    // 10. Wrapper elements (check longest first)
    let wrapperMatched = false;
    for (const wrapper of wrapperElementsByLength) {
      if (input.startsWith(wrapper.open, pos)) {
        const [wrapperContent, newPos, closed] = parseElements(
          input,
          pos + wrapper.open.length,
          wrapper.close,
          suppressEscape,
          positionMap,
          ctx,
        );

        if (!closed) {
          const position = positionMap[pos]!;
          ctx.errors.push(
            makeError({
              message: `Unclosed formatting: ${wrapper.open}`,
              line: position.line,
              column: position.column,
              length: wrapper.open.length,
            }),
          );
        }

        flushPlainText();
        result.push({ type: wrapper.type, content: wrapperContent });
        pos = newPos;
        wrapperMatched = true;
        break;
      }
    }
    if (wrapperMatched) continue;

    // 11. Plain text (a special character that began no construct)
    appendSource(pos, pos + 1);
    pos++;
  }

  flushPlainText();

  return [result, pos, false];
};

/**
 * Parse the inside of a generic raw-element start tag (the text between `<<` and
 * `>>`) into a tag name, ordered attributes, and a self-closing flag. Returns
 * null when the text is not a well-formed start tag (e.g. a stray close tag),
 * so the caller can fall back to treating `<<` as plain text.
 *
 * Attribute values are taken verbatim between double quotes; a value therefore
 * cannot itself contain a double quote (XML callers encode it as `&quot;`).
 */
const parseRawStartTag = (
  inner: string,
): {
  tag: string;
  attributes: ElementAttribute[];
  selfClosing: boolean;
} | null => {
  let rest = inner.trim();
  if (rest.length === 0) return null;

  let selfClosing = false;
  if (rest.endsWith("/")) {
    selfClosing = true;
    rest = rest.slice(0, -1).trim();
  }

  const tagMatch = /^([^\s/>]+)/.exec(rest);
  if (!tagMatch) return null;
  const tag = tagMatch[1]!;

  const attributes: ElementAttribute[] = [];
  const attrPattern = /([^\s=/]+)\s*=\s*"([^"]*)"/g;
  attrPattern.lastIndex = tag.length;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(rest)) !== null) {
    attributes.push({ name: match[1]!, value: match[2]! });
  }

  return { tag, attributes, selfClosing };
};

/**
 * Scan a `[w:` body for its `=` separator and closing `]`, honouring backslash
 * escapes so `\=` and `\]` are literal. Returns [separatorIndex, closeIndex]
 * for a well-formed `[w:surface=word]`, or [-1, -1] when there is no unescaped
 * `=` followed later by an unescaped `]` (a malformed word element).
 */
const scanWordDelimiters = (
  input: string,
  start: number,
): [number, number] => {
  let separator = -1;
  for (let i = start; i < input.length; i++) {
    const char = input[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === wordSpec.separator && separator === -1) {
      separator = i;
    } else if (char === wordSpec.close) {
      return separator === -1 ? [-1, -1] : [separator, i];
    }
  }
  return [-1, -1];
};

/**
 * Whether a page break falls inside a word: non-whitespace on both sides in the
 * (whitespace-collapsed) source. A break at a paragraph edge, or with whitespace
 * on either side, is loose — a word boundary. `undefined` (off the ends of the
 * input) counts as whitespace, so edge breaks are loose.
 */
const isTightBreak = (
  before: string | undefined,
  after: string | undefined,
): boolean =>
  before !== undefined &&
  after !== undefined &&
  !/\s/.test(before) &&
  !/\s/.test(after);

/**
 * Trim leading and trailing whitespace from the element list, trim whitespace
 * adjacent to lineBreak and pageBreak elements, and recursively clean wrapper
 * element content.
 *
 * `protectStart`/`protectEnd` guard the list's outer edges from that trim. They
 * are set when the list is a wrapper's content and the wrapper's delimiter is
 * *tight* — a word abuts it in the source — so the edge whitespace is a real
 * inter-word space, not cosmetic padding. This is what keeps `_a _b_ c_` (one
 * italic phrase with a roman `b`) compiling to `emphasis("a "), "b",
 * emphasis(" c")` instead of gluing the words. The paragraph/line edges of a
 * block are always loose, so the top-level call leaves both false.
 */
const cleanupElements = (
  elements: InlineElement[],
  protectStart = false,
  protectEnd = false,
): InlineElement[] => {
  const result: InlineElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;

    // Recursively clean wrapper, word, language, and generic-element content,
    // protecting each edge whose delimiter is tight against a neighbouring word.
    if (
      isWrapperElement(element) ||
      element.type === "word" ||
      element.type === "language" ||
      element.type === "element"
    ) {
      result.push({
        ...element,
        content: cleanupElements(
          element.content,
          isTightEdgeBefore(elements[i - 1]),
          isTightEdgeAfter(elements[i + 1]),
        ),
      });
    } else {
      result.push(element);
    }
  }

  // Trim leading whitespace from the first plainText element
  const first = result[0];
  if (!protectStart && first && first.type === "plainText") {
    const trimmed = trimPlainTextStart(first);
    if (trimmed) result[0] = trimmed;
    else result.shift();
  }

  // Trim trailing whitespace from the last plainText element
  const last = result[result.length - 1];
  if (!protectEnd && last && last.type === "plainText") {
    const trimmed = trimPlainTextEnd(last);
    if (trimmed) result[result.length - 1] = trimmed;
    else result.pop();
  }

  // Trim whitespace adjacent to lineBreak and pageBreak elements
  for (let i = 0; i < result.length; i++) {
    if (result[i]?.type === "lineBreak" || result[i]?.type === "pageBreak") {
      const prev = result[i - 1];
      if (prev?.type === "plainText") {
        const trimmed = trimPlainTextEnd(prev);
        if (trimmed) {
          result[i - 1] = trimmed;
        } else {
          result.splice(i - 1, 1);
          i--;
        }
      }
      const next = result[i + 1];
      if (next?.type === "plainText") {
        const trimmed = trimPlainTextStart(next);
        if (trimmed) result[i + 1] = trimmed;
        else result.splice(i + 1, 1);
      }
    }
  }

  return result;
};

/**
 * Whether a wrapper's opening delimiter is tight against its preceding sibling —
 * a word sits flush before it in the source, so the wrapper's leading edge
 * whitespace is a real inter-word space and must be kept. Structurally that is a
 * sibling that does not itself carry the separating space: a non-plainText
 * content element (flush against the delimiter), or a plainText not ending in
 * whitespace. A line/page break, or no sibling at all (a paragraph/line edge),
 * is a word boundary, hence loose.
 */
const isTightEdgeBefore = (prev: InlineElement | undefined): boolean =>
  prev !== undefined &&
  prev.type !== "lineBreak" &&
  prev.type !== "pageBreak" &&
  (prev.type !== "plainText" || !/\s$/.test(prev.content));

/**
 * The trailing counterpart of `isTightEdgeBefore`: whether a word sits flush
 * after the wrapper's closing delimiter, so its trailing edge whitespace is a
 * real inter-word space.
 */
const isTightEdgeAfter = (next: InlineElement | undefined): boolean =>
  next !== undefined &&
  next.type !== "lineBreak" &&
  next.type !== "pageBreak" &&
  (next.type !== "plainText" || !/^\s/.test(next.content));

/** `node` with leading whitespace trimmed, or null when nothing remains. */
const trimPlainTextStart = (node: PlainText): PlainText | null => {
  const from = node.content.length - node.content.trimStart().length;
  return from === node.content.length
    ? null
    : slicePlainText(node, from, node.content.length);
};

/** `node` with trailing whitespace trimmed, or null when nothing remains. */
const trimPlainTextEnd = (node: PlainText): PlainText | null => {
  const to = node.content.trimEnd().length;
  return to === 0 ? null : slicePlainText(node, 0, to);
};

/**
 * A `plainText` node holding `node.content[from..to)`, carrying the matching
 * slice of the original's source positions so trimming keeps provenance
 * aligned. `node.sources` is present exactly when recording, so the spread is
 * exercised both ways.
 */
const slicePlainText = (
  node: PlainText,
  from: number,
  to: number,
): PlainText => ({
  type: "plainText",
  content: node.content.slice(from, to),
  ...(node.sources ? { sources: node.sources.slice(from, to) } : {}),
});
