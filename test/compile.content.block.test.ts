import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markitWithContent, p, h, hl, bq, sd, pt } from "./utils/factories.js";

describe("paragraphs", () => {
  it("parses text into paragraphs by default", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "Example plain text content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Example plain text content.")]),
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
});

describe("headings", () => {
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

  it("returns error for heading level greater than 6", () => {
    const [, errors] = compile(markitWithContent("{#1}", "^7 not a heading"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Heading level must be between 1 and 6.",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 3,
      severity: "error",
    });
  });

  it("returns error for heading without a level digit", () => {
    const [, errors] = compile(markitWithContent("{#1}", "^ not a heading"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Heading must be given a level between 1 and 6.",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 2,
      severity: "error",
    });
  });

  it("returns error for heading inside a block quotation", () => {
    const [, errors] = compile(
      markitWithContent("{#title}", "> ^1 Heading inside block quote"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
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
    expect(errors[0]).toMatchObject({
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
    expect(errors[0]).toMatchObject({
      message: "Headings are only allowed in title or subtitle blocks.",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 29,
      severity: "error",
    });
  });
});

describe("block quotations", () => {
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
});

describe("stage directions", () => {
  it("parses a stage direction", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", ": Enter Hamlet, reading."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([p([pt("Enter Hamlet, reading.")])]),
    ]);
  });

  it("parses a stage direction with text before and after", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "Text before.", ": He pauses.", "Text after."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Text before.")]),
      sd([p([pt("He pauses.")])]),
      p([pt("Text after.")]),
    ]);
  });

  it("collapses multi-line stage directions into one paragraph", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", ": He enters slowly,", ": looking about him."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([p([pt("He enters slowly, looking about him.")])]),
    ]);
  });

  it("parses a stage direction with multiple paragraphs", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", ": First action.", ":", ": Second action."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([p([pt("First action.")]), p([pt("Second action.")])]),
    ]);
  });

  it("returns error for a heading inside a stage direction and emits nothing", () => {
    const [document, errors] = compile(
      markitWithContent("{#title}", ": ^1 Heading inside stage direction"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Headings are not allowed inside stage directions.",
      severity: "error",
    });
    // The heading is removed and the stage direction has no paragraphs, so it
    // produces no block element.
    expect(document.blocks[0]!.content).toEqual([]);
  });
});
