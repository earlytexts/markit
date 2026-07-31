// How a TEI structure tree becomes a Markit text tree: which of an element's
// children open a text as content blocks and which become sub-texts of their
// own, and how the TEI shell around a work — `<text>`, `<front>`, `<body>` and
// the content-free `<div>` wrappers TCP puts between them — is flattened away.
// Markit has no equivalent of that shell: it is scaffolding rather than
// content, and left in place it pushes a work's own divisions two or three
// heading levels below where the corpus writes them by hand.

import {
  attr,
  isElement,
  localName,
  type XmlElement,
  type XmlNode,
} from "./xml.ts";
import { langOf, STRUCTURAL } from "./schema.ts";

// --- The root text ---------------------------------------------------------

/** The root element to emit, and the language of the `<text>` that was
 * flattened into it (it leaves no other trace in the Markit). */
export type TeiStructure = { element: XmlElement; lang: string | undefined };

/**
 * Flatten the TEI shell out of a `<TEI>` root, leaving one element whose
 * children are the root text's content in document order: the title page's
 * blocks, then the front matter that is left, then the body's own divisions,
 * then the back matter. A document that is not a single `<text>` (no text at
 * all, or a several-text volume) is left as it stands.
 */
export const teiStructure = (root: XmlElement): TeiStructure => {
  const collapsed = collapse(root);
  const texts = significantChildren(collapsed).filter(
    (child): child is XmlElement =>
      isElement(child) && localName(child.name) === "text",
  );
  const text = texts.length === 1 ? texts[0]! : undefined;
  if (!text) return { element: collapsed, lang: undefined };

  const blocks: XmlNode[] = [];
  const children: XmlNode[] = [];
  for (const child of significantChildren(text)) {
    if (!isElement(child)) {
      children.push(child);
      continue;
    }
    switch (localName(child.name)) {
      case "front": {
        // The title page is content the work opens with, not a division of it,
        // so it becomes the root text's own blocks (the shape the corpus
        // writes by hand). What is left of the front matter stays a section.
        const rest = hoistTitlePage(child, blocks);
        if (rest.length > 0) children.push({ ...child, children: rest });
        break;
      }
      case "body":
        // The body is the work; its divisions are the work's own sections.
        children.push(...child.children);
        break;
      default:
        // `<back>` and `<group>` keep their own section, as does anything else.
        children.push(child);
    }
  }
  // Blocks first: Markit's model is blocks-then-sub-texts, and partitionChildren
  // reads the same order back out.
  return {
    element: { ...text, children: [...blocks, ...children] },
    lang: langOf(text),
  };
};

// Move the blocks of a leading `<div type="title_page">` onto `blocks`,
// returning what is left of the front matter. Only a *leading* title page is
// hoisted, so nothing is ever reordered.
const hoistTitlePage = (front: XmlElement, blocks: XmlNode[]): XmlNode[] => {
  const rest: XmlNode[] = [];
  for (const child of significantChildren(front)) {
    if (rest.length === 0 && isElement(child) && isTitlePage(child)) {
      blocks.push(...child.children);
      continue;
    }
    rest.push(child);
  }
  return rest;
};

// TCP writes `type="title_page"`; other hands write `titlePage` or `title page`.
const isTitlePage = (element: XmlElement): boolean =>
  localName(element.name) === "div" &&
  (attr(element, "type") ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "") ===
    "titlepage";

// --- Content-free wrappers -------------------------------------------------

// A `<div>` that opens with no content of its own and is its parent's only
// child adds a heading level without adding anything: TCP's genre wrapper
// (`<div type="treatise">`, `"sermon"`, `"letter"`, …) is the standard case,
// there to let one file hold several works. Unwrap such a div into its parent,
// repeatedly, so a chain of them collapses to the first division that carries
// something. Two sibling wrappers *are* two distinct works, so the rule is
// deliberately conditioned on there being only one; and a run of blocks that
// closed the wrapper (a `<trailer>`) simply moves up with everything else.
const collapse = (element: XmlElement): XmlElement => {
  let children = element.children.map((child) =>
    isElement(child) && STRUCTURAL.has(localName(child.name))
      ? collapse(child)
      : child
  );
  for (;;) {
    const significant = children.filter(isSignificant);
    const only = significant.length === 1 ? significant[0]! : undefined;
    if (!only || !isElement(only) || localName(only.name) !== "div") break;
    if (partitionChildren(only).blocks.length > 0) break;
    children = only.children;
  }
  return { ...element, children };
};

// --- Children --------------------------------------------------------------

// A text's children in document order: the block content that opens the text,
// then everything after it. The Markit data model is blocks-then-sub-texts, so
// a block genuinely cannot sit after a sibling sub-text at the same level —
// rather than hoisting such blocks to the top (which silently reorders the
// text: a <trailer> would come to open what it closes), each run of them
// becomes a synthetic sub-text in the place it was written.
export type Partition = { blocks: XmlNode[]; tail: TailItem[] };

export type TailItem =
  | { kind: "text"; element: XmlElement }
  | { kind: "blocks"; nodes: XmlNode[] };

export const partitionChildren = (element: XmlElement): Partition => {
  const blocks: XmlNode[] = [];
  const tail: TailItem[] = [];
  let run: XmlNode[] = [];
  const flushRun = (): void => {
    if (run.length === 0) return;
    tail.push({ kind: "blocks", nodes: run });
    run = [];
  };

  for (const child of element.children) {
    if (isElement(child)) {
      const name = localName(child.name);
      if (name === "teiHeader") continue; // already consumed as metadata
      if (STRUCTURAL.has(name)) {
        flushRun();
        tail.push({ kind: "text", element: child });
        continue;
      }
    } else if (child.kind !== "text" || child.content.trim() === "") {
      continue; // comments, PIs, insignificant whitespace
    }
    if (tail.length === 0) blocks.push(child);
    else run.push(child);
  }
  flushRun();
  return { blocks, tail };
};

// --- Significance ----------------------------------------------------------

// The children that carry meaning: elements other than the header, and text
// that is not just layout whitespace.
const significantChildren = (element: XmlElement): XmlNode[] =>
  element.children.filter(isSignificant);

const isSignificant = (node: XmlNode): boolean =>
  isElement(node)
    ? localName(node.name) !== "teiHeader"
    : node.kind === "text" && node.content.trim() !== "";
