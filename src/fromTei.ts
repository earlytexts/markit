import emitText from "./tei/emitText.ts";
import { headerToMetadata, type MetaTree } from "./tei/header.ts";
import { teiStructure } from "./tei/structure.ts";
import { childNamed, isElement, parseXml, type XmlElement } from "./tei/xml.ts";
import type { FromTEIOptions } from "./types.ts";

/**
 * Convert a TEI P5 XML document into clean Markit (`.mit`) source text. The
 * converter favours native Markit features (emphasis, quotes, lists, verse,
 * footnotes, page breaks, foreign-language runs, editorial marks) and only falls
 * back to the generic `<<tag>>` element for markup with no native equivalent.
 * Page layout is normalised to reading text: end-of-line hyphens are closed up,
 * `<g>` glyphs resolve to their Unicode content, and `<pb>` becomes a Markit
 * page break. The TEI shell — `<text>`, `<front>`/`<body>` and content-free
 * `<div>` wrappers — is flattened away (see `teiStructure`), so a work's own
 * divisions open at `##`. See `toTEIXML` for the inverse.
 */
const fromTEIXML = (xml: string, options: FromTEIOptions = {}): string => {
  const nodes = parseXml(xml);
  const root = nodes.find(isElement);
  if (!root) return "# document\n";

  const out: string[] = [];
  const header = findHeader(root);
  const { element, lang } = teiStructure(root);
  emitText(
    element,
    1,
    deriveRootId(header),
    rootMeta(header, lang),
    options,
    out,
  );
  return out.join("\n").replace(/\n+$/, "") + "\n";
};

export default fromTEIXML;

// The root text's metadata: the TEI header, with the flattened `<text>`
// element's language folded in so it is not lost with the element itself.
const rootMeta = (
  header: MetaTree | null,
  lang: string | undefined,
): MetaTree => {
  const tree = header ?? { top: [], sections: [] };
  return lang === undefined
    ? tree
    : { ...tree, top: [...tree.top, ["lang", lang]] };
};

const findHeader = (root: XmlElement): MetaTree | null => {
  const header = childNamed(root, "teiHeader");
  return header ? headerToMetadata(header) : null;
};

// The root text's id: the DLPS identifier from the header, when there is one.
const deriveRootId = (header: MetaTree | null): string => {
  const idno = header?.sections.find(([s]) => s === "idno")?.[1];
  const dlps = idno?.find(([k]) => k === "DLPS")?.[1];
  const value = Array.isArray(dlps) ? dlps[0] : dlps;
  return (value ?? "document").replace(/[\s#{}]+/g, "_");
};
