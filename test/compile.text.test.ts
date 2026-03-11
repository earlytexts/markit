import { describe, expect, it } from "vitest";
import compileToText from "../src/compileToText.js";
import { loadFixture } from "./fixtures.js";

describe("compileToText", () => {
  it("compiles a Markit document to text", () => {
    const input = loadFixture("example.mit");
    const expected = loadFixture("example.txt");
    const [text, errors] = compileToText(input);
    expect(text).toBe(expected);
    expect(errors).toEqual([]);
  });

  it("returns errors for invalid Markit documents", () => {
    const input = loadFixture("errors.mit");
    const [, errors] = compileToText(input);
    expect(errors.length).toBeGreaterThan(0);
  });
});
