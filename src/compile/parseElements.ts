import type {
  ElementAttribute,
  InlineElement,
  Language,
  MarkitError,
} from "../types.ts";
import {
  elementSpec,
  footnoteReferenceSpec,
  isWrapperElement,
  leafElements,
  wordSpec,
  wrapperElements,
} from "../types.ts";
import type { PositionInfo } from "./buildPositionMap.ts";
import makeError from "../lib/makeError.ts";
import processGreekMode from "./greekMode.ts";
import processCharacterMode from "./characterMode.ts";

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

export default (
  input: string,
  positionMap: PositionInfo[],
  footnoteIds: ReadonlySet<string>,
  textId: string,
): [InlineElement[], MarkitError[]] => {
  const errors: MarkitError[] = [];
  const [elements] = parseElements(
    input,
    0,
    null,
    positionMap,
    footnoteIds,
    errors,
    false,
    textId,
  );
  const cleanedElements = cleanupElements(elements);
  return [cleanedElements, errors];
};

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
  positionMap: PositionInfo[],
  footnoteIds: ReadonlySet<string>,
  errors: MarkitError[],
  suppressEscape: boolean,
  textId: string,
): [InlineElement[], number, boolean] => {
  const result: InlineElement[] = [];
  let pos = startPos;
  let plainTextBuffer = "";
  const closeChar = closeMarker === null ? -1 : closeMarker.charCodeAt(0);

  const flushPlainText = () => {
    if (plainTextBuffer.length > 0) {
      result.push({ type: "plainText", content: plainTextBuffer });
      plainTextBuffer = "";
    }
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
      plainTextBuffer += input.slice(pos, end);
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
        plainTextBuffer += input[next]!;
        pos += 2;
      }
      continue;
    }

    // 2. Greek mode: {{...}}
    if (input.startsWith("{{", pos)) {
      const closePos = input.indexOf("}}", pos + 2);
      if (closePos === -1) {
        const position = positionMap[pos]!;
        errors.push(
          makeError({
            message: "Unclosed Greek mode",
            line: position.line,
            column: position.column,
            length: 2,
          }),
        );
        plainTextBuffer += "{{";
        pos += 2;
        continue;
      }
      const content = input.slice(pos + 2, closePos);
      flushPlainText();
      result.push({ type: "plainText", content: processGreekMode(content) });
      pos = closePos + 2;
      continue;
    }

    // 3. Character mode: {...}
    if (input[pos] === "{") {
      const closePos = input.indexOf("}", pos + 1);
      if (closePos === -1) {
        const position = positionMap[pos]!;
        errors.push(
          makeError({
            message: "Unclosed character mode",
            line: position.line,
            column: position.column,
            length: 1,
          }),
        );
        plainTextBuffer += "{";
        pos++;
        continue;
      }
      const content = input.slice(pos + 1, closePos);
      flushPlainText();
      result.push({
        type: "plainText",
        content: processCharacterMode(content),
      });
      pos = closePos + 1;
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
        result.push({ type: "pageBreak" });
        pos += 3;
        continue;
      }
      const closePos = input.indexOf("//", pos + 2);
      if (closePos !== -1) {
        const ref = input.slice(pos + 2, closePos);
        if (ref.length > 0 && !/\s/.test(ref)) {
          flushPlainText();
          result.push({ type: "pageBreak", ref });
          pos = closePos + 2;
          continue;
        }
      }
      plainTextBuffer += "/";
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
            positionMap,
            footnoteIds,
            errors,
            suppressEscape,
            textId,
          );

          if (!closed) {
            const position = positionMap[pos]!;
            errors.push(
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
          result.push({ type: "footnoteReference", id: `${textId}.${refId}` });

          if (!footnoteIds.has(refId)) {
            const position = positionMap[pos]!;
            errors.push(
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
        positionMap,
        footnoteIds,
        errors,
        false,
        textId,
      );

      if (!closed) {
        const position = positionMap[pos]!;
        errors.push(
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
        const [surface] = parseElements(
          input.slice(surfaceStart, separator),
          0,
          null,
          positionMap.slice(surfaceStart, separator),
          footnoteIds,
          errors,
          suppressEscape,
          textId,
        );
        const word = input
          .slice(separator + 1, close)
          .replace(/\\(.)/g, "$1")
          .trim();
        flushPlainText();
        result.push({ type: "word", word, content: surface });
        pos = close + 1;
        continue;
      }
      const position = positionMap[pos]!;
      errors.push(
        makeError({
          message: "Malformed word element; expected [w:surface=word].",
          line: position.line,
          column: position.column,
          length: wordSpec.open.length,
        }),
      );
      plainTextBuffer += input[pos];
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
          positionMap,
          footnoteIds,
          errors,
          suppressEscape,
          textId,
        );

        if (!closed) {
          const position = positionMap[pos]!;
          errors.push(
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
    plainTextBuffer += input[pos];
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
 * Trim leading and trailing whitespace from the element list, trim whitespace
 * adjacent to lineBreak elements, and recursively clean wrapper element content.
 */
const cleanupElements = (elements: InlineElement[]): InlineElement[] => {
  const result: InlineElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;

    // Recursively clean wrapper, word, language, and generic-element content
    if (
      isWrapperElement(element) ||
      element.type === "word" ||
      element.type === "language" ||
      element.type === "element"
    ) {
      result.push({ ...element, content: cleanupElements(element.content) });
    } else {
      result.push(element);
    }
  }

  // Trim leading whitespace from the first plainText element
  const first = result[0];
  if (first && first.type === "plainText") {
    const trimmed = first.content.trimStart();
    if (trimmed.length === 0) {
      result.shift();
    } else {
      result[0] = { type: "plainText", content: trimmed };
    }
  }

  // Trim trailing whitespace from the last plainText element
  const last = result[result.length - 1];
  if (last && last.type === "plainText") {
    const trimmed = last.content.trimEnd();
    if (trimmed.length === 0) {
      result.pop();
    } else {
      result[result.length - 1] = { type: "plainText", content: trimmed };
    }
  }

  // Trim whitespace adjacent to lineBreak and pageBreak elements
  for (let i = 0; i < result.length; i++) {
    if (result[i]?.type === "lineBreak" || result[i]?.type === "pageBreak") {
      const prev = result[i - 1];
      if (prev?.type === "plainText") {
        const trimmed = prev.content.trimEnd();
        if (trimmed.length === 0) {
          result.splice(i - 1, 1);
          i--;
        } else {
          result[i - 1] = { type: "plainText", content: trimmed };
        }
      }
      const next = result[i + 1];
      if (next?.type === "plainText") {
        const trimmed = next.content.trimStart();
        if (trimmed.length === 0) {
          result.splice(i + 1, 1);
        } else {
          result[i + 1] = { type: "plainText", content: trimmed };
        }
      }
    }
  }

  return result;
};
