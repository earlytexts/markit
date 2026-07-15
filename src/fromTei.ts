import emitText from "./tei/emitText.ts";
import { headerToMetadata, type MetaTree } from "./tei/header.ts";
import { childNamed, isElement, parseXml, type XmlElement } from "./tei/xml.ts";
import type { FromTEIOptions } from "./types.ts";

/**
 * Convert a TEI P5 XML document into clean Markit (`.mit`) source text. The
 * converter favours native Markit features (emphasis, quotes, lists, verse,
 * footnotes, page breaks, foreign-language runs, editorial marks) and only falls
 * back to the generic `<<tag>>` element for markup with no native equivalent.
 * Page layout is normalised to reading text: end-of-line hyphens are closed up,
 * `<g>` glyphs resolve to their Unicode content, and `<pb>` becomes a Markit
 * page break. See `toTEIXML` for the inverse.
 */
const fromTEIXML = (xml: string, options: FromTEIOptions = {}): string => {
  const nodes = parseXml(xml);
  const root = nodes.find(isElement);
  if (!root) return "# document\n";

  const out: string[] = [];
  const header = findHeader(root);
  emitText(root, 1, deriveRootId(header), header, options, out);
  return out.join("\n").replace(/\n+$/, "") + "\n";
};

export default fromTEIXML;

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
