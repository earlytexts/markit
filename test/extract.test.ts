import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import compile, { compileWithPositions } from "../src/compile.ts";
import { extractText, highlight, resolve } from "../src/extract.ts";
import type { Block, Version } from "../src/types.ts";
import { markitWithContent, p, pt } from "./utils/factories.ts";

const blockOf = (...content: string[]): Block =>
  compile(markitWithContent("{#1}", ...content)).document.blocks[0]!;

const textOf = (...content: string[]): string =>
  extractText(blockOf(...content)).text;

describe("extractText — element contributions", () => {
  it("copies plain text verbatim, dropping wrapper furniture", () => {
    expect(textOf('He said "_yes_" [see *above*].')).toEqual(
      "He said yes see above.",
    );
  });

  it("keeps aside and uncertain content (analysis, not display)", () => {
    expect(textOf("a #aside# [?unsure?] b")).toEqual("a aside unsure b");
  });

  it("contributes U+00A0 for a non-breaking space", () => {
    expect(textOf("a~priori")).toEqual("a priori");
  });

  it("contributes a tab for `~~` and a newline for `\\`", () => {
    expect(textOf("a~~b \\ c")).toEqual("a\tb\nc");
  });

  it("contributes `[...]` for illegible text — no word characters", () => {
    expect(textOf("lost [...] found")).toEqual("lost [...] found");
  });

  it("contributes nothing for a footnote reference", () => {
    const { document } = compile(
      markitWithContent("{#1}", "before<n1> after", "", "{#n1}", "Note."),
    );
    expect(extractText(document.blocks[0]!).text).toEqual("before after");
  });

  it("joins a tight page break and spaces a loose one", () => {
    expect(textOf("be///ginning")).toEqual("beginning");
    expect(textOf("be//12//ginning")).toEqual("beginning");
    // Whitespace next to the break is trimmed at parse time, so the loose
    // break's own space is the only separator.
    expect(textOf("before /// after")).toEqual("before after");
  });

  it("recurses into word and language elements", () => {
    expect(textOf("the [w:humane=human] $la:verbum$ end")).toEqual(
      "the humane verbum end",
    );
  });

  it("recurses into generic raw elements", () => {
    expect(textOf('a <<TAG attr="v">>inside<</TAG>> b')).toEqual(
      "a inside b",
    );
  });
});

describe("extractText — versions", () => {
  it("keeps insertions and drops deletions for edited (the default)", () => {
    expect(textOf("colour[-s-][+ing+] fine")).toEqual("colouring fine");
  });

  it("keeps deletions and drops insertions for original", () => {
    const block = blockOf("colour[-s-][+ing+] fine");
    expect(extractText(block, { version: "original" }).text).toEqual(
      "colours fine",
    );
  });
});

describe("extractText — block joiners", () => {
  it("joins block elements, heading lines, and list items with newlines", () => {
    const title = compile(
      markitWithContent("{#title}", "^1 First", "^2 Second"),
    ).document.blocks[0]!;
    expect(extractText(title).text).toEqual("First\nSecond");
    expect(textOf("- one", "- two")).toEqual("one\ntwo");
    expect(textOf("para one.", "", "para two.")).toEqual(
      "para one.\npara two.",
    );
  });

  it("joins nested lists below their item", () => {
    expect(textOf("- one", "  - sub", "- two")).toEqual("one\nsub\ntwo");
  });

  it("joins blockquote children with newlines", () => {
    expect(textOf("> quoted one", ">", "> quoted two")).toEqual(
      "quoted one\nquoted two",
    );
  });

  it("joins table rows with newlines and cells with ` | `", () => {
    expect(textOf("| a | b |", "| c | d |")).toEqual("a | b\nc | d");
  });
});

describe("extractText — spans and context", () => {
  it("gives each contribution a span with the wrapper stack, outermost first", () => {
    const { text, spans } = extractText(blockOf('x "y _z_" w'));
    expect(text).toEqual("x y z w");
    expect(spans.map((s) => [text.slice(s.start, s.end), s.context])).toEqual([
      ["x ", []],
      ["y ", [{ type: "quote" }]],
      ["z", [{ type: "quote" }, { type: "emphasis" }]],
      [" w", []],
    ]);
  });

  it("carries word, language, element, and highlight frames", () => {
    const { spans } = extractText(
      blockOf('[w:humane=human] $la:verbum$ <<TAG a="v">>in<</TAG>>'),
    );
    const contexts = spans.map((s) => s.context);
    expect(contexts[0]).toEqual([{ type: "word", word: "human" }]);
    expect(contexts[1]).toEqual([]); // the joining space
    expect(contexts[2]).toEqual([{ type: "language", lang: "la" }]);
    expect(contexts[4]).toEqual([
      { type: "element", tag: "TAG", attributes: [{ name: "a", value: "v" }] },
    ]);
  });

  it("gives highlight elements a frame when re-extracting", () => {
    const marked = highlight(blockOf("one two"), [{ start: 4, end: 7 }]);
    const { spans } = extractText(marked);
    expect(spans.at(-1)!.context).toEqual([{ type: "highlight" }]);
  });

  it("gives synthetic joiners no span", () => {
    const { text, spans } = extractText(blockOf("| a | b |"));
    expect(text).toEqual("a | b");
    // Two spans (the cells); the ` | ` joiner belongs to neither.
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["a", "b"]);
  });

  it("omits source spans without positions, carries them with", () => {
    const bare = extractText(blockOf("plain"));
    expect(bare.spans[0]!.source).toBeUndefined();

    const sourced = compileWithPositions(markitWithContent("{#1}", "plain"))
      .document.blocks[0]!;
    expect(extractText(sourced).spans[0]!.source).toEqual({
      start: { line: 3, column: 0 },
      end: { line: 3, column: 5 },
    });
  });
});

describe("highlight", () => {
  it("wraps a range of the extracted text in a highlight element", () => {
    const block = blockOf("one two three");
    const marked = highlight(block, [{ start: 4, end: 7 }]);
    expect(marked.content).toEqual([
      p([
        pt("one "),
        { type: "highlight", content: [pt("two")] },
        pt(" three"),
      ]),
    ]);
  });

  it("marks several ranges in one pass", () => {
    const marked = highlight(blockOf("one two three"), [
      { start: 0, end: 3 },
      { start: 8, end: 13 },
    ]);
    expect(marked.content).toEqual([
      p([
        { type: "highlight", content: [pt("one")] },
        pt(" two "),
        { type: "highlight", content: [pt("three")] },
      ]),
    ]);
  });

  it("skips ranges that fall entirely outside a node", () => {
    // Two ranges around an untouched middle node: the trailing node skips the
    // first range, the leading node stops before the second.
    const marked = highlight(blockOf("one *two* three"), [
      { start: 0, end: 3 },
      { start: 8, end: 13 },
    ]);
    expect(marked.content).toEqual([
      p([
        { type: "highlight", content: [pt("one")] },
        pt(" "),
        { type: "strong", content: [pt("two")] },
        pt(" "),
        { type: "highlight", content: [pt("three")] },
      ]),
    ]);
  });

  it("splits only plainText, passing over other contributions", () => {
    // The range covers "a priori" including the U+00A0 the ~ contributes.
    const marked = highlight(blockOf("so a~priori it"), [
      { start: 3, end: 11 },
    ]);
    expect(marked.content).toEqual([
      p([
        pt("so "),
        { type: "highlight", content: [pt("a")] },
        { type: "nbSpace" },
        { type: "highlight", content: [pt("priori")] },
        pt(" it"),
      ]),
    ]);
  });

  it("measures ranges against the requested version", () => {
    // "colours" spans two plainText nodes in the original version (the "s"
    // sits in a deletion), so the one range yields two highlights.
    const block = blockOf("colour[-s-] fine");
    const marked = highlight(block, [{ start: 0, end: 7 }], "original");
    expect(marked.content).toEqual([
      p([
        { type: "highlight", content: [pt("colour")] },
        { type: "highlight", content: [pt("s")] },
        pt(" fine"),
      ]),
    ]);
  });

  it("highlights within wrappers, keeping the wrapper", () => {
    const marked = highlight(blockOf('say "yes now"'), [
      { start: 4, end: 7 },
    ]);
    expect(marked.content).toEqual([
      p([
        pt("say "),
        {
          type: "quote",
          content: [
            { type: "highlight", content: [pt("yes")] },
            pt(" now"),
          ],
        },
      ]),
    ]);
  });
});

describe("resolve", () => {
  it("resolves edited: insertions unwrapped, deletions gone", () => {
    const block = blockOf("colour[-s-][+ing+] fine");
    expect(resolve(block, "edited").content).toEqual([
      p([pt("colour"), pt("ing"), pt(" fine")]),
    ]);
  });

  it("resolves original: deletions unwrapped, insertions gone", () => {
    const block = blockOf("colour[-s-][+ing+] fine");
    expect(resolve(block, "original").content).toEqual([
      p([pt("colour"), pt("s"), pt(" fine")]),
    ]);
  });

  it("leaves non-editorial structure intact", () => {
    const block = blockOf("- one", "- two");
    expect(resolve(block, "edited")).toEqual(block);
  });
});

describe("extraction and versions agree everywhere", () => {
  it("resolve then extract equals extract with the version", () => {
    for (const version of ["edited", "original"] as Version[]) {
      const block = blockOf(
        "x^2^ ,,sub,, [-old-][+new+] @HAMLET@ ::aloud:: [p:Hume] a~priori",
      );
      expect(extractText(resolve(block, version)).text).toEqual(
        extractText(block, { version }).text,
      );
    }
  });
});
