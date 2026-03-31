import * as path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";

const fixturesDir = path.resolve(process.cwd(), "test/fixtures");

describe("external children integration", () => {
  it("loads external children from real fixture files", () => {
    const filePath = path.join(fixturesDir, "parent.mit");
    const fileContent = readFileSync(filePath, "utf-8");

    const [document, errors] = compile(fileContent, { filePath: filePath });

    expect(errors).toEqual([]);
    expect(document.id).toBe("Parent");
    expect(document.children).toHaveLength(2);
    expect(document.children[0]!.id).toBe("Parent.InlineChild");
    expect(document.children[1]!.id).toBe("Child");
    const firstNode = document.children[1]!.blocks[0]!.content[0]!;
    expect(firstNode.type).toBe("plainText");
    expect((firstNode as { type: string; content: string }).content).toBe(
      "This is the external child document.",
    );
  });
});
