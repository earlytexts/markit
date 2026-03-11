import { describe, expect, it } from "vitest";
import { format } from "prettier";
import compileToHTML from "../src/compileToHTML.js";
import { loadFixture } from "./fixtures.js";

describe("compileToHTML", () => {
  it("compiles a Markit document to HTML", async () => {
    const input = loadFixture("example.mit");
    const expected = loadFixture("example.html");
    const [html, errors] = compileToHTML(input);
    const formattedHTML = await format(html, { parser: "html" });
    expect(formattedHTML).toBe(expected);
    expect(errors).toEqual([]);
  });

  it("returns errors for invalid Markit documents", () => {
    const input = loadFixture("errors.mit");
    const [, errors] = compileToHTML(input);
    expect(errors.length).toBeGreaterThan(0);
  });
});
