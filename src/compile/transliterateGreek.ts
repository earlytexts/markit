import type { Element } from "../types.js";

export default (content: Element[]): Element[] =>
  content.map(transliterateElement);

const transliterateElement = (element: Element): Element => {
  if (element.type === "plainText") {
    return { ...element, content: transliterateContent(element.content) };
  } else if ("content" in element && Array.isArray(element.content)) {
    return { ...element, content: element.content.map(transliterateElement) };
  }
  return element;
};

const transliterateContent = (input: string): string => {
  let result = "";
  let pos = 0;

  while (pos < input.length) {
    // Try digraphs first
    const digraph = digraphs.find(([latin]) => input.startsWith(latin, pos));
    if (digraph) {
      result += digraph[1];
      pos += digraph[0].length;
      continue;
    }

    const char = input[pos]!;
    const lower = lowerMap[char];
    const upper = upperMap[char];

    if (lower) {
      // Handle final sigma: lowercase 's' at word boundary
      if (char === "s" && isWordBoundary(input[pos + 1])) {
        result += "ς";
      } else {
        result += lower;
      }
      pos += 1;
    } else if (upper) {
      result += upper;
      pos += 1;
    } else {
      result += char;
      pos += 1;
    }
  }

  return result;
};

const isWordBoundary = (char: string | undefined): boolean => {
  return (
    char === undefined ||
    /\s/.test(char) ||
    /[.,;:!?'"()[\]{}<>\/\\]/.test(char)
  );
};

const digraphs: ReadonlyArray<readonly [string, string]> = [
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

const lowerMap: Readonly<Record<string, string>> = {
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

const upperMap: Readonly<Record<string, string>> = {
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
