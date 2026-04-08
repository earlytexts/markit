import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { endLine, startLine } from "../src/types.js";
import { markit } from "./utils/factories.js";

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
