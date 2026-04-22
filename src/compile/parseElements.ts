import type { InlineElement, Language, MarkitError } from "../types.js";
import {
  footnoteReferenceSpec,
  isWrapperElement,
  leafElements,
  wrapperElements,
} from "../types.js";
import type { PositionInfo } from "./buildPositionMap.js";
import makeError from "../lib/makeError.js";
import processGreekMode from "./greekMode.js";
import processCharacterMode from "./characterMode.js";

export default (
  input: string,
  positionMap: PositionInfo[],
  footnoteIds: string[],
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

const parseElements = (
  input: string,
  startPos: number,
  closeMarker: string | null,
  positionMap: PositionInfo[],
  footnoteIds: string[],
  errors: MarkitError[],
  suppressEscape: boolean,
  textId: string,
): [InlineElement[], number] => {
  const result: InlineElement[] = [];
  let pos = startPos;
  let plainTextBuffer = "";

  const flushPlainText = () => {
    if (plainTextBuffer.length > 0) {
      result.push({ type: "plainText", content: plainTextBuffer });
      plainTextBuffer = "";
    }
  };

  while (pos < input.length) {
    // Check for close marker
    if (closeMarker && input.startsWith(closeMarker, pos)) {
      flushPlainText();
      return [result, pos + closeMarker.length];
    }

    // 1. Line break: \ followed by whitespace or end of input
    if (!suppressEscape && input[pos] === "\\") {
      const next = pos + 1;
      if (next >= input.length || /\s/.test(input[next]!)) {
        flushPlainText();
        result.push({ type: "lineBreak" });
        pos = next;
        continue;
      }
    }

    // 2. Escape character (suppressed inside language wrappers)
    if (!suppressEscape && input[pos] === "\\") {
      plainTextBuffer += input[pos + 1]!;
      pos += 2;
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

    // 2b. Character mode: {...}
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

    // 3. Leaf elements (check longest first)
    let leafMatched = false;
    for (const leaf of [...leafElements].sort(
      (a, b) => b.trigger.length - a.trigger.length,
    )) {
      if (input.startsWith(leaf.trigger, pos)) {
        flushPlainText();
        result.push({ type: leaf.type });
        pos += leaf.trigger.length;
        leafMatched = true;
        break;
      }
    }
    if (leafMatched) continue;

    // 4. Page break: /// (bare) or //ref// (with reference)
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

    // 5. Footnote reference
    if (input[pos] === "<") {
      const closeAnglePos = input.indexOf(">", pos + 1);
      if (closeAnglePos !== -1) {
        const refId = input.slice(pos + 1, closeAnglePos);
        if (footnoteReferenceSpec.pattern.test(refId)) {
          flushPlainText();
          result.push({ type: "footnoteReference", id: `${textId}.${refId}` });

          if (!footnoteIds.includes(refId)) {
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

    // 6. Language wrapper: $lang:...$  or generic foreign $...$
    if (input[pos] === "$") {
      const langMatch = /[a-z]+:/y;
      langMatch.lastIndex = pos + 1;
      const match = langMatch.exec(input);
      const lang = match ? match[0].slice(0, -1) : undefined;
      const openMarker = match ? `$${match[0]}` : "$";
      const startAfterOpen = pos + openMarker.length;

      const [wrapperContent, newPos] = parseElements(
        input,
        startAfterOpen,
        "$",
        positionMap,
        footnoteIds,
        errors,
        false,
        textId,
      );

      if (newPos === startAfterOpen || !input.startsWith("$", newPos - 1)) {
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
      const languageElement: Language =
        lang !== undefined
          ? { type: "language", lang, content: wrapperContent }
          : { type: "language", content: wrapperContent };
      result.push(languageElement);
      pos = newPos;
      continue;
    }

    // 7. Wrapper elements (check longest first)
    let wrapperMatched = false;
    for (const wrapper of [...wrapperElements].sort(
      (a, b) => b.open.length - a.open.length,
    )) {
      if (input.startsWith(wrapper.open, pos)) {
        const [wrapperContent, newPos] = parseElements(
          input,
          pos + wrapper.open.length,
          wrapper.close,
          positionMap,
          footnoteIds,
          errors,
          suppressEscape,
          textId,
        );

        if (
          newPos === pos + wrapper.open.length ||
          !input.startsWith(wrapper.close, newPos - wrapper.close.length)
        ) {
          // Unclosed wrapper
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

    // 6. Plain text
    plainTextBuffer += input[pos];
    pos++;
  }

  flushPlainText();

  return [result, pos];
};

/**
 * Trim leading and trailing whitespace from the element list, trim whitespace
 * adjacent to lineBreak elements, and recursively clean wrapper element content.
 */
const cleanupElements = (elements: InlineElement[]): InlineElement[] => {
  const result: InlineElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;

    // Recursively clean wrapper and language element content
    if (isWrapperElement(element) || element.type === "language") {
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
