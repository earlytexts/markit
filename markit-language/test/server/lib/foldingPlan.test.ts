import { describe, expect, it } from "vitest";
import { compile, compileWithPositions } from "@earlytexts/markit";
import planFoldingRanges from "../../../src/server/lib/foldingPlan.ts";

describe("planFoldingRanges", () => {
  it("folds the document, its metadata (and nested tables) and each block", () => {
    const { document } = compileWithPositions(
      [
        "# Text", // line 0
        "",
        "[metadata]", // line 2
        'title = "A Text"',
        "",
        "[metadata.source]", // line 5
        'author = "Anon"',
        "",
        "{#1}", // line 8
        "First block.",
        "",
        "{#2}", // line 11
        "Second block.",
        "",
      ].join("\n"),
    );

    const ranges = planFoldingRanges(document);

    // The document extent itself.
    expect(ranges).toContainEqual({ startLine: 0, endLine: 12 });
    // The metadata extent and its nested table (a `[metadata.source]` key
    // named "source" must not collide with the metadataSource property).
    expect(ranges).toContainEqual({ startLine: 2, endLine: 6 });
    expect(ranges).toContainEqual({ startLine: 5, endLine: 6 });
    expect(document.metadata!.source).toEqual({ author: "Anon" });
    // Both content blocks.
    expect(ranges).toContainEqual({ startLine: 8, endLine: 9 });
    expect(ranges).toContainEqual({ startLine: 11, endLine: 12 });
    // Ranges are well-formed (start no later than end).
    for (const range of ranges) {
      expect(range.startLine).toBeLessThanOrEqual(range.endLine);
    }
  });

  it("recurses into nested sections", () => {
    const { document } = compileWithPositions(
      [
        "# Parent", // line 0
        "",
        "{#1}",
        "Top.",
        "",
        "## Child", // line 5
        "",
        "{#2}",
        "Nested.", // line 8
        "",
      ].join("\n"),
    );

    const ranges = planFoldingRanges(document);
    expect(ranges).toContainEqual({ startLine: 5, endLine: 8 });
  });

  it("returns nothing for a document compiled without positions", () => {
    const { document } = compile(
      ["# Text", "", "{#1}", "Content.", ""].join("\n"),
    );

    expect(planFoldingRanges(document)).toEqual([]);
  });
});
