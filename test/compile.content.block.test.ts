import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import {
  markitWithContent,
  p,
  h,
  hl,
  bq,
  list,
  li,
  pt,
} from "./utils/factories.js";

describe("block content", () => {
  it("parses text into paragraphs by default", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "Example plain text content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Example plain text content.")]),
    ]);
  });

  it("groups consecutive heading lines into a single heading group", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#title}",
        "^1 Level 1 Heading",
        "^2 Level 2 Heading",
        "^3 Level 3 Heading",
        "^6 Level 6 Heading",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      h([
        hl(1, [pt("Level 1 Heading")]),
        hl(2, [pt("Level 2 Heading")]),
        hl(3, [pt("Level 3 Heading")]),
        hl(6, [pt("Level 6 Heading")]),
      ]),
    ]);
  });

  it("separates heading groups at blank lines", () => {
    const [document, errors] = compile(
      markitWithContent("{#title}", "^1 Title", "", "^2 Subtitle"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      h([hl(1, [pt("Title")])]),
      h([hl(2, [pt("Subtitle")])]),
    ]);
  });

  it("parses block quotations", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "> A block quotation."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([p([pt("A block quotation.")])]),
    ]);
  });

  it("parses block quotation with text before and after", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "Text before.",
        "> The block quotation.",
        "Text after.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Text before.")]),
      bq([p([pt("The block quotation.")])]),
      p([pt("Text after.")]),
    ]);
  });

  it("parses multi-line block quotations", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "> This is a block quotation that spans",
        "> multiple lines and should be treated",
        "> as a single block.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([
        p([
          pt(
            "This is a block quotation that spans multiple lines and should be treated as a single block.",
          ),
        ]),
      ]),
    ]);
  });

  it("parses block quotation with multiple paragraphs", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "> First paragraph.",
        ">",
        "> Second paragraph.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([p([pt("First paragraph.")]), p([pt("Second paragraph.")])]),
    ]);
  });

  it("parses multiple paragraphs separated by blank lines", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "First paragraph.", "", "Second paragraph."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("First paragraph.")]),
      p([pt("Second paragraph.")]),
    ]);
  });

  it("parses heading followed by paragraph without blank line", () => {
    const [document, errors] = compile(
      markitWithContent("{#title}", "^1 Title", "Some content below."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      h([hl(1, [pt("Title")])]),
      p([pt("Some content below.")]),
    ]);
  });

  it("collapses whitespace and joins paragraph lines", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This content is split",
        "across multiple lines and should",
        "be joined   with    single   spaces.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt(
          "This content is split across multiple lines and should be joined with single spaces.",
        ),
      ]),
    ]);
  });

  // TODO: make this an error
  it("treats ^7 (invalid level) as paragraph text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "^7 not a heading"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("^7 not a heading")])]);
  });

  // TODO: make this an error
  it("treats ^ without a level digit as paragraph text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "^ not a heading"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("^ not a heading")])]);
  });

  it("removes trailing space at end of content block", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "text with trailing space "),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("text with trailing space")]),
    ]);
  });

  it("removes trailing space after inline element at end of content", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "*bold* "));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "strong", content: [pt("bold")] }]),
    ]);
  });

  it("parses unordered list", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "- Item 1", "- Item 2", "- Item 3"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      list(false, [li([pt("Item 1")]), li([pt("Item 2")]), li([pt("Item 3")])]),
    ]);
  });

  it("parses ordered list", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "1. First", "2. Second", "3. Third"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      list(true, [li([pt("First")]), li([pt("Second")]), li([pt("Third")])]),
    ]);
  });

  it("parses list adjacent to paragraphs without blank lines", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "Before.", "- Item 1", "- Item 2", "After."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Before.")]),
      list(false, [li([pt("Item 1")]), li([pt("Item 2")])]),
      p([pt("After.")]),
    ]);
  });

  it("parses list separated from paragraph by blank line", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#0}",
        "Before.",
        "",
        "- Item 1",
        "- Item 2",
        "",
        "After.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Before.")]),
      list(false, [li([pt("Item 1")]), li([pt("Item 2")])]),
      p([pt("After.")]),
    ]);
  });

  it("parses two separate lists separated by a blank line", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "- Item 1", "", "- Item 2"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      list(false, [li([pt("Item 1")])]),
      list(false, [li([pt("Item 2")])]),
    ]);
  });

  it("parses unordered list inside blockquote", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "> - Item 1", "> - Item 2"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([list(false, [li([pt("Item 1")]), li([pt("Item 2")])])]),
    ]);
  });

  it("parses blockquote with paragraph and list", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#0}",
        "> A paragraph.",
        ">",
        "> - Item 1",
        "> - Item 2",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([
        p([pt("A paragraph.")]),
        list(false, [li([pt("Item 1")]), li([pt("Item 2")])]),
      ]),
    ]);
  });

  it("parses list item with inline formatting", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "- *bold* item"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      list(false, [
        li([{ type: "strong", content: [pt("bold")] }, pt(" item")]),
      ]),
    ]);
  });

  it("parses ordered list with non-sequential numbers", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "1. Alpha", "5. Beta"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      list(true, [li([pt("Alpha")]), li([pt("Beta")])]),
    ]);
  });

  it("treats bare '-' as a paragraph", () => {
    const [document, errors] = compile(markitWithContent("{#0}", "-"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("-")])]);
  });

  it("treats '1.' without a space as a paragraph", () => {
    const [document, errors] = compile(markitWithContent("{#0}", "1."));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("1.")])]);
  });
});

describe("block content errors", () => {
  it("returns error for heading inside a block quotation", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "> ^1 Heading inside block quote"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Headings are not allowed inside block quotations.",
      line: 4,
      column: 3,
      endLine: 4,
      endColumn: 32,
      severity: "error",
    });
  });

  it("returns error for heading inside a paragraph block", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "^1 Heading in paragraph block"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Headings are only allowed in title or subtitle blocks.",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 30,
      severity: "error",
    });
  });

  it("returns error for heading inside a footnote block", () => {
    const [, errors] = compile(
      markitWithContent("{#n1}", "^1 Heading in footnote block"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Headings are only allowed in title or subtitle blocks.",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 29,
      severity: "error",
    });
  });
});
