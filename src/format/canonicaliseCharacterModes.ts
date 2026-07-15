import processCharacterMode from "../compile/characterMode.ts";
import processGreekMode from "../compile/greekMode.ts";

/**
 * Canonicalise character mode (`{…}`) and Greek mode (`{{…}}`) in a content
 * line: each braced span is rewritten to the final Unicode it compiles to, so
 * the braces remain an input method (type `{e/}`, save, the formatter writes
 * `é`) while the source holds a single canonical spelling. The compiled
 * document is identical by construction — compile resolves the braces to the
 * same characters this writes.
 *
 * A span is left braced when rewriting it could not be proven inert: if its
 * resolved text contains a character Markit could re-parse as syntax (via an
 * escape like `{\$}`), whitespace other than internal single spaces, or
 * nothing at all — or if the span starts a line (after any `>`/`:` markers)
 * and resolves to an ASCII non-letter there (a digit could form `1.`, an
 * ordered-list marker; every block-level trigger is ASCII, so a non-ASCII
 * character like `§` or `—` is inert). Escaped braces (`\{`) never open a
 * span.
 */
export default (line: string): string => {
  let result = "";
  let pos = 0;
  while (pos < line.length) {
    const char = line[pos]!;
    // Escape: keep the pair verbatim; the next character opens nothing.
    if (char === "\\") {
      result += line.slice(pos, pos + 2);
      pos += 2;
      continue;
    }
    // Greek mode (checked before character mode, like the parser). An
    // unclosed `{{` is passed through for the compiler to report; scanning
    // continues after it, as the parser's does.
    if (line.startsWith("{{", pos)) {
      const closePos = line.indexOf("}}", pos + 2);
      if (closePos === -1) {
        result += "{{";
        pos += 2;
        continue;
      }
      const resolved = processGreekMode(line.slice(pos + 2, closePos));
      result += canRewrite(resolved, atLineStart(line, pos))
        ? resolved
        : line.slice(pos, closePos + 2);
      pos = closePos + 2;
      continue;
    }
    // Character mode.
    if (char === "{") {
      const closePos = line.indexOf("}", pos + 1);
      if (closePos === -1) {
        result += "{";
        pos += 1;
        continue;
      }
      const resolved = processCharacterMode(line.slice(pos + 1, closePos));
      result += canRewrite(resolved, atLineStart(line, pos))
        ? resolved
        : line.slice(pos, closePos + 1);
      pos = closePos + 1;
      continue;
    }
    result += char;
    pos++;
  }
  return result;
};

// Characters Markit gives syntax meaning somewhere (wrapper markers, element
// and word delimiters, page breaks, escapes, table cells, list markers, …).
// None is ever produced by a genuine conversion — they can only appear in a
// span's output via escapes or pass-through — so refusing to rewrite them
// costs nothing real and guarantees the rewritten line re-parses identically.
const syntaxCharacters = /[\\{}/<>$~"*_^#@[\]|=+?,:-]/;

/** Whether a resolved span is provably inert as literal source text. */
const canRewrite = (resolved: string, startsLine: boolean): boolean =>
  resolved.length > 0 &&
  !syntaxCharacters.test(resolved) &&
  // Leading/trailing whitespace or internal runs would be re-collapsed by the
  // formatter and the paragraph joiner, changing the compiled text.
  !/^\s|\s$|\s\s/.test(resolved) &&
  // At the start of a line, a leading ASCII non-letter risks reclassifying
  // the line (a digit could form `1.`); letters and non-ASCII (`§`, `—`,
  // Greek) match no block-level trigger, which are all ASCII.
  (!startsLine || /^[\p{L}\u0080-\u{10FFFF}]/u.test(resolved));

/**
 * Whether the span at `pos` starts the line's content: preceded only by
 * whitespace and blockquote/stage-direction markers, where the block-level
 * classifier reads its first characters.
 */
const atLineStart = (line: string, pos: number): boolean =>
  /^[>:\s]*$/.test(line.slice(0, pos));
