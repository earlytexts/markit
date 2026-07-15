# Markit

Markit is a textual markup language similar to Markdown, but designed for use in textual preservation projects, as a more human-readable alternative to TEI XML. It compiles to JSON for representing document structure and metadata, while the text content itself can then be further compiled to either plain text or HTML.

See the [specification](./SPECIFICATION.md) for a complete description of the Markit syntax.

Markit comes with a VS Code language server extension which supports syntax highlighting, block folding, in-editor error reporting, and a live preview of the rendered HTML output.

## How to Use

1. Install Microsoft's [VS Code](https://code.visualstudio.com/) editor.
2. Install the [Markit](https://marketplace.visualstudio.com/items?itemName=earlytexts.markit-language) extension.
3. Write your Markit document in a `.mit` file, following the syntax specified in the [specification](./SPECIFICATION.md).
4. Preview the rendered HTML output using the live preview feature (`Cmd+Shift+V` or `Ctrl+Shift+V`).
5. Compile your Markit document to JSON, HTML, or plain text using the provided commands (`Cmd+Shift+P` or `Ctrl+Shift+P` to open the command palette, then search for "Markit: Compile to JSON/HTML/Text").

## Programmatic Use (Advanced)

The Markit compiler is written in TypeScript and can be used programmatically in your own projects. You can install it via npm:

```bash
npx jsr add @earlytexts/markit
```

Then you can import the compiler functions in your code:

```typescript
import { compile, renderText } from "@earlytexts/markit";

const markitInput = `...`; // your Markit document as a string
const { document, errors } = compile(markitInput);
const textOutput = renderText(document);
```

The `compile` function returns an object of the form `{ document, errors }`, where `document` is the compiled result and `errors` is an array of any syntax errors encountered during compilation. The `document` is always produced even if there are errors, so you can choose to use it anyway (e.g. for a best-effort preview), but you should always check the `errors` array to see if there were any issues with the input.

`compileWithPositions` is identical, except that every run of plain text in the document additionally carries per-character source positions, so extraction and tokenisation (below) can map any character back to the line and column it was written at. It is kept separate because the positions are plain serialisable properties, and always recording them would bloat stored JSON.

`renderText` takes a compiled document and returns its plain-text *display* projection: the text a reader would see, string furniture included (quote marks, citation brackets, `<illegible>` markers). It is not meant for analysis — for that, use the extraction functions below.

### Extraction and tokenization

The analysis projection works block by block (blocks are the retrieval unit in the corpus this language serves):

- `extractText(block, { version? })` returns `{ text, spans }`: the block's plain text with all markup furniture dropped, and one span per contributing source element carrying the full wrapper context around it (outermost first). Editorial markup is resolved to one `version` — `"edited"` (the default: insertions kept, deletions dropped) or `"original"` (the reverse). A non-breaking space (`~`) extracts as U+00A0, so a marked multi-word unit (`a~priori`) reads as a single word.
- `tokenize(block, { version? })` runs the word alphabet (`wordPattern`, also exported) over that extracted text and returns the block's word tokens in reading order. Each token carries its `text` (U+00A0 normalised to a plain space, so `a~priori` reads `"a priori"`), its `[start, end)` offsets into the extracted text, its wrapper `context`, and the distilled `word` (nearest `[w:…=word]` value) and `lang` (nearest language code). Tokens from a `compileWithPositions` document also carry a `source` span: the word's `{ line, column }` range in the original Markit source.
- `highlight(block, ranges, version?)` returns a copy of the block with the given ranges of its extracted text wrapped in `highlight` elements — the same walk as `extractText`, so offsets always line up. `resolve(block, version)` is `highlight` with no ranges: it strips editorial markup down to one side's reading text.

```typescript
import { compileWithPositions, extractText, tokenize } from "@earlytexts/markit";

const { document, errors } = compileWithPositions(markitInput);
const block = document.blocks[0];

const { text, spans } = extractText(block);
const tokens = tokenize(block);
// tokens[0] === { text, start, end, context, word?, lang?, source: { start, end } }

// With plain `compile` the same calls work; tokens just carry no `source`.
```

## Architecture

The compiler is error-tolerant: it always produces output and accumulates diagnostics, enabling live-preview workflows. Compilation runs as a four-stage pipeline: split → tree generation → metadata parsing → content parsing.

The `src/` directory separates the public API (the top-level modules, re-exported from `index.ts`) from the implementation details beneath them:

```
src/
├── compile.ts     # Public API: compile a Markit string → document (compileWithPositions adds source positions)
├── format.ts      # Public API: autoformat a Markit string (orchestration only)
├── renderText.ts  # Public API: render a compiled document to plain text (display projection)
├── extract.ts     # Public API: extractText / highlight / resolve (block-level analysis projection)
├── tokenize.ts    # Public API: tokenize a block into word tokens (over the extraction)
├── types.ts       # Public API: the language's type definitions
├── index.ts       # Public API entry point (re-exports)
├── compile/       # Compiler pipeline stages
├── format/        # Formatter state-machine handlers
├── tei/           # Lossless TCP/TEI XML conversion (fromTEIXML / toTEIXML)
└── lib/           # Shared internals, incl. grammar.ts (the markers/specs the parser matches)
```

The VS Code language-server extension lives alongside `src/` in [markit-language/](./markit-language/) (bundled with esbuild).

### Source code conventions

- **TypeScript strict**: all options on; `noUncheckedIndexedAccess` means array access may be undefined
- **ES modules**: imports must include `.js`/`.ts` extensions (`verbatimModuleSyntax`)
- **Functional style**: pure functions, recursive tree traversal, minimal mutable state
- **Formatting**: Prettier with default settings

### Compiler design conventions

- **Error tolerance**: invalid constructs → emit diagnostic, continue with fallback parsing
- **Error positions**: 0-based internally, 1-based in public errors
- **Symbol metadata**: editor-only data (e.g. `startLine`/`endLine`) goes on symbols, not JSON keys
- **Grammar**: element types are defined in [src/types.ts](./src/types.ts); the matching markers and specs live as constants in [src/lib/grammar.ts](./src/lib/grammar.ts), consumed by the parsers
