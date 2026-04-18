import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import { li, list, markitWithContent, pt } from "./utils/factories.js";

describe("List compilation", () => {
  describe("Unordered lists", () => {
    it("compiles a basic unordered list", () => {
      const input = markitWithContent(
        "{#1}",
        "- First item",
        "- Second item",
        "- Third item",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        list(false, [
          li([pt("First item")]),
          li([pt("Second item")]),
          li([pt("Third item")]),
        ]),
      ]);
    });

    it("compiles a single-item unordered list", () => {
      const input = markitWithContent("{#1}", "- Only item");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        list(false, [li([pt("Only item")])]),
      ]);
    });

    it("preserves inline formatting in list items", () => {
      const input = markitWithContent("{#1}", "- Item with *strong* text");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content[0]!.type).toBe("list");
      const listElement = result.blocks[0]!.content[0] as any;
      expect(listElement.items[0]!.content).toHaveLength(3);
      expect(listElement.items[0]!.content[0]).toEqual(pt("Item with "));
      expect(listElement.items[0]!.content[1]!.type).toBe("strong");
      expect(listElement.items[0]!.content[2]).toEqual(pt(" text"));
    });
  });

  describe("Ordered lists", () => {
    it("compiles a basic ordered list starting from 1", () => {
      const input = markitWithContent(
        "{#1}",
        "1. First item",
        "2. Second item",
        "3. Third item",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        list(true, [
          li([pt("First item")]),
          li([pt("Second item")]),
          li([pt("Third item")]),
        ]),
      ]);
    });

    it("compiles an ordered list with custom start number", () => {
      const input = markitWithContent(
        "{#1}",
        "5. Fifth item",
        "6. Sixth item",
        "7. Seventh item",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        list(
          true,
          [
            li([pt("Fifth item")]),
            li([pt("Sixth item")]),
            li([pt("Seventh item")]),
          ],
          5,
        ),
      ]);
    });

    it("does not set start property for lists starting at 1", () => {
      const input = markitWithContent("{#1}", "1. First", "2. Second");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const listElement = result.blocks[0]!.content[0] as any;
      expect(listElement.type).toBe("list");
      expect(listElement.start).toBeUndefined();
    });

    it("sets start property for lists not starting at 1", () => {
      const input = markitWithContent("{#1}", "3. Third", "4. Fourth");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const listElement = result.blocks[0]!.content[0] as any;
      expect(listElement.type).toBe("list");
      expect(listElement.start).toBe(3);
    });
  });

  describe("Nested lists", () => {
    it("compiles nested unordered lists", () => {
      const input = markitWithContent(
        "{#1}",
        "- First level",
        "  - Second level",
        "  - Second level again",
        "- Back to first level",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const outerList = result.blocks[0]!.content[0] as any;
      expect(outerList.type).toBe("list");
      expect(outerList.ordered).toBe(false);
      expect(outerList.items).toHaveLength(2);
      expect(outerList.items[0]!.content).toEqual([pt("First level")]);
      expect(outerList.items[0]!.nestedList).toBeDefined();
      expect(outerList.items[0]!.nestedList!.items).toHaveLength(2);
      expect(outerList.items[0]!.nestedList!.items[0]!.content).toEqual([
        pt("Second level"),
      ]);
      expect(outerList.items[1]!.content).toEqual([pt("Back to first level")]);
    });

    it("compiles nested ordered lists", () => {
      const input = markitWithContent(
        "{#1}",
        "1. First level",
        "  1. Second level",
        "  2. Second level again",
        "2. Back to first level",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const outerList = result.blocks[0]!.content[0] as any;
      expect(outerList.type).toBe("list");
      expect(outerList.ordered).toBe(true);
      expect(outerList.items).toHaveLength(2);
      expect(outerList.items[0]!.nestedList).toBeDefined();
      expect(outerList.items[0]!.nestedList!.ordered).toBe(true);
      expect(outerList.items[0]!.nestedList!.items).toHaveLength(2);
    });

    it("compiles mixed nested lists (unordered in ordered)", () => {
      const input = markitWithContent(
        "{#1}",
        "1. Ordered item",
        "  - Unordered nested",
        "  - Another nested",
        "2. Another ordered",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const outerList = result.blocks[0]!.content[0] as any;
      expect(outerList.ordered).toBe(true);
      expect(outerList.items[0]!.nestedList!.ordered).toBe(false);
    });

    it("compiles mixed nested lists (ordered in unordered)", () => {
      const input = markitWithContent(
        "{#1}",
        "- Unordered item",
        "  1. Ordered nested",
        "  2. Another nested",
        "- Another unordered",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const outerList = result.blocks[0]!.content[0] as any;
      expect(outerList.ordered).toBe(false);
      expect(outerList.items[0]!.nestedList!.ordered).toBe(true);
    });

    it("compiles deeply nested lists", () => {
      const input = markitWithContent(
        "{#1}",
        "- Level 1",
        "  - Level 2",
        "    - Level 3",
        "      - Level 4",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const l1 = result.blocks[0]!.content[0] as any;
      expect(l1.items[0]!.nestedList).toBeDefined();
      const l2 = l1.items[0]!.nestedList!;
      expect(l2.items[0]!.nestedList).toBeDefined();
      const l3 = l2.items[0]!.nestedList!;
      expect(l3.items[0]!.nestedList).toBeDefined();
      const l4 = l3.items[0]!.nestedList!;
      expect(l4.items[0]!.content).toEqual([pt("Level 4")]);
    });
  });

  describe("Lists adjacent to other elements", () => {
    it("compiles list after paragraph", () => {
      const input = markitWithContent(
        "{#1}",
        "This is a paragraph.",
        "",
        "- List item",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("paragraph");
      expect(result.blocks[0]!.content[1]!.type).toBe("list");
    });

    it("compiles list before paragraph", () => {
      const input = markitWithContent(
        "{#1}",
        "- List item",
        "",
        "This is a paragraph.",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("list");
      expect(result.blocks[0]!.content[1]!.type).toBe("paragraph");
    });

    it("compiles list after blockquote", () => {
      const input = markitWithContent(
        "{#1}",
        "> Quoted text",
        "",
        "- List item",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("blockquote");
      expect(result.blocks[0]!.content[1]!.type).toBe("list");
    });
  });

  describe("Multiple lists", () => {
    it("treats consecutive unordered lists with blank line as separate", () => {
      const input = markitWithContent(
        "{#1}",
        "- First list item 1",
        "- First list item 2",
        "",
        "- Second list item 1",
        "- Second list item 2",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("list");
      expect(result.blocks[0]!.content[1]!.type).toBe("list");
    });

    it("treats consecutive ordered lists with blank line as separate", () => {
      const input = markitWithContent(
        "{#1}",
        "1. First list item 1",
        "2. First list item 2",
        "",
        "1. Second list item 1",
        "2. Second list item 2",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("list");
      expect(result.blocks[0]!.content[1]!.type).toBe("list");
    });

    it("switches between ordered and unordered lists without blank line", () => {
      const input = markitWithContent(
        "{#1}",
        "1. Ordered item",
        "- Unordered item",
      );
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("list");
      expect((result.blocks[0]!.content[0] as any).ordered).toBe(true);
      expect(result.blocks[0]!.content[1]!.type).toBe("list");
      expect((result.blocks[0]!.content[1] as any).ordered).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("reports error for invalid list item indentation", () => {
      const input = markitWithContent("{#1}", "- Item", " - Bad indent");
      const [result, errors] = compile(input);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain("indent must be a multiple of 2");
      expect(errors[0]!.line).toBe(5); // Line number in the full document
      expect(errors[0]!.severity).toBe("error");
    });

    it("reports error for odd indentation in ordered list", () => {
      const input = markitWithContent("{#1}", "1. Item", "   2. Bad indent");
      const [result, errors] = compile(input);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain("indent must be a multiple of 2");
      expect(errors[0]!.severity).toBe("error");
    });
  });

  describe("Edge cases", () => {
    it("handles empty list item content", () => {
      const input = markitWithContent("{#1}", "- ");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const listElement = result.blocks[0]!.content[0] as any;
      expect(listElement.items[0]!.content).toEqual([]);
    });

    it("handles list items with only whitespace after marker", () => {
      const input = markitWithContent("{#1}", "-   ");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const listElement = result.blocks[0]!.content[0] as any;
      expect(listElement.items[0]!.content).toEqual([]);
    });

    it("handles large item numbers in ordered lists", () => {
      const input = markitWithContent("{#1}", "100. Item one hundred");
      const [result, errors] = compile(input);
      expect(errors).toEqual([]);
      const listElement = result.blocks[0]!.content[0] as any;
      expect(listElement.start).toBe(100);
    });
  });
});
