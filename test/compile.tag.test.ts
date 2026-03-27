import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("block metadata", () => {
  it("parses blocks with their ids", () => {
    const [document] = compile(
      markitWithContent(
        "{#0}",
        "This is the first block.",
        "",
        "{#1}",
        "This is the second block.",
      ),
    );

    expect(document.blocks.length).toBe(2);
    expect(document.blocks[0]!.id).toBe("0");
    expect(document.blocks[1]!.id).toBe("1");
  });

  it("parses block metadata", () => {
    const [document] = compile(
      markitWithContent('{#1, boolean=true, number=42, string="hello"}'),
    );
    expect(document.blocks[0]).toEqual(
      expect.objectContaining({
        boolean: true,
        number: 42,
        string: "hello",
      }),
    );
  });
});

describe("block metadata errors", () => {
  it("returns error for block with no tag", () => {
    const [, errors] = compile(
      markit("# Text", "", "This block has no tag.", ""),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({
      message: "Block is missing metadata tag '{#id}'",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 23,
      severity: "error",
    });
  });

  it("returns error for block with unclosed tag", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1", "This block has a badly formed tag.", ""),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({
      message: "Block tag is not properly closed with '}'",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 4,
      severity: "error",
    });
  });

  it("returns error for block with badly formed metadata", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        '{#2, nothing, string: "hello"}',
        "This block has badly formed metadata.",
        "",
      ),
    );

    expect(errors.length).toBe(2);
    expect(errors[0]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 13,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 15,
      endLine: 3,
      endColumn: 30,
      severity: "error",
    });
  });

  it("returns error for block with invalid metadata values", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        '{#3, badBoolean=troo, badString="no closing quote}',
        "This block has badly formed metadata.",
        "",
      ),
    );

    expect(errors.length).toBe(2);
    expect(errors[0]).toEqual({
      message: "Invalid metadata value: troo",
      line: 3,
      column: 17,
      endLine: 3,
      endColumn: 21,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "no closing quote',
      line: 3,
      column: 33,
      endLine: 3,
      endColumn: 50,
      severity: "error",
    });
  });

  it("returns error for block with duplicate ID", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#2}",
        "First block with ID 2.",
        "",
        "{#2}",
        "This block has the same ID as a previous block.",
        "",
      ),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({
      message: "Duplicate block ID: #2",
      line: 6,
      column: 1,
      endLine: 6,
      endColumn: 5,
      severity: "error",
    });
  });

  it("returns error for reserved block tag key 'id'", () => {
    const [, errors] = compile(
      markit("# Text", "", '{#1, id="custom"}', "Block content.", ""),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({
      message: "Block tag key 'id' is reserved and cannot be used in metadata",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 8,
      severity: "error",
    });
  });

  it("returns error for reserved block tag key 'content'", () => {
    const [, errors] = compile(
      markit("# Text", "", '{#1, content="x"}', "Block content.", ""),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({
      message:
        "Block tag key 'content' is reserved and cannot be used in metadata",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 13,
      severity: "error",
    });
  });

  it("returns error for footnote block appearing before a regular block", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#n1}",
        "Footnote content.",
        "",
        "{#1}",
        "Regular block after footnote.",
        "",
      ),
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({
      message: "Footnote blocks must appear after all paragraph blocks",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 6,
      severity: "error",
    });
  });
});
