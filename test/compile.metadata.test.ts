import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import { markit, markitWithMetadata } from "./utils/factories.ts";

describe("null case", () => {
  it("returns no metadata for a document with no metadata blocks", () => {
    const [document] = compile(markit("# Text", "", "{#0}", "Content"));

    expect(document.metadata).toBeUndefined();
  });
});

describe("boolean values", () => {
  it("parses boolean metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata("metadataBoolean1 = true", "metadataBoolean2 = false"),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        metadataBoolean1: true,
        metadataBoolean2: false,
      }),
    );
  });
});

describe("numeric values", () => {
  it("parses numeric metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata("metadataNumber = 42"),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        metadataNumber: 42,
      }),
    );
  });

  it("parses negative number metadata", () => {
    const [document, errors] = compile(markitWithMetadata("offset = -1"));

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(expect.objectContaining({ offset: -1 }));
  });
});

describe("string values", () => {
  it("parses string metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata('metadataString = "the answer"'),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        metadataString: "the answer",
      }),
    );
  });

  it("handles escaped quotes in string metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata('metadataString = "She said \\"hello\\"."'),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        metadataString: 'She said "hello".',
      }),
    );
  });
});

describe("inline arrays", () => {
  it("parses inline array metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata(
        "metadataBooleanArray = [true, false]",
        "metadataNumberArray = [1, 2, 3]",
        'metadataStringArray = ["a", "b", "c"]',
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        metadataBooleanArray: [true, false],
        metadataNumberArray: [1, 2, 3],
        metadataStringArray: ["a", "b", "c"],
      }),
    );
  });

  it("returns error for mixed-type inline arrays", () => {
    const [, errors] = compile(
      markitWithMetadata('mixedInlineArray = [true, 1, "a"]'),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message:
        "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 34,
      severity: "error",
    });
  });
});

describe("multiline arrays", () => {
  it("parses multiline array metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata(
        "metadataBooleanArray = [",
        "    true,",
        "    false,",
        "]",
        "metadataNumberArray = [",
        "    1,",
        "    2,",
        "    3,",
        "]",
        "metadataStringArray = [",
        '    "a",',
        '    "b",',
        '    "c",',
        "]",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        metadataBooleanArray: [true, false],
        metadataNumberArray: [1, 2, 3],
        metadataStringArray: ["a", "b", "c"],
      }),
    );
  });

  it("parses multiline arrays followed by other metadata", () => {
    const [document, errors] = compile(
      markitWithMetadata(
        "arrayKey = [",
        "    1,",
        "    2,",
        "]",
        "otherKey = true",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        arrayKey: [1, 2],
        otherKey: true,
      }),
    );
  });

  it("returns error for mixed-type multiline arrays", () => {
    const [, errors] = compile(
      markitWithMetadata(
        "mixedArray = [",
        "    true,",
        "    1,",
        '    "a",',
        "]",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message:
        "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 15,
      severity: "error",
    });
  });

  it("returns error for invalid values in multiline arrays", () => {
    const [, errors] = compile(
      markitWithMetadata("badArray = [", "    troo,", '    "unclosed,', "]"),
    );

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      message: "Invalid metadata value: troo",
      line: 5,
      column: 5,
      endLine: 5,
      endColumn: 9,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "unclosed',
      line: 6,
      column: 5,
      endLine: 6,
      endColumn: 14,
      severity: "error",
    });
  });

  it("returns error for null in multiline array", () => {
    const [, errors] = compile(markitWithMetadata("arr = [", "    null,", "]"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Invalid metadata value: null",
      line: 5,
      column: 5,
      endLine: 5,
      endColumn: 9,
      severity: "error",
    });
  });

  it("returns error for empty multiline arrays", () => {
    const [, errors] = compile(markitWithMetadata("emptyArray = [", "]"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Multiline array must have at least one item",
      line: 4,
      column: 1,
      endLine: 4,
      endColumn: 15,
      severity: "error",
    });
  });
});

describe("nested tables", () => {
  it("parses nested metadata tables", () => {
    const [document, errors] = compile(
      markit(
        "# Text",
        "",
        "[metadata]",
        'title = "The Full Title"',
        "",
        "[metadata.links]",
        'googleBooks = "https://books.google.com/"',
        'wikipedia = "https://en.wikipedia.org/"',
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        title: "The Full Title",
        links: expect.objectContaining({
          googleBooks: "https://books.google.com/",
          wikipedia: "https://en.wikipedia.org/",
        }),
      }),
    );
  });

  it("parses nested metadata tables without blank line between blocks", () => {
    const [document, errors] = compile(
      markit(
        "# Text",
        "",
        "[metadata]",
        'title = "The Full Title"',
        "[metadata.links]",
        'googleBooks = "https://books.google.com/"',
        'wikipedia = "https://en.wikipedia.org/"',
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        title: "The Full Title",
        links: expect.objectContaining({
          googleBooks: "https://books.google.com/",
          wikipedia: "https://en.wikipedia.org/",
        }),
      }),
    );
  });

  it("parses [metadata.subkey] without a top-level [metadata] block", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "[metadata.links]",
        'googleBooks = "https://books.google.com/"',
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain(
      "Nested metadata block '[metadata.links]' must appear after the top-level '[metadata]' block",
    );
  });
});

describe("metadata headers", () => {
  it("parses metadata without blank line after text ID", () => {
    const [document, errors] = compile(
      markit(
        "# Text",
        "[metadata]",
        'title = "Hello"',
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toEqual(
      expect.objectContaining({
        title: "Hello",
      }),
    );
  });

  it("omits metadata key when no metadata block is present", () => {
    const [document, errors] = compile(
      markit("# Text", "", "{#0}", "Title", ""),
    );

    expect(errors).toHaveLength(0);
    expect(document.metadata).toBeUndefined();
  });

  it("reports error for invalid bracket header without blank line", () => {
    const [document, errors] = compile(
      markit(
        "# Text",
        "[incorrect]",
        'title = "Hello"',
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("Invalid metadata header");
    expect(document.metadata).toBeDefined();
    expect(Object.keys(document.metadata!)).toHaveLength(0);
  });

  it("returns error for unrecognized metadata header", () => {
    const [, errors] = compile(
      markit("# Text", "", "[foo]", 'key = "value"', "", "{#0}", "Title", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("Invalid metadata header '[foo]'");
  });
});

describe("child texts", () => {
  it("parses metadata from child texts", () => {
    const [document, errors] = compile(
      markit(
        "# Text",
        "",
        "## ChildText",
        "",
        "[metadata]",
        'note = "Child texts can contain metadata too."',
      ),
    );

    expect(errors).toHaveLength(0);
    const section1 = document.children[0]!;
    expect(section1.metadata).toEqual(
      expect.objectContaining({
        note: "Child texts can contain metadata too.",
      }),
    );
  });
});

describe("general errors", () => {
  it("returns error for invalid metadata values", () => {
    const [, errors] = compile(
      markitWithMetadata("badBoolean = troo", 'badString = "no closing quote'),
    );

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      message: "Invalid metadata value: troo",
      line: 4,
      column: 14,
      endLine: 4,
      endColumn: 18,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: 'Invalid metadata value: "no closing quote',
      line: 5,
      column: 13,
      endLine: 5,
      endColumn: 30,
      severity: "error",
    });
  });

  it("returns error for null as inline metadata value", () => {
    const [, errors] = compile(markitWithMetadata("key = null"));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Invalid metadata value: null",
      line: 4,
      column: 7,
      endLine: 4,
      endColumn: 11,
      severity: "error",
    });
  });

  it("returns error for badly formatted metadata lines", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "[metadata]",
        "validKey = true",
        "this is not okay",
        "",
        "{#0}",
        "Title",
        "",
      ),
    );

    expect(errors[0]).toMatchObject({
      message: "Invalid metadata line, expected 'key = value'",
      line: 5,
      column: 1,
      endLine: 5,
      endColumn: 17,
      severity: "error",
    });
  });
});
