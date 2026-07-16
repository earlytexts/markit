import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import {
  bq,
  h,
  hl,
  li,
  list,
  markitWithContent,
  p,
  pt,
  sd,
  table,
  tc,
  tr,
} from "./utils/factories.ts";

describe("paragraphs", () => {
  it("parses text into paragraphs by default", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "Example plain text content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Example plain text content.")]),
    ]);
  });

  it("parses multiple paragraphs separated by blank lines", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "First paragraph.", "", "Second paragraph."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("First paragraph.")]),
      p([pt("Second paragraph.")]),
    ]);
  });

  it("collapses whitespace and joins paragraph lines", () => {
    const { document, errors } = compile(
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
    const { document, errors } = compile(
      markitWithContent("{#1}", "text with trailing space "),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("text with trailing space")]),
    ]);
  });

  it("removes trailing space after inline element at end of content", () => {
    const { document, errors } = compile(markitWithContent("{#1}", "*bold* "));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "strong", content: [pt("bold")] }]),
    ]);
  });
});

describe("headings", () => {
  it("groups consecutive heading lines into a single heading group", () => {
    const { document, errors } = compile(
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
    const { document, errors } = compile(
      markitWithContent("{#title}", "^1 Title", "", "^2 Subtitle"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      h([hl(1, [pt("Title")])]),
      h([hl(2, [pt("Subtitle")])]),
    ]);
  });

  it("parses heading followed by paragraph without blank line", () => {
    const { document, errors } = compile(
      markitWithContent("{#title}", "^1 Title", "Some content below."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      h([hl(1, [pt("Title")])]),
      p([pt("Some content below.")]),
    ]);
  });

  it("returns error for heading level greater than 6", () => {
    const { errors } = compile(markitWithContent("{#1}", "^7 not a heading"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Heading level must be between 1 and 6.",
      source: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 2 },
      },
      severity: "error",
    });
  });

  it("returns error for heading without a level digit", () => {
    const { errors } = compile(markitWithContent("{#1}", "^ not a heading"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Heading must be given a level between 1 and 6.",
      source: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 1 },
      },
      severity: "error",
    });
  });

  it("returns error for heading inside a block quotation", () => {
    const { errors } = compile(
      markitWithContent("{#title}", "> ^1 Heading inside block quote"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Headings are not allowed inside block quotations.",
      source: {
        start: { line: 3, column: 2 },
        end: { line: 3, column: 31 },
      },
      severity: "error",
    });
  });

  it("returns error for heading inside a paragraph block", () => {
    const { errors } = compile(
      markitWithContent("{#1}", "^1 Heading in paragraph block"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Headings are only allowed in title or subtitle blocks.",
      source: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 29 },
      },
      severity: "error",
    });
  });

  it("returns error for heading inside a footnote block", () => {
    const { errors } = compile(
      markitWithContent("{#n1}", "^1 Heading in footnote block"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Headings are only allowed in title or subtitle blocks.",
      source: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 28 },
      },
      severity: "error",
    });
  });
});

describe("block quotations", () => {
  it("parses block quotations", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> A block quotation."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([p([pt("A block quotation.")])]),
    ]);
  });

  it("parses block quotation with text before and after", () => {
    const { document, errors } = compile(
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
    const { document, errors } = compile(
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
    const { document, errors } = compile(
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

  it("parses an unordered list inside a block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> Intro:", "> - one", "> - two", "> After."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([
        p([pt("Intro:")]),
        list("unordered", [li([pt("one")]), li([pt("two")])]),
        p([pt("After.")]),
      ]),
    ]);
  });

  it("parses an ordered list starting at a given number inside a block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> 3. three", "> 4. four"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([list("ordered", [li([pt("three")]), li([pt("four")])], 3)]),
    ]);
  });

  it("parses verse inside a block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> * line a", "> * line b"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([list("verse", [li([pt("line a")]), li([pt("line b")])])]),
    ]);
  });

  it("preserves nested-list indentation inside a block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> - a", ">   - b"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([
        list("unordered", [li([pt("a")], list("unordered", [li([pt("b")])]))]),
      ]),
    ]);
  });

  it("parses a table inside a block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> | A | B |", "> | 1 | 2 |"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([
        table(
          [
            tr([tc([pt("A")]), tc([pt("B")])]),
            tr([tc([pt("1")]), tc([pt("2")])]),
          ],
          false,
        ),
      ]),
    ]);
  });

  it("parses a nested block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> outer", ">> inner"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([p([pt("outer")]), bq([p([pt("inner")])])]),
    ]);
  });

  it("parses a stage direction inside a block quotation", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", "> He speaks:", "> : aside"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      bq([p([pt("He speaks:")]), sd([p([pt("aside")])])]),
    ]);
  });

  it("returns an error for an empty block quotation", () => {
    const { document, errors } = compile(markitWithContent("{#1}", ">"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Block quotation must not be empty.",
      source: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 1 },
      },
      severity: "error",
    });
    expect(document.blocks[0]!.content).toEqual([]);
  });

  it("reports a block quotation of only bare markers once", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", ">", ">"),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Block quotation must not be empty.");
    expect(document.blocks[0]!.content).toEqual([]);
  });
});

describe("stage directions", () => {
  it("parses a stage direction", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", ": Enter Hamlet, reading."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([p([pt("Enter Hamlet, reading.")])]),
    ]);
  });

  it("parses a stage direction with text before and after", () => {
    const { document, errors } = compile(
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
    const { document, errors } = compile(
      markitWithContent("{#1}", ": He enters slowly,", ": looking about him."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([p([pt("He enters slowly, looking about him.")])]),
    ]);
  });

  it("parses a stage direction with multiple paragraphs", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", ": First action.", ":", ": Second action."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([p([pt("First action.")]), p([pt("Second action.")])]),
    ]);
  });

  it("returns error for a heading inside a stage direction and emits nothing", () => {
    const { document, errors } = compile(
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

  it("parses a list inside a stage direction", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", ": He does:", ": - one", ": - two"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([
        p([pt("He does:")]),
        list("unordered", [li([pt("one")]), li([pt("two")])]),
      ]),
    ]);
  });

  it("parses verse inside a stage direction", () => {
    const { document, errors } = compile(
      markitWithContent("{#1}", ": * line a", ": * line b"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      sd([list("verse", [li([pt("line a")]), li([pt("line b")])])]),
    ]);
  });

  it("returns an error for an empty stage direction", () => {
    const { document, errors } = compile(markitWithContent("{#1}", ":"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Stage direction must not be empty.",
      source: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 1 },
      },
      severity: "error",
    });
    expect(document.blocks[0]!.content).toEqual([]);
  });
});
