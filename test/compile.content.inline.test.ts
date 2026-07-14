import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import { h, hl, markit, markitWithContent, p, pt } from "./utils/factories.ts";

describe("inline formatting", () => {
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

  it("preserves space between inline elements", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "*bold* text"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "strong", content: [pt("bold")] }, pt(" text")]),
    ]);
  });

  it("returns error for unclosed formatting", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#3}", "This has *unclosed bold.", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: *",
      line: 4,
      column: 10,
      endLine: 4,
      endColumn: 11,
      severity: "error",
    });
  });

  it("returns error for unclosed formatting ending in an escaped close marker", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#3}", "This has *escaped close\\*", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: *",
      line: 4,
      column: 10,
      endLine: 4,
      endColumn: 11,
      severity: "error",
    });
  });

  it("returns error for overlapping inline formatting", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1}", "*bold _italic* wrong_", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: *",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 2,
      severity: "error",
    });
  });
});

describe("inline quotes", () => {
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
});

describe("citations", () => {
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
});

describe("editorial marks", () => {
  it("parses editorial deletions ", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This text has some [-deleted content-]."),
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
      markitWithContent("{#1}", "This text has some [+inserted content+]."),
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
      markitWithContent("{#1}", "This text has some [?uncertain content?]."),
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

  it("parses illegible markers", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "This is a quote with [...] illegible text."),
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
});

describe("speakers", () => {
  it("parses speakers", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "@Speaker.@ This is a line of dialogue."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "speaker", content: [pt("Speaker.")] },
        pt(" This is a line of dialogue."),
      ]),
    ]);
  });
});

describe("asides", () => {
  it("parses asides (margin comments)", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is an example of an aside. #in the margin#",
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
});

describe("inline stage directions", () => {
  it("parses an inline stage direction", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "@Ham.@ To be ::aside:: or not to be."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "speaker", content: [pt("Ham.")] },
        pt(" To be "),
        { type: "stageDirection", content: [pt("aside")] },
        pt(" or not to be."),
      ]),
    ]);
  });

  it("leaves a single colon as literal text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "the ratio 3:4 is fixed"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("the ratio 3:4 is fixed")]),
    ]);
  });

  it("reports an unclosed inline stage direction", () => {
    const [, errors] = compile(markitWithContent("{#1}", "open ::unclosed"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: ::",
      severity: "error",
    });
  });
});

describe("whitespace and line breaks", () => {
  it("parses line breaks", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "This is the first line. \\",
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

  it("parses tabs (double tildes)", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "before~~after"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("before"), { type: "tab" }, pt("after")]),
    ]);
  });

  it("removes leading whitespace-only plainText inside wrapper content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "x *\\ text*"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("x "),
        {
          type: "strong",
          content: [{ type: "lineBreak" }, pt("text")],
        },
      ]),
    ]);
  });

  it("removes trailing whitespace-only plainText inside wrapper content", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "*text\\ *"));

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
    const [document, errors] = compile(
      markitWithContent("{#1}", "*x* \\ more"),
    );

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
    const [document, errors] = compile(markitWithContent("{#1}", "text\\ *x*"));

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

describe("foreign text", () => {
  it("parses generic foreign text", () => {
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

  it("parses foreign text with $la: syntax", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "$la:Rome$ $fr:Paris$ $grc:Athens$"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "language", lang: "la", content: [pt("Rome")] },
        { type: "plainText", content: " " },
        { type: "language", lang: "fr", content: [pt("Paris")] },
        { type: "plainText", content: " " },
        { type: "language", lang: "grc", content: [pt("Athens")] },
      ]),
    ]);
  });

  it("returns error for unclosed generic foreign wrapper", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "some $unclosed text", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: $",
      line: 4,
      column: 6,
      endLine: 4,
      endColumn: 7,
      severity: "error",
    });
  });

  it("returns error for unclosed foreign wrapper ending in an escaped close marker", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "some $escaped\\$", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: $",
      line: 4,
      column: 6,
      endLine: 4,
      endColumn: 7,
      severity: "error",
    });
  });

  it("returns error for unclosed language wrapper", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "some $grc:unclosed text", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: $grc:",
      line: 4,
      column: 6,
      endLine: 4,
      endColumn: 11,
      severity: "error",
    });
  });
});

describe("named entities", () => {
  it("parses person names", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "[p:John Locke] wrote the Essay."),
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
      markitWithContent("{#1}", "He lived in [l:London]."),
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

  it("returns error for unclosed person name wrapper", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "some [p:unclosed name", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: [p:",
      line: 4,
      column: 6,
      endLine: 4,
      endColumn: 9,
      severity: "error",
    });
  });

  it("returns error for unclosed place name wrapper", () => {
    const [, errors] = compile(
      markitWithContent("{#1}", "some [l:unclosed name", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed formatting: [l:",
      line: 4,
      column: 6,
      endLine: 4,
      endColumn: 9,
      severity: "error",
    });
  });
});

describe("page breaks", () => {
  it("parses bare page break ///", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "end of page /// start of next"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("end of page"), { type: "pageBreak" }, pt("start of next")]),
    ]);
  });

  it("parses page break with reference //12r//", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "end of page //12r// start of next"),
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

  it("treats // with no closing // as plain text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "text //unclosed"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("text //unclosed")])]);
  });

  it("treats //ref with spaces// as plain text", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "text //12 r// more"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("text //12 r// more")]),
    ]);
  });
});

describe("footnote references", () => {
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

  it("returns error for missing footnote reference", () => {
    const [, errors] = compile(
      markitWithContent("{#5}", "This has a ref to <n99>.", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Footnote not found: n99",
      line: 4,
      column: 19,
      endLine: 4,
      endColumn: 24,
      severity: "error",
    });
  });
});

describe("escape sequences", () => {
  it("parses escaped characters as literals", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#1}",
        "Escaped bracket: \\[cite] and escaped asterisk: \\*not bold\\*.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("Escaped bracket: [cite] and escaped asterisk: *not bold*.")]),
    ]);
  });

  it("parses escape character at start of content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "\\*not bold"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("*not bold")])]);
  });

  it("treats trailing backslash as line break", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "text\\"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([pt("text"), { type: "lineBreak" }]),
    ]);
  });

  it("treats lone backslash as line break", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "\\"));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([{ type: "lineBreak" }])]);
  });

  it("parses escaped pipe as literal pipe character", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "price: \\| tax"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([p([pt("price: | tax")])]);
  });
});

describe("word disambiguation", () => {
  it("parses a disambiguated word", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "The word [w:humane=human] is ambiguous."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        pt("The word "),
        { type: "word", word: "human", content: [pt("humane")] },
        pt(" is ambiguous."),
      ]),
    ]);
  });

  it("applies transliteration inside the surface form", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "[w:{oe}conomy=economy]"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        { type: "word", word: "economy", content: [pt("œ"), pt("conomy")] },
      ]),
    ]);
  });

  it("parses inline markup inside the surface form", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "[w:_humane_=human]"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "word",
          word: "human",
          content: [{ type: "emphasis", content: [pt("humane")] }],
        },
      ]),
    ]);
  });

  it("trims whitespace around the surface and the word", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "[w: humane = human ]"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "word", word: "human", content: [pt("humane")] }]),
    ]);
  });

  it("honours an escaped separator in the surface form", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "[w:a\\=b=equals]"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "word", word: "equals", content: [pt("a=b")] }]),
    ]);
  });

  it("honours an escaped closing bracket in the word", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "[w:x=y\\]z]"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([{ type: "word", word: "y]z", content: [pt("x")] }]),
    ]);
  });

  it("nests inside another inline element", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "_[w:humane=human]_"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.content).toEqual([
      p([
        {
          type: "emphasis",
          content: [{ type: "word", word: "human", content: [pt("humane")] }],
        },
      ]),
    ]);
  });

  it("reports an error and keeps the text literal when the separator is missing", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "a [w:humane] b"),
    );

    expect(errors[0]).toMatchObject({
      message: "Malformed word element; expected [w:surface=word].",
      line: 4,
      column: 3,
      severity: "error",
    });
    expect(document.blocks[0]!.content).toEqual([p([pt("a [w:humane] b")])]);
  });

  it("reports an error when the closing bracket is missing", () => {
    const [document, errors] = compile(
      markitWithContent("{#1}", "a [w:humane=human b"),
    );

    expect(errors[0]).toMatchObject({
      message: "Malformed word element; expected [w:surface=word].",
      line: 4,
      column: 3,
      severity: "error",
    });
    expect(document.blocks[0]!.content).toEqual([
      p([pt("a [w:humane=human b")]),
    ]);
  });
});
