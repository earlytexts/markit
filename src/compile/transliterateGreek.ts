import type { InlineElement } from "../types.js";

// Full diacritic set for Greek (breathings + accents + diaeresis + iota subscript)
const greekDiacritics: Record<string, string> = {
  ")": "\u0313", // smooth breathing (psili)
  "(": "\u0314", // rough breathing (dasia)
  "/": "\u0301", // acute accent (oxia)
  "\\": "\u0300", // grave accent (varia)
  "=": "\u0342", // circumflex (perispomeni)
  "+": "\u0308", // diaeresis
  "|": "\u0345", // iota subscript
};

// Accent-only set for Latin and French
const accentDiacritics: Record<string, string> = {
  "/": "\u0301", // acute
  "\\": "\u0300", // grave
  "=": "\u0302", // circumflex (Latin standard, not Greek perispomeni)
  "+": "\u0308", // diaeresis
};

export default (content: InlineElement[]): InlineElement[] =>
  content.map((el) => transliterateElement(el, greekDiacritics));

export const applyDiacritics = (content: InlineElement[]): InlineElement[] =>
  content.map((el) => transliterateElement(el, accentDiacritics));

const transliterateElement = (
  element: InlineElement,
  diacritics: Record<string, string>,
): InlineElement => {
  if (element.type === "plainText") {
    return {
      ...element,
      content: processContent(element.content, diacritics),
    };
  } else if ("content" in element && Array.isArray(element.content)) {
    return {
      ...element,
      content: element.content.map((el) =>
        transliterateElement(el, diacritics),
      ),
    };
  }
  return element;
};

const processContent = (
  input: string,
  diacritics: Record<string, string>,
): string => {
  let result = "";
  let pos = 0;

  while (pos < input.length) {
    // Try digraphs first (Greek transliteration only)
    if (diacritics === greekDiacritics) {
      const digraph = digraphs.find(([latin]) => input.startsWith(latin, pos));
      if (digraph) {
        result += digraph[1];
        pos += digraph[0].length;
        result = consumeDiacritics(input, pos, diacritics, result);
        pos += countDiacritics(input, pos, diacritics);
        continue;
      }
    }

    const char = input[pos]!;

    if (diacritics === greekDiacritics) {
      const lower = lowerMap[char];
      const upper = upperMap[char];
      if (lower) {
        result += char === "s" && isWordBoundary(input[pos + 1]) ? "ς" : lower;
        pos += 1;
      } else if (upper) {
        result += upper;
        pos += 1;
      } else {
        result += char;
        pos += 1;
      }
    } else {
      result += char;
      pos += 1;
    }

    // Consume diacritic markers following this character
    const combining = collectDiacritics(input, pos, diacritics);
    result += combining.chars;
    pos += combining.count;
  }

  return result.normalize("NFC");
};

const collectDiacritics = (
  input: string,
  pos: number,
  diacritics: Record<string, string>,
): { chars: string; count: number } => {
  let chars = "";
  let count = 0;
  while (pos + count < input.length) {
    const combining = diacritics[input[pos + count]!];
    if (!combining) break;
    chars += combining;
    count++;
  }
  return { chars, count };
};

// Helper used in the digraph branch
const consumeDiacritics = (
  input: string,
  pos: number,
  diacritics: Record<string, string>,
  result: string,
): string => {
  const { chars } = collectDiacritics(input, pos, diacritics);
  return result + chars;
};

const countDiacritics = (
  input: string,
  pos: number,
  diacritics: Record<string, string>,
): number => collectDiacritics(input, pos, diacritics).count;

const isWordBoundary = (char: string | undefined): boolean =>
  char === undefined || /\s/.test(char) || /[.,;:!?'"[\]{}<>]/.test(char);

const digraphs: [string, string][] = [
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
  h: "η",
};

const upperMap: Record<string, string> = {
  A: "Α",
  B: "Β",
  G: "Γ",
  D: "Δ",
  E: "Ε",
  Z: "Ζ",
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
  H: "Η",
};
