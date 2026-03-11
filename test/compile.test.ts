import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { loadFixture } from "./fixtures.js";
import { endLine, startLine } from "../src/types.js";
import { markit, markitWithContent, markitWithMetadata } from "./factories.js";

describe("compile", () => {
  describe("integration", () => {
    it("compiles a document with no errors", () => {
      const example = loadFixture("example.mit");
      const [document, errors] = compile(example);
      expect(document).toBeDefined();
      expect(errors).toEqual([]);
    });
  });

  describe("document structure", () => {
    it("parses the document tree and text IDs, with correct line numbers for folding", () => {
      const [document] = compile(
        markit(
          "# Test.Document", // line 0
          "",
          "## Test.Document.Child1", // line 2
          "",
          "{#1} Child 1 content.",
          "",
          "## Test.Document.Child2", // line 6
          "",
          "{#1} Child 2 content.",
          "",
          "### Test.Document.Child2.Grandchild", // line 10
          "",
          "{#1} Grandchild content.", // line 12
        ),
      );

      expect(document.id).toBe("Test.Document");
      expect(document.children.length).toBe(2);
      expect(document[startLine]).toBe(0);
      expect(document[endLine]).toBe(12);

      const child1 = document.children[0]!;
      expect(child1.id).toBe("Test.Document.Child1");
      expect(child1.children.length).toBe(0);
      expect(child1[startLine]).toBe(2);
      expect(child1[endLine]).toBe(4);

      const child2 = document.children[1]!;
      expect(child2.id).toBe("Test.Document.Child2");
      expect(child2.children.length).toBe(1);
      expect(child2[startLine]).toBe(6);
      expect(child2[endLine]).toBe(12);

      const grandchild = child2.children[0]!;
      expect(grandchild.id).toBe("Test.Document.Child2.Grandchild");
      expect(grandchild.children.length).toBe(0);
      expect(grandchild[startLine]).toBe(10);
      expect(grandchild[endLine]).toBe(12);
    });
  });

  describe("text metadata", () => {
    it("parses text metadata", () => {
      const [document] = compile(
        markitWithMetadata(
          "metadataBooleans1: true",
          "metadataBooleans2: false",
          "metadataNumbers: 42",
          'metadataString: "the answer"',
          "metadataBooleanArrays: [true, false]",
          "metadataNumberArrays: [1, 2, 3]",
          'metadataStringArrays: ["a", "b", "c"]',
        ),
      );

      expect(document.metadata).toEqual({
        metadataBooleans1: true,
        metadataBooleans2: false,
        metadataNumbers: 42,
        metadataString: "the answer",
        metadataBooleanArrays: [true, false],
        metadataNumberArrays: [1, 2, 3],
        metadataStringArrays: ["a", "b", "c"],
      });
    });

    it("parses metadata from child texts", () => {
      const [document] = compile(
        markit(
          "# Text",
          "",
          "## Child.Text",
          "",
          "note: Child texts can contain metadata too.",
        ),
      );

      const section1 = document.children[0]!;
      expect(section1.metadata).toEqual({
        note: "Child texts can contain metadata too.",
      });
    });
  });

  describe("block metadata", () => {
    it("parses blocks with their ids", () => {
      const [document] = compile(
        markitWithContent(
          "{#0}",
          "This is the first block.",
          "",
          "{#1}",
          "This is the second block.",
        ),
      );

      expect(document.blocks.length).toBe(2);
      expect(document.blocks[0]!.id).toBe("0");
      expect(document.blocks[1]!.id).toBe("1");
    });

    it("parses block metadata", () => {
      const [document] = compile(
        markitWithContent('{#1, boolean=true, number=42, string="hello"}'),
      );
      expect(document.blocks[0]!.metadata).toEqual({
        boolean: true,
        number: 42,
        string: "hello",
      });
    });
  });

  describe("block content", () => {
    it("parses plain text", () => {
      const [document] = compile(
        markitWithContent("{#0}", "Example plain text content."),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "plainText",
          content: "Example plain text content.",
        },
      ]);
    });

    it("parses headings with multiple levels", () => {
      const [document] = compile(
        markitWithContent(
          "{#0}",
          "£1 Level 1 Heading £1",
          "£2 Level 2 Heading £2",
          "£3 Level 3 Heading £3",
          "£6 Level 6 Heading £6",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "heading",
          level: 1,
          content: [{ type: "plainText", content: "Level 1 Heading" }],
        },
        {
          type: "heading",
          level: 2,
          content: [{ type: "plainText", content: "Level 2 Heading" }],
        },
        {
          type: "heading",
          level: 3,
          content: [{ type: "plainText", content: "Level 3 Heading" }],
        },
        {
          type: "heading",
          level: 6,
          content: [{ type: "plainText", content: "Level 6 Heading" }],
        },
      ]);
    });

    it("parses inline formatting (bold and italic)", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "This is a paragraph with *some* _inline markup_, and also _some *nested* formatting_.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is a paragraph with " },
        { type: "strong", content: [{ type: "plainText", content: "some" }] },
        { type: "plainText", content: " " },
        {
          type: "emphasis",
          content: [{ type: "plainText", content: "inline markup" }],
        },
        { type: "plainText", content: ", and also " },
        {
          type: "emphasis",
          content: [
            { type: "plainText", content: "some " },
            {
              type: "strong",
              content: [{ type: "plainText", content: "nested" }],
            },
            { type: "plainText", content: " formatting" },
          ],
        },
        {
          type: "plainText",
          content: ".",
        },
      ]);
    });

    it("parses headings with formatting inside", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "£2 *Bold* and _italic_ text can be used in headings £2",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "heading",
          level: 2,
          content: [
            {
              type: "strong",
              content: [{ type: "plainText", content: "Bold" }],
            },
            { type: "plainText", content: " and " },
            {
              type: "emphasis",
              content: [{ type: "plainText", content: "italic" }],
            },
            {
              type: "plainText",
              content: " text can be used in headings",
            },
          ],
        },
      ]);
    });

    it("parses inline quotes", () => {
      const [document] = compile(
        markitWithContent("{#1}", 'This is an inline quote: "like this".'),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is an inline quote: " },
        {
          type: "quote",
          content: [{ type: "plainText", content: "like this" }],
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses block quotes", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          'This is a paragraph that contains: ""A block quotation."" And also some follow-on text.',
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is a paragraph that contains:" },
        {
          type: "blockquote",
          content: [{ type: "plainText", content: "A block quotation." }],
        },
        { type: "plainText", content: "And also some follow-on text." },
      ]);
    });

    it("parses citations", () => {
      const [document] = compile(
        markitWithContent("{#1}", "This is a citation: [cite me]."),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is a citation: " },
        {
          type: "citation",
          content: [{ type: "plainText", content: "cite me" }],
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses editorial deletions and insertions", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "This is an example of editorial markup: --deleted text in double hyphens-- and ++inserted text in double plus signs++.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "plainText",
          content: "This is an example of editorial markup: ",
        },
        {
          type: "deletion",
          content: [
            { type: "plainText", content: "deleted text in double hyphens" },
          ],
        },
        { type: "plainText", content: " and " },
        {
          type: "insertion",
          content: [
            {
              type: "plainText",
              content: "inserted text in double plus signs",
            },
          ],
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses asides (margin comments)", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "This is an example of an aside. @in the margin@",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is an example of an aside. " },
        {
          type: "aside",
          content: [{ type: "plainText", content: "in the margin" }],
        },
      ]);
    });

    it("parses line breaks", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "This is the first line. //",
          "This is the second line.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is the first line." },
        { type: "lineBreak" },
        { type: "plainText", content: "This is the second line." },
      ]);
    });

    it("parses non-breaking spaces", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          'This is a quote with a non-breaking space: "~".',
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "plainText",
          content: "This is a quote with a non-breaking space: ",
        },
        {
          type: "quote",
          content: [{ type: "nbSpace" }],
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses foreign text", () => {
      const [document] = compile(
        markitWithContent("{#1}", "This is foreign text: $like this$."),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is foreign text: " },
        {
          type: "foreign",
          content: [{ type: "plainText", content: "like this" }],
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses Greek text with transliteration", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "Greek words: $$like this$$ and $$philosophia$$.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "Greek words: " },
        {
          type: "greek",
          content: [{ type: "plainText", content: "λικε θις" }],
        },
        { type: "plainText", content: " and " },
        {
          type: "greek",
          content: [{ type: "plainText", content: "φιλοσοφια" }],
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses brace codes", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "Special characters: {ae} {oe} {AE} {OE} {SS} {-} {--}.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "Special characters: " },
        { type: "plainText", content: "æ" },
        { type: "plainText", content: " " },
        { type: "plainText", content: "œ" },
        { type: "plainText", content: " " },
        { type: "plainText", content: "Æ" },
        { type: "plainText", content: " " },
        { type: "plainText", content: "Œ" },
        { type: "plainText", content: " " },
        { type: "plainText", content: "§" },
        { type: "plainText", content: " " },
        { type: "plainText", content: "–" },
        { type: "plainText", content: " " },
        { type: "plainText", content: "—" },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses footnote references", () => {
      const [document] = compile(
        markitWithContent("{#1}", "This is a sentence with a footnote<n1>."),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "This is a sentence with a footnote" },
        {
          type: "footnoteReference",
          id: "n1",
        },
        { type: "plainText", content: "." },
      ]);
    });

    it("parses escaped characters as literals", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "Escaped block id: \\{#1} and escaped asterisk: \\*not bold\\*.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "plainText",
          content: "Escaped block id: {#1} and escaped asterisk: *not bold*.",
        },
      ]);
    });

    it("collapses whitespace and joins lines", () => {
      const [document] = compile(
        markitWithContent(
          "{#1}",
          "This content is split",
          "across multiple lines and should",
          "be joined   with    single   spaces.",
        ),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "plainText",
          content:
            "This content is split across multiple lines and should be joined with single spaces.",
        },
      ]);
    });

    it("parses page breaks", () => {
      const [document] = compile(markitWithContent("{#1}", "before | after"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "before " },
        { type: "pageBreak" },
        { type: "plainText", content: " after" },
      ]);
    });

    it("parses em spaces (double tildes)", () => {
      const [document] = compile(markitWithContent("{#1}", "before~~after"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "before" },
        { type: "emSpace" },
        { type: "plainText", content: "after" },
      ]);
    });

    it("parses escape character at start of content", () => {
      const [document] = compile(markitWithContent("{#1}", "\\*not bold"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "*not bold" },
      ]);
    });

    it("treats trailing backslash as literal", () => {
      const [document] = compile(markitWithContent("{#1}", "text\\"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "text\\" },
      ]);
    });

    it("treats lone backslash as literal", () => {
      const [document] = compile(markitWithContent("{#1}", "\\"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "\\" },
      ]);
    });

    it("parses unknown brace code at start of content", () => {
      const [document, errors] = compile(
        markitWithContent("{#1}", "{unknown} text"),
      );

      expect(errors.length).toBe(1);
      expect(errors[0]!.message).toBe("Unknown brace code: unknown");
      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "{unknown} text" },
      ]);
    });

    it("reports error for heading nested inside block-level element", () => {
      const [, errors] = compile(
        markitWithContent("{#1}", '""£1 heading £1""'),
      );

      expect(errors).toContainEqual(
        expect.objectContaining({
          message: "Block-level elements cannot be nested",
        }),
      );
    });

    it("reports error for heading nested inside block-level element after text", () => {
      const [, errors] = compile(
        markitWithContent("{#1}", '""text £1 heading £1""'),
      );

      expect(errors).toContainEqual(
        expect.objectContaining({
          message: "Block-level elements cannot be nested",
        }),
      );
    });

    it("reports error for block-level wrapper at start of heading content", () => {
      const [, errors] = compile(markitWithContent("{#1}", '£1 ""nested"" £1'));

      const nestingErrors = errors.filter(
        (e) => e.message === "Block-level elements cannot be nested",
      );
      expect(nestingErrors.length).toBeGreaterThanOrEqual(1);
    });

    it("transliterates Greek text with nested formatting", () => {
      const [document] = compile(markitWithContent("{#1}", "$$*bold*$$"));

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "greek",
          content: [
            {
              type: "strong",
              content: [{ type: "plainText", content: "βολδ" }],
            },
          ],
        },
      ]);
    });

    it("transliterates Greek text with leaf elements", () => {
      const [document] = compile(markitWithContent("{#1}", "$$text//more$$"));

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "greek",
          content: [
            { type: "plainText", content: "τεξτ" },
            { type: "lineBreak" },
            { type: "plainText", content: "μορε" },
          ],
        },
      ]);
    });

    it("transliterates uppercase Greek letters", () => {
      const [document] = compile(markitWithContent("{#1}", "$$Alpha$$"));

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "greek",
          content: [{ type: "plainText", content: "Αλφα" }],
        },
      ]);
    });

    it("treats angle bracket without closing as plain text", () => {
      const [document] = compile(markitWithContent("{#1}", "a < b"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "a < b" },
      ]);
    });

    it("treats angle brackets with non-footnote content as plain text", () => {
      const [document] = compile(markitWithContent("{#1}", "a <b> c"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "a <b> c" },
      ]);
    });

    it("treats pound sign not followed by 1-6 as plain text", () => {
      const [document] = compile(markitWithContent("{#1}", "costs £50"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "costs £50" },
      ]);
    });

    it("treats pound sign followed by non-level digit as plain text", () => {
      const [document] = compile(markitWithContent("{#1}", "symbol £x here"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "symbol £x here" },
      ]);
    });

    it("removes trailing space at end of content block", () => {
      const [document] = compile(
        markitWithContent("{#1}", "text with trailing space "),
      );

      expect(document.blocks[0]!.content).toEqual([
        { type: "plainText", content: "text with trailing space" },
      ]);
    });

    it("preserves space between inline elements", () => {
      const [document] = compile(markitWithContent("{#1}", "*bold* text"));

      expect(document.blocks[0]!.content).toEqual([
        { type: "strong", content: [{ type: "plainText", content: "bold" }] },
        { type: "plainText", content: " text" },
      ]);
    });

    it("removes trailing space after inline element at end of content", () => {
      const [document] = compile(markitWithContent("{#1}", "*bold* "));

      expect(document.blocks[0]!.content).toEqual([
        { type: "strong", content: [{ type: "plainText", content: "bold" }] },
      ]);
    });

    it("removes space between block-level elements", () => {
      const [document] = compile(
        markitWithContent("{#1}", "£1 first £1 £2 second £2"),
      );

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "heading",
          level: 1,
          content: [{ type: "plainText", content: "first" }],
        },
        {
          type: "heading",
          level: 2,
          content: [{ type: "plainText", content: "second" }],
        },
      ]);
    });

    it("removes trailing space after block-level element at end of content", () => {
      const [document] = compile(markitWithContent("{#1}", "£1 heading £1 "));

      expect(document.blocks[0]!.content).toEqual([
        {
          type: "heading",
          level: 1,
          content: [{ type: "plainText", content: "heading" }],
        },
      ]);
    });
  });
});
