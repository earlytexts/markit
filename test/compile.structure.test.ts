import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import { markit } from "./utils/factories.ts";

describe("document tree", () => {
  it("parses the document tree and text IDs", () => {
    const { document, errors } = compile(
      markit(
        "# Test.Document",
        "",
        "## Child1",
        "",
        "{#1}",
        "Child 1 content.",
        "",
        "## Child2",
        "",
        "{#1}",
        "Child 2 content.",
        "",
        "### Grandchild",
        "",
        "{#1}",
        "Grandchild content.",
      ),
    );

    expect(errors).toHaveLength(0);

    expect(document.id).toBe("Test.Document");
    expect(document.children).toHaveLength(2);

    const child1 = document.children[0]!;
    expect(child1.id).toBe("Test.Document.Child1");
    expect(child1.children).toHaveLength(0);

    const child2 = document.children[1]!;
    expect(child2.id).toBe("Test.Document.Child2");
    expect(child2.children).toHaveLength(1);

    const grandchild = child2.children[0]!;
    expect(grandchild.id).toBe("Test.Document.Child2.Grandchild");
    expect(grandchild.children).toHaveLength(0);
  });

  it("parses a text with only an ID block and no metadata or content", () => {
    const { document, errors } = compile(markit("# Text.Only"));

    expect(errors).toHaveLength(0);
    expect(document.id).toBe("Text.Only");
    expect(document.blocks).toHaveLength(0);
    expect(document.children).toHaveLength(0);
  });
});

describe("document headers", () => {
  it("returns empty document and error for empty document", () => {
    const { errors } = compile("");

    expect(errors[0]).toMatchObject({
      message: "Document is empty",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      severity: "error",
    });
  });

  it("returns error for document with no root ID block", () => {
    const { errors } = compile(markit("{#0}", "Text", ""));

    expect(errors[0]).toMatchObject({
      message: "Document must begin with a level 1 header (e.g. # Document.Id)",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 5,
      severity: "error",
    });
  });

  it("returns error for document with non-level-1 root header", () => {
    const { errors } = compile(markit("## Markit.Errors"));

    expect(errors[0]).toMatchObject({
      message: "Expected level 1 header but found level 2",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 17,
      severity: "error",
    });
  });

  it("returns error for document with level jump", () => {
    const { errors } = compile(
      markit("# Markit.Errors", "", "## BadTextMetadata", "", "#### TooDeep"),
    );

    expect(errors[0]).toMatchObject({
      message:
        "Level 4 header cannot follow level 2 header without an intermediate level",
      line: 5,
      column: 1,
      endLine: 5,
      endColumn: 13,
      severity: "error",
    });
  });
});
