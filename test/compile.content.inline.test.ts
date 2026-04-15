import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent, p, h, pt, hl } from "./utils/factories.js";

describe("block content", () => {
  it("parses inline formatting (bold and italic)", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is a paragraph with *some* _inline markup_, and also _some *nested* formatting_.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is a paragraph with "),
        { type: "strong", content: [pt("some")] },
        pt(" "),
        { type: "emphasis", content: [pt("inline markup")] },
        pt(", and also "),
        {
          type: "emphasis",
          content: [
            pt("some "),
            { type: "strong", content: [pt("nested")] },
            pt(" formatting"),
          ],
        },
        pt("."),
      ]),
    ]);
  });

  it("parses formatting inside headings", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#title}",
        "^1 *Bold* and _italic_ text can be used in headings",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      h([
        hl(1, [
          { type: "strong", content: [pt("Bold")] },
          pt(" and "),
          { type: "emphasis", content: [pt("italic")] },
          pt(" text can be used in headings"),
        ]),
      ]),
    ]);
  });

  it("parses inline quotes", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", 'This is an inline quote: "like this".'),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is an inline quote: "),
        { type: "quote", content: [pt("like this")] },
        pt("."),
      ]),
    ]);
  });

  it("parses citations", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This is a citation: [cite me]."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is a citation: "),
        { type: "citation", content: [pt("cite me")] },
        pt("."),
      ]),
    ]);
  });

  it("parses editorial deletions ", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This text has some --deleted content--."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This text has some "),
        {
          type: "deletion",
          content: [pt("deleted content")],
        },
        pt("."),
      ]),
    ]);
  });

  it("parses editorial insertions", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This text has some ++inserted content++."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This text has some "),
        {
          type: "insertion",
          content: [pt("inserted content")],
        },
        pt("."),
      ]),
    ]);
  });

  it("parses uncertain text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This text has some ??uncertain content??."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This text has some "),
        {
          type: "uncertain",
          content: [pt("uncertain content")],
        },
        pt("."),
      ]),
    ]);
  });

  it("parses editorial highlights", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This text has some ==highlighted content==."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This text has some "),
        {
          type: "highlight",
          content: [pt("highlighted content")],
        },
        pt("."),
      ]),
    ]);
  });

  it("parses asides (margin comments)", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is an example of an aside. @in the margin@",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is an example of an aside. "),
        { type: "aside", content: [pt("in the margin")] },
      ]),
    ]);
  });

  it("parses line breaks", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is the first line. //",
        "This is the second line.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is the first line."),
        { type: "lineBreak" },
        pt("This is the second line."),
      ]),
    ]);
  });

  it("parses non-breaking spaces", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        'This is a quote with a non-breaking space: "~".',
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is a quote with a non-breaking space: "),
        { type: "quote", content: [{ type: "nbSpace" }] },
        pt("."),
      ]),
    ]);
  });

  it("parses illegible markers", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This is a quote with ??? illegible text."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is a quote with "),
        { type: "illegible" },
        pt(" illegible text."),
      ]),
    ]);
  });

  it("parses foreign text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This is foreign text: $like this$."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is foreign text: "),
        { type: "foreign", content: [pt("like this")] },
        pt("."),
      ]),
    ]);
  });

  it("parses Greek text with transliteration", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "Greek words: $$like this$$ and $$philosophia$$.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("Greek words: "),
        { type: "greek", content: [pt("λικε θις")] },
        pt(" and "),
        { type: "greek", content: [pt("φιλοσοφια")] },
        pt("."),
      ]),
    ]);
  });

  it("parses brace codes", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "Special characters: {ae} {oe} {AE} {OE} {SS} {-} {--}.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("Special characters: "),
        pt("æ"),
        pt(" "),
        pt("œ"),
        pt(" "),
        pt("Æ"),
        pt(" "),
        pt("Œ"),
        pt(" "),
        pt("§"),
        pt(" "),
        pt("–"),
        pt(" "),
        pt("—"),
        pt("."),
      ]),
    ]);
  });

  it("parses footnote references", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is a sentence with a footnote<n1>.",
        "",
        "{#n1}",
        "And here is the footnote.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("This is a sentence with a footnote"),
        { type: "footnoteReference", id: "n1" },
        pt("."),
      ]),
    ]);
  });

  it("parses escaped characters as literals", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "Escaped block id: \\{#1} and escaped asterisk: \\*not bold\\*.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Escaped block id: {#1} and escaped asterisk: *not bold*.")]),
    ]);
  });

  it("parses page breaks", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "before | after"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("before "), { type: "pageBreak" }, pt(" after")]),
    ]);
  });

  it("parses em spaces (double tildes)", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "before~~after"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("before"), { type: "emSpace" }, pt("after")]),
    ]);
  });

  it("parses escape character at start of content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "\\*not bold"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("*not bold")])]);
  });

  it("treats trailing backslash as literal", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "text\\"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("text\\")])]);
  });

  it("treats lone backslash as literal", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "\\"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("\\")])]);
  });

  it("transliterates Greek text with nested formatting", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$$*bold*$$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "greek",
          content: [{ type: "strong", content: [pt("βολδ")] }],
        },
      ]),
    ]);
  });

  it("transliterates Greek text with leaf elements", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$text//more$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "greek",
          content: [pt("τεξτ"), { type: "lineBreak" }, pt("μορε")],
        },
      ]),
    ]);
  });

  it("transliterates uppercase Greek letters", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$$Alpha$$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "greek", content: [pt("Αλφα")] }]),
    ]);
  });

  it("parses Greek digraph mixed-case variants", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$Thalassa Ph Ph CH PS$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "greek", content: [pt("Θαλασσα Φ Φ Χ Ψ")] }]),
    ]);
  });

  it("passes non-table characters through unchanged in Greek transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$42! abc$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "greek", content: [pt("42! αβc")] }]),
    ]);
  });

  it("applies final sigma when followed by punctuation", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$logos, bios.$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "greek", content: [pt("λογος, βιος.")] }]),
    ]);
  });

  it("treats angle bracket without closing as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "a < b"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("a < b")])]);
  });

  it("treats angle brackets with non-footnote content as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "a <b> c"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("a <b> c")])]);
  });

  it("preserves space between inline elements", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "*bold* text"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "strong", content: [pt("bold")] }, pt(" text")]),
    ]);
  });

  it("parses escaped pipe as literal pipe character", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "price: \\| tax"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("price: | tax")])]);
  });

  it("parses multiple references to the same footnote", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "First ref <n1> and second ref <n1>.",
        "",
        "{#n1}",
        "The footnote.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("First ref "),
        { type: "footnoteReference", id: "n1" },
        pt(" and second ref "),
        { type: "footnoteReference", id: "n1" },
        pt("."),
      ]),
    ]);
  });

  it("removes leading whitespace-only plainText inside wrapper content", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "* //text*"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "strong",
          content: [{ type: "lineBreak" }, pt("text")],
        },
      ]),
    ]);
  });

  it("removes trailing whitespace-only plainText inside wrapper content", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "*text// *"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "strong",
          content: [pt("text"), { type: "lineBreak" }],
        },
      ]),
    ]);
  });

  it("removes whitespace-only plainText before line break", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "*x* //more"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "strong", content: [pt("x")] },
        { type: "lineBreak" },
        pt("more"),
      ]),
    ]);
  });

  it("removes whitespace-only plainText after line break", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "text// *x*"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("text"),
        { type: "lineBreak" },
        { type: "strong", content: [pt("x")] },
      ]),
    ]);
  });
});

describe("block content errors", () => {
  it("returns error for unknown brace code", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1}", "This has an {unknown} brace code.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unknown brace code: unknown",
      line: 4,
      column: 14,
      endLine: 4,
      endColumn: 21,
      severity: "error",
    });
  });

  it("returns error for unclosed brace code", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#2}", "This has an {unclosed brace code.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unclosed brace code",
      line: 4,
      column: 13,
      endLine: 4,
      endColumn: 14,
      severity: "error",
    });
  });

  it("returns error for unclosed formatting", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#3}", "This has *unclosed bold.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unclosed formatting: *",
      line: 4,
      column: 10,
      endLine: 4,
      endColumn: 11,
      severity: "error",
    });
  });

  it("returns error for missing footnote reference", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#5}", "This has a ref to <n99>.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Footnote not found: n99",
      line: 4,
      column: 19,
      endLine: 4,
      endColumn: 24,
      severity: "error",
    });
  });

  it("returns error for overlapping inline formatting", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1}", "*bold _italic* wrong_", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unclosed formatting: *",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 2,
      severity: "error",
    });
  });
});
