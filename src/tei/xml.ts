// A small, dependency-free XML reader/writer, tuned to the needs of the TCP/TEI
// converter. It is not a fully conformant XML processor: it handles the subset
// the TCP "displayable XML" schema actually uses (elements, attributes, text,
// comments, processing instructions, the doctype declaration, CDATA, and the
// five predefined entities plus numeric character references). It aims for
// information-lossless round-tripping, not byte-identical output: attribute
// quoting is normalised to double quotes and entities are re-encoded canonically.

export type XmlNode = XmlElement | XmlText | XmlComment | XmlPI | XmlDoctype;

export type XmlAttribute = { name: string; value: string };

export type XmlElement = {
  kind: "element";
  name: string;
  attributes: XmlAttribute[];
  children: XmlNode[];
  // Whether the source wrote this as `<x/>` (true) rather than `<x></x>`
  // (false). Only meaningful when `children` is empty.
  selfClosed: boolean;
};

export type XmlText = { kind: "text"; content: string };
export type XmlComment = { kind: "comment"; content: string };
export type XmlPI = { kind: "pi"; content: string };
export type XmlDoctype = { kind: "doctype"; content: string };

export const isElement = (node: XmlNode): node is XmlElement =>
  node.kind === "element";

// --- Parsing -------------------------------------------------------------

type Cursor = { s: string; i: number };

export const parseXml = (input: string): XmlNode[] => {
  const cursor: Cursor = { s: input.replace(/^﻿/, ""), i: 0 };
  return parseNodes(cursor, null);
};

// Parse a run of sibling nodes until either end of input (when `closeName` is
// null) or the matching close tag `</closeName>` is reached (which is consumed).
const parseNodes = (cursor: Cursor, closeName: string | null): XmlNode[] => {
  const nodes: XmlNode[] = [];
  const { s } = cursor;

  while (cursor.i < s.length) {
    if (s[cursor.i] === "<") {
      if (s.startsWith("</", cursor.i)) {
        // Close tag — belongs to our parent
        const end = s.indexOf(">", cursor.i);
        const tagEnd = end === -1 ? s.length : end + 1;
        const name = s.slice(cursor.i + 2, end === -1 ? s.length : end).trim();
        if (closeName !== null && name === closeName) {
          cursor.i = tagEnd;
          return nodes;
        }
        // Stray/mismatched close tag: skip it and carry on (error-tolerant)
        cursor.i = tagEnd;
        continue;
      }
      if (s.startsWith("<!--", cursor.i)) {
        const end = s.indexOf("-->", cursor.i);
        const stop = end === -1 ? s.length : end;
        nodes.push({ kind: "comment", content: s.slice(cursor.i + 4, stop) });
        cursor.i = end === -1 ? s.length : end + 3;
        continue;
      }
      if (s.startsWith("<![CDATA[", cursor.i)) {
        const end = s.indexOf("]]>", cursor.i);
        const stop = end === -1 ? s.length : end;
        nodes.push({ kind: "text", content: s.slice(cursor.i + 9, stop) });
        cursor.i = end === -1 ? s.length : end + 3;
        continue;
      }
      if (s.startsWith("<!", cursor.i)) {
        nodes.push({ kind: "doctype", content: readDeclaration(cursor) });
        continue;
      }
      if (s.startsWith("<?", cursor.i)) {
        const end = s.indexOf("?>", cursor.i);
        const stop = end === -1 ? s.length : end;
        nodes.push({ kind: "pi", content: s.slice(cursor.i + 2, stop) });
        cursor.i = end === -1 ? s.length : end + 2;
        continue;
      }
      nodes.push(parseElement(cursor));
      continue;
    }

    // Text run up to the next `<`
    const next = s.indexOf("<", cursor.i);
    const stop = next === -1 ? s.length : next;
    nodes.push({
      kind: "text",
      content: decodeEntities(s.slice(cursor.i, stop)),
    });
    cursor.i = stop;
  }

  return nodes;
};

// Read a `<!...>` declaration (e.g. DOCTYPE), respecting an optional `[...]`
// internal subset that may itself contain `>`.
const readDeclaration = (cursor: Cursor): string => {
  const { s } = cursor;
  const start = cursor.i + 2;
  let i = start;
  let bracket = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "[") bracket++;
    else if (ch === "]") bracket--;
    else if (ch === ">" && bracket <= 0) break;
    i++;
  }
  cursor.i = i < s.length ? i + 1 : s.length;
  return s.slice(start, i);
};

const parseElement = (cursor: Cursor): XmlElement => {
  const { s } = cursor;
  // Find the end of the start tag, respecting quoted attribute values.
  let i = cursor.i + 1;
  let inQuote: string | null = null;
  while (i < s.length) {
    const ch = s[i]!;
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ">") {
      break;
    }
    i++;
  }
  const tagInner = s.slice(cursor.i + 1, i);
  cursor.i = i < s.length ? i + 1 : s.length;

  const selfClosed = tagInner.endsWith("/");
  const inner = selfClosed ? tagInner.slice(0, -1) : tagInner;

  const nameMatch = /^([^\s/>]+)/.exec(inner.trim());
  const name = nameMatch ? nameMatch[1]! : "";
  const attributes = parseAttributes(
    inner.slice(inner.indexOf(name) + name.length),
  );

  if (selfClosed) {
    return {
      kind: "element",
      name,
      attributes,
      children: [],
      selfClosed: true,
    };
  }

  const children = parseNodes(cursor, name);
  return { kind: "element", name, attributes, children, selfClosed: false };
};

const parseAttributes = (input: string): XmlAttribute[] => {
  const attributes: XmlAttribute[] = [];
  const pattern = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    // Exactly one of the quoted alternatives matches.
    const raw = (match[3] ?? match[4])!;
    attributes.push({ name: match[1]!, value: decodeEntities(raw) });
  }
  return attributes;
};

// --- Entities ------------------------------------------------------------

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export const decodeEntities = (text: string): string =>
  text.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (whole, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        return String.fromCodePoint(parseInt(body.slice(2), 16));
      }
      if (body.startsWith("#")) {
        return String.fromCodePoint(parseInt(body.slice(1), 10));
      }
      const named = namedEntities[body];
      return named ?? whole;
    },
  );

export const escapeText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// --- Serialising ---------------------------------------------------------

export const serializeNodes = (nodes: XmlNode[]): string =>
  nodes.map(serializeNode).join("");

export const serializeNode = (node: XmlNode): string => {
  switch (node.kind) {
    case "text":
      return escapeText(node.content);
    case "comment":
      return `<!--${node.content}-->`;
    case "pi":
      return `<?${node.content}?>`;
    case "doctype":
      return `<!${node.content}>`;
    case "element": {
      const attrs = node.attributes
        .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
        .join("");
      if (node.children.length === 0) {
        return node.selfClosed
          ? `<${node.name}${attrs}/>`
          : `<${node.name}${attrs}></${node.name}>`;
      }
      return `<${node.name}${attrs}>${serializeNodes(node.children)}</${node.name}>`;
    }
  }
};

// --- Convenience accessors ----------------------------------------------

export const attr = (element: XmlElement, name: string): string | undefined =>
  element.attributes.find((a) => a.name === name)?.value;

export const childElements = (element: XmlElement): XmlElement[] =>
  element.children.filter(isElement);

// Serialise the element name plus its attributes as the interior of a start tag
// (e.g. `DIV1 TYPE="play" N="1"`). This is the canonical "provenance" string
// stored in Markit metadata so the element can be reconstructed losslessly.
export const startTagInner = (element: XmlElement): string => {
  const attrs = element.attributes
    .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
    .join("");
  return `${element.name}${attrs}`;
};
