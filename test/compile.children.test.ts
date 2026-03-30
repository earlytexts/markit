import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit } from "./utils/factories.js";
import { createMockFileLoader } from "./utils/mocks.js";

describe("external children", () => {
  it("loads external children from children metadata", () => {
    const files = {
      "/parent.mit": markit(
        "# Parent",
        "",
        'children: ["child1.mit", "child2.mit"]',
        "",
        "{#1} Parent content.",
      ),
      "/child1.mit": markit("# Child1", "", "{#1} Child 1 content."),
      "/child2.mit": markit("# Child2", "", "{#1} Child 2 content."),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.id).toBe("Parent");
    expect(document.children).toHaveLength(2);
    expect(document.children[0]!.id).toBe("Child1");
    expect(document.children[1]!.id).toBe("Child2");
  });

  it("orders inline children first, then external children", () => {
    const files = {
      "/parent.mit": markit(
        "# Parent",
        "",
        'children: ["external.mit"]',
        "",
        "{#1} Parent content.",
        "",
        "## Inline.Child",
        "",
        "{#1} Inline child content.",
      ),
      "/external.mit": markit(
        "# External.Child",
        "",
        "{#1} External child content.",
      ),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(2);
    expect(document.children[0]!.id).toBe("Inline.Child");
    expect(document.children[1]!.id).toBe("External.Child");
  });

  it("resolves paths without .mit extension", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["child"]'),
      "/child.mit": markit("# Child", "", "{#1} Child content."),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(1);
    expect(document.children[0]!.id).toBe("Child");
  });

  it("tries path as-is first, then with .mit extension", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["child.txt"]'),
      "/child.txt": markit("# Child", "", "{#1} Child content."),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(1);
    expect(document.children[0]!.id).toBe("Child");
  });

  it("recursively loads nested external children", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["child.mit"]'),
      "/child.mit": markit("# Child", "", 'children: ["grandchild.mit"]'),
      "/grandchild.mit": markit("# Grandchild", "", "{#1} Content."),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(1);
    expect(document.children[0]!.id).toBe("Child");
    expect(document.children[0]!.children).toHaveLength(1);
    expect(document.children[0]!.children[0]!.id).toBe("Grandchild");
  });

  it("resolves paths correctly when parent has no directory component", () => {
    const files = {
      "parent.mit": markit("# Parent", "", 'children: ["child.mit"]'),
      "child.mit": markit("# Child", "", "{#1} Content."),
    };

    const [document, errors] = compile(files["parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(1);
    expect(document.children[0]!.id).toBe("Child");
  });

  it("handles path that already has .mit extension", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["child.mit.mit"]'),
      "/child.mit.mit": markit("# Child", "", "{#1} Content."),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(1);
    expect(document.children[0]!.id).toBe("Child");
  });

  it("handles absolute paths in children metadata", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["/child.mit"]'),
      "/child.mit": markit("# Child", "", "{#1} Content."),
    };

    const [document, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(0);
    expect(document.children).toHaveLength(1);
    expect(document.children[0]!.id).toBe("Child");
  });
});

describe("external children errors", () => {
  const options = {
    loadFile: createMockFileLoader({}),
    currentFilePath: "/parent.mit",
  };

  it("returns error for non-array children metadata", () => {
    const [, errors] = compile(
      markit("# Text", "", 'children: "not-array"'),
      options,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "The 'children' metadata field must be an array of strings (file paths)",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 9,
      severity: "error",
    });
  });

  it("returns error for children metadata with non-string values", () => {
    const [, errors] = compile(markit("# Text", "", "children: [1]"), options);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Each item in 'children' metadata array must be a string (file path)",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 13,
      severity: "error",
    });
  });

  it("returns error for missing external child file", () => {
    const files = {
      "/parent.mit": markit(
        "# Parent",
        "",
        'children: ["missing.mit"]',
        "",
        "{#1} Content.",
      ),
    };

    const [, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Cannot load external child: missing.mit",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 25,
      severity: "error",
    });
  });

  it("returns error for circular dependencies", () => {
    const files = {
      "/a.mit": markit("# A", "", 'children: ["b.mit"]'),
      "/b.mit": markit("# B", "", 'children: ["a.mit"]'),
    };

    const [, errors] = compile(files["/a.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/a.mit",
    });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      message: "Circular dependency detected",
      file: "b.mit",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 19,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: "External child 'b.mit' has errors",
      severity: "warning",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 19,
    });
  });

  it("returns error for deep circular dependencies (A→B→C→A)", () => {
    const files = {
      "/a.mit": markit("# A", "", 'children: ["b.mit"]'),
      "/b.mit": markit("# B", "", 'children: ["c.mit"]'),
      "/c.mit": markit("# C", "", 'children: ["a.mit"]'),
    };

    const [, errors] = compile(files["/a.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/a.mit",
    });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      message: "Circular dependency detected",
      file: "b.mit",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 19,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: "External child 'b.mit' has errors",
      severity: "warning",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 19,
    });
  });

  it("returns errors from external children with file context", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["child.mit"]'),
      "/child.mit": markit(
        "# Child",
        "",
        "{#1}",
        "Invalid *unclosed formatting",
      ),
    };

    const [, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    const childErrors = errors.filter((e) => e.file === "child.mit");
    expect(childErrors).toHaveLength(1);
    expect(childErrors[0]).toEqual({
      message: "Unclosed formatting: *",
      file: "child.mit",
      line: 4,
      column: 9,
      endLine: 4,
      endColumn: 10,
      severity: "error",
    });
  });

  it("returns warning in parent when external child has errors", () => {
    const files = {
      "/parent.mit": markit("# Parent", "", 'children: ["child.mit"]'),
      "/child.mit": markit(
        "# Child",
        "",
        "{#1}",
        "Invalid *unclosed formatting",
      ),
    };

    const [, errors] = compile(files["/parent.mit"]!, {
      loadFile: createMockFileLoader(files),
      currentFilePath: "/parent.mit",
    });

    expect(errors).toHaveLength(2);
    const warning = errors.find((e) => e.severity === "warning");
    expect(warning).toEqual({
      message: "External child 'child.mit' has errors",
      severity: "warning",
      line: 3,
      column: 12,
      endLine: 3,
      endColumn: 23,
    });
  });

  it("returns error when external children specified but no file loader provided", () => {
    const [, errors] = compile(markit("# Text", "", 'children: ["file.mit"]'));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Cannot load external children: no file loader provided to compile()",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 9,
      severity: "error",
    });
  });
});
