import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithMetadata } from "./utils/factories.js";

describe("text metadata", () => {
  it("parses boolean metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata("metadataBoolean1: true", "metadataBoolean2: false"),
    );

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        metadataBoolean1: true,
        metadataBoolean2: false,
      }),
    );
  });

  it("parses numeric metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata("metadataNumber: 42"),
    );

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        metadataNumber: 42,
      }),
    );
  });

  it("parses negative number metadata", () => {
    const [document, errors] = compile(markitWithMetadata("offset: -1"));

    expect(errors).toHaveLength(0);
    expect(document).toEqual(expect.objectContaining({ offset: -1 }));
  });

  it("parses string metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata('metadataString: "the answer"'),
    );

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        metadataString: "the answer",
      }),
    );
  });

  it("handles escaped quotes in string metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata('metadataString: "She said \\"hello\\"."'),
    );

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        metadataString: 'She said "hello".',
      }),
    );
  });

  it("parses inline array metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata(
        "metadataBooleanArray: [true, false]",
        "metadataNumberArray: [1, 2, 3]",
        'metadataStringArray: ["a", "b", "c"]',
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        metadataBooleanArray: [true, false],
        metadataNumberArray: [1, 2, 3],
        metadataStringArray: ["a", "b", "c"],
      }),
    );
  });

  it("parses multiline array metadata", () => {
    const [document, errors] = compile(
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

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        metadataBooleanArray: [true, false],
        metadataNumberArray: [1, 2, 3],
        metadataStringArray: ["a", "b", "c"],
      }),
    );
  });

  it("parses multiline arrays followed by other metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata("arrayKey:", "  - 1", "  - 2", "otherKey: true"),
    );

    expect(errors).toHaveLength(0);
    expect(document).toEqual(
      expect.objectContaining({
        arrayKey: [1, 2],
        otherKey: true,
      }),
    );
  });

  it("parses metadata from child texts", () => {
    const [document, errors] = compile(
      markit(
        "# Text",
        "",
        "## Child.Text",
        "",
        'note: "Child texts can contain metadata too."',
      ),
    );

    expect(errors).toHaveLength(0);
    const section1 = document.children[0]!;
    expect(section1).toEqual(
      expect.objectContaining({
        note: "Child texts can contain metadata too.",
      }),
    );
  });
});

describe("text metadata errors", () => {
  it("returns error for invalid metadata values", () => {
    const [, errors] = compile(
      markitWithMetadata("badBoolean: troo", 'badString: "no closing quote'),
    );

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      message: "Invalid metadata value: troo",
      line: 3,
      column: 13,
      endLine: 3,
      endColumn: 17,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "no closing quote',
      line: 4,
      column: 12,
      endLine: 4,
      endColumn: 29,
      severity: "error",
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
      severity: "error",
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
      severity: "error",
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
      severity: "error",
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
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "unclosed',
      line: 5,
      column: 5,
      endLine: 5,
      endColumn: 14,
      severity: "error",
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
      severity: "error",
    });
  });

  it("returns error for reserved metadata key 'id'", () => {
    const [, errors] = compile(markitWithMetadata('id: "custom"'));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "The 'id' metadata key is reserved and cannot be used in the document metadata",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 3,
      severity: "error",
    });
  });

  it("returns error for reserved metadata key 'blocks'", () => {
    const [, errors] = compile(markitWithMetadata("blocks: 1"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "The 'blocks' metadata key is reserved and cannot be used in the document metadata",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 7,
      severity: "error",
    });
  });
});
