// Conversion between a TEI <teiHeader> and Markit's TOML-style metadata. The
// header is a deep, irregular tree; Markit metadata nests only one level, so the
// mapping is field-oriented and canonical-on-reverse (it captures the salient
// bibliographic fields rather than serialising the tree verbatim). Keys derive
// from TEI element names, independent of any particular corpus schema.

import {
  attr,
  escapeText,
  isElement,
  localName,
  type XmlElement,
} from "./xml.ts";

// The intermediate shape `fromTei` serialises into `[metadata]` blocks: ordered
// top-level pairs plus ordered nested sections (`[metadata.<section>]`).
export type MetaTree = {
  top: [string, string | string[]][];
  sections: [string, [string, string | string[]][]][];
};

// --- TEI header → metadata -----------------------------------------------

const child = (element: XmlElement, name: string): XmlElement | undefined =>
  element.children.find(
    (c): c is XmlElement => isElement(c) && localName(c.name) === name,
  );

const childrenNamed = (element: XmlElement, name: string): XmlElement[] =>
  element.children.filter(
    (c): c is XmlElement => isElement(c) && localName(c.name) === name,
  );

// All descendant text of an element, whitespace-collapsed and trimmed.
const text = (element: XmlElement): string => {
  const gather = (node: XmlElement): string =>
    node.children
      .map((c) => c.kind === "text" ? c.content : isElement(c) ? gather(c) : "")
      .join("");
  return gather(element).replace(/\s+/g, " ").trim();
};

// Collapse a list of elements to one scalar (single value) or array (several).
const scalarOrArray = (values: string[]): string | string[] | undefined =>
  values.length === 0 ? undefined : values.length === 1 ? values[0]! : values;

// Pull publisher / pubPlace / date out of a <publicationStmt> (date prefers the
// machine-readable @when).
const pubPairs = (stmt: XmlElement): [string, string][] => {
  const pairs: [string, string][] = [];
  for (const name of ["publisher", "pubPlace"]) {
    const el = child(stmt, name);
    if (el && text(el)) pairs.push([name, text(el)]);
  }
  const date = child(stmt, "date");
  if (date) {
    const value = attr(date, "when") ?? text(date);
    if (value) pairs.push(["date", value]);
  }
  return pairs;
};

export const headerToMetadata = (header: XmlElement): MetaTree => {
  const top: [string, string | string[]][] = [];
  const sections: [string, [string, string | string[]][]][] = [];

  const fileDesc = child(header, "fileDesc");
  const titleStmt = fileDesc && child(fileDesc, "titleStmt");

  if (titleStmt) {
    const titles = childrenNamed(titleStmt, "title").map(text).filter(Boolean);
    const t = scalarOrArray(titles);
    if (t !== undefined) top.push(["title", t]);

    const authors = childrenNamed(titleStmt, "author")
      .map(text)
      .filter(Boolean);
    const a = scalarOrArray(authors);
    if (a !== undefined) top.push([Array.isArray(a) ? "authors" : "author", a]);

    const editors = childrenNamed(titleStmt, "editor")
      .map(text)
      .filter(Boolean);
    const e = scalarOrArray(editors);
    if (e !== undefined) top.push([Array.isArray(e) ? "editors" : "editor", e]);
  }

  const language = fileDesc && headerLanguage(header);
  if (language) top.push(["language", language]);

  const extent = fileDesc && child(fileDesc, "extent");
  if (extent && text(extent)) top.push(["extent", text(extent)]);

  const notesStmt = fileDesc && child(fileDesc, "notesStmt");
  if (notesStmt) {
    const notes = childrenNamed(notesStmt, "note").map(text).filter(Boolean);
    if (notes.length > 0) top.push(["notes", notes]);
  }

  const publicationStmt = fileDesc && child(fileDesc, "publicationStmt");
  if (publicationStmt) {
    const pairs = pubPairs(publicationStmt);
    if (pairs.length > 0) sections.push(["publication", pairs]);

    // Identifiers, grouped by @type (repeats become arrays).
    const idnoPairs: [string, string | string[]][] = [];
    const grouped = new Map<string, string[]>();
    for (const idno of childrenNamed(publicationStmt, "idno")) {
      // Markit metadata keys are `\w+`, so a type like "EEBO-CITATION" is
      // normalised to "EEBO_CITATION".
      const type = (attr(idno, "type") ?? "id").replace(/[^A-Za-z0-9_]/g, "_");
      (grouped.get(type) ?? grouped.set(type, []).get(type)!).push(text(idno));
    }
    for (const [type, values] of grouped) {
      const value = scalarOrArray(values.filter(Boolean));
      if (value !== undefined) idnoPairs.push([type, value]);
    }
    if (idnoPairs.length > 0) sections.push(["idno", idnoPairs]);
  }

  const biblFull = fileDesc &&
    child(fileDesc, "sourceDesc") &&
    child(child(fileDesc, "sourceDesc")!, "biblFull");
  if (biblFull) {
    const stmt = child(biblFull, "publicationStmt");
    const pairs: [string, string][] = stmt ? pubPairs(stmt) : [];
    const srcExtent = child(biblFull, "extent");
    if (srcExtent && text(srcExtent)) pairs.push(["extent", text(srcExtent)]);
    if (pairs.length > 0) sections.push(["source", pairs]);
  }

  return { top, sections };
};

const headerLanguage = (header: XmlElement): string | undefined => {
  const profileDesc = child(header, "profileDesc");
  const langUsage = profileDesc && child(profileDesc, "langUsage");
  const language = langUsage && child(langUsage, "language");
  return language
    ? (attr(language, "ident") ?? text(language)) || undefined
    : undefined;
};

// --- Metadata → TEI header -----------------------------------------------

// A compiled metadata object (plain values and one level of nested objects).
// Typed loosely as unknown values since it comes straight from the compiler;
// the helpers below guard each access.
export type MetaObject = Record<string, unknown>;

// Callers only pass defined scalar values (guarded by the truthiness/`!==
// undefined` checks at each call site).
const str = (value: unknown): string => escapeText(String(value));

const asArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String)
    : value === undefined
    ? []
    : [String(value)];

const tag = (name: string, value: string): string =>
  `<${name}>${value}</${name}>`;

// Build a canonical, minimal-valid P5 <teiHeader> from a root text's metadata.
export const metadataToHeader = (metadata: MetaObject | undefined): string => {
  const meta = metadata ?? {};

  const titles = asArray(meta["title"]);
  const titleTags = (titles.length > 0 ? titles : [""])
    .map((t) => tag("title", escapeText(t)))
    .join("");
  const authorTags = asArray(meta["authors"] ?? meta["author"])
    .map((a) => tag("author", escapeText(a)))
    .join("");
  const editorTags = asArray(meta["editors"] ?? meta["editor"])
    .map((e) => tag("editor", escapeText(e)))
    .join("");
  const titleStmt =
    `<titleStmt>${titleTags}${authorTags}${editorTags}</titleStmt>`;

  const extent = meta["extent"] ? tag("extent", str(meta["extent"])) : "";

  const publication = isObject(meta["publication"]) ? meta["publication"] : {};
  const idno = isObject(meta["idno"]) ? meta["idno"] : {};
  const idnoTags = Object.entries(idno)
    .flatMap(([type, value]) =>
      asArray(value).map(
        (v) => `<idno type="${escapeText(type)}">${escapeText(v)}</idno>`,
      )
    )
    .join("");
  const publicationStmt = `<publicationStmt>${
    pubBody(publication)
  }${idnoTags}</publicationStmt>`;

  const notes = asArray(meta["notes"]);
  const notesStmt = notes.length > 0
    ? `<notesStmt>${
      notes.map((n) => tag("note", escapeText(n))).join("")
    }</notesStmt>`
    : "";

  const source = isObject(meta["source"]) ? meta["source"] : {};
  const sourceBody = Object.keys(source).length > 0
    ? `<biblFull><publicationStmt>${pubBody(source)}</publicationStmt>${
      source["extent"] ? tag("extent", str(source["extent"])) : ""
    }</biblFull>`
    : "<p>Source description not available.</p>";
  const sourceDesc = `<sourceDesc>${sourceBody}</sourceDesc>`;

  const fileDesc =
    `<fileDesc>${titleStmt}${extent}${publicationStmt}${notesStmt}${sourceDesc}</fileDesc>`;

  const language = meta["language"];
  const profileDesc = language
    ? `<profileDesc><langUsage><language ident="${
      escapeText(String(language))
    }">${escapeText(String(language))}</language></langUsage></profileDesc>`
    : "";

  return `<teiHeader>${fileDesc}${profileDesc}</teiHeader>`;
};

// publisher / pubPlace / date children of a publicationStmt-like object.
const pubBody = (obj: Record<string, unknown>): string =>
  ["publisher", "pubPlace", "date"]
    .filter((k) => obj[k] !== undefined)
    .map((k) => tag(k, str(obj[k])))
    .join("");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
