import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import formatDocument from "../src/format.ts";
import { markit, markitWithContent } from "./utils/factories.ts";

/** Format one content line and return the formatted content line. */
const formatLine = (line: string): string => {
  const formatted = formatDocument(markitWithContent("{#1}", line));
  return formatted.split("\n")[3]!;
};

describe("format — character/Greek mode canonicalisation", () => {
  it("rewrites ligatures, cedillas, and diacritics to their Unicode", () => {
    expect(formatLine("{oe}conomy and {ae}sthetics, gar{c,}on, caf{e/}"))
      .toBe("œconomy and æsthetics, garçon, café");
    expect(formatLine("wi{s}dom")).toBe("wisdom");
  });

  it("rewrites the dash and section symbols", () => {
    expect(formatLine("pp. 3{-}4 {--} see {$} 12")).toBe(
      "pp. 3–4 — see § 12",
    );
  });

  it("rewrites Greek mode to Greek script", () => {
    expect(formatLine("the {{logos}} itself")).toBe("the λογος itself");
    // A multi-word passage: internal single spaces are fine.
    expect(formatLine("so {{en arch hn o logos}} begins")).toBe(
      "so εν αρχ ην ο λογος begins",
    );
  });

  it("leaves escaped braces alone", () => {
    expect(formatLine("a \\{literal\\} brace")).toBe("a \\{literal\\} brace");
  });

  it("leaves unclosed braces for the compiler to report", () => {
    expect(formatLine("an {unclosed brace")).toBe("an {unclosed brace");
    expect(formatLine("an {{unclosed greek")).toBe("an {{unclosed greek");
  });

  it("still canonicalises later spans after an unclosed opener", () => {
    expect(formatLine("{{oops then {e/}")).toBe("{{oops then é");
  });

  it("leaves a span alone when its output could re-parse as syntax", () => {
    // An escape smuggling a Markit special character out of the braces.
    expect(formatLine("keep {\\$} braced")).toBe("keep {\\$} braced");
    expect(formatLine("keep {\\*} braced")).toBe("keep {\\*} braced");
    // The same rule applies to Greek mode (`=` passes through untranslated).
    expect(formatLine("keep {{a=b}} braced")).toBe("keep {{a=b}} braced");
  });

  it("leaves a span alone when its output is empty or edge whitespace", () => {
    expect(formatLine("an {} empty")).toBe("an {} empty");
    expect(formatLine("a { a} space")).toBe("a { a} space");
  });

  it("rejects ASCII non-letters at line start, allows letters and non-ASCII", () => {
    // "s" would be fine, but a digit could reclassify the line (`1.` opens an
    // ordered list) — and all block-level triggers are ASCII, so `—`/`§` pass.
    expect(formatLine("{\\1}. not a list")).toBe("{\\1}. not a list");
    expect(formatLine("{e/}tude")).toBe("étude");
    expect(formatLine("{--} dash first")).toBe("— dash first");
    expect(formatLine("{$} 12 first")).toBe("§ 12 first");
  });

  it("does not touch metadata, IDs, or block tags", () => {
    const input = markit(
      "# Text",
      "",
      "[metadata]",
      'note = "{oe} stays"',
      "",
      "{#1}",
      "{oe}conomy",
      "",
    );
    const formatted = formatDocument(input);
    expect(formatted).toContain('note = "{oe} stays"');
    expect(formatted).toContain("œconomy");
  });

  it("is idempotent", () => {
    const once = formatDocument(
      markitWithContent("{#1}", "{oe}conomy {{logos}} {\\$} x"),
    );
    expect(formatDocument(once)).toBe(once);
  });
});

describe("format — canonicalisation preserves the compiled document", () => {
  const sources = [
    markitWithContent("{#1}", "the {oe}conomy of {{logos}} p. 3{-}4 {--}"),
    markitWithContent("{#1}", "wi{s}dom [w:{oe}conomy=economy] gar{c,}on"),
    markitWithContent("{#1}", "> quoted {ae}on", "> - listed caf{e/}"),
    markitWithContent("{#title}", "^1 {OE}uvres compl{e`}tes"),
    markitWithContent("{#1}", "| {ae} | {e/}b |", "| c | d |"),
  ];

  it("compile before ≡ compile after formatting", () => {
    for (const source of sources) {
      const before = compile(source);
      const after = compile(formatDocument(source));
      expect(before.errors).toEqual([]);
      expect(after.errors).toEqual([]);
      // The serialisable document is identical; source line ranges (symbol
      // keys, never serialised) may shift when the formatter reflows lines.
      expect(JSON.parse(JSON.stringify(after.document))).toEqual(
        JSON.parse(JSON.stringify(before.document)),
      );
    }
  });
});
