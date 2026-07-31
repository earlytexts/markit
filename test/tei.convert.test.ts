import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import format from "../src/format.ts";
import fromTEIXML from "../src/fromTei.ts";
import toTEIXML from "../src/toTei.ts";

// Wrap body markup in a minimal, valid TEI P5 document (TEI namespace, header,
// single text/body). Most fromTEIXML tests feed `tei(<div>…</div>)`.
const tei = (body: string, header = HEADER): string =>
  `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body>${body}</body></text></TEI>`;

const HEADER =
  `<teiHeader><fileDesc><titleStmt><title>T</title></titleStmt><publicationStmt><idno type="DLPS">A1</idno></publicationStmt><sourceDesc><p>s</p></sourceDesc></fileDesc></teiHeader>`;

// Convert, and assert the produced Markit compiles without diagnostics.
const clean = (xml: string, opts?: { modernize?: boolean }): string => {
  const mit = fromTEIXML(xml, opts);
  const { errors } = compile(mit);
  expect(errors).toEqual([]);
  return mit;
};

describe("fromTEIXML — structure", () => {
  it("derives the root id from the DLPS idno and flattens text/body away", () => {
    const mit = clean(tei(`<div type="chapter" n="1"><p>hi</p></div>`));
    expect(mit).toContain("# A1");
    expect(mit).not.toMatch(/^#+ text$/m);
    expect(mit).not.toMatch(/^#+ body$/m);
    expect(mit).toMatch(/^## chapter_1$/m);
    expect(mit).toContain('type = "chapter"');
    expect(mit).toContain('n = "1"');
  });

  it("falls back to id `document` when no header/idno is present", () => {
    expect(
      fromTEIXML(`<TEI xmlns="x"><text><body><p>x</p></body></text></TEI>`),
    ).toContain("# document");
    expect(fromTEIXML("")).toBe("# document\n");
    expect(fromTEIXML("<!-- only a comment -->")).toBe("# document\n");
  });

  it("derives div ids from type, n, both, or neither and uniquifies them", () => {
    const mit = clean(
      tei(
        `<div type="a"><p>1</p></div><div n="2"><p>2</p></div>` +
          `<div><p>3</p></div><div type="a"><p>4</p></div>`,
      ),
    );
    expect(mit).toMatch(/^## a$/m);
    expect(mit).toMatch(/^## div_2$/m);
    expect(mit).toMatch(/^## div$/m);
    expect(mit).toMatch(/^## a_2$/m);
  });

  it("carries the text's xml:lang onto the root as `lang` metadata and back", () => {
    const mit = clean(
      `<TEI xmlns="x"><text xml:lang="lat"><body><p>x</p></body></text></TEI>`,
    );
    expect(mit).toContain('lang = "lat"');
    expect(toTEIXML(mit)).toContain('<text xml:lang="lat">');
  });

  it("carries a division's xml:lang onto its section and back", () => {
    const mit = clean(tei(`<div xml:lang="lat"><p>x</p></div>`));
    expect(mit).toContain('lang = "lat"');
    expect(toTEIXML(mit)).toContain('<div xml:lang="lat">');
  });

  it("treats <group> as structural", () => {
    const mit = clean(tei(`<group><text><body><p>x</p></body></text></group>`));
    expect(mit).toContain("group");
  });

  it("keeps blocks that follow a sub-text in place, as a sub-text of their own", () => {
    // The treatise holds a block of its own, so it is not a content-free
    // wrapper and survives the collapse.
    const mit = clean(
      tei(
        `<div type="treatise"><p>open</p><div n="1"><p>book</p></div>` +
          `<trailer>THE END.</trailer></div>`,
      ),
    );
    expect(mit).toMatch(/^## treatise$/m);
    expect(mit).toMatch(/^### trailer$/m);
    expect(mit).toContain('element="trailer"');
    // The point of the fix: the trailer closes the treatise, not opens it.
    expect(mit.indexOf("THE END.")).toBeGreaterThan(mit.indexOf("book"));
    expect(mit.indexOf("open")).toBeLessThan(mit.indexOf("book"));
  });

  it("splits interleaved blocks into one sub-text per run", () => {
    const mit = clean(
      tei(
        `<div type="w"><p>open</p><div n="1"><p>alpha</p></div><p>middle</p>` +
          `<div n="2"><p>omega</p></div><closer>bye</closer></div>`,
      ),
    );
    expect(mit.indexOf("middle")).toBeGreaterThan(mit.indexOf("alpha"));
    expect(mit.indexOf("middle")).toBeLessThan(mit.indexOf("omega"));
    expect(mit).toMatch(/^### p$/m);
    expect(mit).toMatch(/^### closer$/m);
  });

  it("names a trailing run with no element after it `content`", () => {
    const mit = clean(
      tei(
        `<div type="w"><p>open</p><div n="1"><p>a</p></div><pb n="9"/></div>`,
      ),
    );
    expect(mit).toMatch(/^### content$/m);
    expect(mit).toContain("//9//");
  });
});

describe("fromTEIXML — front, body and back", () => {
  // The TEI shell (`<text>`, `<front>`, `<body>`) is scaffolding rather than
  // content: it is flattened away so that a work's own divisions open at `##`,
  // the depth the corpus writes by hand.
  const shell = (inner: string): string =>
    `<TEI xmlns="http://www.tei-c.org/ns/1.0">${HEADER}<text>${inner}</text></TEI>`;

  it("hoists the body's divisions to the top level and keeps front and back", () => {
    const mit = clean(
      shell(
        `<front><div type="errata"><p>e</p></div></front>` +
          `<body><div type="ch" n="1"><p>b</p></div></body>` +
          `<back><div type="ads"><p>k</p></div></back>`,
      ),
    );
    expect(mit).not.toMatch(/^#+ text$/m);
    expect(mit).not.toMatch(/^#+ body$/m);
    expect(mit).toMatch(/^## front$/m);
    expect(mit).toMatch(/^### errata$/m);
    expect(mit).toMatch(/^## ch_1$/m);
    expect(mit).toMatch(/^## back$/m);
    expect(mit).toMatch(/^### ads$/m);
    // Document order survives: front, then body, then back.
    expect(mit.indexOf("## front")).toBeLessThan(mit.indexOf("## ch_1"));
    expect(mit.indexOf("## ch_1")).toBeLessThan(mit.indexOf("## back"));
  });

  it("hoists a leading title page into the root's own blocks", () => {
    const mit = clean(
      shell(
        `<front><div type="title_page"><head>T</head><p>imprint</p></div>` +
          `<div type="errata"><p>e</p></div></front>` +
          `<body><div n="1"><p>b</p></div></body>`,
      ),
    );
    // The title page's blocks open the document, above the first section.
    expect(mit.indexOf("{#title}")).toBeLessThan(mit.indexOf("## front"));
    expect(mit).toContain("imprint");
    expect(mit).not.toMatch(/^#+ title_page$/m);
    expect(mit).toMatch(/^## front$/m);
    expect(mit).toMatch(/^### errata$/m);
  });

  it("drops a front that held nothing but the title page", () => {
    const mit = clean(
      shell(
        `<front><div type="title_page"><head>T</head></div></front>` +
          `<body><div n="1"><p>b</p></div></body>`,
      ),
    );
    expect(mit).not.toMatch(/^#+ front$/m);
    expect(mit).toContain("{#title}");
    expect(mit).toMatch(/^## div_1$/m);
  });

  it("recognises the title page however its type is spelt", () => {
    for (const type of ["title_page", "titlepage", "titlePage", "title page"]) {
      const mit = clean(
        shell(`<front><div type="${type}"><p>tp</p></div></front>`),
      );
      expect(mit).not.toMatch(/^#+ front$/m);
      expect(mit).toContain("tp");
    }
  });

  it("leaves a title page that does not open the front as a section", () => {
    const mit = clean(
      shell(
        `<front><div type="dedication"><p>d</p></div>` +
          `<div type="title_page"><p>tp</p></div></front>`,
      ),
    );
    expect(mit).toMatch(/^## front$/m);
    expect(mit).toMatch(/^### dedication$/m);
    expect(mit).toMatch(/^### title_page$/m);
    expect(mit.indexOf("d")).toBeLessThan(mit.indexOf("tp"));
  });

  it("keeps a typeless leading div in the front section", () => {
    const mit = clean(shell(`<front><div><p>d</p></div></front>`));
    expect(mit).toMatch(/^## front$/m);
    expect(mit).toMatch(/^### div$/m);
  });

  it("keeps a front's own blocks with the front section", () => {
    const mit = clean(
      shell(`<front><p>loose</p></front><body><p>b</p></body>`),
    );
    expect(mit).toMatch(/^## front$/m);
    expect(mit.indexOf("## front")).toBeLessThan(mit.indexOf("loose"));
  });

  it("keeps text that sits loose in the <text> element", () => {
    const mit = clean(shell(`loose<body><p>b</p></body>`));
    expect(mit).toContain("loose");
    expect(mit.indexOf("loose")).toBeLessThan(mit.indexOf("b\n"));
  });

  it("leaves a document with no <text> element alone", () => {
    const mit = clean(
      `<TEI xmlns="x">${HEADER}<body><p>x</p></body></TEI>`,
    );
    expect(mit).toMatch(/^## body$/m);
  });

  it("leaves a document with more than one <text> element alone", () => {
    const mit = clean(
      `<TEI xmlns="x">${HEADER}<text><body><p>a</p></body></text>` +
        `<text><body><p>b</p></body></text></TEI>`,
    );
    expect(mit).toMatch(/^## text$/m);
    expect(mit).toMatch(/^## text_2$/m);
  });
});

describe("fromTEIXML — content-free wrappers", () => {
  it("collapses a blockless div that is its parent's only child", () => {
    // TCP wraps a whole work in a genre div (`treatise`, `sermon`, …); with a
    // single work it carries nothing and only adds a heading level.
    const mit = clean(
      tei(
        `<div type="treatise"><div type="book" n="1"><head>B</head>` +
          `<div type="section" n="1"><p>s</p></div></div></div>`,
      ),
    );
    expect(mit).not.toMatch(/^#+ treatise$/m);
    expect(mit).toMatch(/^## book_1$/m);
    expect(mit).toMatch(/^### section_1$/m);
  });

  it("collapses a wrapper whose only content closes it", () => {
    // A59472's shape: the treatise div opens with nothing, holds the books,
    // and is closed by a trailer. Collapsing lifts books and trailer alike.
    const mit = clean(
      tei(
        `<div type="treatise"><div type="book" n="1"><head>B1</head><p>a</p></div>` +
          `<div type="book" n="2"><head>B2</head><p>b</p></div>` +
          `<trailer>THE END.</trailer></div>`,
      ),
    );
    expect(mit).not.toMatch(/^#+ treatise$/m);
    expect(mit).toMatch(/^## book_1$/m);
    expect(mit).toMatch(/^## book_2$/m);
    expect(mit).toMatch(/^## trailer$/m);
    expect(mit.indexOf("## book_2")).toBeLessThan(mit.indexOf("## trailer"));
  });

  it("collapses a chain of content-free wrappers", () => {
    const mit = clean(
      tei(
        `<div type="a"><div type="b"><div type="c"><p>x</p></div></div></div>`,
      ),
    );
    expect(mit).not.toMatch(/^#+ a$/m);
    expect(mit).not.toMatch(/^#+ b$/m);
    expect(mit).toMatch(/^## c$/m);
  });

  it("keeps a blockless div that has a sibling", () => {
    // Two genre divs are two distinct works; collapsing would merge them.
    const mit = clean(
      tei(
        `<div type="treatise" n="1"><div n="1"><p>a</p></div></div>` +
          `<div type="treatise" n="2"><div n="1"><p>b</p></div></div>`,
      ),
    );
    expect(mit).toMatch(/^## treatise_1$/m);
    expect(mit).toMatch(/^## treatise_2$/m);
  });

  it("keeps a div that has blocks of its own", () => {
    const mit = clean(
      tei(`<div type="book"><head>B</head><div n="1"><p>a</p></div></div>`),
    );
    expect(mit).toMatch(/^## book$/m);
    expect(mit).toMatch(/^### div_1$/m);
  });

  it("keeps a wrapper that holds a stray page break", () => {
    const mit = clean(
      tei(`<div type="w"><pb n="4"/><div n="1"><p>a</p></div></div>`),
    );
    expect(mit).toMatch(/^## w$/m);
    expect(mit).toContain("//4//");
  });

  it("collapses an empty div away entirely", () => {
    const mit = clean(tei(`<div type="empty"></div>`));
    expect(mit).not.toMatch(/^#+ empty$/m);
  });
});

describe("fromTEIXML — blocks", () => {
  it("maps the first <head> to a title and later heads to subtitles", () => {
    const mit = clean(
      tei(`<div><head>One</head><p>x</p><head>Two</head></div>`),
    );
    expect(mit).toContain("{#title}");
    expect(mit).toContain("{#subtitle}");
  });

  it("emits every heading at ^1, whatever the nesting depth", () => {
    // `^N` is display size, not structural depth: TEI carries no size, so a
    // depth-derived level would be invented data (and TCP's deepest divisions
    // typically carry its most prominent headings).
    const mit = clean(
      tei(
        `<div><head>One</head><div><head>Two</head>` +
          `<div><head>Three</head><p>x</p></div></div></div>`,
      ),
    );
    expect(mit).toContain("^1 One");
    expect(mit).toContain("^1 Two");
    expect(mit).toContain("^1 Three");
    expect(mit).not.toMatch(/\^[2-6] /);
  });

  it("demotes a <head> that follows other content to a subtitle", () => {
    const mit = clean(
      tei(`<div><argument><p>a</p></argument><head>H</head></div>`),
    );
    expect(mit).not.toContain("{#title}");
    expect(mit).toContain("{#subtitle}");
  });

  it("renders ordered, unordered and nested lists", () => {
    const mit = clean(
      tei(
        `<list><item>one<list><item>sub</item></list></item><item>two</item></list>` +
          `<list type="ordered"><item>first</item><item>second</item></list>`,
      ),
    );
    expect(mit).toContain("- one");
    expect(mit).toContain("  - sub");
    expect(mit).toContain("- two");
    expect(mit).toContain("1. first");
    expect(mit).toContain("2. second");
  });

  it("renders a list <head> as a leading item", () => {
    const mit = clean(tei(`<list><head>Title</head><item>x</item></list>`));
    expect(mit).toContain("- Title");
    expect(mit).toContain("- x");
  });

  it("renders tables with and without a header row", () => {
    const withHeader = clean(
      tei(
        `<table><row role="label"><cell>A</cell><cell>B</cell></row><row><cell>1</cell><cell>2</cell></row></table>`,
      ),
    );
    expect(withHeader).toContain("| A | B |");
    expect(withHeader).toContain("|---|---|");
    const noHeader = clean(
      tei(`<table><row><cell>1</cell><cell>2</cell></row></table>`),
    );
    expect(noHeader).toContain("| 1 | 2 |");
    expect(noHeader).not.toContain("---");
  });

  it("escapes a literal pipe inside a table cell", () => {
    const mit = clean(tei(`<table><row><cell>a|b</cell></row></table>`));
    expect(mit).toContain("a\\|b");
  });

  it("renders verse, stanzas and a standalone line", () => {
    const mit = clean(
      tei(`<lg><l>one</l><l>two</l><lg><l>three</l></lg></lg><l>loose</l>`),
    );
    expect(mit).toContain("* one");
    expect(mit).toContain("* two");
    expect(mit).toContain("* three");
    expect(mit).toContain("* loose");
  });

  it("maps <quote> and <cit> to blockquotes", () => {
    const mit = clean(tei(`<quote><p>a</p><p>b</p></quote><cit>c</cit>`));
    expect(mit).toContain("> a");
    expect(mit).toContain("> b");
    expect(mit).toContain("> c");
  });

  it("maps a <q> around block content to a blockquote", () => {
    const mit = clean(
      tei(
        `<div><q><p>HONESTUM igitur.</p><bibl>Cic. de Fin.</bibl></q></div>`,
      ),
    );
    expect(mit).toContain("> HONESTUM igitur.\n>\n> [Cic. de Fin.]");
    // The canonical TEI form of a blockquote is <quote>, not <q>.
    expect(toTEIXML(mit)).toContain(
      "<quote><p>HONESTUM igitur.</p><p><bibl>Cic. de Fin.</bibl></p></quote>",
    );
  });

  it("keeps a <q> with inline-only content an inline quotation", () => {
    expect(clean(tei(`<p>He said <q>yes</q> firmly.</p>`))).toContain(
      'He said "yes" firmly.',
    );
    // Even at block level, where it used to be flattened to a bare paragraph.
    expect(clean(tei(`<div><said>yes</said></div>`))).toContain('"yes"');
    // And nested in another block, where the same choice is made per element.
    expect(clean(tei(`<quote><p>He said <q>yes</q>.</p></quote>`))).toContain(
      '> He said "yes".',
    );
  });

  it("maps a <q> around block content nested in another block", () => {
    const mit = clean(
      tei(`<quote><p>outer</p><q><p>inner</p></q></quote>`),
    );
    expect(mit).toContain("> outer");
    expect(mit).toContain("> > inner");
  });

  it("maps a list, verse, and nested quote inside a <quote> to block content", () => {
    const listMit = clean(
      tei(
        `<quote><p>Intro:</p><list><item>one</item><item>two</item></list></quote>`,
      ),
    );
    expect(listMit).toContain("> Intro:");
    expect(listMit).toContain("> - one");
    expect(listMit).toContain("> - two");

    const verseMit = clean(tei(`<quote><lg><l>a</l><l>b</l></lg></quote>`));
    expect(verseMit).toContain("> * a");
    expect(verseMit).toContain("> * b");

    const nestedMit = clean(
      tei(`<quote><p>outer</p><quote><p>inner</p></quote></quote>`),
    );
    expect(nestedMit).toContain("> outer");
    expect(nestedMit).toContain("> > inner");
  });

  it("maps a list inside a block <stage> to stage-direction block content", () => {
    const mit = clean(
      tei(
        `<div><stage><list><item>one</item><item>two</item></list></stage></div>`,
      ),
    );
    expect(mit).toContain(": - one");
    expect(mit).toContain(": - two");
  });

  it("maps a speech to a speaker line plus verse", () => {
    const mit = clean(tei(`<sp><speaker>Ham.</speaker><l>To be</l></sp>`));
    expect(mit).toContain("@Ham.@");
    expect(mit).toContain("* To be");
  });

  it("maps a block-level <stage> to stage-direction lines", () => {
    const mit = clean(tei(`<div><stage>Enter Hamlet.</stage><p>x</p></div>`));
    expect(mit).toContain(": Enter Hamlet.");
  });

  it("maps a block <stage> with multiple paragraphs", () => {
    const mit = clean(
      tei(`<div><stage><p>First.</p><p>Second.</p></stage></div>`),
    );
    expect(mit).toContain(": First.");
    expect(mit).toContain(": Second.");
  });

  it("tags semantic block wrappers with an `element` key", () => {
    const mit = clean(tei(`<trailer>The End</trailer>`));
    expect(mit).toContain('element="trailer"');
    expect(mit).toContain("The End");
  });

  it("keeps an empty figure as an element-tagged block", () => {
    const mit = clean(tei(`<figure></figure>`));
    expect(mit).toContain('element="figure"');
  });

  it("renders a bare text run inside a structural element as a paragraph", () => {
    const mit = clean(tei(`<div>loose text<p>p</p></div>`));
    expect(mit).toContain("loose text");
  });

  it("ignores an all-whitespace bare text run", () => {
    const mit = clean(tei(`<div>   <p>p</p></div>`));
    expect(mit).toContain("p");
  });
});

describe("fromTEIXML — footnotes", () => {
  it("turns a bottom note into a reference plus an appended footnote block", () => {
    const mit = clean(
      tei(`<div><p>text<note place="bottom">the note</note>.</p></div>`),
    );
    expect(mit).toContain("<n1>");
    expect(mit).toContain("{#n1}");
    expect(mit).toContain("the note");
  });

  it("renders a block-level note in place", () => {
    const mit = clean(
      tei(`<div><note place="foot"><p>standalone</p></note></div>`),
    );
    expect(mit).toContain("standalone");
  });
});

describe("fromTEIXML — inline", () => {
  const inline = (frag: string): string => clean(tei(`<p>${frag}</p>`));

  it("maps highlight rends to their Markit wrappers", () => {
    expect(inline(`<hi>i</hi>`)).toContain("_i_");
    expect(inline(`<hi rend="italic">i</hi>`)).toContain("_i_");
    expect(inline(`<hi rend="sup">s</hi>`)).toContain("^s^");
    expect(inline(`<hi rend="sub">s</hi>`)).toContain(",,s,,");
    expect(inline(`<hi rend="smallcaps">c</hi>`)).toContain("*c*");
  });

  it("preserves an unknown rend as a generic element", () => {
    expect(inline(`<hi rend="underline">u</hi>`)).toContain(
      '<<hi rend="underline">>u<</hi>>',
    );
  });

  it("maps quotes, names, editorial marks and citations", () => {
    expect(inline(`<q>q</q>`)).toContain('"q"');
    expect(inline(`<persName>p</persName>`)).toContain("[p:p]");
    expect(inline(`<name type="place">l</name>`)).toContain("[l:l]");
    expect(inline(`<orgName>o</orgName>`)).toContain("[o:o]");
    expect(inline(`<add>a</add>`)).toContain("[+a+]");
    expect(inline(`<del>d</del>`)).toContain("[-d-]");
    expect(inline(`<unclear>u</unclear>`)).toContain("[?u?]");
    expect(inline(`<bibl>b</bibl>`)).toContain("[b]");
  });

  it("maps a lemmatized word to a disambiguation and unwraps a bare word", () => {
    expect(inline(`<w lemma="human">humane</w>`)).toContain("[w:humane=human]");
    expect(inline(`<w>humane</w>`)).toContain("humane");
    expect(inline(`<w>humane</w>`)).not.toContain("[w:");
  });

  it("maps foreign runs with and without a language code", () => {
    expect(inline(`<foreign xml:lang="la">ave</foreign>`)).toContain(
      "$la:ave$",
    );
    expect(inline(`<foreign>x</foreign>`)).toContain("$x$");
  });

  it("maps margin notes to asides", () => {
    expect(inline(`<note place="margin">side</note>`)).toContain("#side#");
  });

  it("maps an inline <stage> to a stage-direction wrapper", () => {
    expect(inline(`He pauses <stage>aside</stage> here`)).toContain(
      "::aside::",
    );
  });

  it("escapes a literal double colon in text", () => {
    expect(inline(`ratio a::b`)).toContain("a\\::b");
  });

  it("maps gaps, line breaks and page breaks", () => {
    expect(inline(`a<gap/>b`)).toContain("[...]");
    expect(inline(`a<lb/>b`)).toContain("\\");
    expect(inline(`<pb n="i"/>x`)).toContain("//i//");
    expect(inline(`<pb facs="f 1"/>x`)).toContain("//f_1//");
    expect(inline(`<pb/>x`)).toContain("///");
  });

  it("resolves glyphs to Unicode and closes up end-of-line hyphens", () => {
    expect(inline(`a<g ref="char:cmbAbbrStroke">̄</g>b`)).toContain("āb");
    expect(inline(`pro<g ref="char:EOLhyphen"/>\nceeded`)).toContain(
      "proceeded",
    );
    expect(inline(`un<g ref="char:EOLunhyphen"/>\nclear`)).toContain("unclear");
  });

  it("prefers the expansion of an abbreviation choice and marks supplied letters", () => {
    expect(
      inline(`<choice><abbr>Mr</abbr><expan>Mr<ex>iste</ex>r</expan></choice>`),
    ).toContain("[+iste+]");
    expect(inline(`<choice><abbr>Esq</abbr></choice>`)).toContain("Esq");
    expect(inline(`<choice>plain</choice>`)).toContain("plain");
    expect(
      inline(`<expan>v<am><g ref="char:abr"/></am><ex>er</ex>tue</expan>`),
    ).toContain("v[+er+]tue");
    expect(inline(`<abbr>co</abbr>`)).toContain("co");
    expect(inline(`<seg rend="decorInit">I</seg>say`)).toContain("Isay");
  });

  it("falls back to a generic element when a native type would nest in itself", () => {
    expect(inline(`<hi>a <hi>b</hi> c</hi>`)).toContain("_a <<hi>>b<</hi>> c_");
  });

  it("preserves an unmapped element as a generic element, self-closing or paired", () => {
    expect(inline(`x<milestone unit="page"/>y`)).toContain(
      '<<milestone unit="page"/>>',
    );
    expect(inline(`<foo bar="1">z</foo>`)).toContain(
      '<<foo bar="1">>z<</foo>>',
    );
  });

  it("escapes Markit-significant characters and leading block markers", () => {
    expect(inline(`a *b* _c_ {d} "e"`)).toContain(
      '\\*b\\* \\_c\\_ \\{d} \\"e\\"',
    );
    expect(clean(tei(`<p>- dash</p>`))).toContain("\\- dash");
  });

  it("drops comments and processing instructions in content", () => {
    expect(inline(`a<!--c-->b`)).toContain("ab");
    expect(inline(`a<?pi z?>b`)).toContain("ab");
  });
});

describe("fromTEIXML — formatter-canonical output", () => {
  // The corpus requires every .mit file to be formatter-canonical, so the
  // converter must be a formatter fixed point: format(fromTEIXML(x)) === it.
  const canonical = (xml: string): string => {
    const mit = clean(xml);
    expect(format(mit)).toBe(mit);
    return mit;
  };

  it("places hard line breaks at end-of-line in a paragraph", () => {
    const mit = canonical(tei(`<p>wise:<lb/>every knave<lb/>is wise.</p>`));
    expect(mit).toContain("wise: \\\nevery knave \\\nis wise.");
  });

  it("places hard line breaks at end-of-line inside a blockquote", () => {
    const mit = canonical(tei(`<quote>one.<lb/>two.</quote>`));
    expect(mit).toContain("> one. \\\n> two.");
  });

  it("places hard line breaks at end-of-line inside a stage direction", () => {
    const mit = canonical(tei(`<div><stage>one.<lb/>two.</stage></div>`));
    expect(mit).toContain(": one. \\\n: two.");
  });

  it("guards a line-break continuation that looks like a block construct", () => {
    const mit = canonical(tei(`<p>text<lb/>- dashy<lb/>| pipey</p>`));
    expect(mit).toContain("text \\\n\\- dashy \\\n\\| pipey");
  });

  it("guards a marker-like continuation inside a blockquote", () => {
    const mit = canonical(tei(`<quote>text<lb/>1. numbered</quote>`));
    expect(mit).toContain("> text \\\n> \\1. numbered");
  });

  it("keeps an empty list item that holds only a nested list", () => {
    const mit = canonical(
      tei(
        `<list><item>A<list><item>a1</item></list></item>` +
          `<item><list><item>b1</item><item>b2</item></list></item></list>`,
      ),
    );
    expect(mit).toContain("- \n  - b1\n  - b2");
  });

  it("keeps an empty ordered list item that holds only a nested list", () => {
    const mit = canonical(
      tei(
        `<list type="ordered"><item><list type="ordered">` +
          `<item>a</item></list></item></list>`,
      ),
    );
    expect(mit).toContain("1. \n  1. a");
  });

  it("hoists a leading space out of emphasis so words stay separated", () => {
    const mit = canonical(tei(`<p>By<hi> J. C. Professor.</hi></p>`));
    expect(mit).toContain("By _J. C. Professor._");
  });

  it("hoists a trailing space out of emphasis", () => {
    const mit = canonical(tei(`<p><hi>J. C. </hi>Professor</p>`));
    expect(mit).toContain("_J. C._ Professor");
  });

  it("hoists boundary space out of a foreign run", () => {
    const mit = canonical(
      tei(`<p>see<foreign xml:lang="la"> ave</foreign></p>`),
    );
    expect(mit).toContain("see $la:ave$");
  });

  it("collapses a whitespace-only inline element to bare whitespace", () => {
    const mit = canonical(tei(`<p>a<hi> </hi>b</p>`));
    expect(mit).toContain("a b");
    expect(mit).not.toContain("_");
  });

  it("separates block groups with a blank line, not a spurious line break", () => {
    const mit = canonical(tei(`<trailer><p>a</p><p>b</p></trailer>`));
    expect(mit).toContain("a\n\nb");
    expect(mit).not.toMatch(/^\\$/m);
    expect(mit).not.toContain("\\\n");
  });

  it("drops an empty paragraph inside a blockquote", () => {
    const mit = canonical(tei(`<quote><p></p><p>kept</p></quote>`));
    expect(mit).toContain("> kept");
  });
});

describe("fromTEIXML — page breaks between blocks", () => {
  it("prepends a stray page break to the following block", () => {
    const mit = clean(tei(`<div><pb n="2"/><p>text</p></div>`));
    expect(mit).toContain("//2// text");
  });

  it("places a page break inside a following heading's content", () => {
    const mit = clean(tei(`<div><pb n="3"/><head>Title</head></div>`));
    expect(mit).toMatch(/\^\d \/\/3\/\/ Title/);
  });

  it("appends a trailing page break to the last line already emitted", () => {
    const mit = clean(tei(`<div><p>x</p><pb n="9"/></div>`));
    expect(mit).toContain("x //9//");
    expect(mit).not.toMatch(/\{#2}/);
  });

  it("gives a page break with no preceding block a block of its own", () => {
    const mit = clean(tei(`<div><pb n="9"/></div>`));
    expect(mit).toContain("{#1}\n//9//");
  });

  it("appends a trailing page break to a block that emitted no content", () => {
    const mit = clean(tei(`<div><trailer></trailer><pb n="9"/></div>`));
    expect(mit).toContain('{#1, element="trailer"}\n//9//');
  });

  it("spaces an inline page break off the surrounding words", () => {
    // TCP writes `<p><pb n="17"/>BUT if…` with no space; unpadded, the marker
    // fuses to the word, and a break landing mid-word corrupts tokenisation.
    expect(clean(tei(`<p><pb n="17"/>BUT if any.</p>`))).toContain(
      "//17// BUT if any.",
    );
    expect(clean(tei(`<p>dispo<pb n="53"/>sition</p>`))).toContain(
      "dispo //53// sition",
    );
    // A space already there is not doubled.
    expect(clean(tei(`<p>end. <pb n="2"/> Next.</p>`))).toContain(
      "end. //2// Next.",
    );
  });
});

describe("fromTEIXML — modernisation option", () => {
  it("preserves long-s by default and modernises it on request", () => {
    expect(clean(tei(`<p>Deciſions</p>`))).toContain("Deciſions");
    expect(clean(tei(`<p>Deciſions</p>`), { modernize: true })).toContain(
      "Decisions",
    );
  });

  it("modernises TCP's other letterforms but leaves ligatures alone", () => {
    const mit = clean(tei(`<p>CONCLƲSION ʋse ẛo Ꞅar ꞅell æther</p>`), {
      modernize: true,
    });
    expect(mit).toContain("CONCLVSION vse so Far fell æther");
  });
});

describe("fromTEIXML — header to metadata", () => {
  const headed = (header: string): string =>
    fromTEIXML(tei(`<p>x</p>`, header));

  it("converts the standard bibliographic fields", () => {
    const mit = headed(
      `<teiHeader><fileDesc>` +
        `<titleStmt><title>Main</title><title>Alt</title><author>A. One</author><editor>E. Two</editor></titleStmt>` +
        `<extent>5 pages</extent>` +
        `<publicationStmt><publisher>Pub</publisher><pubPlace>Here</pubPlace><date when="2020">2020.</date>` +
        `<idno type="DLPS">A1</idno><idno type="STC">s1</idno><idno type="STC">s2</idno><idno type="EEBO-CITATION">e</idno></publicationStmt>` +
        `<notesStmt><note>n1</note><note>n2</note></notesStmt>` +
        `<sourceDesc><biblFull><publicationStmt><publisher>Old</publisher></publicationStmt><extent>orig</extent></biblFull></sourceDesc>` +
        `</fileDesc><profileDesc><langUsage><language ident="eng">English</language></langUsage></profileDesc></teiHeader>`,
    );
    expect(mit).toContain('title = ["Main", "Alt"]');
    expect(mit).toContain('author = "A. One"');
    expect(mit).toContain('editor = "E. Two"');
    expect(mit).toContain('extent = "5 pages"');
    expect(mit).toContain('language = "eng"');
    expect(mit).toContain('notes = ["n1", "n2"]');
    expect(mit).toContain("[metadata.publication]");
    expect(mit).toContain('date = "2020"');
    expect(mit).toContain("[metadata.idno]");
    expect(mit).toContain('STC = ["s1", "s2"]');
    expect(mit).toContain("EEBO_CITATION = "); // hyphen normalised
    expect(mit).toContain("[metadata.source]");
    expect(mit).toContain('publisher = "Old"');
  });

  it("uses singular/plural keys and date text when @when is absent", () => {
    const mit = headed(
      `<teiHeader><fileDesc><titleStmt><author>X</author><author>Y</author></titleStmt>` +
        `<publicationStmt><date>1700</date></publicationStmt><sourceDesc><p>s</p></sourceDesc></fileDesc></teiHeader>`,
    );
    expect(mit).toContain('authors = ["X", "Y"]');
    expect(mit).toContain('date = "1700"');
  });

  it("emits no metadata for an empty header", () => {
    const mit = fromTEIXML(
      `<TEI xmlns="x"><teiHeader></teiHeader><text><body><p>x</p></body></text></TEI>`,
    );
    expect(mit).toContain("# document");
    expect(mit).not.toContain("[metadata]");
  });
});

describe("toTEIXML — Markit to canonical P5", () => {
  it("rebuilds the TEI root, namespace and header", () => {
    const mit = [
      "# A1",
      "",
      "[metadata]",
      'title = "Main"',
      'authors = ["X", "Y"]',
      'language = "eng"',
      "",
      "[metadata.publication]",
      'publisher = "Pub"',
      'date = "2020"',
      "",
      "[metadata.idno]",
      'DLPS = "A1"',
      'STC = ["s1", "s2"]',
      "",
      "[metadata.source]",
      'publisher = "Old"',
      'extent = "orig"',
      "",
      "{#1}",
      "Body.",
    ].join("\n");
    const xml = toTEIXML(mit);
    expect(xml.startsWith('<TEI xmlns="http://www.tei-c.org/ns/1.0">')).toBe(
      true,
    );
    expect(xml).toContain("<title>Main</title>");
    expect(xml).toContain("<author>X</author><author>Y</author>");
    expect(xml).toContain('<idno type="DLPS">A1</idno>');
    expect(xml).toContain(
      '<idno type="STC">s1</idno><idno type="STC">s2</idno>',
    );
    expect(xml).toContain('<language ident="eng">eng</language>');
    expect(xml).toContain("<biblFull>");
    expect(xml).toContain("<extent>orig</extent>");
    expect(xml).toContain("<p>Body.</p>");
  });

  it("emits a minimal valid header when metadata is absent", () => {
    const xml = toTEIXML("# d\n\n{#1}\nx");
    expect(xml).toContain("<teiHeader>");
    expect(xml).toContain("<title></title>");
    expect(xml).toContain("Source description not available.");
  });

  it("maps every Markit inline element back to TEI", () => {
    const mit = [
      "# d",
      "",
      "{#1}",
      '*strong* _em_ #aside# @sp@ ::stg:: [+ins+] [-del-] [?unc?] [p:per] [l:pla] [o:org] [cit] $la:fr$ $plain$ [...] /// //p5// a~b a~~b "q" ^sup^ ,,sub,, x\\ y <n1>',
      "",
      "{#n1}",
      "the note",
    ].join("\n");
    const xml = toTEIXML(mit);
    for (
      const fragment of [
        '<hi rend="smallcaps">strong</hi>',
        '<hi rend="italic">em</hi>',
        '<note place="margin">aside</note>',
        "<speaker>sp</speaker>",
        "<stage>stg</stage>",
        "<add>ins</add>",
        "<del>del</del>",
        "<unclear>unc</unclear>",
        "<persName>per</persName>",
        "<placeName>pla</placeName>",
        "<orgName>org</orgName>",
        "<bibl>cit</bibl>",
        '<foreign xml:lang="la">fr</foreign>',
        "<foreign>plain</foreign>",
        "<gap/>",
        "<pb/>",
        '<pb n="p5"/>',
        '<hi rend="superscript">sup</hi>',
        '<hi rend="subscript">sub</hi>',
        "<q>q</q>",
        "&#160;",
        "<lb/>",
        '<note place="bottom">the note</note>',
      ]
    ) {
      expect(xml).toContain(fragment);
    }
  });

  it("falls back to <ref> for an unresolved footnote reference", () => {
    expect(toTEIXML("# d\n\n{#1}\nsee <n9>")).toContain("<ref>d.n9</ref>");
  });

  it("renders headings, structural elements and an element override", () => {
    const mit = [
      "# d",
      "",
      "{#title}",
      "^1 Big",
      "^2 Small",
      "",
      '{#1, element="argument"}',
      "Summary one.",
      "",
      "Summary two.",
      "",
      '{#2, tei="x"}',
      "> quoted",
      "",
      "{#3}",
      "- a",
      "  - b",
      "",
      "{#4}",
      "| h |",
      "|---|",
      "| c |",
      "",
      "{#5}",
      "* verse line",
    ].join("\n");
    const xml = toTEIXML(mit);
    expect(xml).toContain("<head>Big<lb/>Small</head>");
    expect(xml).toContain(
      "<argument><p>Summary one.</p><p>Summary two.</p></argument>",
    );
    expect(xml).toContain("<quote><p>quoted</p></quote>");
    expect(xml).toContain(
      "<list><item>a<list><item>b</item></list></item></list>",
    );
    expect(xml).toContain(
      '<table><row role="label"><cell>h</cell></row><row><cell>c</cell></row></table>',
    );
    expect(xml).toContain("<lg><l>verse line</l></lg>");
  });

  it("renders a disambiguated word as <w lemma>", () => {
    expect(toTEIXML("# d\n\n{#1}\n[w:humane=human]")).toContain(
      '<w lemma="human">humane</w>',
    );
  });

  it("round-trips a disambiguated word through TEI", () => {
    const mit = "# d\n\n{#1}\nHe was [w:humane=human] and kind.\n";
    expect(clean(toTEIXML(mit))).toContain("[w:humane=human]");
  });

  it("renders a block stage direction as <stage>", () => {
    const single = toTEIXML("# d\n\n{#1}\n: He enters.");
    expect(single).toContain("<stage>He enters.</stage>");
    const multi = toTEIXML("# d\n\n{#1}\n: First.\n:\n: Second.");
    expect(multi).toContain("<stage>First. Second.</stage>");
  });

  it("renders nested block content inside a blockquote and stage direction", () => {
    const quote = toTEIXML("# d\n\n{#1}\n> Intro:\n> - one\n> - two\n> After.");
    expect(quote).toContain(
      "<quote><p>Intro:</p><list><item>one</item><item>two</item></list><p>After.</p></quote>",
    );

    const verse = toTEIXML("# d\n\n{#1}\n> * a\n> * b");
    expect(verse).toContain("<quote><lg><l>a</l><l>b</l></lg></quote>");

    const nested = toTEIXML("# d\n\n{#1}\n> outer\n>> inner");
    expect(nested).toContain(
      "<quote><p>outer</p><quote><p>inner</p></quote></quote>",
    );

    const stage = toTEIXML("# d\n\n{#1}\n: does:\n: - one");
    expect(stage).toContain(
      "<stage>does: <list><item>one</item></list></stage>",
    );
  });

  it("renders an ordered list and a single-paragraph element override", () => {
    expect(toTEIXML("# d\n\n{#1}\n3. a\n4. b")).toContain(
      '<list type="ordered">',
    );
    expect(toTEIXML('# d\n\n{#1, element="trailer"}\nThe End')).toContain(
      "<trailer>The End</trailer>",
    );
    expect(toTEIXML('# d\n\n{#1, element="figure"}')).toContain("<figure/>");
  });

  it("reconstructs structural elements from ids and metadata", () => {
    const mit = [
      "# d",
      "",
      "## front",
      "",
      "{#1}",
      "f",
      "",
      "## body",
      "",
      "### chap",
      "",
      "[metadata]",
      'type = "chapter"',
      'n = "1"',
      "",
      "{#1}",
      "b",
    ].join("\n");
    const xml = toTEIXML(mit);
    expect(xml).toContain("<front><p>f</p></front>");
    expect(xml).toContain('<div type="chapter" n="1"><p>b</p></div>');
  });

  it("emits a generic element verbatim, self-closing or paired", () => {
    expect(toTEIXML('# d\n\n{#1}\na<<seg n="1"/>>b')).toContain('<seg n="1"/>');
    expect(toTEIXML("# d\n\n{#1}\n<<seg>>x<</seg>>")).toContain("<seg>x</seg>");
  });
});

describe("fromTEIXML — coverage corners", () => {
  const inline = (frag: string): string => clean(tei(`<p>${frag}</p>`));

  it("drops a glyph with no ref and resolves glyph content past comments", () => {
    expect(inline(`a<g/>b`)).toContain("ab");
    expect(inline(`x<g ref="char:cmbAbbrStroke">•<!--c--></g>y`)).toContain(
      "x•y",
    );
  });

  it("drops the unidentified-punctuation glyph but keeps a letterform", () => {
    expect(inline(`America<g ref="char:punc">▪</g> and`)).not.toContain("▪");
    expect(inline(`America<g ref="char:punc">▪</g> and`)).toContain(
      "America and",
    );
    expect(inline(`CONCL<g ref="char:V">Ʋ</g>SION`)).toContain("CONCLƲSION");
  });

  it("guards a paragraph that ends with a pipe", () => {
    expect(inline(`row a|`)).toContain("a\\|");
  });

  it("skips an empty block element", () => {
    const mit = clean(tei(`<div><p></p><p>kept</p></div>`));
    expect(mit).toContain("kept");
    expect(mit).not.toMatch(/\{#1}\n\n/);
  });

  it("treats a note with no place attribute as a footnote", () => {
    expect(inline(`text<note>aside</note>`)).toContain("<n1>");
  });

  it("renders a placeless block note in place and a margin block note as a paragraph", () => {
    expect(clean(tei(`<div><note><p>foot</p></note></div>`))).toContain("foot");
    // A margin note at block level has no inline aside context, so it renders
    // as a plain paragraph (exercising the isFootnote=false branch).
    const margin = clean(tei(`<div><note place="margin">m</note></div>`));
    expect(margin).toContain("\nm");
    expect(margin).not.toContain("<n");
  });

  it("handles a page break before an empty figure", () => {
    const mit = clean(tei(`<div><pb n="1"/><figure></figure></div>`));
    expect(mit).toContain("//1//");
    expect(mit).toContain('element="figure"');
  });

  it("groups verse past an intervening comment in a speech", () => {
    expect(clean(tei(`<sp><!--c--><l>x</l></sp>`))).toContain("* x");
  });

  it("skips whitespace and comment nodes inside verse, lists and tables", () => {
    expect(clean(tei(`<lg> <l>a</l> <!--c--> <l>b</l> </lg>`))).toContain(
      "* a",
    );
    expect(clean(tei(`<list> <item>i</item> </list>`))).toContain("- i");
    expect(clean(tei(`<table> <row><cell>c</cell></row> </table>`))).toContain(
      "| c |",
    );
  });

  it("skips non-verse elements in a stanza and starts on a nested stanza", () => {
    expect(clean(tei(`<lg><l>a</l><pb n="1"/></lg>`))).toContain("* a");
    expect(clean(tei(`<lg><lg><l>x</l></lg></lg>`))).toContain("* x");
  });

  it("skips a non-item, non-head element in a list", () => {
    expect(
      clean(tei(`<list><item>i</item><label>skip</label></list>`)),
    ).toContain("- i");
  });

  it("collects repeated DLPS idnos into an array and uses the first for the id", () => {
    const mit = clean(
      `<TEI xmlns="x"><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt>` +
        `<publicationStmt><idno type="DLPS">A1</idno><idno type="DLPS">A2</idno></publicationStmt>` +
        `<sourceDesc><p>s</p></sourceDesc></fileDesc></teiHeader><text><body><p>x</p></body></text></TEI>`,
    );
    expect(mit).toContain("# A1");
    expect(mit).toContain('DLPS = ["A1", "A2"]');
  });
});

describe("fromTEIXML — header corners", () => {
  const headed = (fd: string): string =>
    fromTEIXML(
      `<TEI xmlns="x"><teiHeader><fileDesc>${fd}</fileDesc></teiHeader><text><body><p>x</p></body></text></TEI>`,
    );

  it("ignores comment nodes inside header text and an empty date", () => {
    const mit = headed(
      `<titleStmt><title>A<!--c-->B</title></titleStmt><publicationStmt><date></date></publicationStmt><sourceDesc><p>s</p></sourceDesc>`,
    );
    expect(mit).toContain('title = "AB"');
    expect(mit).not.toContain("date");
  });

  it("records two editors as an array", () => {
    expect(
      headed(
        `<titleStmt><editor>One</editor><editor>Two</editor></titleStmt><sourceDesc><p>s</p></sourceDesc>`,
      ),
    ).toContain('editors = ["One", "Two"]');
  });

  it("defaults a typeless idno key and drops an empty idno", () => {
    const mit = headed(
      `<titleStmt><title>T</title></titleStmt><publicationStmt><idno>bare</idno><idno type="X"></idno></publicationStmt><sourceDesc><p>s</p></sourceDesc>`,
    );
    expect(mit).toContain('id = "bare"');
    expect(mit).not.toContain("X =");
  });

  it("reads source extent even when biblFull has no publicationStmt", () => {
    expect(
      headed(
        `<titleStmt><title>T</title></titleStmt><sourceDesc><biblFull><extent>orig</extent></biblFull></sourceDesc>`,
      ),
    ).toContain('extent = "orig"');
  });

  it("recurses into nested elements when reading a header field", () => {
    expect(
      headed(
        `<titleStmt><title>Main <hi>Work</hi></title></titleStmt><sourceDesc><p>s</p></sourceDesc>`,
      ),
    ).toContain('title = "Main Work"');
  });

  it("ignores an empty notesStmt", () => {
    const mit = headed(
      `<titleStmt><title>T</title></titleStmt><notesStmt></notesStmt><sourceDesc><p>s</p></sourceDesc>`,
    );
    expect(mit).not.toContain("notes");
  });

  it("reads a language element that has no ident attribute", () => {
    const mit = fromTEIXML(
      `<TEI xmlns="x"><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt><sourceDesc><p>s</p></sourceDesc></fileDesc>` +
        `<profileDesc><langUsage><language>fra</language></langUsage></profileDesc></teiHeader>` +
        `<text><body><p>x</p></body></text></TEI>`,
    );
    expect(mit).toContain('language = "fra"');
  });

  it("ignores an empty language element", () => {
    const mit = fromTEIXML(
      `<TEI xmlns="x"><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt><sourceDesc><p>s</p></sourceDesc></fileDesc>` +
        `<profileDesc><langUsage><language></language></langUsage></profileDesc></teiHeader>` +
        `<text><body><p>x</p></body></text></TEI>`,
    );
    expect(mit).not.toContain("language =");
  });

  it("records a source with publication but no extent, and an empty biblFull", () => {
    expect(
      headed(
        `<titleStmt><title>T</title></titleStmt><sourceDesc><biblFull><publicationStmt><publisher>P</publisher></publicationStmt></biblFull></sourceDesc>`,
      ),
    ).toContain('publisher = "P"');
    expect(
      headed(
        `<titleStmt><title>T</title></titleStmt><sourceDesc><biblFull></biblFull></sourceDesc>`,
      ),
    ).toContain('title = "T"');
  });
});

describe("toTEIXML — coverage corners", () => {
  it("rebuilds editors, extent, notes and source extent", () => {
    const mit = [
      "# d",
      "",
      "[metadata]",
      'editors = ["E1", "E2"]',
      'extent = "5p"',
      'notes = ["n1"]',
      "",
      "[metadata.source]",
      'extent = "orig"',
      "",
      "{#1}",
      "x",
    ].join("\n");
    const xml = toTEIXML(mit);
    expect(xml).toContain("<editor>E1</editor><editor>E2</editor>");
    expect(xml).toContain("<extent>5p</extent>");
    expect(xml).toContain("<notesStmt><note>n1</note></notesStmt>");
    expect(xml).toContain("<biblFull>");
    expect(xml).toContain("<extent>orig</extent>");
  });

  it("infers div from type-only, n-only, a custom id, and a numeric n", () => {
    const div = (meta: string): string =>
      toTEIXML(
        ["# d", "", "## s", "", "[metadata]", meta, "", "{#1}", "x"].join("\n"),
      );
    expect(div('type = "a"')).toContain('<div type="a">');
    expect(div('n = "2"')).toContain('<div n="2">');
    expect(div("n = 3")).toContain('<div n="3">');
    expect(toTEIXML("# d\n\n## appendix\n\n{#1}\nx")).toContain(
      "<div><p>x</p></div>",
    );
  });

  it("renders a paragraph-only title block and a multi-paragraph footnote", () => {
    expect(toTEIXML("# d\n\n{#title}\nplain title")).toContain(
      "<head>plain title</head>",
    );
    const note = [
      "# d",
      "",
      "{#1}",
      "see <n1>",
      "",
      "{#n1}",
      "para one",
      "",
      "para two",
    ].join("\n");
    expect(toTEIXML(note)).toContain(
      '<note place="bottom"><p>para one</p><p>para two</p></note>',
    );
  });

  it("renders a title block whose content is a list", () => {
    expect(toTEIXML("# d\n\n{#title}\n- one\n- two")).toContain(
      "<head><list><item>one</item><item>two</item></list></head>",
    );
  });

  it("emits a source section that has no extent", () => {
    const mit = [
      "# d",
      "",
      "[metadata.source]",
      'publisher = "Old"',
      "",
      "{#1}",
      "x",
    ].join("\n");
    const xml = toTEIXML(mit);
    expect(xml).toContain(
      "<biblFull><publicationStmt><publisher>Old</publisher>",
    );
    expect(xml).not.toContain("<extent>");
  });
});

describe("toTEIXML — the TEI shell", () => {
  // fromTEIXML flattens <text>/<front>/<body> away, so toTEIXML has to put
  // them back: the root's own blocks are its title page, `front` and `back`
  // name the matter around the body, and everything else is the body.
  it("wraps the whole document in text and body", () => {
    expect(toTEIXML("# d\n\n## s\n\n{#1}\nx")).toContain(
      "<text><body><div><p>x</p></div></body></text>",
    );
  });

  it("emits the root's own blocks as the title page in the front matter", () => {
    expect(toTEIXML("# d\n\n{#title}\nT")).toContain(
      '<front><div type="title_page"><head>T</head></div></front>',
    );
  });

  it("restores front and back matter around the body", () => {
    const mit = [
      "# d",
      "",
      "{#title}",
      "T",
      "",
      "## front",
      "",
      "### errata",
      "",
      "[metadata]",
      'type = "errata"',
      "",
      "{#1}",
      "e",
      "",
      "## ch",
      "",
      "{#1}",
      "b",
      "",
      "## back",
      "",
      "{#1}",
      "k",
    ].join("\n");
    const xml = toTEIXML(mit);
    expect(xml).toContain(
      '<front><div type="title_page"><head>T</head></div>' +
        '<div type="errata"><p>e</p></div></front>',
    );
    expect(xml).toContain("<body><div><p>b</p></div></body>");
    expect(xml).toContain("<back><p>k</p></back>");
  });

  it("emits an empty body when there is nothing but front matter", () => {
    expect(toTEIXML("# d\n\n{#title}\nT")).toContain("</front><body></body>");
  });

  it("puts a group beside the body rather than inside it", () => {
    const xml = toTEIXML("# d\n\n## group\n\n### text\n\n{#1}\nx");
    expect(xml).toContain("<text><group><text><p>x</p></text></group></text>");
    expect(xml).not.toContain("<body>");
  });

  it("emits a hoisted block run bare, not inside a div that was never there", () => {
    const xml = toTEIXML(
      '# d\n\n## ch\n\n{#1}\nb\n\n## trailer\n\n{#1, element="trailer"}\nTHE END.',
    );
    expect(xml).toContain("<div><p>b</p></div><trailer>THE END.</trailer>");
  });

  it("keeps the div around a section that is a division, not a run", () => {
    // Same shape, but the id does not name the element its blocks came from,
    // so it is somebody's own section rather than a hoisted run.
    expect(toTEIXML("# d\n\n## appendix\n\n{#1}\nx")).toContain(
      "<div><p>x</p></div>",
    );
    // Nor is a run a division just because it holds one: metadata marks it out.
    expect(
      toTEIXML('# d\n\n## trailer\n\n[metadata]\nn = "1"\n\n{#1}\nx'),
    ).toContain('<div n="1">');
  });

  it("carries the root's lang onto the text element", () => {
    expect(toTEIXML('# d\n\n[metadata]\nlang = "lat"\n\n## s\n\n{#1}\nx'))
      .toContain('<text xml:lang="lat">');
  });
});

describe("round trips", () => {
  it("survives a fromTEIXML → toTEIXML → fromTEIXML cycle without diagnostics", () => {
    const xml = tei(
      `<div type="ch" n="1"><head>H</head><p>A <hi>word</hi> and a note<note place="bottom">see <hi>here</hi></note>.</p>` +
        `<lg><l>verse</l></lg><list><item>i</item></list></div>`,
    );
    const mit = clean(xml);
    const round = clean(toTEIXML(mit));
    expect(round).toBe(mit);
  });

  it("survives a cycle through a title page, front matter, body and back", () => {
    const xml =
      `<TEI xmlns="http://www.tei-c.org/ns/1.0">${HEADER}<text xml:lang="eng">` +
      `<front><div type="title_page"><p>AN INQUIRY</p><quote>epigraph</quote></div>` +
      `<div type="errata"><head>ERRATA.</head><p>Page 11, read this.</p></div></front>` +
      `<body><div type="treatise"><div type="book" n="1"><head>BOOK I</head>` +
      `<div type="section" n="1"><p>text</p></div></div>` +
      `<trailer>THE END.</trailer></div></body>` +
      `<back><div type="ads"><head>Books lately published.</head><p>a book</p></div></back>` +
      `</text></TEI>`;
    const mit = clean(xml);
    expect(format(mit)).toBe(mit);
    expect(mit).toMatch(/^## front$/m);
    expect(mit).toMatch(/^## book_1$/m);
    expect(mit).toMatch(/^## back$/m);
    expect(mit).toMatch(/^## trailer$/m);
    expect(mit).not.toMatch(/^#+ treatise$/m);
    expect(clean(toTEIXML(mit))).toBe(mit);
  });

  it("survives a cycle through a block run hoisted out of a division", () => {
    const mit = clean(
      tei(
        `<div type="ch" n="1"><head>H</head><div n="1"><p>a</p></div>` +
          `<trailer>THE END.</trailer></div>`,
      ),
    );
    expect(mit).toMatch(/^### trailer$/m);
    expect(clean(toTEIXML(mit))).toBe(mit);

    // The same holds for a run of bare paragraphs, named `p` after the element
    // it came from.
    const paras = clean(
      tei(
        `<div type="ch" n="1"><head>H</head><div n="1"><p>a</p></div>` +
          `<p>after</p></div>`,
      ),
    );
    expect(paras).toMatch(/^### p$/m);
    expect(clean(toTEIXML(paras))).toBe(paras);
  });
});
