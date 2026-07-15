// deno-lint-ignore-file no-explicit-any -- tests reach into unions with `as any`
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile from "../src/compile.ts";
import { markitWithContent, pt, table, tc, tr } from "./utils/factories.ts";

describe("Table compilation", () => {
  describe("Basic tables without headers", () => {
    it("compiles a simple table without header", () => {
      const input = markitWithContent(
        "{#1}",
        "| Cell 1 | Cell 2 |",
        "| Cell 3 | Cell 4 |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
            tr([tc([pt("Cell 3")]), tc([pt("Cell 4")])]),
          ],
          false,
        ),
      ]);
    });

    it("compiles a table with leading/trailing spaces in cells", () => {
      const input = markitWithContent(
        "{#1}",
        "|  Cell 1  |  Cell 2  |",
        "|  Cell 3  |  Cell 4  |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
            tr([tc([pt("Cell 3")]), tc([pt("Cell 4")])]),
          ],
          false,
        ),
      ]);
    });

    it("compiles a table without leading pipe", () => {
      const input = markitWithContent(
        "{#1}",
        "Cell 1 | Cell 2 |",
        "Cell 3 | Cell 4 |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
            tr([tc([pt("Cell 3")]), tc([pt("Cell 4")])]),
          ],
          false,
        ),
      ]);
    });

    it("compiles a table without trailing pipe", () => {
      const input = markitWithContent(
        "{#1}",
        "| Cell 1 | Cell 2",
        "| Cell 3 | Cell 4",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
            tr([tc([pt("Cell 3")]), tc([pt("Cell 4")])]),
          ],
          false,
        ),
      ]);
    });

    it("compiles a single-row table", () => {
      const input = markitWithContent("{#1}", "| Cell 1 | Cell 2 | Cell 3 |");
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [tr([tc([pt("Cell 1")]), tc([pt("Cell 2")]), tc([pt("Cell 3")])])],
          false,
        ),
      ]);
    });

    it("compiles a single-column table", () => {
      const input = markitWithContent("{#1}", "| Cell 1 |", "| Cell 2 |");
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table([tr([tc([pt("Cell 1")])]), tr([tc([pt("Cell 2")])])], false),
      ]);
    });
  });

  describe("Tables with headers", () => {
    it("compiles a table with header when separator row is present", () => {
      const input = markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "|----------|----------|",
        "| Cell 1   | Cell 2   |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Header 1")]), tc([pt("Header 2")])]),
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
          ],
          true,
        ),
      ]);
    });

    it("compiles a header with separator row without leading pipe", () => {
      const input = markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "----------|----------|",
        "| Cell 1   | Cell 2   |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Header 1")]), tc([pt("Header 2")])]),
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
          ],
          true,
        ),
      ]);
    });

    it("compiles a header with separator row without trailing pipe", () => {
      const input = markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "|----------|----------",
        "| Cell 1   | Cell 2   |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Header 1")]), tc([pt("Header 2")])]),
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
          ],
          true,
        ),
      ]);
    });

    it("compiles a header with separator row with minimal dashes", () => {
      const input = markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "| - | - |",
        "| Cell 1   | Cell 2   |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("Header 1")]), tc([pt("Header 2")])]),
            tr([tc([pt("Cell 1")]), tc([pt("Cell 2")])]),
          ],
          true,
        ),
      ]);
    });

    it("compiles a header-only table (just header and separator)", () => {
      const input = markitWithContent(
        "{#1}",
        "| Header 1 | Header 2 |",
        "|----------|----------|",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table([tr([tc([pt("Header 1")]), tc([pt("Header 2")])])], true),
      ]);
    });

    it("compiles multiple tables in one block", () => {
      const input = markitWithContent("{#1}", "| A | B |", "", "| C | D |");
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table([tr([tc([pt("A")]), tc([pt("B")])])], false),
        table([tr([tc([pt("C")]), tc([pt("D")])])], false),
      ]);
    });
  });

  describe("Empty cells", () => {
    it("compiles a table with empty cells", () => {
      const input = markitWithContent(
        "{#1}",
        "| Cell 1 |  |",
        "|        | Cell 4 |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table(
          [tr([tc([pt("Cell 1")]), tc([])]), tr([tc([]), tc([pt("Cell 4")])])],
          false,
        ),
      ]);
    });

    it("compiles a table with all empty cells", () => {
      const input = markitWithContent("{#1}", "| | |", "| | |");
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toEqual([
        table([tr([tc([]), tc([])]), tr([tc([]), tc([])])], false),
      ]);
    });
  });

  describe("Inline formatting in cells", () => {
    it("preserves inline formatting in table cells", () => {
      const input = markitWithContent(
        "{#1}",
        "| *Bold* text | _Italic_ text |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      const tableElement = result.blocks[0]!.content[0] as any;
      expect(tableElement.type).toBe("table");
      expect(tableElement.rows[0]!.cells[0]!.content).toHaveLength(2);
      expect(tableElement.rows[0]!.cells[0]!.content[0]!.type).toBe("strong");
      expect(tableElement.rows[0]!.cells[0]!.content[1]).toEqual(pt(" text"));
      expect(tableElement.rows[0]!.cells[1]!.content).toHaveLength(2);
      expect(tableElement.rows[0]!.cells[1]!.content[0]!.type).toBe("emphasis");
      expect(tableElement.rows[0]!.cells[1]!.content[1]).toEqual(pt(" text"));
    });

    it("preserves quotes and citations in table cells", () => {
      const input = markitWithContent("{#1}", '| "Quoted" text | [Citation] |');
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      const tableElement = result.blocks[0]!.content[0] as any;
      expect(tableElement.type).toBe("table");
      expect(tableElement.rows[0]!.cells[0]!.content).toHaveLength(2);
      expect(tableElement.rows[0]!.cells[0]!.content[0]!.type).toBe("quote");
      expect(tableElement.rows[0]!.cells[0]!.content[1]).toEqual(pt(" text"));
      expect(tableElement.rows[0]!.cells[1]!.content).toHaveLength(1);
      expect(tableElement.rows[0]!.cells[1]!.content[0]!.type).toBe("citation");
    });
  });

  describe("Malformed tables", () => {
    it("normalizes rows with inconsistent column counts by adding empty cells", () => {
      const input = markitWithContent(
        "{#1}",
        "| A | B | C |",
        "| D | E |",
        "| F |",
      );
      const { document: result } = compile(input);
      // Should emit warnings but still produce output
      expect(result.blocks[0]!.content).toEqual([
        table(
          [
            tr([tc([pt("A")]), tc([pt("B")]), tc([pt("C")])]),
            tr([tc([pt("D")]), tc([pt("E")]), tc([])]),
            tr([tc([pt("F")]), tc([]), tc([])]),
          ],
          false,
        ),
      ]);
    });

    it("handles separator row with wrong number of columns", () => {
      const input = markitWithContent(
        "{#1}",
        "| A | B | C |",
        "|---|---|",
        "| D | E | F |",
      );
      const { document: result } = compile(input);
      // Should still recognize as header and normalize
      expect(result.blocks[0]!.content[0]!.type).toBe("table");
      const tableElement = result.blocks[0]!.content[0] as any;
      expect(tableElement.hasHeader).toBe(true);
      expect(tableElement.rows).toHaveLength(2);
    });
  });

  describe("Tables with paragraphs", () => {
    it("separates table from preceding paragraph with blank line", () => {
      const input = markitWithContent(
        "{#1}",
        "This is a paragraph.",
        "",
        "| Cell 1 | Cell 2 |",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("paragraph");
      expect(result.blocks[0]!.content[1]!.type).toBe("table");
    });

    it("separates table from following paragraph with blank line", () => {
      const input = markitWithContent(
        "{#1}",
        "| Cell 1 | Cell 2 |",
        "",
        "This is a paragraph.",
      );
      const { document: result, errors } = compile(input);
      expect(errors).toEqual([]);
      expect(result.blocks[0]!.content).toHaveLength(2);
      expect(result.blocks[0]!.content[0]!.type).toBe("table");
      expect(result.blocks[0]!.content[1]!.type).toBe("paragraph");
    });

    it("handles standalone separator row", () => {
      const input = markitWithContent("{#1}", "|---|---|");
      const { document: result } = compile(input);
      // Standalone separator creates an empty table
      expect(result.blocks[0]!.content).toHaveLength(0);
    });

    it("handles a row with no cells alongside rows with cells", () => {
      const input = markitWithContent("{#1}", "| A | B |", "|");
      const { document: result, errors } = compile(input);
      expect(errors).toHaveLength(0);
      expect(result.blocks[0]!.content[0]!.type).toBe("table");
    });

    it("positions cell errors correctly when two cells have identical text", () => {
      const input = markitWithContent("{#1}", "| *a | *a |");
      const { errors } = compile(input);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        message: "Unclosed formatting: *",
        source: { start: { line: 3, column: 2 } },
      });
      expect(errors[1]).toMatchObject({
        message: "Unclosed formatting: *",
        source: { start: { line: 3, column: 7 } },
      });
    });

    it("warns about misplaced separator row (not second row)", () => {
      const input = markitWithContent(
        "{#1}",
        "| A | B |",
        "| C | D |",
        "|---|---|",
      );
      const { document: result, errors } = compile(input);
      // Should compile but emit warning
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain(
        "separator row should be the second row",
      );
      expect(result.blocks[0]!.content[0]!.type).toBe("table");
    });
  });
});
