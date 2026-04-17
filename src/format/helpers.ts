import type { State } from "./types.js";

// Emit the given line
export const emitLine = (state: State, line: string): State => {
  return {
    ...state,
    acc: [...state.acc, line],
    lastEmitted: "nonblank",
  };
};

// Emit a blank line (only if last wasn't blank)
export const emitBlank = (state: State): State => {
  if (state.lastEmitted === "blank") return state;
  return {
    ...state,
    acc: [...state.acc, ""],
    lastEmitted: "blank",
  };
};

// Flush content buffer.
// Block-level elements are line-based:
//   - lines matching ^[1-6] space     → heading (consecutive heading lines form a group)
//   - lines starting with >           → blockquote
//   - blank lines                     → element separator
//   - everything else                 → paragraph line (consecutive lines are collapsed)
// Consecutive paragraph lines are joined and whitespace is collapsed.
export const flushContent = (state: State): State => {
  if (state.contentBuffer.length === 0) return state;

  const outputLines = extractBlockElements(state.contentBuffer);

  return {
    ...state,
    acc: [...state.acc, ...outputLines],
    contentBuffer: [],
    lastEmitted: "nonblank",
  };
};

// Process content buffer lines, preserving block-level structure and normalizing whitespace.
const extractBlockElements = (buffer: string[]): string[] => {
  const output: string[] = [];
  let paragraphLines: string[] = [];
  let blockquoteLines: string[] = [];
  let headingLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphLines.length === 0) return;
    const collapsed = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    output.push(...splitOnLineBreakMarker(collapsed));
    paragraphLines = [];
  };

  const flushBlockquote = (): void => {
    if (blockquoteLines.length === 0) return;
    const inner = extractBlockElements(blockquoteLines);
    // Add blank line before blockquote if needed
    if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }
    for (const line of inner) {
      output.push(line === "" ? ">" : `> ${line}`);
    }
    blockquoteLines = [];
  };

  const flushHeading = (): void => {
    if (headingLines.length === 0) return;
    // Add blank line before heading group if we already have content
    if (output.length > 0 && output.at(-1) !== "") {
      output.push("");
    }
    // Emit all heading lines with no blank lines between them
    for (const line of headingLines) {
      output.push(line);
    }
    headingLines = [];
  };

  for (let i = 0; i < buffer.length; i++) {
    const line = buffer[i]!;
    const trimmed = line.trim();

    // Blank line — separator between block-level elements
    if (trimmed === "") {
      flushParagraph();
      flushBlockquote();
      flushHeading();
      // Only emit a blank line if we've already output something
      if (output.length > 0 && output.at(-1) !== "") {
        output.push("");
      }
      continue;
    }

    // Heading line: ^ followed by digit 1-6 and a space
    if (/^\^[1-6] /.test(trimmed)) {
      flushParagraph();
      flushBlockquote();
      headingLines.push(trimmed);
      continue;
    }

    // Blockquote line: starts with >
    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushHeading();
      const inner = trimmed.slice(1).trim();
      if (inner) {
        blockquoteLines.push(inner);
      } else {
        // Bare ">" acts as a paragraph separator within blockquotes
        blockquoteLines.push("");
      }
      continue;
    }

    // Regular content line — accumulate as paragraph
    flushBlockquote();
    flushHeading();
    // Add blank line before paragraph if we already have content
    if (
      paragraphLines.length === 0 &&
      output.length > 0 &&
      output.at(-1) !== ""
    ) {
      output.push("");
    }
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushBlockquote();
  flushHeading();

  // Strip any trailing blank or bare blockquote separator lines
  while (output.at(-1) === "" || output.at(-1) === ">") output.pop();

  return output;
};

// Split content on '//' markers to create line breaks
const splitOnLineBreakMarker = (text: string): string[] => {
  return text
    .replace(/(\S)\/\//g, "$1 //")
    .split("//")
    .map((part, index, array) => {
      const trimmed = part.trim();
      return index < array.length - 1 ? `${trimmed} //` : trimmed;
    })
    .filter((part) => part !== "");
};
