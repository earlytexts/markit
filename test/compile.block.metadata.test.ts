import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { endLine, startLine } from "../src/types.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("null case", () => {
  it("omits metadata when a block tag has no metadata pairs", () => {
    const [document, errors] = compile(markitWithContent("{#1}", "Content."));

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toBeUndefined();
  });
});

describe("scalar values", () => {
  it("parses boolean, number, and string metadata on a block", () => {
    const [document, errors] = compile(
      markitWithContent(
        '{#1, modified=true, subsection=4, speaker="Philo"}',
        "Content.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({
        modified: true,
        subsection: 4,
        speaker: "Philo",
      }),
    );
  });

  it("parses negative numbers", () => {
    const [document, errors] = compile(
      markitWithContent("{#1, offset=-3}", "Content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ offset: -3 }),
    );
  });

  it("handles escaped quotes in string metadata", () => {
    const [document, errors] = compile(
      markitWithContent('{#1, q="She said \\"hi\\"."}', "Content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ q: 'She said "hi".' }),
    );
  });

  it("preserves commas inside strings", () => {
    const [document, errors] = compile(
      markitWithContent('{#1, s="a, b, c"}', "Content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ s: "a, b, c" }),
    );
  });

  it("preserves braces inside strings", () => {
    const [document, errors] = compile(
      markitWithContent('{#1, s="close}brace"}', "Content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ s: "close}brace" }),
    );
  });
});

describe("inline arrays", () => {
  it("parses homogeneous arrays of each scalar type", () => {
    const [document, errors] = compile(
      markitWithContent(
        '{#1, bools=[true, false], nums=[1, 2, 3], strs=["a", "b"]}',
        "Content.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({
        bools: [true, false],
        nums: [1, 2, 3],
        strs: ["a", "b"],
      }),
    );
  });

  it("parses strings containing commas and braces inside arrays", () => {
    const [document, errors] = compile(
      markitWithContent('{#1, edits=["2014-10-12", "2014-11-01"]}', "Content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ edits: ["2014-10-12", "2014-11-01"] }),
    );
  });

  it("returns error for mixed-type arrays", () => {
    const [, errors] = compile(
      markitWithContent('{#1, mixed=[true, 1, "a"]}', "Content."),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message:
        "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 26,
      severity: "error",
    });
  });
});

describe("positions and line ranges", () => {
  it("records startLine and endLine for the block regardless of metadata", () => {
    const [document, errors] = compile(
      markit("# Text", "", "{#1, foo=1}", "Content.", ""),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]![startLine]).toBe(2);
    expect(document.blocks[0]![endLine]).toBe(3);
  });
});

describe("interaction with special block IDs", () => {
  it("allows metadata on a title block", () => {
    const [document, errors] = compile(
      markitWithContent('{#title, lang="en"}', "^1 The Title"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.id).toBe("Text.title");
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ lang: "en" }),
    );
  });

  it("allows metadata on a subtitle block", () => {
    const [document, errors] = compile(
      markitWithContent("{#subtitle, level=2}", "^2 Heading"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.id).toBe("Text.subtitle1");
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ level: 2 }),
    );
  });

  it("allows metadata on a footnote block", () => {
    const [document, errors] = compile(
      markitWithContent('{#n1, source="A"}', "A footnote."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.id).toBe("Text.n1");
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ source: "A" }),
    );
  });
});

describe("block tag on the same line as content", () => {
  it("separates metadata from trailing content", () => {
    const [document, errors] = compile(
      markitWithContent("{#1, foo=1} Some content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ foo: 1 }),
    );
    expect(document.blocks[0]!.content).toHaveLength(1);
  });
});

describe("malformed tags", () => {
  it("returns error for block tag with a trailing pair that is not key=value", () => {
    const [, errors] = compile(markitWithContent("{#1, notvalid}", "Content."));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Invalid metadata pair, expected 'key=value'",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 14,
      severity: "error",
    });
  });

  it("returns error for invalid scalar values inside a block tag", () => {
    const [, errors] = compile(markitWithContent("{#1, key=troo}", "Content."));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Invalid metadata value: troo",
      line: 3,
      column: 10,
      endLine: 3,
      endColumn: 14,
      severity: "error",
    });
  });

  it("still reports the unclosed-tag error when } is missing", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1, foo=1", "Content.", ""),
    );

    expect(errors[0]).toMatchObject({
      message: "Block tag is not properly closed with '}'",
      line: 3,
      column: 1,
      severity: "error",
    });
  });

  it("ignores trailing commas in block metadata", () => {
    const [document, errors] = compile(
      markitWithContent("{#1, foo=1,}", "Content."),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.metadata).toEqual(
      expect.objectContaining({ foo: 1 }),
    );
  });

  it("keeps splitting on commas after a spurious ]", () => {
    const [, errors] = compile(
      markitWithContent("{#1, foo=], bar=2}", "Content."),
    );

    // Both chunks are split and parsed; `foo=]` and `bar=2` each get validated.
    // The point is that the trailing comma AFTER the spurious `]` still splits.
    expect(errors.some((e) => e.message === "Invalid metadata value: ]")).toBe(
      true,
    );
  });
});
