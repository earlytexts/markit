// deno-lint-ignore-file no-explicit-any -- tests reach into unions with `as any`
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import { li, list, markitWithContent, p, pt } from "./utils/factories.ts";

describe("Verse compilation", () => {
  it("compiles a single stanza", () => {
    const input = markitWithContent(
      "{#1}",
      "* Fear no more the heat o' the sun,",
      "* Nor the furious winter's rages;",
    );
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    expect(result.blocks[0]!.content).toEqual([
      list("verse", [
        li([pt("Fear no more the heat o' the sun,")]),
        li([pt("Nor the furious winter's rages;")]),
      ]),
    ]);
  });

  it("compiles multiple stanzas as separate verse blocks", () => {
    const input = markitWithContent(
      "{#1}",
      "* First line,",
      "* Second line.",
      "",
      "* Third line,",
      "* Fourth line.",
    );
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    expect(result.blocks[0]!.content).toEqual([
      list("verse", [li([pt("First line,")]), li([pt("Second line.")])]),
      list("verse", [li([pt("Third line,")]), li([pt("Fourth line.")])]),
    ]);
  });

  it("preserves inline formatting in verse lines", () => {
    const input = markitWithContent("{#1}", "* Line with *strong* text");
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    const verse = result.blocks[0]!.content[0] as any;
    expect(verse.ordered).toBe("verse");
    expect(verse.items[0]!.content).toHaveLength(3);
    expect(verse.items[0]!.content[0]).toEqual(pt("Line with "));
    expect(verse.items[0]!.content[1]!.type).toBe("strong");
    expect(verse.items[0]!.content[2]).toEqual(pt(" text"));
  });

  it("preserves line break within a verse line", () => {
    const input = markitWithContent("{#1}", "* First half \\ second half");
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    const verse = result.blocks[0]!.content[0] as any;
    expect(verse.ordered).toBe("verse");
    expect(verse.items[0]!.content[1]!.type).toBe("lineBreak");
  });

  it("compiles a single verse line", () => {
    const input = markitWithContent("{#1}", "* Only line");
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    expect(result.blocks[0]!.content).toEqual([
      list("verse", [li([pt("Only line")])]),
    ]);
  });

  it("separates verse from adjacent paragraph", () => {
    const input = markitWithContent(
      "{#1}",
      "Prose paragraph.",
      "",
      "* A verse line.",
      "",
      "More prose.",
    );
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    expect(result.blocks[0]!.content).toEqual([
      p([pt("Prose paragraph.")]),
      list("verse", [li([pt("A verse line.")])]),
      p([pt("More prose.")]),
    ]);
  });

  it("separates verse from adjacent unordered list", () => {
    const input = markitWithContent("{#1}", "- List item", "", "* Verse line");
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    expect(result.blocks[0]!.content).toEqual([
      list("unordered", [li([pt("List item")])]),
      list("verse", [li([pt("Verse line")])]),
    ]);
  });

  it("separates verse from adjacent ordered list", () => {
    const input = markitWithContent("{#1}", "1. List item", "", "* Verse line");
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    expect(result.blocks[0]!.content).toEqual([
      list("ordered", [li([pt("List item")])]),
      list("verse", [li([pt("Verse line")])]),
    ]);
  });

  it("verse does not set start property", () => {
    const input = markitWithContent("{#1}", "* Line one", "* Line two");
    const { document: result, errors } = compile(input);
    expect(errors).toEqual([]);
    const verse = result.blocks[0]!.content[0] as any;
    expect(verse.start).toBeUndefined();
  });
});
