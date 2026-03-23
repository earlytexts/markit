import type { Element, MarkitError } from "../types.js";
import {
  braceCodes,
  footnoteReferenceSpec,
  headingSpec,
  isBlockLevelType,
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
): [Element[], MarkitError[]] => {
  // Step 1: Parse content and collect errors
  const errors: MarkitError[] = [];
  const [elements] = parseElements(
    input,
    0,
    null,
    false,
    positionMap,
    footnoteIds,
    errors,
  );

  // Step 2: Clean up whitespace around block-level elements
  const cleanedElements = cleanupElements(elements);

  return [cleanedElements, errors];
};

const parseElements = (
  input: string,
  startPos: number,
  closeMarker: string | null,
  insideBlockLevel: boolean,
  positionMap: PositionInfo[],
  footnoteIds: string[],
  errors: MarkitError[],
): [Element[], number] => {
  const result: Element[] = [];
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

    // 5. Heading
    if (input[pos] === headingSpec.marker) {
      const levelChar = input[pos + 1];
      if (levelChar && /[1-6]/.test(levelChar)) {
        const level = parseInt(levelChar, 10);
        const hasSpace = input[pos + 2] === " ";

        if (hasSpace) {
          if (insideBlockLevel) {
            const position = positionMap[pos]!;
            errors.push(
              makeError({
                message: "Block-level elements cannot be nested",
                line: position.line,
                column: position.column,
                length: 3,
              }),
            );
            // Treat as literal
            plainTextBuffer += input.slice(pos, pos + 3);
            pos += 3;
            continue;
          }

          const closeMarkerStr = `${headingSpec.marker}${level}`;
          const [headingContent, newPos] = parseElements(
            input,
            pos + 3,
            closeMarkerStr,
            true,
            positionMap,
            footnoteIds,
            errors,
          );

          if (
            newPos === pos + 3 ||
            !input.startsWith(closeMarkerStr, newPos - closeMarkerStr.length)
          ) {
            // Unclosed heading
            const position = positionMap[pos]!;
            errors.push(
              makeError({
                message: `Unclosed heading level ${level}`,
                line: position.line,
                column: position.column,
                length: 3,
              }),
            );
          }

          flushPlainText();
          result.push({ type: "heading", level, content: headingContent });
          pos = newPos;
          continue;
        }
      }
    }

    // 6. Wrapper elements (check longest first)
    let wrapperMatched = false;
    for (const wrapper of [...wrapperElements].sort(
      (a, b) => b.open.length - a.open.length,
    )) {
      if (input.startsWith(wrapper.open, pos)) {
        if (isBlockLevelType(wrapper.type) && insideBlockLevel) {
          const position = positionMap[pos]!;
          errors.push(
            makeError({
              message: "Block-level elements cannot be nested",
              line: position.line,
              column: position.column,
              length: wrapper.open.length,
            }),
          );
          // Treat as literal
          plainTextBuffer += wrapper.open;
          pos += wrapper.open.length;
          wrapperMatched = true;
          break;
        }

        const [wrapperContent, newPos] = parseElements(
          input,
          pos + wrapper.open.length,
          wrapper.close,
          isBlockLevelType(wrapper.type) || insideBlockLevel,
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

    // 7. Plain text
    plainTextBuffer += input[pos];
    pos++;
  }

  // Check if we were expecting a close marker but reached end of input
  if (closeMarker && pos >= input.length) {
    // Error already reported in the calling context for unclosed markers
  }

  flushPlainText();

  return [result, pos];
};

/**
 * Clean up whitespace-only plainText elements around block-level elements
 * and trim content inside block-level elements.
 */
const cleanupElements = (elements: ReadonlyArray<Element>): Element[] => {
  const result: Element[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;

    // Skip whitespace-only plainText between block elements or at the end
    if (element.type === "plainText" && /^\s+$/.test(element.content)) {
      const prevElement = result[result.length - 1];
      const nextElement = elements[i + 1];

      // Remove if:
      // - This is at the end with no next element, OR
      // - This is between two block-level elements, OR
      // - This is after a block-level element at the end
      if (
        !nextElement ||
        (prevElement && isBlockLevelType(prevElement.type)) ||
        (nextElement && isBlockLevelType(nextElement.type))
      ) {
        continue;
      }
    }

    // Trim trailing space from plainText that comes before a block-level element
    if (element.type === "plainText") {
      const nextElement = elements[i + 1];
      if (nextElement && isBlockLevelType(nextElement.type)) {
        result.push({
          type: "plainText",
          content: element.content.trimEnd(),
        });
        continue;
      }
    }

    // Trim leading space from plainText that comes after a block-level element
    if (element.type === "plainText") {
      const prevElement = result[result.length - 1];
      if (prevElement && isBlockLevelType(prevElement.type)) {
        result.push({
          type: "plainText",
          content: element.content.trimStart(),
        });
        continue;
      }
    }

    // Recursively clean up content in wrapper elements and trim block-level elements
    if (element.type === "heading" || isWrapperElement(element)) {
      const cleanedContent = cleanupElements(element.content);

      // Trim content inside block-level elements
      if (isBlockLevelType(element.type)) {
        // Remove leading whitespace-only plainText elements
        while (
          cleanedContent.length > 0 &&
          cleanedContent[0]!.type === "plainText" &&
          typeof cleanedContent[0]!.content === "string" &&
          /^\s+$/.test(cleanedContent[0]!.content)
        ) {
          cleanedContent.shift();
        }

        // Trim leading space from the first element if it's plainText
        const firstElement = cleanedContent[0];
        if (
          firstElement &&
          firstElement.type === "plainText" &&
          typeof firstElement.content === "string"
        ) {
          cleanedContent[0] = {
            type: "plainText",
            content: firstElement.content.trimStart(),
          };
        }

        // Trim trailing space from the last element if it's plainText
        const lastIndex = cleanedContent.length - 1;
        const lastElement = cleanedContent[lastIndex];
        if (
          lastElement &&
          lastElement.type === "plainText" &&
          typeof lastElement.content === "string"
        ) {
          cleanedContent[lastIndex] = {
            type: "plainText",
            content: lastElement.content.trimEnd(),
          };
        }
      }

      result.push({ ...element, content: cleanedContent });
    } else {
      result.push(element);
    }
  }

  return result;
};
