import { describe, expect, it } from "vitest";
import { loadFixture } from "./utils/fixtures.js";
import compile from "../src/compile.js";
import renderText from "../src/renderText.js";

describe("compileToText", () => {
  it("compiles a Markit document to text", () => {
    const input = loadFixture("example.mit");
    const expected = loadFixture("example.txt");

    const [document] = compile(input);
    const text = renderText(document);

    expect(text).toBe(expected);
  });
});
