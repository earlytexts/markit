/**
 * Split a single line of paragraph prose on hard line-break markers (`\`),
 * placing each break at the end of its line as ` \`. Shared by the formatter
 * (so paragraphs are canonical) and the TEI converter (so its output is a
 * formatter fixed point by construction).
 *
 * A `\` is a line-break marker when followed by a space or the end of the
 * string. Each break emits the preceding text with a trailing ` \`; the final
 * segment carries no marker. Empty segments are dropped.
 */
export default (text: string): string[] =>
  text
    .replace(/(\S)\\(?= |$)/g, "$1 \\")
    .split(/\\(?= |$)/)
    .map((part, index, array) => {
      const trimmed = part.trim();
      return index < array.length - 1 ? `${trimmed} \\` : trimmed;
    })
    .filter((part) => part !== "");
