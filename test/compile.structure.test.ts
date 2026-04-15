import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { endLine, startLine } from "../src/types.js";
import { markit, markitWithMetadata } from "./utils/factories.js";

describe("document structure", () => {
  it("parses the document tree and text IDs, with correct line numbers for folding", () => {
    const [document, errors] = compile(
      markit(
        "# Test.Document", // line 0
        "",
        "## Test.Document.Child1", // line 2
        "",
        "{#1}",
        "Child 1 content.",
        "",
        "## Test.Document.Child2", // line 7
        "",
        "{#1}",
        "Child 2 content.",
        "",
        "### Test.Document.Child2.Grandchild", // line 12
        "",
        "{#1}",
        "Grandchild content.", // line 15
      ),
    );

    expect(errors).toHaveLength(0);

    expect(document.id).toBe("Test.Document");
    expect(document.children).toHaveLength(2);
    expect(document[startLine]).toBe(0);
    expect(document[endLine]).toBe(15);

    const child1 = document.children[0]!;
    expect(child1.id).toBe("Test.Document.Child1");
    expect(child1.children).toHaveLength(0);
    expect(child1[startLine]).toBe(2);
    expect(child1[endLine]).toBe(5);

    const child2 = document.children[1]!;
    expect(child2.id).toBe("Test.Document.Child2");
    expect(child2.children).toHaveLength(1);
    expect(child2[startLine]).toBe(7);
    expect(child2[endLine]).toBe(15);

    const grandchild = child2.children[0]!;
    expect(grandchild.id).toBe("Test.Document.Child2.Grandchild");
    expect(grandchild.children).toHaveLength(0);
    expect(grandchild[startLine]).toBe(12);
    expect(grandchild[endLine]).toBe(15);
  });

  it("parses a text with only an ID block and no metadata or content", () => {
    const [document, errors] = compile(markit("# Text.Only"));

    expect(errors).toHaveLength(0);
    expect(document.id).toBe("Text.Only");
    expect(document.blocks).toHaveLength(0);
    expect(document.children).toHaveLength(0);
  });
});

describe("metadata block ranges", () => {
  it("returns no metadata for a document with no metadata blocks", () => {
    const [document] = compile(markit("# Text", "", "{#0}", "Content"));

    expect(document.metadata).toBeUndefined();
  });

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
    // line 2: ## Root.Child
    // line 3: (blank)
    // line 4: [metadata]
    // line 5: key = "val"
    const [document] = compile(
      markit("# Root", "", "## Root.Child", "", "[metadata]", 'key = "val"'),
    );

    expect(document.metadata).toBeUndefined();

    const child = document.children[0]!;
    expect(child.metadata![startLine]).toBe(4);
    expect(child.metadata![endLine]).toBe(5);
  });
});

describe("document structure errors", () => {
  it("returns empty document and error for empty document", () => {
    const [, errors] = compile("");

    expect(errors[0]).toEqual({
      message: "Document is empty",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      severity: "error",
    });
  });

  it("returns error for document with no root ID block", () => {
    const [, errors] = compile(markit("{#0}", "Text", ""));

    expect(errors[0]).toEqual({
      message: "Document must begin with a level 1 header (e.g. # Document.Id)",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 5,
      severity: "error",
    });
  });

  it("returns error for document with non-level-1 root header", () => {
    const [, errors] = compile(markit("## Markit.Errors"));

    expect(errors[0]).toEqual({
      message: "Expected level 1 header but found level 2",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 17,
      severity: "error",
    });
  });

  it("returns error for document with level jump", () => {
    const [, errors] = compile(
      markit(
        "# Markit.Errors",
        "",
        "## Markit.Errors.BadTextMetadata",
        "",
        "#### Markit.Errors.BadTextMetadata.TooDeep",
      ),
    );

    expect(errors[0]).toEqual({
      message:
        "Level 4 header cannot follow level 2 header without an intermediate level",
      line: 5,
      column: 1,
      endLine: 5,
      endColumn: 43,
      severity: "error",
    });
  });
});
