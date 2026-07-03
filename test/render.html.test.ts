import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import renderHTML from "../src/renderHTML.js";
import {
  document,
  markit,
  markitWithContent,
  paragraph,
} from "./utils/factories.js";
import type { MarkitDocument } from "../src/types.js";

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
    expect(html).toContain('<div id="Text.1"');
    expect(html).toMatch(/data-line="\d+">/);
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

  it("renders block stage directions", () => {
    const [document] = compile(markitWithContent("{#1}", ": Exeunt."));
    expect(renderHTML(document)).toContain(
      '<div class="stage-direction"><p>Exeunt.</p></div>',
    );
  });

  it("renders inline stage directions", () => {
    const [document] = compile(
      markitWithContent("{#1}", "He speaks ::aside:: to her."),
    );
    expect(renderHTML(document)).toContain(
      '<span class="stage-direction">aside</span>',
    );
  });

  it("renders unordered lists", () => {
    const [document] = compile(
      markitWithContent("{#1}", "- First", "- Second"),
    );
    expect(renderHTML(document)).toContain(
      "<ul><li>First</li><li>Second</li></ul>",
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

  it("renders ordered lists with custom start attribute", () => {
    const [document] = compile(
      markitWithContent("{#1}", "5. Fifth", "6. Sixth"),
    );
    expect(renderHTML(document)).toContain(
      '<ol start="5"><li>Fifth</li><li>Sixth</li></ol>',
    );
  });

  it("omits start attribute for lists starting at 1", () => {
    const [document] = compile(
      markitWithContent("{#1}", "1. First", "2. Second"),
    );
    const html = renderHTML(document);
    expect(html).toContain("<ol>");
    expect(html).not.toContain("start=");
  });

  it("renders nested lists", () => {
    const [document] = compile(
      markitWithContent("{#1}", "- First", "  - Nested", "- Second"),
    );
    const html = renderHTML(document);
    expect(html).toContain(
      "<ul><li>First<ul><li>Nested</li></ul></li><li>Second</li></ul>",
    );
  });

  it("renders mixed nested lists (ordered in unordered)", () => {
    const [document] = compile(
      markitWithContent("{#1}", "- Item", "  1. Nested ordered"),
    );
    const html = renderHTML(document);
    expect(html).toContain(
      "<ul><li>Item<ol><li>Nested ordered</li></ol></li></ul>",
    );
  });

  it("renders verse as div.lg with p.l lines", () => {
    const [document] = compile(
      markitWithContent("{#1}", "* First line", "* Second line"),
    );
    expect(renderHTML(document)).toContain(
      '<div class="lg"><p class="l">First line</p><p class="l">Second line</p></div>',
    );
  });

  it("renders tables without headers", () => {
    const [document] = compile(
      markitWithContent("{#1}", "| A | B |", "| C | D |"),
    );
    const html = renderHTML(document);
    expect(html).toContain("<table>");
    expect(html).toContain("<tbody>");
    expect(html).not.toContain("<thead>");
    expect(html).toContain("<tr><td>A</td><td>B</td></tr>");
    expect(html).toContain("<tr><td>C</td><td>D</td></tr>");
    expect(html).toContain("</tbody></table>");
  });

  it("renders tables with headers", () => {
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "|----------|----------|",
        "| Cell 1   | Cell 2   |",
      ),
    );
    const html = renderHTML(document);
    expect(html).toContain("<table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<tbody>");
    expect(html).toContain("<tr><th>Header 1</th><th>Header 2</th></tr>");
    expect(html).toContain("</thead>");
    expect(html).toContain("<tr><td>Cell 1</td><td>Cell 2</td></tr>");
    expect(html).toContain("</tbody></table>");
  });

  it("renders tables with empty cells", () => {
    const [document] = compile(
      markitWithContent("{#1}", "| A |  |", "|  | D |"),
    );
    const html = renderHTML(document);
    expect(html).toContain("<td>A</td><td></td>");
    expect(html).toContain("<td></td><td>D</td>");
  });

  it("renders tables with inline formatting in cells", () => {
    const [document] = compile(
      markitWithContent("{#1}", "| *Bold* | _Italic_ |"),
    );
    const html = renderHTML(document);
    expect(html).toContain("<td><strong>Bold</strong></td>");
    expect(html).toContain("<td><em>Italic</em></td>");
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
    const [document] = compile(markitWithContent("{#1}", "[+added+]"));
    expect(renderHTML(document)).toContain("<ins>added</ins>");
  });

  it("renders deletion as <del>", () => {
    const [document] = compile(markitWithContent("{#1}", "[-removed-]"));
    expect(renderHTML(document)).toContain("<del>removed</del>");
  });

  it('renders uncertain text as <span class="uncertain">', () => {
    const [document] = compile(markitWithContent("{#1}", "[?uncertain?]"));
    expect(renderHTML(document)).toContain(
      '<span class="uncertain">uncertain</span>',
    );
  });

  it("renders highlight as <mark>", () => {
    // highlights are not renderable in Markit, but the elements can be added
    // programmatically (e.g. to highlight search results), and should be
    // rendered as <mark> in HTML
    const doc = document("Text", [
      paragraph("1", [
        {
          type: "paragraph",
          content: [
            {
              type: "highlight",
              content: [{ type: "plainText", content: "highlighted" }],
            },
          ],
        },
      ]),
    ]);
    expect(renderHTML(doc)).toContain("<mark>highlighted</mark>");
  });

  it("renders speaker as <span class='speaker'>", () => {
    const [document] = compile(
      markitWithContent("{#1}", "@Speaker.@ This is dialogue."),
    );
    expect(renderHTML(document)).toContain(
      '<span class="speaker">Speaker.</span>',
    );
  });

  it('renders aside as <span class="aside">', () => {
    const [document] = compile(markitWithContent("{#1}", "#margin note#"));
    expect(renderHTML(document)).toContain(
      '<span class="aside">margin note</span>',
    );
  });

  it('renders generic foreign text as <em class="foreign">', () => {
    const [document] = compile(markitWithContent("{#1}", "$foreign$"));
    expect(renderHTML(document)).toContain('<em class="foreign">foreign</em>');
  });

  it("renders language-coded text as <em> with lang attribute", () => {
    const [document] = compile(markitWithContent("{#1}", "$grc:logos$"));
    expect(renderHTML(document)).toContain('<em lang="grc">');
  });

  it('renders person names as <span class="person">', () => {
    const [document] = compile(markitWithContent("{#1}", "[p:Locke]"));
    expect(renderHTML(document)).toContain('<span class="person">Locke</span>');
  });

  it('renders place names as <span class="place">', () => {
    const [document] = compile(markitWithContent("{#1}", "[l:London]"));
    expect(renderHTML(document)).toContain('<span class="place">London</span>');
  });

  it('renders org names as <span class="org">', () => {
    const [document] = compile(markitWithContent("{#1}", "[o:Acme]"));
    expect(renderHTML(document)).toContain('<span class="org">Acme</span>');
  });

  it("renders superscript as <sup>", () => {
    const [document] = compile(markitWithContent("{#1}", "^raised^"));
    expect(renderHTML(document)).toContain("<sup>raised</sup>");
  });

  it("renders subscript as <sub>", () => {
    const [document] = compile(markitWithContent("{#1}", ",,lower,,"));
    expect(renderHTML(document)).toContain("<sub>lower</sub>");
  });

  it('renders bare page break as <span class="pageBreak">', () => {
    const [document] = compile(markitWithContent("{#1}", "text /// more"));
    expect(renderHTML(document)).toContain('<span class="pageBreak"></span>');
  });

  it('renders page break with ref as <span class="pageBreak" data-ref="...">', () => {
    const [document] = compile(markitWithContent("{#1}", "text //12r// more"));
    expect(renderHTML(document)).toContain(
      '<span class="pageBreak" data-ref="12r"></span>',
    );
  });

  it("renders footnote reference as anchor with superscript", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "Footnote."),
    );
    expect(renderHTML(document)).toContain(
      '<a href="#footnote-Text.n1" id="footnote-ref-Text.n1"><sup>Text.n1</sup></a>',
    );
  });

  it("renders Latin text as <em lang='la'>", () => {
    const [document] = compile(markitWithContent("{#1}", "$la:Roma$"));
    expect(renderHTML(document)).toContain('<em lang="la">Roma</em>');
  });

  it("renders French text as <em lang='fr'>", () => {
    const [document] = compile(markitWithContent("{#1}", "$fr:Paris$"));
    expect(renderHTML(document)).toContain('<em lang="fr">Paris</em>');
  });

  it("renders line break as <br />", () => {
    const [document] = compile(
      markitWithContent("{#1}", "line one \\", "line two"),
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
    const [document] = compile(markitWithContent("{#1}", "[...]"));
    expect(renderHTML(document)).toContain(
      '<span class="illegible">&lt;illegible&gt;</span>',
    );
  });
});
