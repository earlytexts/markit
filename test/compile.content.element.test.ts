import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import renderText from "../src/renderText.ts";
import { markitWithContent, pt } from "./utils/factories.ts";

const inlineOf = (source: string) => {
  const { document, errors } = compile(markitWithContent("{#1}", source));
  const block = document.blocks[0]!;
  const paragraph = block.content[0]!;
  if (paragraph.type !== "paragraph") {
    throw new Error("expected a paragraph");
  }
  return { content: paragraph.content, errors, document };
};

describe("generic raw element", () => {
  it("parses a self-closing element with attributes", () => {
    const { content, errors } = inlineOf(`Before <<PB REF="3" MS="y"/>> after`);
    expect(errors).toHaveLength(0);
    expect(content).toEqual([
      pt("Before "),
      {
        type: "element",
        tag: "PB",
        attributes: [
          { name: "REF", value: "3" },
          { name: "MS", value: "y" },
        ],
        selfClosing: true,
        content: [],
      },
      pt(" after"),
    ]);
  });

  it("parses an element with attributes wrapping nested native markup", () => {
    const { content, errors } = inlineOf(
      `<<HI REND="bold">>some _italic_<</HI>>`,
    );
    expect(errors).toHaveLength(0);
    expect(content).toEqual([
      {
        type: "element",
        tag: "HI",
        attributes: [{ name: "REND", value: "bold" }],
        content: [pt("some "), { type: "emphasis", content: [pt("italic")] }],
      },
    ]);
  });

  it("parses an element with no attributes", () => {
    const { content, errors } = inlineOf(`<<DATE>>1678<</DATE>>`);
    expect(errors).toHaveLength(0);
    expect(content).toEqual([
      {
        type: "element",
        tag: "DATE",
        attributes: [],
        content: [pt("1678")],
      },
    ]);
  });

  it("nests elements of the same tag", () => {
    const { content, errors } = inlineOf(`<<A>>p<<A>>q<</A>>r<</A>>`);
    expect(errors).toHaveLength(0);
    expect(content).toEqual([
      {
        type: "element",
        tag: "A",
        attributes: [],
        content: [
          pt("p"),
          { type: "element", tag: "A", attributes: [], content: [pt("q")] },
          pt("r"),
        ],
      },
    ]);
  });

  it("reports an unclosed element but still captures its content", () => {
    const { content, errors } = inlineOf(`<<HI>>text`);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Unclosed element: <<HI");
    expect(content).toEqual([
      { type: "element", tag: "HI", attributes: [], content: [pt("text")] },
    ]);
  });

  it("reports an unclosed element ending in an escaped close marker", () => {
    const { content, errors } = inlineOf(`<<HI>>text\\<</HI>>`);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Unclosed element: <<HI");
    expect(content).toEqual([
      {
        type: "element",
        tag: "HI",
        attributes: [],
        content: [pt("text<</HI>>")],
      },
    ]);
  });

  it("treats `<<` with no closing `>>` as plain text", () => {
    const { content, errors } = inlineOf(`a << b`);
    expect(errors).toHaveLength(0);
    expect(content).toEqual([pt("a << b")]);
  });

  it("treats a stray close tag as plain text", () => {
    const { content, errors } = inlineOf(`<</HI>>`);
    expect(errors).toHaveLength(0);
    expect(content).toEqual([pt("<</HI>>")]);
  });

  it("treats an empty `<<>>` as plain text", () => {
    const { content, errors } = inlineOf(`<<>>`);
    expect(errors).toHaveLength(0);
    expect(content).toEqual([pt("<<>>")]);
  });

  it("renders element content to plain text, ignoring the tag", () => {
    const { document } = inlineOf(`x<<HI REND="bold">>word<</HI>>y`);
    expect(renderText(document)).toContain("xwordy");
  });
});
