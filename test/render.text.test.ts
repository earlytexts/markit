import { describe, expect, it } from "vitest";
import compile from "../src/compile.js";
import renderText from "../src/renderText.js";
import { markit, markitWithContent } from "./utils/factories.js";

describe("document structure", () => {
  it("joins multiple blocks with double newlines", () => {
    const [document] = compile(
      markitWithContent("{#1}", "First.", "", "{#2}", "Second."),
    );
    expect(renderText(document)).toContain("First.\n\nSecond.");
  });

  it("appends child document text after parent blocks", () => {
    const [document] = compile(
      markit(
        "# Parent",
        "",
        "{#1}",
        "Parent block.",
        "",
        "## Parent.Child",
        "",
        "{#1}",
        "Child block.",
        "",
      ),
    );
    const text = renderText(document);
    expect(text).toContain("Parent block.");
    expect(text).toContain("Child block.");
    expect(text.indexOf("Parent block.")).toBeLessThan(
      text.indexOf("Child block."),
    );
  });

  it("ends with a trailing newline", () => {
    const [document] = compile(markitWithContent("{#1}", "Hello"));
    expect(renderText(document)).toMatch(/\n$/);
  });
});

describe("block elements", () => {
  it("renders paragraph as plain text", () => {
    const [document] = compile(markitWithContent("{#1}", "Hello world"));
    expect(renderText(document)).toContain("Hello world");
  });

  it("renders heading lines as plain text joined by newlines", () => {
    const [document] = compile(
      markitWithContent("{#title}", "^1 First line", "^2 Second line"),
    );
    expect(renderText(document)).toContain("First line\nSecond line");
  });

  it("renders blockquote indented with 4 spaces", () => {
    // blockquote must not be the sole element in the block (blockToText trims the result)
    const [document] = compile(
      markitWithContent("{#1}", "intro.", "", "> A quote.", "", "outro."),
    );
    expect(renderText(document)).toContain("    A quote.");
  });

  it("renders unordered list items as plain text without prefix", () => {
    const [document] = compile(markitWithContent("{#1}", "- Alpha", "- Beta"));
    const text = renderText(document);
    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(text).not.toContain("1. Alpha");
  });

  it("renders ordered list items with numeric prefix", () => {
    const [document] = compile(
      markitWithContent("{#1}", "1. First", "2. Second"),
    );
    expect(renderText(document)).toContain("1. First\n2. Second");
  });

  it("renders footnote block as [^id]: text", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "The footnote."),
    );
    expect(renderText(document)).toContain("[^n1]: The footnote.");
  });
});

describe("inline elements", () => {
  it("renders plain text as-is", () => {
    const [document] = compile(markitWithContent("{#1}", "Just text"));
    expect(renderText(document)).toContain("Just text");
  });

  it("renders strong as inner text without markup", () => {
    const [document] = compile(markitWithContent("{#1}", "*bold*"));
    const text = renderText(document);
    expect(text).toContain("bold");
    expect(text).not.toContain("*");
  });

  it("renders emphasis as inner text without markup", () => {
    const [document] = compile(markitWithContent("{#1}", "_italic_"));
    const text = renderText(document);
    expect(text).toContain("italic");
    expect(text).not.toContain("_");
  });

  it("renders quote wrapped in double quotes", () => {
    const [document] = compile(markitWithContent("{#1}", '"a quote"'));
    expect(renderText(document)).toContain('"a quote"');
  });

  it("renders citation wrapped in brackets", () => {
    const [document] = compile(markitWithContent("{#1}", "[cited]"));
    expect(renderText(document)).toContain("[cited]");
  });

  it("renders insertion as inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "++added++"));
    const text = renderText(document);
    expect(text).toContain("added");
    expect(text).not.toContain("++");
  });

  it("renders deletion as empty string", () => {
    const [document] = compile(markitWithContent("{#1}", "a --gone-- b"));
    const text = renderText(document);
    expect(text).not.toContain("gone");
    expect(text).toContain("a  b");
  });

  it("renders uncertain text as inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "??uncertain??"));
    const text = renderText(document);
    expect(text).toContain("uncertain");
    expect(text).not.toContain("??");
  });

  it("renders highlight as inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "==bright=="));
    const text = renderText(document);
    expect(text).toContain("bright");
    expect(text).not.toContain("==");
  });

  it("renders aside as empty string", () => {
    const [document] = compile(markitWithContent("{#1}", "text @aside@ end"));
    expect(renderText(document)).not.toContain("aside");
  });

  it("renders foreign text as inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "$foreign$"));
    expect(renderText(document)).toContain("foreign");
  });

  it("renders Latin text as inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "$la:Roma$"));
    expect(renderText(document)).toContain("Roma");
  });

  it("renders French text as inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "$fr:Paris$"));
    expect(renderText(document)).toContain("Paris");
  });

  it("renders Greek text as transliterated inner text", () => {
    const [document] = compile(markitWithContent("{#1}", "$gr:logos$"));
    expect(renderText(document)).toContain("λογος");
  });

  it("renders footnote reference as <id>", () => {
    const [document] = compile(
      markitWithContent("{#1}", "See <n1>.", "", "{#n1}", "Footnote."),
    );
    expect(renderText(document)).toContain("<n1>");
  });

  it("renders page break as |", () => {
    const [document] = compile(markitWithContent("{#1}", "before || after"));
    expect(renderText(document)).toContain("|");
  });

  it("renders line break as newline", () => {
    const [document] = compile(
      markitWithContent("{#1}", "line one //", "line two"),
    );
    expect(renderText(document)).toContain("line one\nline two");
  });

  it("renders non-breaking space as a single space", () => {
    const [document] = compile(markitWithContent("{#1}", "a~b"));
    expect(renderText(document)).toContain("a b");
  });

  it("renders em space as two spaces", () => {
    const [document] = compile(markitWithContent("{#1}", "a~~b"));
    expect(renderText(document)).toContain("a  b");
  });

  it("renders illegible text as <illegible>", () => {
    const [document] = compile(markitWithContent("{#1}", "???"));
    expect(renderText(document)).toContain("<illegible>");
  });
});
