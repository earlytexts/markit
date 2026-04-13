import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("blocks", () => {
  it("parses blocks with their ids", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#0}",
        "This is the first block.",
        "",
        "{#1}",
        "This is the second block.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks).toHaveLength(2);
    expect(document.blocks[0]!.id).toBe("0");
    expect(document.blocks[1]!.id).toBe("1");
  });

  it("parses block tags on the same line as content", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#0} This is the first block.",
        "",
        "{#1} This is the second block.",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks).toHaveLength(2);
    expect(document.blocks[0]!.id).toBe("0");
    expect(document.blocks[1]!.id).toBe("1");
  });

  it("parses block metadata", () => {
    const [document, errors] = compile(
      markitWithContent("{#1, pages=12-15, subsection=3, speaker=John Smith}"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]).toEqual(
      expect.objectContaining({
        pages: "12-15",
        subsection: "3",
        speaker: "John Smith",
      }),
    );
  });
});

describe("block errors", () => {
  it("returns error for block with no tag", () => {
    const [, errors] = compile(
      markit("# Text", "", "This block has no tag.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Block is missing metadata tag '{#id}'",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 23,
      severity: "error",
    });
  });

  it("returns error for block with unclosed tag", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1", "This block has a badly formed tag.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Block tag is not properly closed with '}'",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 4,
      severity: "error",
    });
  });

  it("returns error for block with badly formed metadata", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        '{#2, nothing, string: "hello"}',
        "This block has badly formed metadata.",
        "",
      ),
    );

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 13,
      severity: "error",
    });
    expect(errors[1]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 15,
      endLine: 3,
      endColumn: 30,
      severity: "error",
    });
  });

  it("returns error for block with invalid metadata key", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#1, foo=bar}",
        "This block has an invalid metadata key.",
        "",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Block tag key 'foo' is not a valid metadata key (valid keys: pages, subsection, speaker)",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 9,
      severity: "error",
    });
  });

  it("returns error for block with empty metadata value", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1, speaker=}", "Block content.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Invalid block metadata, expected 'key=value'",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 14,
      severity: "error",
    });
  });

  it("returns error for block with duplicate ID", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#2}",
        "First block with ID 2.",
        "",
        "{#2}",
        "This block has the same ID as a previous block.",
        "",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Duplicate block ID: #2",
      line: 6,
      column: 1,
      endLine: 6,
      endColumn: 5,
      severity: "error",
    });
  });

  it("returns error for invalid block tag key 'id'", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1, id=custom}", "Block content.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Block tag key 'id' is not a valid metadata key (valid keys: pages, subsection, speaker)",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 8,
      severity: "error",
    });
  });

  it("returns error for invalid block tag key 'content'", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1, content=x}", "Block content.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Block tag key 'content' is not a valid metadata key (valid keys: pages, subsection, speaker)",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 13,
      severity: "error",
    });
  });

  it("returns error for block ID with invalid characters", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#id#bad}", "Block content.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Block ID 'id#bad' contains invalid characters (IDs may not contain whitespace, '#', '{', or '}')",
      line: 3,
      column: 3,
      endLine: 3,
      endColumn: 9,
      severity: "error",
    });
  });

  it("returns error for block ID of just 'n'", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#n}", "Block content.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Block ID 'n' is not a valid footnote ID (footnote IDs must start with 'n' followed by at least one character)",
      line: 3,
      column: 3,
      endLine: 3,
      endColumn: 4,
      severity: "error",
    });
  });

  it("returns error for footnote block appearing before a regular block", () => {
    const [, errors] = compile(
      markit(
        "# Text",
        "",
        "{#n1}",
        "Footnote content.",
        "",
        "{#1}",
        "Regular block after footnote.",
        "",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Footnote blocks must appear after all paragraph blocks",
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 6,
      severity: "error",
    });
  });

  it("returns error for invalid block tag key 'type'", () => {
    const [, errors] = compile(
      markit("# Text", "", "{#1, type=paragraph}", "Block content.", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message:
        "Block tag key 'type' is not a valid metadata key (valid keys: pages, subsection, speaker)",
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 10,
      severity: "error",
    });
  });
});

describe("title blocks", () => {
  it("assigns type 'title' to title blocks", () => {
    const [document, errors] = compile(
      markitWithContent("{#title}", "Main Title"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.id).toBe("title");
    expect(document.blocks[0]!.type).toBe("title");
  });

  it("returns error if more than one title block", () => {
    const [, errors] = compile(
      markitWithContent("{#title}", "Title 1", "", "{#title}", "Title 2", ""),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Only one title block is allowed per text");
  });

  it("returns error if title block is not the first block", () => {
    const [, errors] = compile(
      markitWithContent(
        "{#1}",
        "Paragraph first",
        "",
        "{#title}",
        "Too late",
        "",
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe(
      "Title block must be the first block in the text",
    );
  });
});

describe("subtitle blocks", () => {
  it("assigns type 'subtitle' to subtitle blocks", () => {
    const [document, errors] = compile(
      markitWithContent("{#subtitle}", "Subtitle"),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.type).toBe("subtitle");
  });

  it("auto-numbers subtitle blocks in compiled output", () => {
    const [document, errors] = compile(
      markitWithContent(
        "{#subtitle}",
        "Sub 1",
        "",
        "{#subtitle}",
        "Sub 2",
        "",
        "{#subtitle}",
        "Sub 3",
        "",
      ),
    );

    expect(errors).toHaveLength(0);
    expect(document.blocks[0]!.id).toBe("subtitle1");
    expect(document.blocks[1]!.id).toBe("subtitle2");
    expect(document.blocks[2]!.id).toBe("subtitle3");
  });

  it("allows multiple subtitle blocks without error", () => {
    const [, errors] = compile(
      markitWithContent("{#subtitle}", "Sub 1", "", "{#subtitle}", "Sub 2", ""),
    );

    expect(errors).toHaveLength(0);
  });
});

describe("block types", () => {
  it("assigns type 'paragraph' to regular blocks", () => {
    const [document] = compile(markitWithContent("{#1}", "Content"));

    expect(document.blocks[0]!.type).toBe("paragraph");
  });

  it("assigns type 'footnote' to footnote blocks", () => {
    const [document] = compile(markitWithContent("{#n1}", "Footnote"));

    expect(document.blocks[0]!.type).toBe("footnote");
  });
});
