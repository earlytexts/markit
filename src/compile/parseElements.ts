import type { InlineElement, MarkitError } from "../types.js";
import {
  braceCodes,
  footnoteReferenceSpec,
  isWrapperElement,
  leafElements,
  wrapperElements,
} from "../types.js";
import type { PositionInfo } from "./buildPositionMap.js";
import makeError from "./makeError.js";
import transliterateGreek from "./transliterateGreek.js";

export default (
  input: string,
  positionMap: PositionInfo[],
  footnoteIds: string[],
): [InlineElement[], MarkitError[]] => {
  const errors: MarkitError[] = [];
  const [elements] = parseElements(
    input,
    0,
    null,
    positionMap,
    footnoteIds,
    errors,
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

    // 1. Escape character
    if (input[pos] === "\\") {
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
      } else {
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

    // 4. Footnote reference
    if (input[pos] === "<") {
      const closeAnglePos = input.indexOf(">", pos + 1);
      if (closeAnglePos !== -1) {
        const refId = input.slice(pos + 1, closeAnglePos);
        if (footnoteReferenceSpec.pattern.test(refId)) {
          flushPlainText();
          result.push({ type: "footnoteReference", id: refId });

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

    // 5. Wrapper elements (check longest first)
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

        // Apply Greek transliteration if needed
        const finalContent =
          wrapper.type === "greek"
            ? transliterateGreek(wrapperContent)
            : wrapperContent;

        result.push({ type: wrapper.type, content: finalContent });
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

    // Recursively clean wrapper element content
    if (isWrapperElement(element)) {
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

  // Trim whitespace adjacent to lineBreak elements
  for (let i = 0; i < result.length; i++) {
    if (result[i]?.type === "lineBreak") {
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
