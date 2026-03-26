import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("block content", () => {
  it("parses plain text", () => {
    const [document] = compile(
      markitWithContent("{#0}", "Example plain text content."),
    );

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "plainText",
        content: "Example plain text content.",
      },
    ]);
  });

  it("parses headings with multiple levels", () => {
    const [document] = compile(
      markitWithContent(
        "{#0}",
        "£1 Level 1 Heading £1",
        "£2 Level 2 Heading £2",
        "£3 Level 3 Heading £3",
        "£6 Level 6 Heading £6",
      ),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "This is a paragraph with *some* _inline markup_, and also _some *nested* formatting_.",
      ),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "£2 *Bold* and _italic_ text can be used in headings £2",
      ),
    );

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
    const [document] = compile(
      markitWithContent("{#1}", 'This is an inline quote: "like this".'),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        'This is a paragraph that contains: ""A block quotation."" And also some follow-on text.',
      ),
    );

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
    const [document] = compile(markitWithContent("{#1}", '"" ""'));

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "blockquote",
        content: [],
      },
    ]);
  });

  it("trims leading and trailing whitespace from blockquotes", () => {
    const [document] = compile(markitWithContent("{#1}", '"" text ""'));

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "blockquote",
        content: [{ type: "plainText", content: "text" }],
      },
    ]);
  });

  it("removes leading whitespace-only plainText before inline elements in blockquotes", () => {
    const [document] = compile(markitWithContent("{#1}", '""  _emphasized_""'));

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
    const [document] = compile(
      markitWithContent("{#1}", "This is a citation: [cite me]."),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "This is an example of editorial markup: --deleted text in double hyphens-- and ++inserted text in double plus signs++.",
      ),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "This is an example of an aside. @in the margin@",
      ),
    );

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is an example of an aside. " },
      {
        type: "aside",
        content: [{ type: "plainText", content: "in the margin" }],
      },
    ]);
  });

  it("parses line breaks", () => {
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "This is the first line. //",
        "This is the second line.",
      ),
    );

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "This is the first line." },
      { type: "lineBreak" },
      { type: "plainText", content: "This is the second line." },
    ]);
  });

  it("parses non-breaking spaces", () => {
    const [document] = compile(
      markitWithContent(
        "{#1}",
        'This is a quote with a non-breaking space: "~".',
      ),
    );

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
    const [document] = compile(
      markitWithContent("{#1}", "This is foreign text: $like this$."),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "Greek words: $$like this$$ and $$philosophia$$.",
      ),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "Special characters: {ae} {oe} {AE} {OE} {SS} {-} {--}.",
      ),
    );

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
    const [document] = compile(
      markitWithContent("{#1}", "This is a sentence with a footnote<n1>."),
    );

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
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "Escaped block id: \\{#1} and escaped asterisk: \\*not bold\\*.",
      ),
    );

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "plainText",
        content: "Escaped block id: {#1} and escaped asterisk: *not bold*.",
      },
    ]);
  });

  it("collapses whitespace and joins lines", () => {
    const [document] = compile(
      markitWithContent(
        "{#1}",
        "This content is split",
        "across multiple lines and should",
        "be joined   with    single   spaces.",
      ),
    );

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "plainText",
        content:
          "This content is split across multiple lines and should be joined with single spaces.",
      },
    ]);
  });

  it("parses page breaks", () => {
    const [document] = compile(markitWithContent("{#1}", "before | after"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "before " },
      { type: "pageBreak" },
      { type: "plainText", content: " after" },
    ]);
  });

  it("parses em spaces (double tildes)", () => {
    const [document] = compile(markitWithContent("{#1}", "before~~after"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "before" },
      { type: "emSpace" },
      { type: "plainText", content: "after" },
    ]);
  });

  it("parses escape character at start of content", () => {
    const [document] = compile(markitWithContent("{#1}", "\\*not bold"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "*not bold" },
    ]);
  });

  it("treats trailing backslash as literal", () => {
    const [document] = compile(markitWithContent("{#1}", "text\\"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "text\\" },
    ]);
  });

  it("treats lone backslash as literal", () => {
    const [document] = compile(markitWithContent("{#1}", "\\"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "\\" },
    ]);
  });

  it("parses unknown brace code at start of content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{unknown} text"),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toBe("Unknown brace code: unknown");
    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "{unknown} text" },
    ]);
  });

  it("reports error for heading nested inside block-level element", () => {
    const [, errors] = compile(markitWithContent("{#1}", '""£1 heading £1""'));

    expect(errors).toContainEqual(
      expect.objectContaining({
        message: "Block-level elements cannot be nested",
      }),
    );
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

  it("reports error for block-level wrapper at start of heading content", () => {
    const [, errors] = compile(markitWithContent("{#1}", '£1 ""nested"" £1'));

    const nestingErrors = errors.filter(
      (e) => e.message === "Block-level elements cannot be nested",
    );
    expect(nestingErrors.length).toBeGreaterThanOrEqual(1);
  });

  it("transliterates Greek text with nested formatting", () => {
    const [document] = compile(markitWithContent("{#1}", "$$*bold*$$"));

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
    const [document] = compile(markitWithContent("{#1}", "$$text//more$$"));

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
    const [document] = compile(markitWithContent("{#1}", "$$Alpha$$"));

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "greek",
        content: [{ type: "plainText", content: "Αλφα" }],
      },
    ]);
  });

  it("treats angle bracket without closing as plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "a < b"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "a < b" },
    ]);
  });

  it("treats angle brackets with non-footnote content as plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "a <b> c"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "a <b> c" },
    ]);
  });

  it("treats pound sign not followed by 1-6 as plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "costs £50"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "costs £50" },
    ]);
  });

  it("treats pound sign followed by non-level digit as plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "symbol £x here"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "symbol £x here" },
    ]);
  });

  it("removes trailing space at end of content block", () => {
    const [document] = compile(
      markitWithContent("{#1}", "text with trailing space "),
    );

    expect(document.blocks[0]!.content).toEqual([
      { type: "plainText", content: "text with trailing space" },
    ]);
  });

  it("preserves space between inline elements", () => {
    const [document] = compile(markitWithContent("{#1}", "*bold* text"));

    expect(document.blocks[0]!.content).toEqual([
      { type: "strong", content: [{ type: "plainText", content: "bold" }] },
      { type: "plainText", content: " text" },
    ]);
  });

  it("removes trailing space after inline element at end of content", () => {
    const [document] = compile(markitWithContent("{#1}", "*bold* "));

    expect(document.blocks[0]!.content).toEqual([
      { type: "strong", content: [{ type: "plainText", content: "bold" }] },
    ]);
  });

  it("removes space between block-level elements", () => {
    const [document] = compile(
      markitWithContent("{#1}", "£1 first £1 £2 second £2"),
    );

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
    const [document] = compile(markitWithContent("{#1}", "£1 heading £1 "));

    expect(document.blocks[0]!.content).toEqual([
      {
        type: "heading",
        level: 1,
        content: [{ type: "plainText", content: "heading" }],
      },
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
      endColumn: 19,
    });

    // The closing "" also generates an error
    expect(errors[1]).toEqual({
      message: "Block-level elements cannot be nested",
      line: 4,
      column: 29,
      endLine: 4,
      endColumn: 31,
    });
  });
});
