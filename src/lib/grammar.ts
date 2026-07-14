// The grammar constants: the markers, delimiters, and element tables the parser
// and formatter match against. They live here, apart from the type definitions
// in ../types.ts, so that module stays purely types — letting `index.ts`
// re-export it with `export type *` without JSR documenting these values too.

import type { InlineElement, Wrapper } from "../types.ts";

export const headingSpec = {
  marker: "^",
  minLevel: 1,
  maxLevel: 6,
} as const;

export const blockquoteSpec = {
  marker: ">",
} as const;

export const stageDirectionSpec = {
  marker: ":",
} as const;

export const listSpec = {
  unorderedMarker: "-",
  orderedMarker: ".",
  verseMarker: "*",
  indentSize: 2,
} as const;

export const tableSpec = {
  cellDelimiter: "|",
  separatorPattern: /^\s*\|?\s*-+\s*(\|\s*-+\s*)*\|?\s*$/,
} as const;

export const leafElements = [
  { trigger: "~~", type: "tab" },
  { trigger: "~", type: "nbSpace" },
  { trigger: "[...]", type: "illegible" },
] as const;

export const footnoteReferenceSpec = {
  open: "<",
  close: ">",
  pattern: /^n[^\s#{}]+$/,
  type: "footnoteReference",
} as const;

export const wrapperElements = [
  { open: '"', close: '"', type: "quote" },
  { open: "*", close: "*", type: "strong" },
  { open: "_", close: "_", type: "emphasis" },
  { open: "^", close: "^", type: "superscript" },
  { open: ",,", close: ",,", type: "subscript" },
  { open: "#", close: "#", type: "aside" },
  { open: "@", close: "@", type: "speaker" },
  { open: "::", close: "::", type: "stageDirection" },
  { open: "[+", close: "+]", type: "insertion" },
  { open: "[-", close: "-]", type: "deletion" },
  { open: "[?", close: "?]", type: "uncertain" },
  { open: "[p:", close: "]", type: "person" },
  { open: "[l:", close: "]", type: "place" },
  { open: "[o:", close: "]", type: "org" },
  { open: "[", close: "]", type: "citation" },
] as const;

export const isWrapperElement = (element: InlineElement): element is Wrapper =>
  wrapperTypes.has(element.type);

const wrapperTypes: ReadonlySet<string> = new Set(
  wrapperElements.map((wrapper) => wrapper.type),
);

export const wordSpec = {
  open: "[w:",
  separator: "=",
  close: "]",
  type: "word",
} as const;

export const elementSpec = {
  open: "<<",
  close: ">>",
  endOpen: "<</",
} as const;
