import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import compileToJSON from "../src/compileToJSON.js";
import { loadFixture } from "./fixtures.js";

describe("compileToJSON", () => {
  it("compiles a valid Markit document to JSON", () => {
    const example = loadFixture("example.mit");
    const [document, errors] = compile(example);
    const [json, jsonErrors] = compileToJSON(example);
    expect(json).toEqual(JSON.stringify(document, null, 2));
    expect(errors).toEqual([]);
    expect(jsonErrors).toEqual([]);
  });

  it("returns errors for invalid Markit documents", () => {
    const input = loadFixture("errors.mit");
    const [, errors] = compile(input);
    const [, jsonErrors] = compileToJSON(input);
    expect(jsonErrors.length).toBe(errors.length);
  });
});
