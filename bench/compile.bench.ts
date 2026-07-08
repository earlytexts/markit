import compile from "../src/compile.ts";
import generateTextTree from "../src/compile/generateTextTree.ts";
import parseContent from "../src/compile/parseContent.ts";
import parseMetadata from "../src/compile/parseMetadata.ts";
import splitIntoBlocks from "../src/compile/splitIntoBlocks.ts";
import type { RawBlock } from "../src/compile/splitIntoBlocks.ts";

// Generate a large synthetic document shaped like a real corpus text: nested
// sections with metadata and title blocks, prose paragraphs rich in inline
// markup, footnotes and references, page breaks, lists, tables, blockquotes,
// and character/Greek modes. Tiled to roughly the size of the largest corpus
// file (~1.5MB), so benchmark numbers track real-world compile times.
const TARGET_BYTES = 1.5 * 1024 * 1024;

const paragraph = (n: number): string =>
  `{#${n}, pages="${n}-${n + 1}"}\n` +
  `*All* the perceptions of the _human mind_ resolve themselves into two ` +
  `distinct kinds, which I shall call *Impressions* and *Ideas*<n${n}>. The ` +
  `difference betwixt these consists in the degrees of "force and liveliness" ` +
  `with which they strike upon the mind ///and make their way into our thought ` +
  `or consciousness. Those perceptions, which enter with most force, we may ` +
  `name _impressions_; and under this name I comprehend all our sensations, ` +
  `passions and emotions, as they make their first appearance in the soul. ` +
  `By _ideas_ I mean the faint images of these in thinking and reasoning; ` +
  `such as [-the-][+our+] perceptions excited by the present discourse, the ` +
  `{ae}ther of the antients, and what $gr:{{sofia}}$ meant to the Greeks. ` +
  `Every one of himself will readily perceive the difference betwixt feeling ` +
  `and thinking; tho' it is not impossible but in particular instances they ` +
  `may very nearly approach each other, as [p:Mons. Malebranche] observes.\n`;

const footnote = (n: number): string =>
  `{#n${n}}\nSee _Essays on the Understanding_, part 2, sect. 4, where the ` +
  `same distinction is drawn at greater length.\n`;

const section = (id: number): string => {
  const base = id * 10;
  const parts = [
    `## S${id}\n`,
    `[metadata]\ntitle = "Section ${id}"\nbreadcrumb = "Section ${id}"\n` +
    `published = [${1700 + (id % 80)}]\n`,
    `{#title}\n^3 SECT. ${id}.\n^4 _Of the origin of our ideas._\n`,
  ];
  for (let p = 1; p <= 6; p++) parts.push(paragraph(base + p));
  parts.push(
    `{#${base + 7}}\nThe kinds of perception are these:\n\n` +
      `- impressions\n  - of sensation\n  - of reflexion\n- ideas\n\n` +
      `1. simple\n2. complex\n`,
    `{#${base + 8}}\n| Kind | Force | Example |\n| - | - | - |\n` +
      `| impression | strong | pain of heat |\n| idea | faint | memory of pain |\n`,
    `{#${base + 9}}\n> A quotation from an elder author, with *emphasis* ` +
      `and a reference<n${base + 1}>.\n> Its second line, \\\n> and a third.\n`,
  );
  for (let p = 1; p <= 6; p++) parts.push(footnote(base + p));
  return parts.join("\n");
};

const buildInput = (): string => {
  const parts = [
    "# Bench.Doc\n",
    '[metadata]\nimported = true\ntitle = "A Benchmark of Human Nature"\n' +
    'breadcrumb = "Benchmark"\nauthors = ["bench"]\npublished = [1740]\n',
    "{#title}\n^1 A Benchmark of Human Nature\n",
  ];
  let size = 0;
  for (let id = 1; size < TARGET_BYTES; id++) {
    const s = section(id);
    parts.push(s);
    size += s.length;
  }
  return parts.join("\n");
};

const input = buildInput();

// Precomputed intermediate results so each stage can be measured in isolation.
const blocks = splitIntoBlocks(input) as [RawBlock, ...RawBlock[]];
const [tree] = generateTextTree(blocks);
const [treeWithMetadata] = parseMetadata(tree);

Deno.bench(`compile (${(input.length / 1024 / 1024).toFixed(1)}MB)`, () => {
  compile(input);
});

Deno.bench("stage: splitIntoBlocks", () => {
  splitIntoBlocks(input);
});

Deno.bench("stage: generateTextTree", () => {
  generateTextTree(blocks);
});

Deno.bench("stage: parseMetadata", () => {
  parseMetadata(tree);
});

Deno.bench("stage: parseContent", () => {
  parseContent(treeWithMetadata);
});
