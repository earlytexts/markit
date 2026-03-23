import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithMetadata } from "./factories.js";

describe("compilation errors", () => {
  describe("structural errors", () => {
    it("returns empty document and error for empty document", () => {
      const [, errors] = compile("");

      expect(errors[0]).toEqual({
        message: "Document is empty",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
      });
    });

    it("returns error for document with no root ID block", () => {
      const [, errors] = compile(markit("{#0}", "Text", ""));

      expect(errors[0]).toEqual({
        message:
          "Document must begin with a level 1 header (e.g. # Document.Id)",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 5,
      });
    });

    it("returns error for document with non-level-1 root header", () => {
      const [, errors] = compile(markit("## Markit.Errors"));

      expect(errors[0]).toEqual({
        message: "Expected level 1 header but found level 2",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 17,
      });
    });

    it("returns error for document with level jump", () => {
      const [, errors] = compile(
        markit(
          "# Markit.Errors",
          "",
          "## Markit.Errors.BadTextMetadata",
          "",
          "#### Markit.Errors.BadTextMetadata.TooDeep",
        ),
      );

      expect(errors[0]).toEqual({
        message:
          "Level 4 header cannot follow level 2 header without an intermediate level",
        line: 5,
        column: 1,
        endLine: 5,
        endColumn: 43,
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

  describe("block tag errors", () => {
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

  describe("block content errors", () => {
    it("returns error for unknown brace code", () => {
      const [, errors] = compile(
        markit("# Text", "", "{#1}", "This has an {unknown} brace code.", ""),
      );

      expect(errors[0]).toEqual({
        message: "Unknown brace code: unknown",
        line: 4,
        column: 14,
        endLine: 4,
        endColumn: 21,
      });
    });

    it("returns error for unclosed brace code", () => {
      const [, errors] = compile(
        markit("# Text", "", "{#2}", "This has an {unclosed brace code.", ""),
      );

      expect(errors[0]).toEqual({
        message: "Unclosed brace code",
        line: 4,
        column: 13,
        endLine: 4,
        endColumn: 14,
      });
    });

    it("returns error for unclosed formatting", () => {
      const [, errors] = compile(
        markit("# Text", "", "{#3}", "This has *unclosed bold.", ""),
      );

      expect(errors[0]).toEqual({
        message: "Unclosed formatting: *",
        line: 4,
        column: 10,
        endLine: 4,
        endColumn: 11,
      });
    });

    it("returns error for unclosed heading", () => {
      const [, errors] = compile(
        markit("# Text", "", "{#4}", "This has a £1 heading without end.", ""),
      );

      expect(errors[0]).toEqual({
        message: "Unclosed heading level 1",
        line: 4,
        column: 12,
        endLine: 4,
        endColumn: 15,
      });
    });

    it("returns error for missing footnote reference", () => {
      const [, errors] = compile(
        markit("# Text", "", "{#5}", "This has a ref to <n99>.", ""),
      );

      expect(errors[0]).toEqual({
        message: "Footnote not found: n99",
        line: 4,
        column: 19,
        endLine: 4,
        endColumn: 24,
      });
    });

    it("returns error for nested block-level elements", () => {
      const [, errors] = compile(
        markit(
          "# Text",
          "",
          "{#6}",
          '£1 Heading with ""blockquote"" inside £1',
          "",
        ),
      );

      expect(errors[0]).toEqual({
        message: "Block-level elements cannot be nested",
        line: 4,
        column: 17,
        endLine: 4,
        endColumn: 19,
      });

      // The closing "" also generates an error
      expect(errors[1]).toEqual({
        message: "Block-level elements cannot be nested",
        line: 4,
        column: 29,
        endLine: 4,
        endColumn: 31,
      });
    });
  });
});
