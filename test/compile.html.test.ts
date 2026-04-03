import { describe, expect, it } from "vitest";
import { format } from "prettier";
import compile from "../src/compile.js";
import renderHTML from "../src/renderHTML.js";
import { loadFixture } from "./utils/fixtures.js";

describe("compileToHTML", () => {
  it("compiles a Markit document to HTML", async () => {
    const input = loadFixture("example.mit");
    const expected = loadFixture("example.html");

    const [document] = compile(input);
    const html = renderHTML(document);
    const formattedHTML = await format(html, { parser: "html" });

    expect(formattedHTML).toBe(expected);
  });
});
