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

// Flush content buffer
// Calls extractBlockElements to handle block tags (headings and blockquotes) within content
export const flushContent = (state: State): State => {
  if (state.contentBuffer.length === 0) return state;

  const collapsedContent = state.contentBuffer.join(" ");
  const extractedLines = extractBlockElements(collapsedContent);

  return {
    ...state,
    acc: [...state.acc, ...extractedLines],
    contentBuffer: [],
    lastEmitted: "nonblank",
  };
};

// Extract block-level elements (headings and blockquotes) to separate lines
const extractBlockElements = (content: string): string[] => {
  const lines: string[] = [];

  // Find all block-level elements: £N...£N headings and ""..."" blockquotes
  const blockRegex = /(£\d[^£]*£\d|""[^"]*"")/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const beforeBlock = content.slice(lastIndex, match.index).trim();
    const blockElement = match[0];

    // Add text before the block element
    if (beforeBlock) {
      lines.push(...splitOnLineBreakMarker(beforeBlock, 0));
    }

    // Add the block element with appropriate formatting
    if (blockElement.startsWith('"')) {
      // Blockquote - indent with 4 spaces
      lines.push(...splitOnLineBreakMarker(blockElement, 4));
    } else {
      // Heading - no indentation
      lines.push(...splitOnLineBreakMarker(blockElement, 0));
    }

    lastIndex = match.index + blockElement.length;
  }

  // Add any remaining text after the last block element
  const afterLast = content.slice(lastIndex).trim();
  if (afterLast) {
    lines.push(...splitOnLineBreakMarker(afterLast, 0));
  }

  // Return the lines (guaranteed to be at least one because contentBuffer is
  // not empty when this is called)
  return lines;
};

// Split content on '//' markers to create line breaks
const splitOnLineBreakMarker = (text: string, offset: number): string[] => {
  return text
    .replace(/(\S)\/\//g, "$1 //")
    .split("//")
    .map((part, index, array) => {
      const trimmed = part.trim();
      const withLineBreak =
        index < array.length - 1 ? `${trimmed} //` : trimmed;
      return " ".repeat(offset) + withLineBreak;
    })
    .filter((part) => part !== "" && part !== "//");
};
