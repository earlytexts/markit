import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent, p, pt } from "./utils/factories.js";

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

  it("returns error for unclosed character mode", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#2}", "This has an {unclosed brace.", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed character mode",
      line: 4,
      column: 13,
      endLine: 4,
      endColumn: 14,
      severity: "error",
    });
  });
});
