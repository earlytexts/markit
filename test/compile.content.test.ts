import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("block content", () => {
  it("parses plain text", () => {
    const [document, errors] = compile(
      markitWithContent("{#0}", "Example plain text content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "plainText",
        content: "Example plain text content.",
      },
    ]);
  });

  it("parses headings with multiple levels", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#0}",
        "£1 Level 1 Heading £1",
        "£2 Level 2 Heading £2",
        "£3 Level 3 Heading £3",
        "£6 Level 6 Heading £6",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "heading",
        level: 1,
        content: [{ type: "plainText", content: "Level 1 Heading" }],
      },
      {
        type: "heading",
        level: 2,
        content: [{ type: "plainText", content: "Level 2 Heading" }],
      },
      {
        type: "heading",
        level: 3,
        content: [{ type: "plainText", content: "Level 3 Heading" }],
      },
      {
        type: "heading",
        level: 6,
        content: [{ type: "plainText", content: "Level 6 Heading" }],
      },
    ]);
  });

  it("parses inline formatting (bold and italic)", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is a paragraph with *some* _inline markup_, and also _some *nested* formatting_.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is a paragraph with " },
      { type: "strong", content: [{ type: "plainText", content: "some" }] },
      { type: "plainText", content: " " },
      {
        type: "emphasis",
        content: [{ type: "plainText", content: "inline markup" }],
      },
      { type: "plainText", content: ", and also " },
      {
        type: "emphasis",
        content: [
          { type: "plainText", content: "some " },
          {
            type: "strong",
            content: [{ type: "plainText", content: "nested" }],
          },
          { type: "plainText", content: " formatting" },
        ],
      },
      {
        type: "plainText",
        content: ".",
      },
    ]);
  });

  it("parses headings with formatting inside", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "£2 *Bold* and _italic_ text can be used in headings £2",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "heading",
        level: 2,
        content: [
          {
            type: "strong",
            content: [{ type: "plainText", content: "Bold" }],
          },
          { type: "plainText", content: " and " },
          {
            type: "emphasis",
            content: [{ type: "plainText", content: "italic" }],
          },
          {
            type: "plainText",
            content: " text can be used in headings",
          },
        ],
      },
    ]);
  });

  it("parses inline quotes", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", 'This is an inline quote: "like this".'),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is an inline quote: " },
      {
        type: "quote",
        content: [{ type: "plainText", content: "like this" }],
      },
      { type: "plainText", content: "." },
    ]);
  });

  it("parses block quotes", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        'This is a paragraph that contains: ""A block quotation."" And also some follow-on text.',
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is a paragraph that contains:" },
      {
        type: "blockquote",
        content: [{ type: "plainText", content: "A block quotation." }],
      },
      { type: "plainText", content: "And also some follow-on text." },
    ]);
  });

  it("trims whitespace-only content from blockquotes", () => {
    const [document, errors] = compile(markitWithContent("{#1}", '"" ""'));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "blockquote",
        content: [],
      },
    ]);
  });

  it("trims leading and trailing whitespace from blockquotes", () => {
    const [document, errors] = compile(markitWithContent("{#1}", '"" text ""'));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "blockquote",
        content: [{ type: "plainText", content: "text" }],
      },
    ]);
  });

  it("removes leading whitespace-only plainText before inline elements in blockquotes", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", '""  _emphasized_""'),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "blockquote",
        content: [
          {
            type: "emphasis",
            content: [{ type: "plainText", content: "emphasized" }],
          },
        ],
      },
    ]);
  });

  it("parses citations", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This is a citation: [cite me]."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is a citation: " },
      {
        type: "citation",
        content: [{ type: "plainText", content: "cite me" }],
      },
      { type: "plainText", content: "." },
    ]);
  });

  it("parses editorial deletions and insertions", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is an example of editorial markup: --deleted text in double hyphens-- and ++inserted text in double plus signs++.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "plainText",
        content: "This is an example of editorial markup: ",
      },
      {
        type: "deletion",
        content: [
          { type: "plainText", content: "deleted text in double hyphens" },
        ],
      },
      { type: "plainText", content: " and " },
      {
        type: "insertion",
        content: [
          {
            type: "plainText",
            content: "inserted text in double plus signs",
          },
        ],
      },
      { type: "plainText", content: "." },
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
      { type: "plainText", content: "This is an example of an aside. " },
      {
        type: "aside",
        content: [{ type: "plainText", content: "in the margin" }],
      },
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
      { type: "plainText", content: "This is the first line." },
      { type: "lineBreak" },
      { type: "plainText", content: "This is the second line." },
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
      {
        type: "plainText",
        content: "This is a quote with a non-breaking space: ",
      },
      {
        type: "quote",
        content: [{ type: "nbSpace" }],
      },
      { type: "plainText", content: "." },
    ]);
  });

  it("parses foreign text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This is foreign text: $like this$."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is foreign text: " },
      {
        type: "foreign",
        content: [{ type: "plainText", content: "like this" }],
      },
      { type: "plainText", content: "." },
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
      { type: "plainText", content: "Greek words: " },
      {
        type: "greek",
        content: [{ type: "plainText", content: "λικε θις" }],
      },
      { type: "plainText", content: " and " },
      {
        type: "greek",
        content: [{ type: "plainText", content: "φιλοσοφια" }],
      },
      { type: "plainText", content: "." },
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
      { type: "plainText", content: "Special characters: " },
      { type: "plainText", content: "æ" },
      { type: "plainText", content: " " },
      { type: "plainText", content: "œ" },
      { type: "plainText", content: " " },
      { type: "plainText", content: "Æ" },
      { type: "plainText", content: " " },
      { type: "plainText", content: "Œ" },
      { type: "plainText", content: " " },
      { type: "plainText", content: "§" },
      { type: "plainText", content: " " },
      { type: "plainText", content: "–" },
      { type: "plainText", content: " " },
      { type: "plainText", content: "—" },
      { type: "plainText", content: "." },
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
      { type: "plainText", content: "This is a sentence with a footnote" },
      {
        type: "footnoteReference",
        id: "n1",
      },
      { type: "plainText", content: "." },
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
      {
        type: "plainText",
        content: "Escaped block id: {#1} and escaped asterisk: *not bold*.",
      },
    ]);
  });

  it("collapses whitespace and joins lines", () => {
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
      {
        type: "plainText",
        content:
          "This content is split across multiple lines and should be joined with single spaces.",
      },
    ]);
  });

  it("parses page breaks", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "before | after"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "before " },
      { type: "pageBreak" },
      { type: "plainText", content: " after" },
    ]);
  });

  it("parses em spaces (double tildes)", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "before~~after"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "before" },
      { type: "emSpace" },
      { type: "plainText", content: "after" },
    ]);
  });

  it("parses escape character at start of content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "\\*not bold"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "*not bold" },
    ]);
  });

  it("treats trailing backslash as literal", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "text\\"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "text\\" },
    ]);
  });

  it("treats lone backslash as literal", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "\\"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "\\" },
    ]);
  });

  it("transliterates Greek text with nested formatting", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$$*bold*$$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [
          {
            type: "strong",
            content: [{ type: "plainText", content: "βολδ" }],
          },
        ],
      },
    ]);
  });

  it("transliterates Greek text with leaf elements", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$text//more$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [
          { type: "plainText", content: "τεξτ" },
          { type: "lineBreak" },
          { type: "plainText", content: "μορε" },
        ],
      },
    ]);
  });

  it("transliterates uppercase Greek letters", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$$Alpha$$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [{ type: "plainText", content: "Αλφα" }],
      },
    ]);
  });

  it("treats angle bracket without closing as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "a < b"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "a < b" },
    ]);
  });

  it("treats angle brackets with non-footnote content as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "a <b> c"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "a <b> c" },
    ]);
  });

  it("treats pound sign not followed by 1-6 as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "costs £50"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "costs £50" },
    ]);
  });

  it("treats pound sign followed by non-level digit as plain text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "symbol £x here"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "symbol £x here" },
    ]);
  });

  it("removes trailing space at end of content block", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "text with trailing space "),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "text with trailing space" },
    ]);
  });

  it("preserves space between inline elements", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "*bold* text"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "strong", content: [{ type: "plainText", content: "bold" }] },
      { type: "plainText", content: " text" },
    ]);
  });

  it("removes trailing space after inline element at end of content", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "*bold* "));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "strong", content: [{ type: "plainText", content: "bold" }] },
    ]);
  });

  it("removes space between block-level elements", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "£1 first £1 £2 second £2"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "heading",
        level: 1,
        content: [{ type: "plainText", content: "first" }],
      },
      {
        type: "heading",
        level: 2,
        content: [{ type: "plainText", content: "second" }],
      },
    ]);
  });

  it("removes trailing space after block-level element at end of content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "£1 heading £1 "),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "heading",
        level: 1,
        content: [{ type: "plainText", content: "heading" }],
      },
    ]);
  });

  it("parses heading content spanning multiple lines within the same block", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "£1 Title", "continued £1"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "heading",
        level: 1,
        content: [{ type: "plainText", content: "Title continued" }],
      },
    ]);
  });

  it("parses escaped pipe as literal pipe character", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "price: \\| tax"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "price: | tax" },
    ]);
  });

  it("parses Greek digraph mixed-case variants", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$Thalassa Ph Ph CH PS$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [{ type: "plainText", content: "Θαλασσα Φ Φ Χ Ψ" }],
      },
    ]);
  });

  it("passes non-table characters through unchanged in Greek transliteration", () => {
    // `c` is not in the single-char table (only `ch` as a digraph), so it passes through
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$42! abc$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [{ type: "plainText", content: "42! αβc" }],
      },
    ]);
  });

  it("applies final sigma when followed by punctuation", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$$logos, bios.$$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [{ type: "plainText", content: "λογος, βιος." }],
      },
    ]);
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
      { type: "plainText", content: "First ref " },
      { type: "footnoteReference", id: "n1" },
      { type: "plainText", content: " and second ref " },
      { type: "footnoteReference", id: "n1" },
      { type: "plainText", content: "." },
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

  it("returns error for unclosed heading", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#4}", "This has a £1 heading without end.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unclosed heading level 1",
      line: 4,
      column: 12,
      endLine: 4,
      endColumn: 15,
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

  it("returns error for nested block-level elements", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#6}",
        '£1 Heading with ""blockquote"" inside £1',
        "",
      ),
    );

    expect(errors[0]).toEqual({
      message: "Block-level elements cannot be nested",
      line: 4,
      column: 17,
      endLine: 4,
      endColumn: 31,
      severity: "error",
    });
  });

  it("returns error for unclosed nested block-level elements", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#6}",
        '£1 Heading with ""unclosed blockquote inside £1',
        "",
      ),
    );

    expect(errors[0]).toEqual({
      message: "Block-level elements cannot be nested",
      line: 4,
      column: 17,
      endLine: 4,
      endColumn: 19,
      severity: "error",
    });
  });

  it("reports error for heading nested inside block-level element after text", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", '""text £1 heading £1""'),
    );

    expect(errors).toContainEqual(
      expect.objectContaining({
        message: "Block-level elements cannot be nested",
      }),
    );
  });
});
