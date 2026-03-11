import { describe, it, expect } from "vitest";
import formatDocument from "../src/format.js";
import {
  markit,
  markitWithId,
  markitWithMetadata,
  markitWithContent,
} from "./factories.js";

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

    it("ensures blank line before children ID blocks", () => {
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

    it("ensures blank line between metadata block and block tag", () => {
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

  describe("ID block normalization", () => {
    it("removes surrounding whitespace from ID blocks", () => {
      const input = markitWithId("   # Text   ");
      const result = formatDocument(input);
      expect(result).toBe(markitWithId("# Text"));
    });

    it("collapses extra spaces inside ID blocks", () => {
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

    it("handles block tag with quoted values containing commas", () => {
      const input = markitWithContent('{#1, label="a, b"}', "Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent('{#1, label="a, b"}', "Content"));
    });

    it("handles multiple key-value pairs with various spacing", () => {
      const input = markitWithContent(
        '{#1,  margin=true ,   label="hello world" ,number=12}',
        "Content",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          '{#1, margin=true, label="hello world", number=12}',
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

    it("handles escaped characters in block tag values", () => {
      const input = markitWithContent('{#1, key="a\\\\b"}', "Content");
      const result = formatDocument(input);
      expect(result).toBe(markitWithContent('{#1, key="a\\\\b"}', "Content"));
    });
  });

  describe("content normalization", () => {
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

    it("preserves inline markup in content", () => {
      const input = markitWithContent("{#1}", "*bold* and _italic_ text");
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#1}", "*bold* and _italic_ text"),
      );
    });

    it("collapses content into a single line", () => {
      const input = markitWithContent(
        "{#1}",
        "This is a paragraph\nthat spans multiple lines.",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          "This is a paragraph that spans multiple lines.",
        ),
      );
    });

    it("puts headings on their own lines", () => {
      const input = markitWithContent(
        "{#0} £2 The £2 £1 Title £1 Subsequent content",
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent("{#0}", "£2 The £2\n£1 Title £1\nSubsequent content"),
      );
    });

    it("puts blockquotes on their own lines with spacing", () => {
      const input = markitWithContent(
        "{#1}",
        'A paragraph with ""a blockquote inside it"" and some more text afterwards.',
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          'A paragraph with\n    ""a blockquote inside it""\nand some more text afterwards.',
        ),
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

    it("handles line breaks inside block quotations", () => {
      const input = markitWithContent(
        "{#1}",
        'This paragraph contains ""A blockquote with a line break.// Still the same blockquote."" And more content.',
      );
      const result = formatDocument(input);
      expect(result).toBe(
        markitWithContent(
          "{#1}",
          'This paragraph contains\n    ""A blockquote with a line break. //\n    Still the same blockquote.""\nAnd more content.',
        ),
      );
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
        "{# 0 } £1 Book One £1 £2 Of Ideas £2",
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
          "£1 Book One £1",
          "£2 Of Ideas £2",
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
        "£1 My Title £1",
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
