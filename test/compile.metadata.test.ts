import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithMetadata } from "./utils/factories.js";

describe("text metadata", () => {
  it("parses boolean metadata", () => {
    const [document] = compile(
      markitWithMetadata("metadataBoolean1: true", "metadataBoolean2: false"),
    );

    expect(document.metadata).toEqual({
      metadataBoolean1: true,
      metadataBoolean2: false,
    });
  });

  it("parses numeric metadata", () => {
    const [document] = compile(markitWithMetadata("metadataNumber: 42"));

    expect(document.metadata).toEqual({
      metadataNumber: 42,
    });
  });

  it("parses string metadata", () => {
    const [document] = compile(
      markitWithMetadata('metadataString: "the answer"'),
    );

    expect(document.metadata).toEqual({
      metadataString: "the answer",
    });
  });

  it("handles escaped quotes in string metadata", () => {
    const [document] = compile(
      markitWithMetadata('metadataString: "She said \\"hello\\"."'),
    );

    expect(document.metadata).toEqual({
      metadataString: 'She said "hello".',
    });
  });

  it("parses inline array metadata", () => {
    const [document] = compile(
      markitWithMetadata(
        "metadataBooleanArray: [true, false]",
        "metadataNumberArray: [1, 2, 3]",
        'metadataStringArray: ["a", "b", "c"]',
      ),
    );

    expect(document.metadata).toEqual({
      metadataBooleanArray: [true, false],
      metadataNumberArray: [1, 2, 3],
      metadataStringArray: ["a", "b", "c"],
    });
  });

  it("parses multiline array metadata", () => {
    const [document] = compile(
      markitWithMetadata(
        "metadataBooleanArray:",
        "  - true",
        "  - false",
        "metadataNumberArray:",
        "  - 1",
        "  - 2",
        "  - 3",
        "metadataStringArray:",
        '  - "a"',
        '  - "b"',
        '  - "c"',
      ),
    );

    expect(document.metadata).toEqual({
      metadataBooleanArray: [true, false],
      metadataNumberArray: [1, 2, 3],
      metadataStringArray: ["a", "b", "c"],
    });
  });

  it("parses multiline arrays followed by other metadata", () => {
    const [document] = compile(
      markitWithMetadata("arrayKey:", "  - 1", "  - 2", "otherKey: true"),
    );

    expect(document.metadata).toEqual({
      arrayKey: [1, 2],
      otherKey: true,
    });
  });

  it("parses metadata from child texts", () => {
    const [document] = compile(
      markit(
        "# Text",
        "",
        "## Child.Text",
        "",
        "note: Child texts can contain metadata too.",
      ),
    );

    const section1 = document.children[0]!;
    expect(section1.metadata).toEqual({
      note: "Child texts can contain metadata too.",
    });
  });
});

describe("text metadata errors", () => {
  it("returns error for invalid metadata values", () => {
    const [, errors] = compile(
      markitWithMetadata("badBoolean: troo", 'badString: "no closing quote'),
    );

    expect(errors[0]).toEqual({
      message: "Invalid metadata value: troo",
      line: 3,
      column: 13,
      endLine: 3,
      endColumn: 17,
    });

    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "no closing quote',
      line: 4,
      column: 12,
      endLine: 4,
      endColumn: 29,
    });
  });

  it("returns error for badly formatted metadata lines", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "validKey: true",
        "this is not okay",
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors[0]).toEqual({
      message: "Invalid metadata line, expected 'key: value'",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 17,
    });
  });

  it("returns error for mixed-type inline arrays", () => {
    const [, errors] = compile(
      markitWithMetadata('mixedInlineArray: [true, 1, "a"]'),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 33,
    });
  });

  it("returns error for mixed-type multiline arrays", () => {
    const [, errors] = compile(
      markitWithMetadata("mixedArray:", "  - true", "  - 1", '  - "a"'),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 12,
    });
  });

  it("returns error for invalid JSON values in multiline arrays", () => {
    const [, errors] = compile(
      markitWithMetadata("badArray:", "  - troo", '  - "unclosed'),
    );

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      message: "Invalid metadata value: troo",
      line: 4,
      column: 5,
      endLine: 4,
      endColumn: 9,
    });
    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "unclosed',
      line: 5,
      column: 5,
      endLine: 5,
      endColumn: 14,
    });
  });

  it("returns error for empty multiline arrays", () => {
    const [, errors] = compile(markitWithMetadata("emptyArray:"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Multiline array must have at least one item",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 12,
    });
  });
});
