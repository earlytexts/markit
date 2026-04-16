import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import renderHTML from "../src/renderHTML.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("document structure", () => {
  it("renders document as a section with id and data-line", () => {
    const [document] = compile(markitWithContent("{#1}", "Hello"));
    const html = renderHTML(document);
    expect(html).toContain('<section id="Text"');
    expect(html).toMatch(/data-line="\d+"/);
  });

  it("sets document title to the document id", () => {
    const [document] = compile(markitWithContent("{#1}", "Hello"));
    const html = renderHTML(document);
    expect(html).toContain("<title>Text</title>");
  });

  it("renders blocks inside div wrappers with data-line", () => {
    const [document] = compile(markitWithContent("{#1}", "Hello"));
    const html = renderHTML(document);
    expect(html).toMatch(/<div data-line="\d+">/);
  });

  it("renders nested child documents as nested sections", () => {
    const [document] = compile(
      markit(
        "# Parent",
        "",
        "{#1}",
        "Intro",
        "",
        "## Child",
        "",
        "{#1}",
        "Child content",
        "",
      ),
    );
    const html = renderHTML(document);
    expect(html).toContain('<section id="Parent"');
    expect(html).toContain('<section id="Parent.Child"');
  });
});

describe("block elements", () => {
  it("renders paragraphs as <p>", () => {
    const [document] = compile(markitWithContent("{#1}", "Hello world"));
    expect(renderHTML(document)).toContain("<p>Hello world</p>");
  });

  it("renders headings with size spans", () => {
    const [document] = compile(markitWithContent("{#title}", "^1 My Heading"));
    expect(renderHTML(document)).toContain(
      '<h1><span class="size-1">My Heading</span></h1>',
    );
  });

  it("renders h2 heading at child document depth", () => {
    const [document] = compile(
      markit("# Parent", "", "## Child", "", "{#title}", "^1 Sub", ""),
    );
    expect(renderHTML(document)).toContain(
      '<h2><span class="size-1">Sub</span></h2>',
    );
  });

  it("renders subtitle heading one level deeper", () => {
    const [document] = compile(
      markit("# Text", "", "{#subtitle}", "^1 Subtitle", ""),
    );
    // subtitle block type adds 1 to depth, so at root (depth 0) a subtitle heading becomes h2
    expect(renderHTML(document)).toContain(
      '<h2><span class="size-1">Subtitle</span></h2>',
    );
  });

  it("renders blockquotes", () => {
    const [document] = compile(markitWithContent("{#1}", "> A quote."));
    expect(renderHTML(document)).toContain(
      "<blockquote><p>A quote.</p></blockquote>",
    );
  });

  it("renders footnote block with superscript id prefix", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "The footnote."),
    );
    expect(renderHTML(document)).toContain(
      "<p><sup>Text.n1</sup> The footnote.</p>",
    );
  });
});

describe("inline elements", () => {
  it("renders plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "Just text"));
    expect(renderHTML(document)).toContain("<p>Just text</p>");
  });

  it("HTML-escapes ampersands in plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "A & B"));
    expect(renderHTML(document)).toContain("<p>A &amp; B</p>");
  });

  it("renders strong as <strong>", () => {
    const [document] = compile(markitWithContent("{#1}", "*bold*"));
    expect(renderHTML(document)).toContain("<strong>bold</strong>");
  });

  it("renders emphasis as <em>", () => {
    const [document] = compile(markitWithContent("{#1}", "_italic_"));
    expect(renderHTML(document)).toContain("<em>italic</em>");
  });

  it("renders quote as <q>", () => {
    const [document] = compile(markitWithContent("{#1}", '"a quote"'));
    expect(renderHTML(document)).toContain("<q>a quote</q>");
  });

  it("renders citation as <cite>", () => {
    const [document] = compile(markitWithContent("{#1}", "[cited]"));
    expect(renderHTML(document)).toContain("<cite>cited</cite>");
  });

  it("renders insertion as <ins>", () => {
    const [document] = compile(markitWithContent("{#1}", "++added++"));
    expect(renderHTML(document)).toContain("<ins>added</ins>");
  });

  it("renders deletion as <del>", () => {
    const [document] = compile(markitWithContent("{#1}", "--removed--"));
    expect(renderHTML(document)).toContain("<del>removed</del>");
  });

  it('renders uncertain text as <span class="uncertain">', () => {
    const [document] = compile(markitWithContent("{#1}", "??uncertain??"));
    expect(renderHTML(document)).toContain(
      '<span class="uncertain">uncertain</span>',
    );
  });

  it("renders highlight as <mark>", () => {
    const [document] = compile(markitWithContent("{#1}", "==highlighted=="));
    expect(renderHTML(document)).toContain("<mark>highlighted</mark>");
  });

  it('renders aside as <span class="aside">', () => {
    const [document] = compile(markitWithContent("{#1}", "@margin note@"));
    expect(renderHTML(document)).toContain(
      '<span class="aside">margin note</span>',
    );
  });

  it('renders foreign text as <em class="foreign">', () => {
    const [document] = compile(markitWithContent("{#1}", "$foreign$"));
    expect(renderHTML(document)).toContain('<em class="foreign">foreign</em>');
  });

  it('renders Greek text as <em class="greek">', () => {
    const [document] = compile(markitWithContent("{#1}", "$gr:logos$"));
    expect(renderHTML(document)).toContain('<em class="greek">');
  });

  it("renders footnote reference as anchor with superscript", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "Footnote."),
    );
    expect(renderHTML(document)).toContain(
      '<a href="#footnote-Text.n1" id="footnote-ref-Text.n1"><sup>Text.n1</sup></a>',
    );
  });

  it('renders Latin text as <em class="latin">', () => {
    const [document] = compile(markitWithContent("{#1}", "$la:Roma$"));
    expect(renderHTML(document)).toContain('<em class="latin">Roma</em>');
  });

  it('renders French text as <em class="french">', () => {
    const [document] = compile(markitWithContent("{#1}", "$fr:Paris$"));
    expect(renderHTML(document)).toContain('<em class="french">Paris</em>');
  });

  it('renders page break as <span class="page-break">', () => {
    const [document] = compile(markitWithContent("{#1}", "before || after"));
    expect(renderHTML(document)).toContain('<span class="page-break">|</span>');
  });

  it("renders line break as <br />", () => {
    const [document] = compile(
      markitWithContent("{#1}", "line one //", "line two"),
    );
    expect(renderHTML(document)).toContain("<br />");
  });

  it("renders non-breaking space as &nbsp;", () => {
    const [document] = compile(markitWithContent("{#1}", '"~"'));
    expect(renderHTML(document)).toContain("&nbsp;");
  });

  it("renders em space as &emsp;", () => {
    const [document] = compile(markitWithContent("{#1}", "a~~b"));
    expect(renderHTML(document)).toContain("&emsp;");
  });

  it('renders illegible text as <span class="illegible">', () => {
    const [document] = compile(markitWithContent("{#1}", "???"));
    expect(renderHTML(document)).toContain(
      '<span class="illegible">&lt;illegible&gt;</span>',
    );
  });
});
