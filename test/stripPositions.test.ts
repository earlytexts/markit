import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile, { compileWithPositions } from "../src/compile.ts";
import stripPositions from "../src/stripPositions.ts";
import { markit } from "./utils/factories.ts";

const SOURCE = markit(
  "# Text",
  "",
  "[metadata]",
  'source = "1748 edition"',
  "",
  "[metadata.sources]",
  'note = "collates 1750"',
  "",
  "{#1, type=prose}",
  "First *paragraph*, with [p:a person] and a~join.",
  "",
  "> A quotation",
  "",
  "## Child",
  "",
  "{#1}",
  "| a | b |",
  "| c | d |",
  "",
);

describe("stripPositions", () => {
  it("returns a positioned document to its plain compiled form", () => {
    const positioned = compileWithPositions(SOURCE).document;
    const plain = compile(SOURCE).document;

    expect(stripPositions(positioned)).toEqual(plain);
  });

  it("leaves a plain document unchanged", () => {
    const plain = compile(SOURCE).document;

    expect(stripPositions(plain)).toEqual(plain);
  });

  it("strips a block without touching metadata keys named source", () => {
    const positioned = compileWithPositions(SOURCE).document;
    const plain = compile(SOURCE).document;

    expect(stripPositions(positioned.blocks[0]!)).toEqual(plain.blocks[0]);
    // Metadata keys named "source"/"sources" are data, not positions.
    expect(stripPositions(positioned).metadata).toEqual({
      source: "1748 edition",
      sources: { note: "collates 1750" },
    });
  });

  it("survives JSON round-tripping after stripping", () => {
    const stripped = stripPositions(compileWithPositions(SOURCE).document);

    expect(JSON.parse(JSON.stringify(stripped))).toEqual(stripped);
  });
});
