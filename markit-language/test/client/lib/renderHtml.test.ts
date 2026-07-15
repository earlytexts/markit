import { describe, expect, it } from "vitest";
import { compile } from "@earlytexts/markit";
import renderHtml from "../../../src/client/lib/renderHtml.ts";

// Compile a whole Markit document (with the "# Id" header) so the renderer sees
// real ids, sections and block ranges.
const render = (...lines: string[]): string => {
  const { document } = compile(lines.join("\n"));
  return renderHtml(document);
};

// Render a one-paragraph body and read back the inner text-block, the quickest
// way to assert on inline rendering.
const renderInline = (source: string): string => {
  const html = render("# Text", "", "{#1}", source, "");
  const match = html.match(/<div class="text-block">(.*?)<\/div>/s);
  return match?.[1] ?? html;
};

describe("document scaffolding", () => {
  it("wraps the body in a reading container inside a full HTML document", () => {
    const html = render("# Text", "", "{#1}", "Hello.", "");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<body><div class="reading">');
    expect(html).toContain("</div></body></html>");
  });

  it("puts the document id in the title and on the section", () => {
    const html = render("# Berkeley.ETV", "", "{#1}", "Hello.", "");
    expect(html).toContain("<title>Berkeley.ETV</title>");
    expect(html).toContain('<section id="Berkeley.ETV"');
  });

  it("stamps data-line on the section and each block for scroll sync", () => {
    const html = render("# Text", "", "{#1}", "First.", "");
    expect(html).toMatch(/<section id="Text" data-line="\d+">/);
    expect(html).toMatch(
      /<div id="Text.1" class="text-block-wrapper" data-line="\d+">/,
    );
  });

  it("recurses into nested sections", () => {
    const html = render(
      "# Parent",
      "",
      "{#1}",
      "Top.",
      "",
      "## Child",
      "",
      "{#2}",
      "Nested.",
      "",
    );
    expect(html).toContain('<section id="Parent"');
    expect(html).toContain("Nested.");
  });
});

describe("blocks", () => {
  it("renders a paragraph block with its citable id shown, prefix stripped", () => {
    const html = render("# Text", "", "{#1}", "Body.", "");
    expect(html).toContain(
      '<div id="Text.1" class="text-block-wrapper" data-line="',
    );
    expect(html).toContain('<span class="block-id">1</span>');
    expect(html).toContain('<div class="text-block"><p>Body.</p></div>');
  });

  it("renders a title block as a titlepage header with heading lines", () => {
    const html = render("# Text", "", "{#title}", "^1 A Title", "");
    expect(html).toContain('<header id="Text.title" class="titlepage"');
    expect(html).toContain('<div class="heading-line level-1">A Title</div>');
  });

  it("renders a subtitle block", () => {
    const html = render("# Text", "", "{#subtitle}", "^3 A Subtitle", "");
    expect(html).toContain('class="subtitle"');
    expect(html).toContain(
      '<div class="heading-line level-3">A Subtitle</div>',
    );
  });

  it("renders a footnote block with its apparatus label", () => {
    const html = render(
      "# Text",
      "",
      "{#1}",
      "Body.<n1>",
      "",
      "{#n1}",
      "A note.",
      "",
    );
    expect(html).toContain('<span class="block-id">1.</span>');
    expect(html).toContain(
      '<div class="text-block footnote"><p>A note.</p></div>',
    );
    // The footnote block's anchor matches the reference's href, so the link
    // resolves within the single-document preview.
    expect(html).toContain('<div id="Text.n1" class="text-block-wrapper"');
    expect(html).toContain('href="#Text.n1"');
  });
});

describe("block elements", () => {
  it("renders blockquotes", () => {
    const html = render("# Text", "", "{#1}", "> Quoted line", "");
    expect(html).toContain("<blockquote><p>Quoted line</p></blockquote>");
  });

  it("renders stage directions", () => {
    const html = render("# Text", "", "{#1}", ": enter Philo", "");
    expect(html).toContain(
      '<div class="stage-direction"><p>enter Philo</p></div>',
    );
  });

  it("renders ordered lists with a start attribute", () => {
    const html = render("# Text", "", "{#1}", "3. third", "4. fourth", "");
    expect(html).toContain('<ol start="3">');
    expect(html).toContain("<li>third</li>");
  });

  it("renders unordered lists", () => {
    const html = render("# Text", "", "{#1}", "- one", "- two", "");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders verse lists", () => {
    const html = render(
      "# Text",
      "",
      "{#1}",
      "* first line",
      "* second line",
      "",
    );
    expect(html).toContain('<ul class="verse">');
    expect(html).toContain("<li>first line</li>");
  });

  it("renders nested lists", () => {
    const html = render("# Text", "", "{#1}", "- outer", "  - inner", "");
    expect(html).toContain("<li>outer<ul><li>inner</li></ul></li>");
  });

  it("renders tables with a header row", () => {
    const html = render(
      "# Text",
      "",
      "{#1}",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
    );
    expect(html).toContain("<thead><tr><th>A</th><th>B</th></tr></thead>");
    expect(html).toContain("<tbody><tr><td>1</td><td>2</td></tr></tbody>");
  });
});

describe("inline elements", () => {
  it("renders strong as small caps and emphasis as italics", () => {
    expect(renderInline("*bold* and _italic_")).toContain(
      "<strong>bold</strong>",
    );
    expect(renderInline("*bold* and _italic_")).toContain("<em>italic</em>");
  });

  it("renders quotes and citations", () => {
    expect(renderInline('a "quoted" phrase')).toContain("<q>quoted</q>");
    expect(renderInline("see [a work] here")).toContain("<cite>a work</cite>");
  });

  it("renders editorial insertions and deletions with titles", () => {
    expect(renderInline("an [+added+] word")).toContain(
      '<ins title="editorial insertion">added</ins>',
    );
    expect(renderInline("a [-cut-] word")).toContain(
      '<del title="editorial deletion">cut</del>',
    );
  });

  it("renders uncertain and illegible readings", () => {
    expect(renderInline("maybe [?this?] word")).toContain(
      '<span class="uncertain" title="uncertain reading">this</span>',
    );
    expect(renderInline("a gap [...] here")).toContain(
      '<span class="illegible" title="illegible in source">[…]</span>',
    );
  });

  it("renders named entities with entity- classes", () => {
    expect(renderInline("[p:Locke] argued")).toContain(
      '<span class="entity-person">Locke</span>',
    );
    expect(renderInline("in [l:London] town")).toContain(
      '<span class="entity-place">London</span>',
    );
  });

  it("renders foreign text, with a lang code when given", () => {
    expect(renderInline("the word $ex nihilo$ means")).toContain(
      '<span class="foreign">ex nihilo</span>',
    );
    expect(renderInline("the city $la:Roma$ stood")).toContain(
      '<span class="foreign" lang="la">Roma</span>',
    );
  });

  it("renders a footnote reference as an anchored superscript", () => {
    const inline = renderInline("a claim<n1>");
    expect(inline).toContain('<sup class="fnref">');
    expect(inline).toContain("[n1]</a></sup>");
  });

  it("renders page breaks, with a titled marker when a ref is given", () => {
    expect(renderInline("end of page //3r// start")).toContain(
      '<span class="pagebreak" title="page 3r"></span>',
    );
    expect(renderInline("end of page /// start")).toContain(
      '<span class="pagebreak" title="page break"></span>',
    );
  });

  it("renders superscript and subscript", () => {
    expect(renderInline("H,,2,,O")).toContain("<sub>2</sub>");
    expect(renderInline("the 1^st^ time")).toContain("<sup>st</sup>");
  });

  it("renders a raw element span carrying its tag", () => {
    expect(renderInline('<<SEG REND="decorInit">>I<</SEG>>')).toContain(
      '<span class="element" data-tag="SEG">I</span>',
    );
  });

  it("escapes HTML metacharacters in text", () => {
    expect(renderInline("a & b")).toContain("a &amp; b");
  });
});
