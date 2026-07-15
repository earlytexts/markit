import { extract } from "./extract.ts";
import type { Block, Frame, Token, Version } from "./types.ts";

/**
 * The word alphabet for tokenisation: a run of letters, digits, and apostrophes
 * with at least one letter or digit (leading, internal, and trailing apostrophes
 * are kept), joined across an internal period before a letter (`i.e`) and across
 * a non-breaking space — U+00A0, what `~` extracts to — before a letter or digit,
 * so `a~priori` is one token. Exported for plain-string uses (e.g. segmenting
 * search queries); tokenising a block goes through `tokenize`.
 */
export const wordPattern: RegExp =
  /['’]*[\p{L}\p{N}](?:[\p{L}\p{N}'’]|\.(?=\p{L})|\u00A0(?=[\p{L}\p{N}]))*/gu;

/**
 * Tokenize a block into its word tokens, in reading order — `wordPattern` run
 * over `extractText(block, { version }).text` (default `edited`). Each token
 * carries its `[start, end)` offsets into that text, the wrapper context
 * around it, the distilled `word`/`lang` values, and — when the block comes
 * from `compileWithPositions` — its span in the source. See `Token`.
 */
export default (
  block: Block,
  options?: { version?: Version },
): Token[] => {
  const { text, spans, sources } = extract(
    block,
    options?.version ?? "edited",
  );
  const tokens: Token[] = [];
  let spanIndex = 0;
  for (const match of text.matchAll(wordPattern)) {
    const start = match.index;
    const end = start + match[0].length;
    // A token's first character is a word character or apostrophe, which only
    // plainText contributions produce — so it always falls inside a span, and
    // matches arrive in order, so a forward cursor finds it.
    while (spans[spanIndex]!.end <= start) spanIndex++;
    const context = spans[spanIndex]!.context;
    const word = innermost(context, "word")?.word;
    const lang = innermost(context, "language")?.lang;
    const startSource = sources[start];
    const endSource = sources[end - 1];
    tokens.push({
      text: match[0].replaceAll("\u00A0", " "),
      start,
      end,
      ...(startSource && endSource
        ? {
          source: {
            start: startSource,
            end: { line: endSource.line, column: endSource.column + 1 },
          },
        }
        : {}),
      context,
      ...(word !== undefined ? { word } : {}),
      ...(lang !== undefined ? { lang } : {}),
    });
  }
  return tokens;
};

/** The nearest (innermost) frame of the given type, if any. */
const innermost = <T extends Frame["type"]>(
  context: Frame[],
  type: T,
): Extract<Frame, { type: T }> | undefined => {
  for (let i = context.length - 1; i >= 0; i--) {
    const frame = context[i]!;
    if (frame.type === type) return frame as Extract<Frame, { type: T }>;
  }
  return undefined;
};
