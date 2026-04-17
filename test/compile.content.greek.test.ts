import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent, p, pt } from "./utils/factories.js";

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

  it("returns error for unclosed Greek mode", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#2}", "This has {{unclosed Greek.", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Unclosed Greek mode",
      line: 4,
      column: 10,
      endLine: 4,
      endColumn: 12,
      severity: "error",
    });
  });
});
