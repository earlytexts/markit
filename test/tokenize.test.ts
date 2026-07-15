import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile, { compileWithPositions } from "../src/compile.ts";
import { extractText } from "../src/extract.ts";
import tokenize from "../src/tokenize.ts";
import type { Block, Token, Version } from "../src/types.ts";
import { markitWithContent } from "./utils/factories.ts";

/** Compile one block's content with positions and return the block. */
const blockOf = (...content: string[]): Block =>
  compileWithPositions(markitWithContent("{#1}", ...content)).document
    .blocks[0]!;

/** The tokens of one block's content, compiled with positions. */
const tokensOf = (...content: string[]): Token[] =>
  tokenize(blockOf(...content));

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

describe("tokenize — a non-breaking space fuses one word", () => {
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

describe("tokenize — page breaks split by whitespace", () => {
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

describe("tokenize — display furniture never fakes a token", () => {
  it("finds no token in illegible text or a footnote anchor", () => {
    const { document } = compile(
      markitWithContent(
        "{#1}",
        "before [...] after <n1>",
        "",
        "{#n1}",
        "Note.",
      ),
    );
    expect(tokenize(document.blocks[0]!).map((t) => t.text)).toEqual([
      "before",
      "after",
    ]);
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

describe("tokenize — versions", () => {
  it("defaults to the edited version", () => {
    expect(textsOf("colour[-s-] [+is+] [-are-] fine")).toEqual([
      "colour",
      "is",
      "fine",
    ]);
  });

  it("keeps deletions and drops insertions for original", () => {
    const block = blockOf("colour[-s-] [+is+] [-are-] fine");
    expect(tokenize(block, { version: "original" }).map((t) => t.text))
      .toEqual(["colours", "are", "fine"]);
  });
});

describe("tokenize — offsets index the extracted text", () => {
  it("start/end index extractText's output (U+00A0 aside)", () => {
    for (const version of ["edited", "original"] as Version[]) {
      const block = blockOf("a~priori be///ginning, [-was-][+is+] more");
      const { text } = extractText(block, { version });
      for (const token of tokenize(block, { version })) {
        expect(text.slice(token.start, token.end).replaceAll("\u00A0", " "))
          .toEqual(token.text);
      }
    }
  });
});

describe("tokenize — context and distilled word/lang", () => {
  it("carries the wrapper stack, outermost first", () => {
    const tokens = tokensOf('"so _far_ off"');
    expect(tokens[0]!.context).toEqual([{ type: "quote" }]);
    expect(tokens[1]!.context).toEqual([
      { type: "quote" },
      { type: "emphasis" },
    ]);
  });

  it("distils the nearest [w:] value and language code", () => {
    const tokens = tokensOf(
      "the [w:humane=human] $la:[w:a~priori=a priori]$ x",
    );
    expect(tokens[1]).toMatchObject({
      text: "humane",
      word: "human",
      context: [{ type: "word", word: "human" }],
    });
    expect(tokens[2]).toMatchObject({
      text: "a priori",
      word: "a priori",
      lang: "la",
      context: [
        { type: "language", lang: "la" },
        { type: "word", word: "a priori" },
      ],
    });
    expect(tokens[3]!.word).toBeUndefined();
    expect(tokens[3]!.lang).toBeUndefined();
  });

  it("leaves lang undefined for a generic $...$ run", () => {
    const tokens = tokensOf("$verbatim$");
    expect(tokens[0]!.context).toEqual([{ type: "language" }]);
    expect(tokens[0]!.lang).toBeUndefined();
  });

  it("never shows editorial wrappers in context", () => {
    expect(tokensOf("[+kept+]")[0]!.context).toEqual([]);
  });
});

describe("tokenize — source spans (from compileWithPositions)", () => {
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

describe("tokenize — a bare compile has no source", () => {
  it("omits source when the document was compiled without positions", () => {
    const { document } = compile(markitWithContent("{#1}", "a~priori more"));
    const bare = tokenize(document.blocks[0]!);
    expect(bare.every((token) => token.source === undefined)).toBe(true);
    // The text and offsets match the position-bearing tokens exactly.
    const withSource = tokensOf("a~priori more");
    expect(bare.map(({ text, start, end }) => ({ text, start, end }))).toEqual(
      withSource.map(({ text, start, end }) => ({ text, start, end })),
    );
  });
});
