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

  it("parses speakers", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "%Speaker.% This is a line of dialogue."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "speaker", content: [pt("Speaker.")] },
        pt(" This is a line of dialogue."),
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
        { type: "language", content: [pt("like this")] },
        pt("."),
      ]),
    ]);
  });

  it("parses Greek language wrapper as purely semantic (no transliteration)", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "Greek words: $grc:like this$ and $grc:philosophia$.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("Greek words: "),
        { type: "language", lang: "grc", content: [pt("like this")] },
        pt(" and "),
        { type: "language", lang: "grc", content: [pt("philosophia")] },
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
        { type: "footnoteReference", id: "Text.n1" },
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

  it("passes nested formatting through Greek language wrapper without transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:*bold*$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "language",
          lang: "grc",
          content: [{ type: "strong", content: [pt("bold")] }],
        },
      ]),
    ]);
  });

  it("passes leaf elements through Greek language wrapper without transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:text//more$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "language",
          lang: "grc",
          content: [pt("text"), { type: "lineBreak" }, pt("more")],
        },
      ]),
    ]);
  });

  it("passes uppercase letters through Greek language wrapper without transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:Alpha$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "grc", content: [pt("Alpha")] }]),
    ]);
  });

  it("passes digraphs through Greek language wrapper without transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:Thalassa Ph CH PS$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "language",
          lang: "grc",
          content: [pt("Thalassa Ph CH PS")],
        },
      ]),
    ]);
  });

  it("passes non-Latin characters through Greek language wrapper as-is", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:42! abc$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "grc", content: [pt("42! abc")] }]),
    ]);
  });

  it("passes punctuated text through Greek language wrapper without transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:logos, bios.$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "grc", content: [pt("logos, bios.")] }]),
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
        { type: "footnoteReference", id: "Text.n1" },
        pt(" and second ref "),
        { type: "footnoteReference", id: "Text.n1" },
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

describe("language wrappers", () => {
  it("parses Latin text with $la: syntax", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$la:Roma$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "la", content: [pt("Roma")] }]),
    ]);
  });

  it("parses French text with $fr: syntax", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$fr:Paris$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "fr", content: [pt("Paris")] }]),
    ]);
  });

  it("parses arbitrary language code", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$he:shalom$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "he", content: [pt("shalom")] }]),
    ]);
  });

  it("passes diacritic markers through as plain text (no processing)", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$la:e/$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "la", content: [pt("e/")] }]),
    ]);
  });

  it("passes Latin characters through Greek wrapper without transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$grc:philosophia$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "grc", content: [pt("philosophia")] }]),
    ]);
  });

  it("supports backslash escaping inside language wrappers", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$la:\\*$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "la", content: [pt("*")] }]),
    ]);
  });

  it("parses page breaks inside language wrappers", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$la:foo||bar$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "language",
          lang: "la",
          content: [pt("foo"), { type: "pageBreak" }, pt("bar")],
        },
      ]),
    ]);
  });

  it("treats lone | inside language wrapper as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "$grc:a|$"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "language", lang: "grc", content: [pt("a|")] }]),
    ]);
  });
});

describe("block content errors", () => {
  it("returns error for unclosed character mode", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#2}", "This has an {unclosed brace.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unclosed character mode",
      line: 4,
      column: 13,
      endLine: 4,
      endColumn: 14,
      severity: "error",
    });
  });

  it("returns error for unclosed Greek mode", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#2}", "This has {{unclosed Greek.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Unclosed Greek mode",
      line: 4,
      column: 10,
      endLine: 4,
      endColumn: 12,
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

  it("returns error for unclosed language wrapper", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1}", "some $grc:unclosed text", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: $grc:",
      severity: "error",
    });
  });

  it("returns error for unclosed generic foreign wrapper", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1}", "some $unclosed text", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: $",
      severity: "error",
    });
  });
});

describe("character mode", () => {
  it("applies acute accent", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{e/}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("é")])]);
  });

  it("applies grave accent", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{a`}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("à")])]);
  });

  it("applies circumflex", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{a^}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("â")])]);
  });

  it("applies diaeresis", () => {
    const [document, errors] = compile(markitWithContent("{#1}", '{a"}'));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ä")])]);
  });

  it("produces ae ligature", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{ae}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("æ")])]);
  });

  it("produces AE ligature", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{AE}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("Æ")])]);
  });

  it("produces oe ligature", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{oe}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("œ")])]);
  });

  it("produces OE ligature", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{OE}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("Œ")])]);
  });

  it("produces cedilla from c, digraph", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{c,}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ç")])]);
  });

  it("produces capital cedilla from C, digraph", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{C,}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("Ç")])]);
  });

  it("produces section symbol from $", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{$}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("§")])]);
  });

  it("produces en dash from -", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{-}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("–")])]);
  });

  it("produces em dash from --", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{--}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("—")])]);
  });

  it("processes multiple characters in one mode span", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{a/e/i/o/u/}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("áéíóú")])]);
  });

  it("processes digraph within a multi-character span", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{aesthetics}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("æsthetics")])]);
  });

  it("passes literal comma through when not after c or C", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{foo, bar}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("foo, bar")])]);
  });

  it("escapes diacritic markers with backslash", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{e\\/}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("e/")])]);
  });

  it("treats trailing backslash inside character mode as literal", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{\\}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("\\")])]);
  });

  it("returns error and treats { as literal for unclosed character mode", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "text {unclosed"),
    );
    expect(errors).toHaveLength(1);
    expect(document.blocks[0]!.content).toEqual([p([pt("text {unclosed")])]);
  });
});

describe("Greek mode", () => {
  it("transliterates basic Latin characters to Greek", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{logos}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("λογος")])]);
  });

  it("transliterates uppercase Latin characters to Greek", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{Alpha}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("Αλφα")])]);
  });

  it("transliterates Greek digraphs", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{{philosophia}}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("φιλοσοφια")])]);
  });

  it("transliterates mixed-case digraphs", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{{Thalassa Ph CH PS}}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("Θαλασσα Φ Χ Ψ")])]);
  });

  it("passes non-table characters through unchanged", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{42!}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("42!")])]);
  });

  it("applies acute accent", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a/}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ά")])]);
  });

  it("applies grave accent", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a`}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ὰ")])]);
  });

  it("applies circumflex (Greek perispomeni)", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a^}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ᾶ")])]);
  });

  it("applies diaeresis", () => {
    const [document, errors] = compile(markitWithContent("{#1}", '{{i"}}'));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ϊ")])]);
  });

  it("applies smooth breathing", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a)}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ἀ")])]);
  });

  it("applies rough breathing", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a(}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ἁ")])]);
  });

  it("applies iota subscript", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a|}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ᾳ")])]);
  });

  it("applies smooth breathing and acute together", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a)/}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ἄ")])]);
  });

  it("applies rough breathing and acute together", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a(/}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ἅ")])]);
  });

  it("applies diacritics after single-char transliteration", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{{a)nthrwpos}}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("ἀνθρωπος")])]);
  });

  it("applies diacritics after digraph transliteration", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{th/os}}"));
    expect(errors).toHaveLength(0);
    // th → θ, / → acute on θ (no precomposed form, stays decomposed after NFC)
    expect(document.blocks[0]!.content).toEqual([
      p([pt("\u03B8\u0301\u03BF\u03C2")]),
    ]);
  });

  it("applies diacritics to uppercase letters", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{A)/}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("Ἄ")])]);
  });

  it("applies final sigma at end of word", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{{logos bios}}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("λογος βιος")])]);
  });

  it("applies final sigma before punctuation", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "{{logos, bios.}}"),
    );
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("λογος, βιος.")])]);
  });

  it("does not apply final sigma before a diacritic marker", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{logos/}}"));
    expect(errors).toHaveLength(0);
    // s before / (diacritic marker) → σ with acute, not ς
    expect(document.blocks[0]!.content).toEqual([p([pt("λογο\u03C3\u0301")])]);
  });

  it("does not apply final sigma before a regular letter", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{logosa}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("λογοσα")])]);
  });

  it("escapes diacritic markers with backslash", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{a\\/}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("α/")])]);
  });

  it("treats trailing backslash inside Greek mode as literal", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "{{\\}}"));
    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("\\")])]);
  });

  it("returns error and treats {{ as literal for unclosed Greek mode", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "text {{unclosed"),
    );
    expect(errors).toHaveLength(1);
    expect(document.blocks[0]!.content).toEqual([p([pt("text {{unclosed")])]);
  });
});

describe("named entities", () => {
  it("parses person names", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "!person[John Locke] wrote the Essay."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "person", content: [pt("John Locke")] },
        pt(" wrote the Essay."),
      ]),
    ]);
  });

  it("parses place names", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "He lived in !place[London]."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("He lived in "),
        { type: "place", content: [pt("London")] },
        pt("."),
      ]),
    ]);
  });

  it("parses person and place names in the same paragraph", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "!person[Newton] was born in !place[Woolsthorpe].",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "person", content: [pt("Newton")] },
        pt(" was born in "),
        { type: "place", content: [pt("Woolsthorpe")] },
        pt("."),
      ]),
    ]);
  });
});

describe("page breaks", () => {
  it("parses bare page break ||", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "end of page || start of next"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("end of page"), { type: "pageBreak" }, pt("start of next")]),
    ]);
  });

  it("parses page break with reference |12r|", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "end of page |12r| start of next"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("end of page"),
        { type: "pageBreak", ref: "12r" },
        pt("start of next"),
      ]),
    ]);
  });

  it("treats lone | as plain text", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "a | b"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("a | b")])]);
  });

  it("treats | with spaced content as plain text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "price: |a b| tax"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("price: |a b| tax")])]);
  });
});
