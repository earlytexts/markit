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
        "metadata: value",
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
          "metadata: value",
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
        "metadata: value",
        "{#1}",
        "Content",
        "",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markit("# mytext", "", "metadata: value", "", "{#1}", "Content", ""),
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
    it("collapses extra spaces after colon", () => {
      const input = markitWithMetadata('title:   "Hello"');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title: "Hello"'));
    });

    it("adds space after colon if missing", () => {
      const input = markitWithMetadata('title:"Hello"');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title: "Hello"'));
    });

    it("removes spaces before colon", () => {
      const input = markitWithMetadata('title : "Hello"');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title: "Hello"'));
    });

    it("passes over metadata with no value", () => {
      const input = markitWithMetadata("draft:");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("removes trailing whitespace after values", () => {
      // removing leading whitespace would be nice too, but it would be
      // difficult to distinguish from intentional indentation in YAML
      const input = markitWithMetadata('title: "Hello"   ');
      const result = formatDocument(input);
      expect(result).toBe(markitWithMetadata('title: "Hello"'));
    });

    it("preserves indentation in YAML continuation lines", () => {
      const input = markitWithMetadata(
        "tags:",
        "  - philosophy",
        "  - epistemology",
      );
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("normalizes indented metadata keys", () => {
      const input = markitWithMetadata(
        "author:",
        '  name:"John"',
        '  email:   "foo@bar.com"',
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithMetadata(
          "author:",
          '  name: "John"',
          '  email: "foo@bar.com"',
        ),
      );
    });

    it("does NOT normalize colon-like lines in content blocks", () => {
      const input = markitWithContent(
        "{#1}",
        "In the beginning:something was said.",
      );
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

    it("normalizes block tag metadata spacing", () => {
      const input = markitWithContent("{#1 , margin = true}", "Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1, margin=true}", "Content"));
    });

    it("normalizes multiple metadata key-value pairs", () => {
      const input = markitWithContent(
        '{#1,margin=true,label="hello"}',
        "Content",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent('{#1, margin=true, label="hello"}', "Content"),
      );
    });

    it("handles multiple key-value pairs with various spacing", () => {
      const input = markitWithContent(
        "{#1,  pages=12-15 ,   speaker=John Smith ,subsection=3}",
        "Content",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1, pages=12-15, speaker=John Smith, subsection=3}",
          "Content",
        ),
      );
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

    it("handles block tag with metadata pair missing =", () => {
      const input = markitWithContent("{#1, standalone}", "Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1, standalone}", "Content"));
    });

    it("trims whitespace around values", () => {
      const input = markitWithContent("{#1, speaker=  Alice  }", "Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1, speaker=Alice}", "Content"));
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

    it("preserves list items on their own lines", () => {
      const input = markitWithContent(
        "{#1}",
        "Unordered list:",
        "",
        "- List item 1",
        "- List item 2",
        "",
        "Numbered list:",
        "",
        "1. List item 1",
        "2. List item 2",
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

    it("doesn't collapse block quotations containing unordered lists", () => {
      const input = markitWithContent("{#1}", "> - Item 1", "> - Item 2");
      const result = formatDocument(input);
      expect(result).toBe(input);
    });

    it("doesn't collapse block quotations containing ordered lists", () => {
      const input = markitWithContent("{#1}", "> 1. Item 1", "> 2. Item 2");
      const result = formatDocument(input);
      expect(result).toBe(input);
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

    it("collapses paragraphs in block quotations to a single line while preserving lists", () => {
      const input = markitWithContent(
        "{#1}",
        "> This is a block quote with a list.",
        "> It has multiple paragraphs, but they should be collapsed.",
        ">",
        "> - List item 1",
        "> - List item 2",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "> This is a block quote with a list. It has multiple paragraphs, but they should be collapsed.",
          ">",
          "> - List item 1",
          "> - List item 2",
        ),
      );
    });

    it("corrects sequential numbering in lists", () => {
      const input = markitWithContent(
        "{#1}",
        "2. Item 1",
        "5. Item 2",
        "1. Item 3",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "1. Item 1", "2. Item 2", "3. Item 3"),
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
        "- list item 1",
        "- list item 2",
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
          "- list item 1",
          "- list item 2",
          "",
          "Even more text.",
        ),
      );
    });

    it("adds blank lines between block-level elements in block quotations", () => {
      const input = markitWithContent(
        "{#1}",
        "> First paragraph.",
        "> - list item 1",
        "> - list item 2",
        "> More text.",
        "> 1. Numbered item 1",
        "> 2. Numbered item 2",
        "> Even more text.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "> First paragraph.",
          ">",
          "> - list item 1",
          "> - list item 2",
          ">",
          "> More text.",
          ">",
          "> 1. Numbered item 1",
          "> 2. Numbered item 2",
          ">",
          "> Even more text.",
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

    it("inserts a space before '//'", () => {
      const input = markitWithContent("{#1}", "Line one.//");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Line one. //"));
    });

    it("inserts a line break after '//'", () => {
      const input = markitWithContent("{#1}", "Line one. // Line two.");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent("{#1}", "Line one. //\nLine two."));
    });

    it("handles line breaks inside blockquotes", () => {
      const input = markitWithContent("{#1}", "> Line one. // Line two.");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "> Line one. //", "> Line two."),
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
      const input = '# Text\r\ntitle: "Hello"\r\n\r\n{#1} Content\r\n';
      const result = formatDocument(input);
      expect(result).toBe('# Text\n\ntitle: "Hello"\n\n{#1}\nContent\n');
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
  });

  describe("full document", () => {
    it("formats a complete document", () => {
      const input = markit(
        "",
        "  # book1   ",
        'title:"Book One"',
        'author :  "Locke"  ',
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
        'title:"Chapter One"',
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
          'title: "Book One"',
          'author: "Locke"',
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
          'title: "Chapter One"',
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
        'title: "Hello"',
        'author: "John"',
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
        'title: "Subsection"',
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
