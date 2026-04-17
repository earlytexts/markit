import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { endLine, startLine } from "../src/types.js";
import {
  markit,
  markitWithContent,
  markitWithMetadata,
} from "./utils/factories.js";

describe("text ranges", () => {
  it("records startLine and endLine for a text with no children", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: Content.
    const [document] = compile(markitWithContent("{#1}", "Content."));

    expect(document[startLine]).toBe(0);
    expect(document[endLine]).toBe(3);
  });

  it("extends parent endLine to cover its children", () => {
    // line 0: # Root
    // line 1: (blank)
    // line 2: ## Child
    // line 3: (blank)
    // line 4: {#1}
    // line 5: Content.
    const [document] = compile(
      markit("# Root", "", "## Child", "", "{#1}", "Content."),
    );

    const child = document.children[0]!;
    expect(child[startLine]).toBe(2);
    expect(child[endLine]).toBe(5);

    expect(document[startLine]).toBe(0);
    expect(document[endLine]).toBe(5);
  });
});

describe("metadata block ranges", () => {
  it("returns [startLine] and [endLine] on metadata for a single metadata block", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: [metadata]
    // line 3: key = value
    // line 4: (blank)
    // line 5: {#0}
    // line 6: Title
    const [document] = compile(markitWithMetadata('key = "value"'));

    expect(document.metadata![startLine]).toBe(2);
    expect(document.metadata![endLine]).toBe(3);
  });

  it("spans all blocks and attaches sub-ranges for multiple metadata blocks", () => {
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
    const [document] = compile(
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

    expect(document.metadata![startLine]).toBe(2);
    expect(document.metadata![endLine]).toBe(6);

    const sub = document.metadata!["sub"] as {
      [startLine]: number;
      [endLine]: number;
    };
    expect(sub[startLine]).toBe(5);
    expect(sub[endLine]).toBe(6);
  });

  it("tracks metadata ranges for child documents independently", () => {
    // line 0: # Root
    // line 1: (blank)
    // line 2: ## Child
    // line 3: (blank)
    // line 4: [metadata]
    // line 5: key = "val"
    const [document] = compile(
      markit("# Root", "", "## Child", "", "[metadata]", 'key = "val"'),
    );

    expect(document.metadata).toBeUndefined();

    const child = document.children[0]!;
    expect(child.metadata![startLine]).toBe(4);
    expect(child.metadata![endLine]).toBe(5);
  });
});

describe("content block ranges", () => {
  it("records startLine and endLine for a single block", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: Content.
    const [document] = compile(markitWithContent("{#1}", "Content."));

    expect(document.blocks[0]![startLine]).toBe(2);
    expect(document.blocks[0]![endLine]).toBe(3);
  });

  it("records independent ranges for multiple blocks", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: First.
    // line 4: (blank)
    // line 5: {#2}
    // line 6: Second.
    const [document] = compile(
      markitWithContent("{#1}", "First.", "", "{#2}", "Second."),
    );

    expect(document.blocks[0]![startLine]).toBe(2);
    expect(document.blocks[0]![endLine]).toBe(3);
    expect(document.blocks[1]![startLine]).toBe(5);
    expect(document.blocks[1]![endLine]).toBe(6);
  });

  it("extends endLine to the last paragraph in a multi-paragraph block", () => {
    // line 0: # Text
    // line 1: (blank)
    // line 2: {#1}
    // line 3: Paragraph 1.
    // line 4: (blank, inside content block)
    // line 5: Paragraph 2.
    const [document] = compile(
      markitWithContent("{#1}", "Paragraph 1.", "", "Paragraph 2."),
    );

    expect(document.blocks[0]![startLine]).toBe(2);
    expect(document.blocks[0]![endLine]).toBe(5);
  });
});
