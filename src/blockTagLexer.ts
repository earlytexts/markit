// Scan `input` from `start` for the closing `}` of a block tag, tracking string
// literals so a `}` inside `"..."` doesn't terminate the tag. Backslash escapes
// inside strings are respected.
export const findClosingBrace = (input: string, start: number): number => {
  let inString = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "}") {
      return i;
    }
  }
  return -1;
};

export type BlockTagChunk = { content: string; offset: number };

// Split a block-tag body on top-level commas, skipping commas that fall inside
// string literals (`"..."`, with backslash escapes) or bracket groups (`[...]`).
// Returns each non-empty chunk, trimmed, along with the offset of the trimmed
// content within the original input (for diagnostic positioning).
export const splitTopLevelCommas = (input: string): BlockTagChunk[] => {
  const chunks: BlockTagChunk[] = [];
  let start = 0;

  const pushChunk = (rawStart: number, rawEnd: number): void => {
    const raw = input.slice(rawStart, rawEnd);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      chunks.push({ content: trimmed, offset: rawStart + leading });
    }
  };

  let depth = 0;
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      if (depth > 0) depth--;
    } else if (ch === "," && depth === 0) {
      pushChunk(start, i);
      start = i + 1;
    }
  }
  pushChunk(start, input.length);

  return chunks;
};
