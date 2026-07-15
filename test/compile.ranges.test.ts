import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile, { compileWithPositions } from "../src/compile.ts";
import {
  markit,
  markitWithContent,
  markitWithMetadata,
} from "./utils/factories.ts";

// Node-level source ranges are whole-line and end-exclusive: a node spanning
// source lines 2-3 has source { start: { line: 2, column: 0 }, end: { line: 4,
// column: 0 } }. They are populated by compileWithPositions only.
const lines = (start: number, end: number) => ({
  start: { line: start, column: 0 },
  end: { line: end + 1, column: 0 },
});

describe("plain compile carries no source ranges", () => {
  it("omits source and metadataSource everywhere", () => {
    const { document } = compile(
      markit(
        "# Text",
        "",
        "[metadata]",
        'key = "value"',
        "",
        "{#1, type=prose}",
        "Content.",
      ),
    );

    expect(document.source).toBeUndefined();
    expect(document.metadataSource).toBeUndefined();
    expect(document.blocks[0]!.source).toBeUndefined();
    expect(document.blocks[0]!.metadataSource).toBeUndefined();
  });

  it("survives JSON round-tripping without loss", () => {
    const { document } = compile(markitWithContent("{#1}", "Content."));

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });
});

describe("text ranges", () => {
  it("records source for a text with no children", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: Content.
    const { document } = compileWithPositions(
      markitWithContent("{#1}", "Content."),
    );

    expect(document.source).toEqual(lines(0, 3));
  });

  it("extends parent source to cover its children", () => {
    // line 0: # Root
    // line 1: (blank)
    // line 2: ## Child
    // line 3: (blank)
    // line 4: {#1}
    // line 5: Content.
    const { document } = compileWithPositions(
      markit("# Root", "", "## Child", "", "{#1}", "Content."),
    );

    expect(document.children[0]!.source).toEqual(lines(2, 5));
    expect(document.source).toEqual(lines(0, 5));
  });

  it("gives the empty document an empty source range", () => {
    const { document } = compileWithPositions("");

    expect(document.source).toEqual({
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    });
  });
});

describe("metadata block ranges", () => {
  it("records metadataSource for a single metadata block", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: [metadata]
    // line 3: key = value
    // line 4: (blank)
    // line 5: {#0}
    // line 6: Title
    const { document } = compileWithPositions(
      markitWithMetadata('key = "value"'),
    );

    expect(document.metadataSource).toEqual({ source: lines(2, 3) });
  });

  it("spans all blocks and keys nested sub-block ranges", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: [metadata]
    // line 3: key1 = "a"
    // line 4: (blank)
    // line 5: [metadata.sub]
    // line 6: key2 = "b"
    // line 7: (blank)
    // line 8: {#0}
    // line 9: Title
    const { document } = compileWithPositions(
      markit(
        "# Text",
        "",
        "[metadata]",
        'key1 = "a"',
        "",
        "[metadata.sub]",
        'key2 = "b"',
        "",
        "{#0}",
        "Title",
      ),
    );

    expect(document.metadataSource).toEqual({
      source: lines(2, 6),
      nested: { sub: lines(5, 6) },
    });
    expect(document.metadata).toEqual({ key1: "a", sub: { key2: "b" } });
  });

  it("tracks metadata ranges for child documents independently", () => {
    // line 0: # Root
    // line 1: (blank)
    // line 2: ## Child
    // line 3: (blank)
    // line 4: [metadata]
    // line 5: key = "val"
    const { document } = compileWithPositions(
      markit("# Root", "", "## Child", "", "[metadata]", 'key = "val"'),
    );

    expect(document.metadata).toBeUndefined();
    expect(document.metadataSource).toBeUndefined();

    const child = document.children[0]!;
    expect(child.metadataSource).toEqual({ source: lines(4, 5) });
  });

  it("records metadataSource for block tag metadata on its tag line", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1, type=prose}
    // line 3: Content.
    const { document } = compileWithPositions(
      markitWithContent("{#1, type=prose}", "Content."),
    );

    expect(document.blocks[0]!.metadataSource).toEqual({
      source: lines(2, 2),
    });
    expect(document.blocks[0]!.metadata).toEqual({ type: "prose" });
  });

  it("omits metadataSource when a block has no metadata", () => {
    const { document } = compileWithPositions(
      markitWithContent("{#1}", "Content."),
    );

    expect(document.blocks[0]!.metadata).toBeUndefined();
    expect(document.blocks[0]!.metadataSource).toBeUndefined();
  });
});

describe("content block ranges", () => {
  it("records source for a single block", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: Content.
    const { document } = compileWithPositions(
      markitWithContent("{#1}", "Content."),
    );

    expect(document.blocks[0]!.source).toEqual(lines(2, 3));
  });

  it("records independent ranges for multiple blocks", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: First.
    // line 4: (blank)
    // line 5: {#2}
    // line 6: Second.
    const { document } = compileWithPositions(
      markitWithContent("{#1}", "First.", "", "{#2}", "Second."),
    );

    expect(document.blocks[0]!.source).toEqual(lines(2, 3));
    expect(document.blocks[1]!.source).toEqual(lines(5, 6));
  });

  it("extends source to the last paragraph in a multi-paragraph block", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: Paragraph 1.
    // line 4: (blank, inside content block)
    // line 5: Paragraph 2.
    const { document } = compileWithPositions(
      markitWithContent("{#1}", "Paragraph 1.", "", "Paragraph 2."),
    );

    expect(document.blocks[0]!.source).toEqual(lines(2, 5));
  });
});
