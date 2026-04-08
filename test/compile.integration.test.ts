import { describe, expect, it } from "vitest";
import { loadFixture } from "./utils/fixtures.js";
import compile from "../src/compile.js";

describe("external children integration", () => {
  it("loads external children from real fixture files", () => {
    const { filePath, content } = loadFixture("parent.mit");

    const [document, errors] = compile(content, { filePath });

    expect(errors).toEqual([]);
    expect(document.id).toBe("Parent");
    expect(document.children).toHaveLength(2);
    expect(document.children[0]!.id).toBe("Parent.InlineChild");
    expect(document.children[1]!.id).toBe("Child");
    const firstElement = document.children[1]!.blocks[0]!.content[0]!;
    expect(firstElement.type).toBe("paragraph");
    const firstInline = (
      firstElement as {
        type: string;
        content: { type: string; content: string }[];
      }
    ).content[0]!;
    expect(firstInline.type).toBe("plainText");
    expect(firstInline.content).toBe("This is the external child document.");
  });
});
