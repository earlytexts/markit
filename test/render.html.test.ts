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
        "## Parent.Child",
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
      markit("# Parent", "", "## Parent.Child", "", "{#title}", "^1 Sub", ""),
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

  it("renders unordered lists", () => {
    const [document] = compile(markitWithContent("{#1}", "- Alpha", "- Beta"));
    expect(renderHTML(document)).toContain(
      "<ul><li>Alpha</li><li>Beta</li></ul>",
    );
  });

  it("renders ordered lists", () => {
    const [document] = compile(
      markitWithContent("{#1}", "1. First", "2. Second"),
    );
    expect(renderHTML(document)).toContain(
      "<ol><li>First</li><li>Second</li></ol>",
    );
  });

  it("renders footnote block with superscript id prefix", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "The footnote."),
    );
    expect(renderHTML(document)).toContain(
      "<p><sup>n1</sup> The footnote.</p>",
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
    const [document] = compile(markitWithContent("{#1}", "$$logos$$"));
    expect(renderHTML(document)).toContain('<em class="greek">');
  });

  it("renders footnote reference as anchor with superscript", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "Footnote."),
    );
    expect(renderHTML(document)).toContain(
      '<a href="#footnote-n1" id="footnote-ref-n1"><sup>n1</sup></a>',
    );
  });

  it("renders page break as span", () => {
    const [document] = compile(markitWithContent("{#1}", "before | after"));
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
});

describe("subsection and speaker metadata", () => {
  it("renders subsection as span before first paragraph element", () => {
    const [document] = compile(
      markitWithContent("{#1, subsection=42}", "Hello"),
    );
    expect(renderHTML(document)).toContain(
      '<p><span class="subsection">42.</span> Hello</p>',
    );
  });

  it("renders speaker as span before first paragraph element", () => {
    const [document] = compile(
      markitWithContent("{#1, speaker=Alice}", "Hello"),
    );
    expect(renderHTML(document)).toContain(
      '<p><span class="speaker">Alice.</span> Hello</p>',
    );
  });

  it("renders both subsection and speaker before first paragraph element", () => {
    const [document] = compile(
      markitWithContent("{#1, subsection=3, speaker=Bob}", "Hello"),
    );
    expect(renderHTML(document)).toContain(
      '<p><span class="subsection">3.</span> <span class="speaker">Bob.</span> Hello</p>',
    );
  });

  it("only prefixes the first block-level element, not subsequent ones", () => {
    const [document] = compile(
      markitWithContent("{#1, subsection=1}", "First.", "", "Second."),
    );
    const html = renderHTML(document);
    expect(html).toContain('<p><span class="subsection">1.</span> First.</p>');
    expect(html).toContain("<p>Second.</p>");
  });

  it("prefixes first element when block starts with a blockquote", () => {
    const [document] = compile(
      markitWithContent("{#1, subsection=2}", "> Quoted."),
    );
    expect(renderHTML(document)).toContain(
      '<blockquote><p><span class="subsection">2.</span> Quoted.</p></blockquote>',
    );
  });

  it("only prefixes the first paragraph inside a multi-paragraph blockquote", () => {
    const [document] = compile(
      markitWithContent("{#1, subsection=3}", "> First.", ">", "> Second."),
    );
    const html = renderHTML(document);
    expect(html).toContain('<p><span class="subsection">3.</span> First.</p>');
    expect(html).toContain("<p>Second.</p>");
  });

  it("prefixes first list item when block starts with a list", () => {
    const [document] = compile(
      markitWithContent("{#1, subsection=5}", "- Alpha", "- Beta"),
    );
    const html = renderHTML(document);
    expect(html).toContain('<li><span class="subsection">5.</span> Alpha</li>');
    expect(html).toContain("<li>Beta</li>");
  });

  it("does not prefix title blocks", () => {
    const [document] = compile(
      markitWithContent("{#title, subsection=1}", "^1 My Title"),
    );
    expect(renderHTML(document)).not.toContain("subsection");
  });

  it("does not prefix subtitle blocks", () => {
    const [document] = compile(
      markitWithContent("{#subtitle, subsection=1}", "^2 A Subtitle"),
    );
    expect(renderHTML(document)).not.toContain("subsection");
  });

  it("does not prefix footnote blocks", () => {
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "See <n1>.",
        "",
        "{#n1, subsection=1}",
        "Note.",
      ),
    );
    expect(renderHTML(document)).not.toContain("subsection");
  });
});
