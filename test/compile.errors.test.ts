import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { loadFixture } from "./fixtures.js";

const empty = loadFixture("empty.mit");
const noId = loadFixture("no-root.mit");
const errors = loadFixture("errors.mit");

const [, emptyErrors] = compile(empty);
const [, noIdErrors] = compile(noId);
const [, variousErrors] = compile(errors);

describe("compilation errors", () => {
  describe("structural errors", () => {
    it("returns empty document and error for empty document", () => {
      expect(emptyErrors[0]).toEqual({
        message: "Document is empty",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
      });
    });

    it("returns error for document with no root ID block", () => {
      expect(noIdErrors[0]).toEqual({
        message:
          "Document must begin with a level 1 header (e.g. # Document.Id)",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 5,
      });
    });

    it("returns error for document with non-level-1 root header", () => {
      expect(variousErrors[0]).toEqual({
        message: "Expected level 1 header but found level 2",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 17,
      });
    });

    it("returns error for document with level jump", () => {
      expect(variousErrors[1]).toEqual({
        message:
          "Level 4 header cannot follow level 2 header without an intermediate level",
        line: 3,
        column: 1,
        endLine: 3,
        endColumn: 35,
      });
    });
  });

  describe("text metadata errors", () => {
    it("returns error for invalid metadata values", () => {
      expect(variousErrors[2]).toEqual({
        message: "Invalid metadata value: troo",
        line: 5,
        column: 13,
        endLine: 5,
        endColumn: 17,
      });

      expect(variousErrors[3]).toEqual({
        message: 'Invalid metadata value: "no closing quote',
        line: 6,
        column: 12,
        endLine: 6,
        endColumn: 29,
      });
    });

    it("returns error for badly formatted metadata lines", () => {
      expect(variousErrors[4]).toEqual({
        message: "Invalid metadata line, expected 'key: value'",
        line: 7,
        column: 1,
        endLine: 7,
        endColumn: 17,
      });
    });
  });

  describe("block tag errors", () => {
    it("returns error for block with no tag", () => {
      expect(variousErrors[5]).toEqual({
        message: "Block is missing metadata tag '{#id}'",
        line: 11,
        column: 1,
        endLine: 11,
        endColumn: 23,
      });
    });

    it("returns error for block with unclosed tag", () => {
      expect(variousErrors[6]).toEqual({
        message: "Block tag is not properly closed with '}'",
        line: 13,
        column: 1,
        endLine: 13,
        endColumn: 4,
      });
    });

    it("returns error for block with badly formed metadata", () => {
      expect(variousErrors[8]).toEqual({
        message: "Invalid block metadata, expected 'key=value'",
        line: 16,
        column: 6,
        endLine: 16,
        endColumn: 13,
      });

      expect(variousErrors[9]).toEqual({
        message: "Invalid block metadata, expected 'key=value'",
        line: 16,
        column: 15,
        endLine: 16,
        endColumn: 30,
      });
    });

    it("returns error for block with invalid metadata values", () => {
      expect(variousErrors[10]).toEqual({
        message: "Invalid metadata value: troo",
        line: 19,
        column: 17,
        endLine: 19,
        endColumn: 21,
      });

      expect(variousErrors[11]).toEqual({
        message: 'Invalid metadata value: "no closing quote',
        line: 19,
        column: 33,
        endLine: 19,
        endColumn: 50,
      });
    });

    it("returns error for block with duplicate ID", () => {
      expect(variousErrors[12]).toEqual({
        message: "Duplicate block ID: #2",
        line: 22,
        column: 1,
        endLine: 22,
        endColumn: 5,
      });
    });
  });

  describe("block content errors", () => {
    it("returns error for unknown brace code", () => {
      expect(variousErrors[13]).toEqual({
        message: "Unknown brace code: unknown",
        line: 28,
        column: 14,
        endLine: 28,
        endColumn: 21,
      });
    });

    it("returns error for unclosed brace code", () => {
      expect(variousErrors[14]).toEqual({
        message: "Unclosed brace code",
        line: 31,
        column: 13,
        endLine: 31,
        endColumn: 14,
      });
    });

    it("returns error for unclosed formatting", () => {
      expect(variousErrors[15]).toEqual({
        message: "Unclosed formatting: *",
        line: 34,
        column: 10,
        endLine: 34,
        endColumn: 11,
      });
    });

    it("returns error for unclosed heading", () => {
      expect(variousErrors[16]).toEqual({
        message: "Unclosed heading level 1",
        line: 37,
        column: 12,
        endLine: 37,
        endColumn: 15,
      });
    });

    it("returns error for missing footnote reference", () => {
      expect(variousErrors[17]).toEqual({
        message: "Footnote not found: n99",
        line: 40,
        column: 19,
        endLine: 40,
        endColumn: 24,
      });
    });

    it("returns error for nested block-level elements", () => {
      expect(variousErrors[18]).toEqual({
        message: "Block-level elements cannot be nested",
        line: 43,
        column: 17,
        endLine: 43,
        endColumn: 19,
      });

      // The closing "" also generates an error
      expect(variousErrors[19]).toEqual({
        message: "Block-level elements cannot be nested",
        line: 43,
        column: 29,
        endLine: 43,
        endColumn: 31,
      });
    });
  });
});
