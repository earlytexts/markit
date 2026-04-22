import { describe, it, expect } from "vitest";
import formatDocument from "../src/format.js";
import {
  markit,
  markitWithId,
  markitWithMetadata,
  markitWithContent,
} from "./utils/factories.js";

describe("formatter", () => {
  describe("blank line normalization", () => {
    it("collapses multiple blank lines to one", () => {
      const input = markit("# mytext", "", "", "", "{#1}", "Content", "");
      const result = formatDocument(input);
      expect(result).toBe(markit("# mytext", "", "{#1}", "Content", ""));
    });

    it("removes leading blank lines", () => {
      const input = markit("", "", "", "# mytext", "", "{#1}", "Content", "");
      const result = formatDocument(input);
      expect(result).toBe(markit("# mytext", "", "{#1}", "Content", ""));
    });

    it("removes excess trailing blank lines", () => {
      const input = markit("# mytext", "", "{#1}", "Content", "", "", "", "");
      const result = formatDocument(input);
      expect(result).toBe(markit("# mytext", "", "{#1}", "Content", ""));
    });

    it("adds trailing newline if missing", () => {
      const input = markit("# mytext", "", "{#1}", "Content");
      const result = formatDocument(input);
      expect(result).toBe(markit("# mytext", "", "{#1}", "Content", ""));
    });

    it("ensures blank line after ID blocks", () => {
      const input = markit(
        "# parent",
        "[metadata]",
        "metadata = value",
        "",
        "{#1}",
        "Parent content",
        "",
        "## child",
        "{#1}",
        "Child content",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit(
          "# parent",
          "",
          "[metadata]",
          "metadata = value",
          "",
          "{#1}",
          "Parent content",
          "",
          "## child",
          "",
          "{#1}",
          "Child content",
          "",
        ),
      );
    });

    it("ensures blank line before children IDs", () => {
      const input = markit(
        "# parent",
        "",
        "{#1}",
        "Parent content",
        "## child",
        "",
        "{#1}",
        "Child content",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit(
          "# parent",
          "",
          "{#1}",
          "Parent content",
          "",
          "## child",
          "",
          "{#1}",
          "Child content",
          "",
        ),
      );
    });

    it("ensures blank line between metadata and first block tag", () => {
      const input = markit(
        "# mytext",
        "",
        "[metadata]",
        "metadata = value",
        "{#1}",
        "Content",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit(
          "# mytext",
          "",
          "[metadata]",
          "metadata = value",
          "",
          "{#1}",
          "Content",
          "",
        ),
      );
    });

    it("ensures blank line between metadata blocks", () => {
      const input = markit(
        "# mytext",
        "",
        "[metadata]",
        "title = value",
        "[metadata.links]",
        "url = value",
        "",
        "{#1}",
        "Content",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit(
          "# mytext",
          "",
          "[metadata]",
          "title = value",
          "",
          "[metadata.links]",
          "url = value",
          "",
          "{#1}",
          "Content",
          "",
        ),
      );
    });

    it("ensures blank line before block tags", () => {
      const input = markitWithContent(
        "{#1}",
        "Content",
        "{#2}",
        "More content",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "Content", "", "{#2}", "More content"),
      );
    });
  });

  describe("ID normalization", () => {
    it("removes surrounding whitespace from IDs", () => {
      const input = markitWithId("   # Text   ");
      const result = formatDocument(input);
      expect(result).toBe(markitWithId("# Text"));
    });

    it("collapses extra spaces inside IDs", () => {
      const input = markitWithId("#   Text");
      const result = formatDocument(input);
      expect(result).toBe(markitWithId("# Text"));
    });
  });

  describe("metadata normalization", () => {
    it("collapses extra spaces around equals sign", () => {
      const input = markitWithMetadata('title =   "Hello"');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title = "Hello"'));
    });

    it("adds spaces around equals sign if missing", () => {
      const input = markitWithMetadata('title="Hello"');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title = "Hello"'));
    });

    it("removes spaces before equals sign", () => {
      const input = markitWithMetadata('title  = "Hello"');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title = "Hello"'));
    });

    it("passes over metadata with no value", () => {
      const input = markitWithMetadata("draft =");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("removes trailing whitespace after values", () => {
      const input = markitWithMetadata('title = "Hello"   ');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title = "Hello"'));
    });

    it("normalizes spacing in multiline array key line", () => {
      const input = markitWithMetadata("tags=[", "    philosophy,", "]");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithMetadata("tags = [", "    philosophy,", "]"),
      );
    });

    it("preserves multiline array items as-is", () => {
      const input = markitWithMetadata(
        "tags = [",
        "    philosophy,",
        "    epistemology,",
        "]",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("passes through [metadata] header unchanged", () => {
      const input = markitWithMetadata('title = "Hello"');
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("does NOT normalize equals-like content in content blocks", () => {
      const input = markitWithContent("{#1}", "x = 1 is the solution.");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });
  });

  describe("block tag normalization", () => {
    it("removes surrounding whitespace from block tags", () => {
      const input = markitWithContent("   {#1}   ");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}"));
    });

    it("preserves well-formed block tags", () => {
      const input = markitWithContent("{#1}", "Content here");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Content here"));
    });

    it("normalizes spacing inside block tags", () => {
      const input = markitWithContent("{# 1 }", "Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Content"));
    });

    it("inserts newline between block tag and content if missing", () => {
      const input = markitWithContent("{#1} Content here");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Content here"));
    });

    it("normalizes extra space between tag and content", () => {
      const input = markitWithContent("{#1}    Content here");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Content here"));
    });

    it("leaves malformed block tag unchanged", () => {
      const input = markitWithContent("{#1 Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1 Content"));
    });
  });

  describe("block tag metadata normalization", () => {
    it("strips whitespace around the ID, commas, and =", () => {
      const input = markitWithContent(
        "{#1 ,  subsection = 4 , modified = true }",
        "Content.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1, subsection=4, modified=true}", "Content."),
      );
    });

    it("preserves whitespace inside string values", () => {
      const input = markitWithContent(
        '{#1, speaker = "Philo of  Alexandria"}',
        "Content.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent('{#1, speaker="Philo of  Alexandria"}', "Content."),
      );
    });

    it("preserves commas and braces inside string values", () => {
      const input = markitWithContent('{#1 , s = "a, b }"}', "Content.");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent('{#1, s="a, b }"}', "Content."));
    });

    it("normalizes spacing inside inline arrays", () => {
      const input = markitWithContent(
        '{#1, edits = [ "2014-10-12" ,   "2014-11-01" ]}',
        "Content.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          '{#1, edits=["2014-10-12", "2014-11-01"]}',
          "Content.",
        ),
      );
    });

    it("splits content after metadata onto its own line", () => {
      const input = markitWithContent("{#1, foo = 1}   Content after tag");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1, foo=1}", "Content after tag"),
      );
    });

    it("drops trailing commas", () => {
      const input = markitWithContent("{#1, foo=1,}", "Content.");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1, foo=1}", "Content."));
    });

    it("is idempotent on canonically formatted block metadata", () => {
      const input = markitWithContent(
        '{#1, subsection=4, speaker="Philo", edits=["2014-10-12", "2014-11-01"], modified=true}',
        "Content.",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("preserves an empty block tag", () => {
      const input = markitWithContent("{#}", "Content.");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#}", "Content."));
    });

    it("leaves a malformed pair unchanged inside the tag", () => {
      const input = markitWithContent("{#1, notvalid}", "Content.");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1, notvalid}", "Content."));
    });
  });

  describe("content white space normalization", () => {
    it("removes surrounding whitespace from content lines", () => {
      const input = markitWithContent("   Content with surrounding spaces   ");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("Content with surrounding spaces"));
    });

    it("removes trailing tabs", () => {
      const input = markitWithContent("Content\t");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("Content"));
    });

    it("collapses multiple spaces in content lines", () => {
      const input = markitWithContent("Content    with   extra spaces");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("Content with extra spaces"));
    });
  });

  describe("block content normalization", () => {
    it("preserves heading groups with no blank lines between lines", () => {
      const input = markitWithContent("{#0}", "^1 Title", "^2 Subtitle");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("preserves blank lines between separate heading groups", () => {
      const input = markitWithContent("{#0}", "^1 Title", "", "^2 Subtitle");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("preserves blockquote lines with > prefix", () => {
      const input = markitWithContent(
        "{#1}",
        "A paragraph.",
        "",
        "> A blockquote.",
        "",
        "More text.",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("collapses paragraphs into a single line", () => {
      const input = markitWithContent(
        "{#1}",
        "This is a paragraph",
        "that spans multiple lines.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "This is a paragraph that spans multiple lines.",
        ),
      );
    });

    it("preserves blank lines between paragraphs", () => {
      const input = markitWithContent(
        "{#1}",
        "First paragraph.",
        "",
        "Second paragraph.",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("collapses block quotations into a single line", () => {
      const input = markitWithContent(
        "{#1}",
        "> This is a block quote",
        "> that spans multiple lines.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "> This is a block quote that spans multiple lines.",
        ),
      );
    });

    it("preserves blank lines between paragraphs in block quotations", () => {
      const input = markitWithContent(
        "{#1}",
        "> First paragraph of block quote.",
        ">",
        "> Second paragraph of block quote.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "> First paragraph of block quote.",
          ">",
          "> Second paragraph of block quote.",
        ),
      );
    });

    it("strips leading and trailing blank lines from block quotations", () => {
      const input = markitWithContent(
        "{#1}",
        ">",
        "> This is a block quote.",
        ">",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "> This is a block quote."),
      );
    });

    it("collapses multiple blank lines in block quotations to a single blank line", () => {
      const input = markitWithContent(
        "{#1}",
        "> This is a block quote with two paragraphs.",
        ">",
        ">",
        "> But there's extra space in between them.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "> This is a block quote with two paragraphs.",
          ">",
          "> But there's extra space in between them.",
        ),
      );
    });

    it("adds blank lines between block-level elements in content", () => {
      const input = markitWithContent(
        "{#1}",
        "^1 Heading 1",
        "^2 Heading 2",
        "First paragraph.",
        "> A blockquote.",
        "More text.",
        "^3 Another heading",
        "Even more text.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "^1 Heading 1",
          "^2 Heading 2",
          "",
          "First paragraph.",
          "",
          "> A blockquote.",
          "",
          "More text.",
          "",
          "^3 Another heading",
          "",
          "Even more text.",
        ),
      );
    });

    it("adds blank lines between block-level elements in block quotations", () => {
      const input = markitWithContent(
        "{#1}",
        "> First paragraph.",
        "> Second paragraph.",
        "> Third paragraph.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "> First paragraph. Second paragraph. Third paragraph.",
        ),
      );
    });

    it("preserves verse lines", () => {
      const input = markitWithContent("{#1}", "* First line", "* Second line");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("adds blank line before verse block", () => {
      const input = markitWithContent("{#1}", "Prose.", "* Verse line");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "Prose.", "", "* Verse line"),
      );
    });

    it("preserves blank line between verse stanzas", () => {
      const input = markitWithContent(
        "{#1}",
        "* Stanza one",
        "",
        "* Stanza two",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("adds blank line between list and verse when missing", () => {
      const input = markitWithContent("{#1}", "- List item", "* Verse line");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "- List item", "", "* Verse line"),
      );
    });

    it("preserves unordered lists with compact spacing", () => {
      const input = markitWithContent("{#1}", "- First item", "- Second item");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("preserves ordered lists with compact spacing", () => {
      const input = markitWithContent(
        "{#1}",
        "1. First item",
        "2. Second item",
        "3. Third item",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("handles ordered list where first item is at a nested indent", () => {
      const input = markitWithContent("{#1}", "  1. Nested first", "1. Parent");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("renumbers ordered lists starting from first item number", () => {
      const input = markitWithContent(
        "{#1}",
        "5. First item",
        "7. Second item",
        "2. Third item",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "5. First item",
          "6. Second item",
          "7. Third item",
        ),
      );
    });

    it("preserves custom start numbers for ordered lists", () => {
      const input = markitWithContent(
        "{#1}",
        "5. Fifth item",
        "8. Sixth item",
        "3. Seventh item",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "5. Fifth item",
          "6. Sixth item",
          "7. Seventh item",
        ),
      );
    });

    it("preserves nested list indentation with 2 spaces", () => {
      const input = markitWithContent(
        "{#1}",
        "- First",
        "  - Nested",
        "  - Also nested",
        "- Second",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("normalizes nested list indentation to 2-space increments", () => {
      const input = markitWithContent(
        "{#1}",
        "1. First",
        "    2. Nested (4 spaces)",
        "2. Second",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "1. First",
          "  2. Nested (4 spaces)",
          "2. Second",
        ),
      );
    });

    it("adds blank lines before and after lists", () => {
      const input = markitWithContent(
        "{#1}",
        "A paragraph.",
        "- List item",
        "More text.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "A paragraph.",
          "",
          "- List item",
          "",
          "More text.",
        ),
      );
    });

    it("preserves blank lines between separate lists", () => {
      const input = markitWithContent(
        "{#1}",
        "- First list",
        "",
        "- Second list",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("adds blank lines between unordered and ordered lists", () => {
      const input = markitWithContent("{#1}", "- Unordered", "1. Ordered");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "- Unordered", "", "1. Ordered"),
      );
    });

    it("adds blank lines between ordered and unordered lists", () => {
      const input = markitWithContent("{#1}", "1. Ordered", "- Unordered");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "1. Ordered", "", "- Unordered"),
      );
    });
  });

  describe("table formatting", () => {
    it("aligns table columns and adds leading/trailing pipes", () => {
      const input = markitWithContent(
        "{#1}",
        "| Name | Age |",
        "| Alice | 30 |",
        "| Bob | 25 |",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "| Name  | Age |",
          "| Alice | 30  |",
          "| Bob   | 25  |",
        ),
      );
    });

    it("normalizes tables without leading pipes", () => {
      const input = markitWithContent("{#1}", "Name | Age |", "Alice | 30 |");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "| Name  | Age |", "| Alice | 30  |"),
      );
    });

    it("normalizes tables without trailing pipes", () => {
      const input = markitWithContent("{#1}", "| Name | Age", "| Alice | 30");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "| Name  | Age |", "| Alice | 30  |"),
      );
    });

    it("aligns tables with headers and separator rows", () => {
      const input = markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "|---|---|",
        "| Cell | Data |",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "| Header 1 | Header 2 |",
          "|----------|----------|",
          "| Cell     | Data     |",
        ),
      );
    });

    it("handles empty cells in alignment", () => {
      const input = markitWithContent("{#1}", "| A |  | C |", "|  | B |  |");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "| A |   | C |", "|   | B |   |"),
      );
    });

    it("adds blank lines before and after tables", () => {
      const input = markitWithContent(
        "{#1}",
        "A paragraph.",
        "| Cell 1 | Cell 2 |",
        "More text.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "A paragraph.",
          "",
          "| Cell 1 | Cell 2 |",
          "",
          "More text.",
        ),
      );
    });

    it("preserves blank lines between separate tables", () => {
      const input = markitWithContent("{#1}", "| A | B |", "", "| C | D |");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "| A | B |", "", "| C | D |"),
      );
    });

    it("handles tables with varying cell content lengths", () => {
      const input = markitWithContent(
        "{#1}",
        "| Short | VeryLongContent |",
        "| VeryLongContent | Short |",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "| Short           | VeryLongContent |",
          "| VeryLongContent | Short           |",
        ),
      );
    });

    it("normalizes tables with uneven row lengths", () => {
      const input = markitWithContent(
        "{#1}",
        "| A | B | C |",
        "| D | E |",
        "| F |",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "| A | B | C |",
          "| D | E |   |",
          "| F |   |   |",
        ),
      );
    });
  });

  describe("inline content normalization", () => {
    it("preserves inline markup in content", () => {
      const input = markitWithContent("{#1}", "*bold* and _italic_ text");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "*bold* and _italic_ text"),
      );
    });

    it("inserts a space before '\\'", () => {
      const input = markitWithContent("{#1}", "Line one.\\");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Line one. \\"));
    });

    it("inserts a line break after '\\'", () => {
      const input = markitWithContent("{#1}", "Line one. \\ Line two.");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "Line one. \\", "Line two."),
      );
    });

    it("handles line breaks inside blockquotes", () => {
      const input = markitWithContent("{#1}", "> Line one. \\ Line two.");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "> Line one. \\", "> Line two."),
      );
    });

    it("preserves blank lines between paragraphs inside content blocks", () => {
      const input = markitWithContent(
        "{#1}",
        "First paragraph.",
        "",
        "Second paragraph.",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      const result = formatDocument("");
      expect(result).toBe("\n");
    });

    it("handles whitespace-only input", () => {
      const result = formatDocument("   \n  \n  ");
      expect(result).toBe("\n");
    });

    it("handles Windows-style line endings", () => {
      const input =
        '# Text\r\n[metadata]\r\ntitle = "Hello"\r\n\r\n{#1} Content\r\n';
      const result = formatDocument(input);
      expect(result).toBe(
        '# Text\n\n[metadata]\ntitle = "Hello"\n\n{#1}\nContent\n',
      );
    });

    it("handles a single id block with no content", () => {
      const input = "# Text\n";
      const result = formatDocument(input);
      expect(result).toBe("# Text\n");
    });

    it("does not rewrap long lines", () => {
      const longLine = "a".repeat(200);
      const input = markitWithContent("{#1}", longLine);
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("handles invalid content after id block", () => {
      const input = markitWithContent("Neither metadata nor block tag");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("handles blank line inside multiline array", () => {
      const input = markit(
        "# Text",
        "",
        "[metadata]",
        "key = [",
        "    item1,",
        "",
        "]",
        "",
        "{#0}",
        "Title",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });
  });

  describe("full document", () => {
    it("formats a complete document", () => {
      const input = markit(
        "",
        "  # book1   ",
        "[metadata]",
        'title="Book One"',
        'author =  "Locke"  ',
        "",
        "",
        "{# 0 } ^1 Book One",
        "",
        "{#1 , margin = true}  *Important* paragraph.  ",
        "",
        "",
        "{#n1} A footnote.",
        "",
        "  ## book1.ch1",
        "[metadata]",
        'title="Chapter One"',
        "",
        "{#1} Chapter content here.  ",
        "",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit(
          "# book1",
          "",
          "[metadata]",
          'title = "Book One"',
          'author = "Locke"',
          "",
          "{#0}",
          "^1 Book One",
          "",
          "{#1, margin=true}",
          "*Important* paragraph.",
          "",
          "{#n1}",
          "A footnote.",
          "",
          "## book1.ch1",
          "",
          "[metadata]",
          'title = "Chapter One"',
          "",
          "{#1}",
          "Chapter content here.",
          "",
        ),
      );
    });

    it("formats a document with nested sections", () => {
      const input = markit(
        "# root",
        "",
        "{#0}",
        "Root title",
        "",
        "## child1",
        "",
        "{#1}",
        "Child one content",
        "### grandchild",
        "",
        "{#1}",
        "Deep content",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit(
          "# root",
          "",
          "{#0}",
          "Root title",
          "",
          "## child1",
          "",
          "{#1}",
          "Child one content",
          "",
          "### grandchild",
          "",
          "{#1}",
          "Deep content",
          "",
        ),
      );
    });

    it("is idempotent (formatting already-formatted document produces same output)", () => {
      const input = markit(
        "# mytext",
        "",
        "[metadata]",
        'title = "Hello"',
        'author = "John"',
        "",
        "{#0}",
        "^1 My Title",
        "",
        "{#1}",
        "First paragraph.",
        "",
        "{#n1}",
        "A footnote.",
        "",
        "## sub",
        "",
        "[metadata]",
        'title = "Subsection"',
        "",
        '{#1, with="metadata"}',
        "Sub content.",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });
  });
});
