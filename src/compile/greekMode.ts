// Process the raw string content of a {{...}} Greek mode span.
export default (input: string): string => {
  let result = "";
  let pos = 0;

  // Collect any diacritic markers following the base character just emitted.
  const collectDiacritics = (): void => {
    while (
      pos < input.length &&
      input[pos] !== "\\" &&
      greekDiacritics[input[pos]!] !== undefined
    ) {
      result += greekDiacritics[input[pos]!]!;
      pos++;
    }
  };

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
    // Latin-to-Greek transliteration digraphs
    const digraph = greekTransDigraphs.find(([d]) => input.startsWith(d, pos));
    if (digraph) {
      result += digraph[1];
      pos += digraph[0].length;
      collectDiacritics();
      continue;
    }
    // Single character transliteration
    const char = input[pos]!;
    const lower = lowerMap[char];
    const upper = upperMap[char];
    if (lower !== undefined) {
      if (char === "s") {
        result += isGreekWordBoundary(input[pos + 1]) ? "ς" : "σ";
      } else {
        result += lower;
      }
      pos++;
    } else if (upper !== undefined) {
      result += upper;
      pos++;
    } else {
      result += char;
      pos++;
    }
    collectDiacritics();
  }
  return result.normalize("NFC");
};

// In Greek mode, diacritic markers are never word boundaries.
// Also excludes " from punctuation since it's a diacritic marker.
const isGreekWordBoundary = (char: string | undefined): boolean => {
  if (char === undefined) return true;
  if (greekDiacritics[char] !== undefined) return false;
  return /\s/.test(char) || /[.,;:!?'[\]{}<>]/.test(char);
};

// Diacritic markers for Greek mode (breathings + accents + diaeresis + iota subscript)
const greekDiacritics: Record<string, string> = {
  ")": "\u0313", // smooth breathing (psili)
  "(": "\u0314", // rough breathing (dasia)
  "/": "\u0301", // acute accent (oxia)
  "`": "\u0300", // grave accent (varia)
  "^": "\u0342", // circumflex (perispomeni — Greek-specific combining char)
  '"': "\u0308", // diaeresis
  "|": "\u0345", // iota subscript
};

// Latin-to-Greek transliteration digraphs
const greekTransDigraphs: [string, string][] = [
  ["th", "θ"],
  ["Th", "Θ"],
  ["TH", "Θ"],
  ["ph", "φ"],
  ["Ph", "Φ"],
  ["PH", "Φ"],
  ["ch", "χ"],
  ["Ch", "Χ"],
  ["CH", "Χ"],
  ["ps", "ψ"],
  ["Ps", "Ψ"],
  ["PS", "Ψ"],
];

const lowerMap: Record<string, string> = {
  a: "α",
  b: "β",
  g: "γ",
  d: "δ",
  e: "ε",
  z: "ζ",
  h: "η",
  i: "ι",
  k: "κ",
  l: "λ",
  m: "μ",
  n: "ν",
  x: "ξ",
  o: "ο",
  p: "π",
  r: "ρ",
  s: "σ",
  t: "τ",
  u: "υ",
  y: "υ",
  w: "ω",
};

const upperMap: Record<string, string> = {
  A: "Α",
  B: "Β",
  G: "Γ",
  D: "Δ",
  E: "Ε",
  Z: "Ζ",
  H: "Η",
  I: "Ι",
  K: "Κ",
  L: "Λ",
  M: "Μ",
  N: "Ν",
  X: "Ξ",
  O: "Ο",
  P: "Π",
  R: "Ρ",
  S: "Σ",
  T: "Τ",
  U: "Υ",
  Y: "Υ",
  W: "Ω",
};
