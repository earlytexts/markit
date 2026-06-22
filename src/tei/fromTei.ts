import {
  attr,
  escapeAttribute,
  isElement,
  parseXml,
  serializeNode,
  startTagInner,
  type XmlComment,
  type XmlElement,
  type XmlNode,
  type XmlText,
} from "./xml.js";
import {
  KEYS,
  rawMetaKey,
  RAW_META,
  STRUCTURAL,
  teiToMarkitInline,
} from "./schema.js";
import classifyBlockLine from "../lib/classifyBlockLine.js";

// Convert a TCP/TEI XML document into Markit (`.mit`) source text. The mapping is
// lossless: structural elements become nested Markit texts, every other element
// becomes a block (or inline element) carrying its original tag + attributes in a
// reserved `tei` metadata key, and anything without a native Markit equivalent is
// preserved via the generic `<<TAG>>` element. See toTei.ts for the inverse.
export const fromTEIXML = (xml: string): string => {
  const nodes = parseXml(xml);
  const rootIndex = nodes.findIndex(isElement);

  // No root element: emit a placeholder document that still preserves the input.
  if (rootIndex === -1) {
    const prolog = serializeNodes(nodes);
    const meta = prolog ? `\n\n[metadata]\n${kv(KEYS.prolog, prolog)}` : "";
    return `# document${meta}\n`;
  }

  const root = nodes[rootIndex] as XmlElement;
  const prolog = serializeNodes(nodes.slice(0, rootIndex));
  const out: string[] = [];
  emitText(root, 1, deriveRootId(root), prolog || null, out);
  return out.join("\n").replace(/\n+$/, "") + "\n";
};

const serializeNodes = (nodes: XmlNode[]): string =>
  nodes.map(serializeNode).join("");

// --- Structural texts ----------------------------------------------------

type Kid = { kind: "b" | "t"; node: XmlElement | XmlText | XmlComment };

const emitText = (
  element: XmlElement,
  level: number,
  id: string,
  prolog: string | null,
  out: string[],
): void => {
  // Partition children into raw-metadata, blocks, and structural sub-texts.
  const rawMeta: XmlElement[] = [];
  const kids: Kid[] = [];
  for (const child of element.children) {
    if (isElement(child)) {
      if (RAW_META.has(child.name)) rawMeta.push(child);
      else if (STRUCTURAL.has(child.name))
        kids.push({ kind: "t", node: child });
      else kids.push({ kind: "b", node: child });
    } else if (child.kind === "text" && child.content.trim() !== "") {
      kids.push({ kind: "b", node: child });
    } else if (child.kind === "comment") {
      kids.push({ kind: "b", node: child });
    }
    // insignificant whitespace text between blocks is dropped
  }

  // Metadata block.
  const meta: [string, string][] = [[KEYS.tei, startTagInner(element)]];
  if (prolog !== null) meta.push([KEYS.prolog, prolog]);
  for (const raw of rawMeta)
    meta.push([rawMetaKey(raw.name), serializeNode(raw)]);
  const order = kids.map((k) => k.kind).join("");
  const naturalOrder = order.replace(/t+$/, "").includes("t") ? null : order;
  // naturalOrder is null when blocks all precede texts (the common case); record
  // the explicit order only when they are interleaved.
  if (naturalOrder === null && order.includes("t") && order.includes("b")) {
    meta.push([KEYS.order, order]);
  }

  out.push(`${"#".repeat(level)} ${id}`);
  out.push("");
  out.push("[metadata]"); // always present: every text records its `tei` element
  for (const [k, v] of meta) out.push(kv(k, v));
  out.push("");

  // Blocks first (Markit requires a text's blocks to precede its sub-texts).
  let blockN = 0;
  for (const kid of kids) {
    if (kid.kind !== "b") continue;
    blockN++;
    emitBlock(kid.node, `b${blockN}`, out);
    out.push("");
  }

  // Then structural sub-texts.
  const childIds = new Set<string>();
  for (const kid of kids) {
    if (kid.kind !== "t") continue;
    const childEl = kid.node as XmlElement;
    const childId = uniqueId(childEl.name.toLowerCase(), childIds);
    emitText(childEl, level + 1, childId, null, out);
    out.push("");
  }
};

// --- Blocks --------------------------------------------------------------

const emitBlock = (
  node: XmlElement | XmlText | XmlComment,
  id: string,
  out: string[],
): void => {
  if (node.kind === "text") {
    // A bare text run that sat directly inside a structural element.
    out.push(`{#${id}, ${KEYS.bareText}=true}`);
    out.push(contentLine(escapeText(node.content.replace(/\s+/g, " ").trim())));
    return;
  }
  if (node.kind === "comment") {
    out.push(`{#${id}, ${kvInline(KEYS.comment, serializeNode(node))}}`);
    return;
  }
  const element = node;
  const tag = startTagInner(element);
  const voidFlag = element.selfClosed ? `, ${KEYS.void}=true` : "";
  out.push(`{#${id}, ${kvInline(KEYS.tei, tag)}${voidFlag}}`);
  const content = renderInline(element.children).trim();
  if (content !== "") out.push(contentLine(content));
};

// --- Inline rendering ----------------------------------------------------

// `open` tracks the native inline types that are lexically open at this point.
// Markit's wrapper delimiters are symmetric (`_..._`), so the same type cannot
// nest directly (`_a_b_c_` would re-parse flat); when that would happen we fall
// back to the generic element, which forms a fresh parse boundary.
const renderInline = (
  nodes: XmlNode[],
  open: Set<string> = new Set(),
): string => nodes.map((node) => renderInlineNode(node, open)).join("");

const renderInlineNode = (node: XmlNode, open: Set<string>): string => {
  if (node.kind === "text")
    return escapeText(node.content.replace(/\s+/g, " "));
  if (node.kind === "comment") return renderInlineComment(node.content);
  if (node.kind !== "element") return "";

  const element = node;
  const native =
    element.attributes.length === 0
      ? teiToMarkitInline(element.name)
      : undefined;
  if (native && native !== "lineBreak" && !open.has(native)) {
    const inner = renderInline(element.children, new Set(open).add(native));
    switch (native) {
      case "emphasis":
        return `_${inner}_`;
      case "quote":
        return `"${inner}"`;
      case "superscript":
        return `^${inner}^`;
      case "subscript":
        return `,,${inner},,`;
    }
  }
  // A Markit line break is `\` followed by whitespace; the space is trimmed
  // against the break when re-parsed, so no spurious space is introduced.
  if (native === "lineBreak" && element.children.length === 0) return `\\ `;

  const tag = startTagInner(element);
  if (element.selfClosed) return `<<${tag}/>>`;
  // A generic element forms a fresh parse boundary, so native types reset.
  return `<<${tag}>>${renderInline(element.children)}<</${element.name}>>`;
};

// An inline comment is preserved as a reserved self-closing generic element
// carrying the comment text in an attribute (toTei reconstructs `<!--...-->`).
const renderInlineComment = (content: string): string =>
  `<<${KEYS.comment} v="${escapeAttribute(content)}"/>>`;

// --- Escaping ------------------------------------------------------------

// Escape characters that would otherwise be parsed as Markit inline markup, so
// that compiling the emitted text reproduces the original characters exactly.
const escapeText = (text: string): string =>
  text
    .replace(/[\\{~[<$"*_^#@]/g, "\\$&")
    .replace(/,(?=,)/g, "\\,")
    .replace(/\/(?=\/)/g, "\\/");

// Guard a content line against being misread as a block-level construct
// (heading, blockquote, list, table). A trailing `|` would make Markit treat the
// line as a table row, so we append a no-op element; a leading block marker is
// neutralised by escaping the first character. We consult the real classifier so
// the guard stays in lock-step with the compiler.
const contentLine = (line: string): string => {
  let result = line;
  if (result.endsWith("|")) result += `<<${KEYS.nop}/>>`;
  if (classifyBlockLine(result).kind !== "paragraph") result = `\\${result}`;
  return result;
};

// --- Metadata helpers ----------------------------------------------------

const kv = (key: string, value: string): string =>
  `${key} = ${JSON.stringify(value)}`;
const kvInline = (key: string, value: string): string =>
  `${key}=${JSON.stringify(value)}`;

// --- IDs -----------------------------------------------------------------

const uniqueId = (base: string, used: Set<string>): string => {
  let id = base;
  let n = 1;
  while (used.has(id)) {
    n++;
    id = `${base}_${n}`;
  }
  used.add(id);
  return id;
};

const deriveRootId = (root: XmlElement): string =>
  (findTcpId(root) ?? "document").replace(/[\s#{}]+/g, "_");

// Look for a TCP identifier: the IDG@ID attribute, or an <IDNO TYPE="DLPS">.
const findTcpId = (root: XmlElement): string | undefined => {
  let found: string | undefined;
  const visit = (element: XmlElement): void => {
    if (found) return;
    if (element.name === "IDG") {
      const id = attr(element, "ID");
      if (id) {
        found = id;
        return;
      }
    }
    if (element.name === "IDNO" && attr(element, "TYPE") === "DLPS") {
      const text = element.children
        .map((c) => (c.kind === "text" ? c.content : ""))
        .join("")
        .trim();
      if (text) {
        found = text;
        return;
      }
    }
    for (const child of element.children) if (isElement(child)) visit(child);
  };
  visit(root);
  return found;
};

export default fromTEIXML;
