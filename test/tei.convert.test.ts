import { describe, expect, it } from "vitest";
import fromTEIXML from "../src/tei/fromTei.js";
import toTEIXML from "../src/tei/toTei.js";
import { parseXml, serializeNodes } from "../src/tei/xml.js";

// Information-level equality: canonical entities/quotes, whitespace ignored.
const norm = (xml: string): string =>
  serializeNodes(parseXml(xml))
    .replace(/\s+/g, " ")
    .replace(/\s*(<[^>]+>)\s*/g, "$1")
    .trim();

const roundTrips = (xml: string): void => {
  expect(norm(toTEIXML(fromTEIXML(xml)))).toBe(norm(xml));
};

const SAMPLE = `<?xml version="1.0"?>
<!DOCTYPE ETS SYSTEM "x.dtd">
<ETS>
<HEADER><FILEDESC><TITLESTMT><TITLE>T &amp; co</TITLE></TITLESTMT></FILEDESC></HEADER>
<EEBO>
<IDG S="marc" ID="A123"><STC>x</STC></IDG>
<TEXT LANG="eng">
<FRONT>
<DIV1 TYPE="title page"><PB REF="1"/><HEAD>The <HI>Title</HI></HEAD><P>By <HI>Author</HI>.</P></DIV1>
</FRONT>
<BODY>
<DIV1 TYPE="play">
<DIV2 TYPE="scene">
<HEAD>Scene 1</HEAD>
<SP><SPEAKER>A</SPEAKER><L>line <HI>one</HI></L><L>line two</L></SP>
<P>text <GAP DESC="illegible" DISP="*"/> and a note<NOTE PLACE="marg">side</NOTE>.</P>
<P>nested <HI>a <HI>b</HI> c</HI> and <SUP>2</SUP> and <Q>quote</Q> and <HI REND="bold">B</HI>.</P>
</DIV2>
</DIV1>
</BODY>
</TEXT>
</EEBO>
</ETS>`;

describe("fromTEIXML / toTEIXML", () => {
  it("round-trips a representative document losslessly", () => {
    roundTrips(SAMPLE);
  });

  it("produces readable Markit for the clean cases", () => {
    const mit = fromTEIXML(SAMPLE);
    expect(mit).toContain("# A123"); // root id from IDG@ID
    expect(mit).toContain('tei = "ETS"');
    expect(mit).toContain("teiProlog = ");
    expect(mit).toContain('teiHeader = "<HEADER>');
    expect(mit).toContain('teiIdg = "<IDG');
    expect(mit).toContain("The _Title_"); // bare <HI> -> emphasis
    expect(mit).toContain('"quote"'); // bare <Q> -> quote
    expect(mit).toContain("^2^"); // <SUP> -> superscript
    expect(mit).toContain("<<SPEAKER>>A<</SPEAKER>>"); // no native form -> generic
    expect(mit).toContain('<<GAP DESC="illegible" DISP="*"/>>'); // attrs preserved
    expect(mit).toContain('<<HI REND="bold">>B<</HI>>'); // attr-bearing HI -> generic
  });

  it("falls back to a generic element when a native type would nest in itself", () => {
    const mit = fromTEIXML(SAMPLE);
    // <HI>a <HI>b</HI> c</HI> : outer stays italic, inner becomes generic.
    expect(mit).toContain("_a <<HI>>b<</HI>> c_");
  });

  it("preserves the entire header and prolog verbatim", () => {
    const back = toTEIXML(fromTEIXML(SAMPLE));
    expect(back).toContain("<TITLE>T &amp; co</TITLE>");
    expect(back).toContain('<!DOCTYPE ETS SYSTEM "x.dtd">');
    expect(back).toContain('<IDG S="marc" ID="A123"><STC>x</STC></IDG>');
  });
});

describe("structural edge cases", () => {
  it("derives the root id from an IDNO when there is no IDG", () => {
    const mit = fromTEIXML(
      `<ETS><HEADER><IDNO TYPE="DLPS">B999</IDNO></HEADER><TEXT><BODY><P>x</P></BODY></TEXT></ETS>`,
    );
    expect(mit.startsWith("# B999")).toBe(true);
  });

  it("falls back to a default id when none can be derived", () => {
    expect(
      fromTEIXML(`<ETS><TEXT><BODY><P>x</P></BODY></TEXT></ETS>`),
    ).toContain("# document");
  });

  it("uniquifies sibling ids and round-trips them", () => {
    const xml = `<ETS><TEXT><FRONT><DIV1 TYPE="a"><P>1</P></DIV1><DIV1 TYPE="b"><P>2</P></DIV1></FRONT></TEXT></ETS>`;
    const mit = fromTEIXML(xml);
    expect(mit).toContain("### div1\n");
    expect(mit).toContain("### div1_2\n");
    roundTrips(xml);
  });

  it("records and replays interleaved block/sub-text order", () => {
    // A block AFTER a structural child cannot use the natural blocks-first order.
    const xml = `<ETS><TEXT><BODY><DIV1 TYPE="a"><P>x</P></DIV1><TRAILER>end</TRAILER></BODY></TEXT></ETS>`;
    expect(fromTEIXML(xml)).toContain("teiKids");
    roundTrips(xml);
  });

  it("preserves a bare text run inside a structural element", () => {
    roundTrips(
      `<ETS><TEXT><BODY><DIV1 TYPE="a">loose text<P>p</P></DIV1></BODY></TEXT></ETS>`,
    );
  });

  it("handles a document with no root element", () => {
    const mit = fromTEIXML(`<!-- only a comment -->`);
    expect(mit).toContain("# document");
    expect(toTEIXML(mit)).toContain("<!-- only a comment -->");
    expect(fromTEIXML(``)).toBe("# document\n");
  });
});

describe("inline and content edge cases", () => {
  it("preserves block-level and inline comments", () => {
    roundTrips(
      `<ETS><TEXT><BODY><DIV1 TYPE="a"><PB REF="1"/><!-- PDF PAGE 2 --><P>a<!--inline-->b</P></DIV1></BODY></TEXT></ETS>`,
    );
  });

  it("preserves a self-closed block element distinctly", () => {
    const back = toTEIXML(
      fromTEIXML(
        `<ETS><TEXT><BODY><DIV1 TYPE="a"><PB REF="1"/><P>x</P></DIV1></BODY></TEXT></ETS>`,
      ),
    );
    expect(back).toContain('<PB REF="1"/>');
    expect(back).not.toContain('<PB REF="1"></PB>');
  });

  it("does not mistake literal pipes for a table", () => {
    roundTrips(
      `<ETS><TEXT><BODY><DIV1 TYPE="a"><HEAD>I. 1. | II. 2. | III. 3. |</HEAD></DIV1></BODY></TEXT></ETS>`,
    );
  });

  it("escapes leading block markers in content", () => {
    for (const text of [
      "- dash",
      "> angle",
      "3. number",
      "| pipe",
      "^ caret",
      "*star",
    ]) {
      roundTrips(
        `<ETS><TEXT><BODY><DIV1 TYPE="a"><P>${text}</P></DIV1></BODY></TEXT></ETS>`,
      );
    }
  });

  it("escapes inline Markit-significant characters in text", () => {
    roundTrips(
      `<ETS><TEXT><BODY><DIV1 TYPE="a"><P>a *b* _c_ {d} [e] ~f~ @g@ #h# $i$ "j" ^k^ \\m</P></DIV1></BODY></TEXT></ETS>`,
    );
  });

  it("preserves a line break and an empty paired element", () => {
    roundTrips(
      `<ETS><TEXT><BODY><DIV1 TYPE="a"><P>a<LB/>b</P><P>x<FIGURE></FIGURE>y</P></DIV1></BODY></TEXT></ETS>`,
    );
  });
});

describe("toTEIXML of hand-authored Markit", () => {
  const mit = [
    "# doc",
    "",
    "{#1}",
    '*strong* _em_ #aside# @sp@ [+ins+] [-del-] [?unc?] [p:per] [l:pla] [o:org] [cit] $la:fr$ $plain$ [...] /// //p5// a~b a~~b "q" ^sup^ ,,sub,, <n1>',
    "",
    "{#n1}",
    "the note",
  ].join("\n");

  const xml = toTEIXML(mit);

  it("maps every Markit inline element to a TEI element", () => {
    for (const fragment of [
      '<HI REND="bold">strong</HI>',
      "<HI>em</HI>",
      '<NOTE PLACE="marg">aside</NOTE>',
      "<SPEAKER>sp</SPEAKER>",
      "<ADD>ins</ADD>",
      "<DEL>del</DEL>",
      "<UNCLEAR>unc</UNCLEAR>",
      '<NAME TYPE="person">per</NAME>',
      '<NAME TYPE="place">pla</NAME>',
      '<NAME TYPE="org">org</NAME>',
      "<BIBL>cit</BIBL>",
      '<FOREIGN LANG="la">fr</FOREIGN>',
      "<FOREIGN>plain</FOREIGN>",
      "<GAP/>",
      "<PB/>",
      '<PB REF="p5"/>',
      "<SUP>sup</SUP>",
      "<SUB>sub</SUB>",
      "<Q>q</Q>",
      "&#160;",
      "<REF>doc.n1</REF>",
    ]) {
      expect(xml).toContain(fragment);
    }
  });

  it("uses fallback element names when provenance is absent", () => {
    expect(xml.startsWith("<TEXT>")).toBe(true); // root has no tei -> TEXT
    expect(xml).toContain("<P>"); // block has no tei -> P
  });

  it("renders heading, blockquote, list and table block elements", () => {
    const doc = [
      "# d",
      "",
      "{#title}",
      "^1 Title",
      "",
      '{#b1, tei="Q"}',
      "> quoted",
      "",
      '{#b2, tei="LIST"}',
      "- one",
      "  - sub",
      "- two",
      "",
      '{#b3, tei="TABLE"}',
      "| a | b |",
    ].join("\n");
    const out = toTEIXML(doc);
    expect(out).toContain("Title");
    expect(out).toContain("<Q>quoted</Q>");
    expect(out).toContain("<LIST>onesubtwo</LIST>");
    expect(out).toContain("<TABLE>ab</TABLE>");
  });

  it("renders an empty comment sentinel and tolerates a too-long teiKids", () => {
    expect(toTEIXML(`# d\n\n{#b1, tei="P"}\na<<teiComment/>>b`)).toContain(
      "<!---->",
    );
    const doc = [
      "# r",
      "",
      "[metadata]",
      'tei = "R"',
      'teiKids = "bbtt"',
      "",
      '{#b1, tei="P"}',
      "x",
    ].join("\n");
    expect(toTEIXML(doc)).toBe("<R><P>x</P></R>");
  });
});

describe("converter coverage corners", () => {
  it("maps <SUB> to subscript and round-trips it", () => {
    roundTrips(
      `<ETS><TEXT><BODY><DIV1 TYPE="a"><P>H<SUB>2</SUB>O</P></DIV1></BODY></TEXT></ETS>`,
    );
  });

  it("drops processing instructions found inside content", () => {
    const mit = fromTEIXML(
      `<ETS><TEXT><BODY><DIV1 TYPE="a"><P>a<?pi z?>b</P></DIV1></BODY></TEXT></ETS>`,
    );
    expect(mit).toContain("ab");
  });

  it("derives the root id from a mixed-content IDNO when IDG lacks an ID", () => {
    const mit = fromTEIXML(
      `<ETS><EEBO><IDG S="m"><STC>x</STC></IDG><HEADER><IDNO TYPE="DLPS">A1<X/>2</IDNO></HEADER><TEXT><BODY><P>z</P></BODY></TEXT></EEBO></ETS>`,
    );
    expect(mit.startsWith("# A12")).toBe(true);
  });

  it("falls back to the default id when the DLPS idno is empty", () => {
    const mit = fromTEIXML(
      `<ETS><HEADER><IDNO TYPE="DLPS"></IDNO></HEADER><TEXT><BODY><P>z</P></BODY></TEXT></ETS>`,
    );
    expect(mit.startsWith("# document")).toBe(true);
  });
});
