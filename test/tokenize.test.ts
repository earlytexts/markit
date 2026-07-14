import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import renderText from "../src/renderText.ts";
import tokenize from "../src/tokenize.ts";
import type { Token } from "../src/types.ts";
import { markitWithContent } from "./utils/factories.ts";

/** Compile one content line with provenance and return its tokens. */
const tokensOf = (...content: string[]): Token[] => {
  const [, , tokens] = compile(
    markitWithContent("{#1}", ...content),
    { tokens: true },
  );
  return tokens;
};

const textsOf = (...content: string[]): string[] =>
  tokensOf(...content).map((token) => token.text);

describe("tokenize — segmentation (mirrors the corpus)", () => {
  it("keeps apostrophes, splits hyphens, takes digit runs", () => {
    expect(
      textsOf("'Tis a fine-day at o'clock, lookin' on 1739 &c MDCCXL x=y"),
    ).toEqual([
      "'Tis",
      "a",
      "fine",
      "day",
      "at",
      "o'clock",
      "lookin'",
      "on",
      "1739",
      "c",
      "MDCCXL",
      "x",
      "y",
    ]);
  });

  it("joins on an internal period before a letter, not before a space or digit", () => {
    expect(
      textsOf("i.e. and e.g things, N.B end.The end. The Ph.D 3.14"),
    ).toEqual([
      "i.e",
      "and",
      "e.g",
      "things",
      "N.B",
      "end.The",
      "end",
      "The",
      "Ph.D",
      "3",
      "14",
    ]);
  });

  it("finds no token in a run of punctuation", () => {
    expect(textsOf("'' — !")).toEqual([]);
  });
});

describe("tokenize — divergence 1: a non-breaking space fuses one word", () => {
  it("makes `a~priori` and `ad~infinitum` single tokens", () => {
    expect(textsOf("reasoning a~priori and ad~infinitum")).toEqual([
      "reasoning",
      "a priori",
      "and",
      "ad infinitum",
    ]);
  });

  it("does not fuse across a non-breaking space when punctuation intervenes", () => {
    expect(textsOf("word1,~word2")).toEqual(["word1", "word2"]);
  });

  it("treats a tab (`~~`) as a boundary", () => {
    expect(textsOf("a~~b")).toEqual(["a", "b"]);
  });
});

describe("tokenize — divergence 2: page breaks split by whitespace", () => {
  it("keeps a word split by a tight page break whole", () => {
    expect(textsOf("be///ginning")).toEqual(["beginning"]);
    // A tight *referenced* page break (`//ref//`) joins its two sides too.
    expect(textsOf("be//12//ginning")).toEqual(["beginning"]);
  });

  it("splits on a loose page break (space before or after)", () => {
    expect(textsOf("before /// after")).toEqual(["before", "after"]);
    expect(textsOf("before/// after")).toEqual(["before", "after"]);
    expect(textsOf("before ///after")).toEqual(["before", "after"]);
  });

  it("treats a page break at a paragraph edge as loose", () => {
    expect(textsOf("///opening")).toEqual(["opening"]);
    expect(textsOf("closing///")).toEqual(["closing"]);
  });
});

describe("tokenize — descent", () => {
  it("descends into quotations, lists, and tables", () => {
    expect(textsOf("> one two", "> - three four")).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
    expect(textsOf("| a | b |", "| c | d |")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("tokenize — rendered offsets", () => {
  it("start/end index the rendered text (U+00A0 aside)", () => {
    const doc = compile(
      markitWithContent("{#1}", "a~priori be///ginning, and more"),
    )[0];
    const text = renderText(doc);
    for (const token of tokenize(doc)) {
      expect(text.slice(token.start, token.end).replaceAll("\u00A0", " "))
        .toEqual(token.text);
    }
  });
});

describe("tokenize — source spans (from compile)", () => {
  it("spans the whole source of a `~`-fused word, including the `~`", () => {
    // "a~priori" occupies columns 0..8 on the content line.
    expect(tokensOf("a~priori")[0]?.source).toEqual({
      start: { line: 3, column: 0 },
      end: { line: 3, column: 8 },
    });
  });

  it("spans the whole source of a tight page break, including the `///`", () => {
    // "be///ginning" occupies columns 0..12.
    expect(tokensOf("be///ginning")[0]?.source).toEqual({
      start: { line: 3, column: 0 },
      end: { line: 3, column: 12 },
    });
  });

  it("spans transformed runs — character mode and Greek mode", () => {
    // "wi{s}dom": one token over columns 0..8.
    expect(tokensOf("wi{s}dom")[0]?.source).toEqual({
      start: { line: 3, column: 0 },
      end: { line: 3, column: 8 },
    });
    // "{{logos}}": the transliterated letters, over the content columns 2..7.
    expect(tokensOf("{{logos}}")[0]?.source).toEqual({
      start: { line: 3, column: 2 },
      end: { line: 3, column: 7 },
    });
  });

  it("carries source through an escape", () => {
    const tokens = tokensOf("a\\*b");
    expect(tokens.map((t) => t.text)).toEqual(["a", "b"]);
    expect(tokens[1]?.source).toEqual({
      start: { line: 3, column: 3 },
      end: { line: 3, column: 4 },
    });
  });
});

describe("tokenize — a bare document has no source", () => {
  it("omits source when the document was compiled without tokens", () => {
    const [document] = compile(markitWithContent("{#1}", "a~priori more"));
    const bare = tokenize(document);
    expect(bare.every((token) => token.source === undefined)).toBe(true);
    // The text and offsets match the source-bearing tokens exactly.
    const withSource = tokensOf("a~priori more");
    expect(bare.map(({ text, start, end }) => ({ text, start, end }))).toEqual(
      withSource.map(({ text, start, end }) => ({ text, start, end })),
    );
  });
});
