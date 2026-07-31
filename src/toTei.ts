import compile from "./compile.ts";
import { shellXml } from "./tei/contentXml.ts";
import { metadataToHeader, type MetaObject } from "./tei/header.ts";
import { TEI_NS } from "./tei/schema.ts";

/**
 * Convert Markit (`.mit`) source into canonical TEI P5 XML — the inverse of
 * `fromTEIXML`. The root text becomes the `<TEI>` element (its metadata rebuilds
 * a `<teiHeader>`) and the shell `fromTEIXML` flattens away is put back around
 * it: the root's own blocks become the title page in the `<front>`, a `front`
 * or `back` sub-text the matter either side, and everything else the `<body>`.
 * Sub-texts become `<div>`s; native Markit inline elements map back to their
 * canonical TEI tags; footnote references re-inline as `<note>`; and generic
 * `<<tag>>` elements are emitted verbatim. The output is standard P5, not a
 * reproduction of any particular source document's chrome.
 */
const toTEIXML = (mit: string): string => {
  const { document } = compile(mit);
  const header = metadataToHeader(document.metadata as MetaObject | undefined);
  return `<TEI xmlns="${TEI_NS}">${header}${shellXml(document)}</TEI>`;
};

export default toTEIXML;
