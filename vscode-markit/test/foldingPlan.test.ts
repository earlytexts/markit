import { describe, expect, it } from "vitest";
import { compile, endLine, startLine } from "@earlytexts/markit";
import planFoldingRanges from "../src/lib/foldingPlan.ts";

describe("planFoldingRanges", () => {
  it("folds the document, its metadata (and nested tables) and each block", () => {
    const [document] = compile(
      [
        "# Text",
        "",
        "[metadata]",
        'title = "A Text"',
        "",
        "[metadata.source]",
        'author = "Anon"',
        "",
        "{#1}",
        "First block.",
        "",
        "{#2}",
        "Second block.",
        "",
      ].join("\n"),
    );

    const ranges = planFoldingRanges(document);

    // The document extent itself.
    expect(ranges).toContainEqual({
      startLine: document[startLine],
      endLine: document[endLine],
    });
    // The metadata block and its nested table.
    expect(ranges).toContainEqual({
      startLine: document.metadata![startLine],
      endLine: document.metadata![endLine],
    });
    // Both content blocks.
    for (const block of document.blocks) {
      expect(ranges).toContainEqual({
        startLine: block[startLine],
        endLine: block[endLine],
      });
    }
    // Ranges are well-formed (start no later than end).
    for (const range of ranges) {
      expect(range.startLine).toBeLessThanOrEqual(range.endLine);
    }
  });

  it("recurses into nested sections", () => {
    const [document] = compile(
      [
        "# Parent",
        "",
        "{#1}",
        "Top.",
        "",
        "## Child",
        "",
        "{#2}",
        "Nested.",
        "",
      ].join("\n"),
    );

    const ranges = planFoldingRanges(document);
    const child = document.children[0]!;
    expect(ranges).toContainEqual({
      startLine: child[startLine],
      endLine: child[endLine],
    });
  });
});
