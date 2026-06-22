import { describe, expect, it } from "vitest";
import {
  attr,
  childElements,
  decodeEntities,
  isElement,
  parseXml,
  serializeNodes,
  startTagInner,
  type XmlElement,
} from "../src/tei/xml.js";

const firstElement = (xml: string): XmlElement => {
  const node = parseXml(xml).find(isElement);
  if (!node) throw new Error("no element");
  return node;
};

describe("xml reader", () => {
  it("parses an element with attributes and nested children", () => {
    const root = firstElement(`<DIV1 TYPE="play" N="1"><P>hi</P></DIV1>`);
    expect(root.name).toBe("DIV1");
    expect(root.attributes).toEqual([
      { name: "TYPE", value: "play" },
      { name: "N", value: "1" },
    ]);
    expect(attr(root, "TYPE")).toBe("play");
    expect(attr(root, "MISSING")).toBeUndefined();
    const [p] = childElements(root);
    expect(p!.name).toBe("P");
    expect(p!.children).toEqual([{ kind: "text", content: "hi" }]);
  });

  it("parses single-quoted attribute values", () => {
    const root = firstElement(`<HI REND='bold'>x</HI>`);
    expect(attr(root, "REND")).toBe("bold");
  });

  it("decodes the predefined and numeric entities in text", () => {
    const root = firstElement(`<P>a &amp; b &lt;c&gt; &#65; &#x42; &quot;</P>`);
    expect(root.children).toEqual([
      { kind: "text", content: 'a & b <c> A B "' },
    ]);
  });

  it("leaves unknown named entities untouched", () => {
    expect(decodeEntities("x &unknown; y")).toBe("x &unknown; y");
  });

  it("parses comments, processing instructions and the doctype", () => {
    const nodes = parseXml(
      `<?xml version="1.0"?>\n<!DOCTYPE ETS SYSTEM "x.dtd">\n<!-- hi --><ETS/>`,
    );
    expect(nodes[0]).toEqual({ kind: "pi", content: 'xml version="1.0"' });
    expect(nodes.find((n) => n.kind === "doctype")).toEqual({
      kind: "doctype",
      content: 'DOCTYPE ETS SYSTEM "x.dtd"',
    });
    expect(nodes.find((n) => n.kind === "comment")).toEqual({
      kind: "comment",
      content: " hi ",
    });
  });

  it("parses a doctype with an internal subset containing >", () => {
    const nodes = parseXml(`<!DOCTYPE x [ <!ENTITY a "b"> ]><x/>`);
    expect(nodes[0]).toEqual({
      kind: "doctype",
      content: 'DOCTYPE x [ <!ENTITY a "b"> ]',
    });
  });

  it("parses CDATA as literal text", () => {
    const root = firstElement(`<P><![CDATA[a < b & c]]></P>`);
    expect(root.children).toEqual([{ kind: "text", content: "a < b & c" }]);
  });

  it("distinguishes self-closed from empty paired elements", () => {
    expect(firstElement(`<PB REF="1"/>`).selfClosed).toBe(true);
    expect(firstElement(`<FIGURE></FIGURE>`).selfClosed).toBe(false);
  });

  it("tolerates a mismatched close tag", () => {
    const root = firstElement(`<P>a</Q>b</P>`);
    expect(root.children).toEqual([
      { kind: "text", content: "a" },
      { kind: "text", content: "b" },
    ]);
  });

  it("produces a provenance start-tag string", () => {
    const root = firstElement(`<GAP DESC="illegible" EXTENT="1 letter"/>`);
    expect(startTagInner(root)).toBe('GAP DESC="illegible" EXTENT="1 letter"');
  });

  it("round-trips representative markup through serialise", () => {
    const samples = [
      `<DIV1 TYPE="play"><HEAD>A</HEAD><P>x <HI>y</HI> z</P></DIV1>`,
      `<P>a &amp; b</P>`,
      `<PB REF="1"/>`,
      `<FIGURE></FIGURE>`,
      `<L>line<STAGE>aside</STAGE></L>`,
    ];
    for (const sample of samples) {
      expect(serializeNodes(parseXml(sample))).toBe(sample);
    }
  });

  it("normalises quotes and self-closing whitespace on serialise", () => {
    expect(serializeNodes(parseXml(`<HI REND='b'>x</HI>`))).toBe(
      `<HI REND="b">x</HI>`,
    );
    expect(serializeNodes(parseXml(`<PB N="1" />`))).toBe(`<PB N="1"/>`);
  });

  it("tolerates malformed / truncated input without throwing", () => {
    const samples = [
      "<a>x</a", // unterminated close tag
      "<!--x", // unterminated comment
      "<![CDATA[x", // unterminated cdata
      "<?pi", // unterminated processing instruction
      "<a/>tail", // trailing text after the last element
      "<!DOCTYPE x", // unterminated doctype
      "<a", // unterminated start tag
      "<>", // empty element name
      "<></>", // empty-name paired element
    ];
    for (const s of samples) {
      expect(() => serializeNodes(parseXml(s))).not.toThrow();
    }
  });
});
