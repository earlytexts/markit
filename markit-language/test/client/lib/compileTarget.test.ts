import { describe, expect, it } from "vitest";
import {
  describeCompileOutcome,
  outputPathFor,
} from "../../../src/client/lib/compileTarget.ts";

describe("outputPathFor", () => {
  it("swaps the extension, keeping the directory and basename", () => {
    expect(outputPathFor("/a/b/text.mit", "html")).toBe("/a/b/text.html");
  });
});

describe("describeCompileOutcome", () => {
  it("reports success with no warning when there are no errors", () => {
    expect(describeCompileOutcome("/a/b/text.html", 0)).toEqual({
      info: "Compiled to text.html",
      warning: undefined,
    });
  });

  it("adds a warning naming the error count", () => {
    expect(describeCompileOutcome("/a/b/text.html", 3)).toEqual({
      info: "Compiled to text.html",
      warning: "Compilation logged 3 errors",
    });
  });
});
