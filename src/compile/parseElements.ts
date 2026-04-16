import type { InlineElement, Language, MarkitError } from "../types.js";
import {
  braceCodes,
  footnoteReferenceSpec,
  isWrapperElement,
  leafElements,
  wrapperElements,
} from "../types.js";
import type { PositionInfo } from "./buildPositionMap.js";
import makeError from "./makeError.js";
import transliterateGreek, { applyDiacritics } from "./transliterateGreek.js";

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

// Languages that receive diacritics processing (accent markers)
const diacriticLangs = new Set(["la", "fr"]);
// Languages that receive transliteration + diacritics (Latin-to-Greek)
const transliterateLangs = new Set(["grc"]);

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

    // 1. Escape character (suppressed inside language wrappers)
    if (!suppressEscape && input[pos] === "\\") {
      if (pos + 1 < input.length) {
        plainTextBuffer += input[pos + 1];
        pos += 2;
        continue;
      } else {
        // Backslash at end of input - treat as literal
        plainTextBuffer += "\\";
        pos++;
        continue;
      }
    }

    // 2. Brace code
    if (input[pos] === "{") {
      const closeBracePos = input.indexOf("}", pos + 1);
      if (closeBracePos === -1) {
        const position = positionMap[pos]!;
        errors.push(
          makeError({
            message: "Unclosed brace code",
            line: position.line,
            column: position.column,
            length: 1,
          }),
        );
        // Treat as literal
        plainTextBuffer += input[pos];
        pos++;
        continue;
      }

      const code = input.slice(pos + 1, closeBracePos);
      const braceCode = braceCodes.find((bc) => bc.code === code);

      if (braceCode) {
        flushPlainText();
        result.push({ type: "plainText", content: braceCode.result });
        pos = closeBracePos + 1;
        continue;
      }

      const diacriticResult = applyBraceCodeDiacritics(code);
      if (diacriticResult !== null) {
        flushPlainText();
        result.push({ type: "plainText", content: diacriticResult });
        pos = closeBracePos + 1;
        continue;
      }

      const position = positionMap[pos + 1]!;
      errors.push(
        makeError({
          message: `Unknown brace code: ${code}`,
          line: position.line,
          column: position.column,
          length: code.length,
        }),
      );
      // Treat as literal
      plainTextBuffer += input.slice(pos, closeBracePos + 1);
      pos = closeBracePos + 1;
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

    // 4. Page break: || (bare) or |ref| (with reference) — only outside language wrappers
    if (!suppressEscape && input[pos] === "|") {
      if (input[pos + 1] === "|") {
        flushPlainText();
        result.push({ type: "pageBreak" });
        pos += 2;
        continue;
      }
      const closeBarPos = input.indexOf("|", pos + 1);
      if (closeBarPos !== -1) {
        const ref = input.slice(pos + 1, closeBarPos);
        if (ref.length > 0 && !/\s/.test(ref)) {
          flushPlainText();
          result.push({ type: "pageBreak", ref });
          pos = closeBarPos + 1;
          continue;
        }
      }
      plainTextBuffer += "|";
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
        true,
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

      const processedContent =
        lang !== undefined && transliterateLangs.has(lang)
          ? transliterateGreek(wrapperContent)
          : lang !== undefined && diacriticLangs.has(lang)
            ? applyDiacritics(wrapperContent)
            : wrapperContent;

      flushPlainText();
      const languageElement: Language =
        lang !== undefined
          ? { type: "language", lang, content: processedContent }
          : { type: "language", content: processedContent };
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

// Diacritic markers available in brace codes (accent-only, same as Latin/French)
const braceCodeDiacritics: Record<string, string> = {
  "/": "\u0301",
  "\\": "\u0300",
  "=": "\u0302",
  "+": "\u0308",
};

/**
 * Try to interpret a brace code as "letter + diacritic markers".
 * Returns the NFC-normalised result string, or null if the code doesn't match.
 */
const applyBraceCodeDiacritics = (code: string): string | null => {
  if (code.length < 2) return null;
  const base = code[0]!;
  const markers = code.slice(1);
  let combining = "";
  for (const ch of markers) {
    const c = braceCodeDiacritics[ch];
    if (!c) return null;
    combining += c;
  }
  return (base + combining).normalize("NFC");
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
