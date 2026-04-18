// Process the raw string content of a {...} character mode span.
export default (input: string): string => {
  let result = "";
  let pos = 0;
  while (pos < input.length) {
    // Escape: \X → literal X
    if (input[pos] === "\\") {
      if (pos + 1 < input.length) {
        result += input[pos + 1];
        pos += 2;
      } else {
        result += "\\";
        pos++;
      }
      continue;
    }
    // Special symbols: -- → em dash, - → en dash, $ → §
    if (input.startsWith("--", pos)) {
      result += "\u2014"; // em dash
      pos += 2;
      continue;
    }
    if (input[pos] === "-") {
      result += "\u2013"; // en dash
      pos++;
      continue;
    }
    if (input[pos] === "$") {
      result += "\u00A7"; // §
      pos++;
      continue;
    }
    // Digraphs (ligatures and cedilla) — checked before single-char + diacritics
    const digraph = characterDigraphs.find(([d]) => input.startsWith(d, pos));
    if (digraph) {
      result += digraph[1];
      pos += digraph[0].length;
      continue;
    }
    // Base char + following diacritic markers
    result += input[pos];
    pos++;
    while (
      pos < input.length &&
      input[pos] !== "\\" &&
      characterDiacritics[input[pos]!] !== undefined
    ) {
      result += characterDiacritics[input[pos]!]!;
      pos++;
    }
  }
  return result.normalize("NFC");
};

// Diacritic markers for character mode (accent-only)
const characterDiacritics: Record<string, string> = {
  "/": "\u0301", // acute
  "`": "\u0300", // grave
  "^": "\u0302", // circumflex (Latin standard)
  '"': "\u0308", // diaeresis
};

// Ligature and cedilla digraphs for character mode
const characterDigraphs: [string, string][] = [
  ["ae", "æ"],
  ["AE", "Æ"],
  ["oe", "œ"],
  ["OE", "Œ"],
  ["c,", "ç"],
  ["C,", "Ç"],
];
