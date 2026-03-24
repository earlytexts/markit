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
    expect(document.blocks[0]!.metadata).toEqual({
      boolean: true,
      number: 42,
      string: "hello",
    });
  });
});

describe("block metadata errors", () => {
  it("returns error for block with no tag", () => {
    const [, errors] = compile(
      markit("# Text", "", "This block has no tag.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Block is missing metadata tag '{#id}'",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 23,
    });
  });

  it("returns error for block with unclosed tag", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1", "This block has a badly formed tag.", ""),
    );

    expect(errors[0]).toEqual({
      message: "Block tag is not properly closed with '}'",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 4,
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

    expect(errors[0]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 13,
    });

    expect(errors[1]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 15,
      endLine: 3,
      endColumn: 30,
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

    expect(errors[0]).toEqual({
      message: "Invalid metadata value: troo",
      line: 3,
      column: 17,
      endLine: 3,
      endColumn: 21,
    });

    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "no closing quote',
      line: 3,
      column: 33,
      endLine: 3,
      endColumn: 50,
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

    expect(errors[0]).toEqual({
      message: "Duplicate block ID: #2",
      line: 6,
      column: 1,
      endLine: 6,
      endColumn: 5,
    });
  });
});
