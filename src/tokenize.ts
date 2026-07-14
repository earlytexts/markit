import { renderSourced } from "./renderText.ts";
import type { MarkitDocument, Token } from "./types.ts";

/**
 * The word alphabet for tokenisation: a run of letters, digits, and apostrophes
 * with at least one letter or digit (leading, internal, and trailing apostrophes
 * are kept), joined across an internal period before a letter (`i.e`) and across
 * a non-breaking space — U+00A0, what `~` renders to — before a letter or digit,
 * so `a~priori` is one token. Mirrors the corpus's word pattern, plus the U+00A0
 * join: the one deliberate divergence, letting the markup mark a multi-word unit.
 */
export const wordPattern =
  /['’]*[\p{L}\p{N}](?:[\p{L}\p{N}'’]|\.(?=\p{L})|\u00A0(?=[\p{L}\p{N}]))*/gu;

/**
 * Tokenize a compiled document into its word tokens, in reading order, each with
 * its `[start, end)` offsets into `renderText(document)`. A token from a document
 * compiled with `{ tokens: true }` also carries its `source` span; otherwise
 * `source` is absent (the rendered text carries no provenance).
 */
export default (document: MarkitDocument): Token[] => {
  const { text, sources } = renderSourced(document);
  const tokens: Token[] = [];
  for (const match of text.matchAll(wordPattern)) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;
    const startSource = sources[start];
    const endSource = sources[end - 1];
    tokens.push({
      text: word.replaceAll("\u00A0", " "),
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
    });
  }
  return tokens;
};
