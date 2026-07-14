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
const [document, errors] = compile(markitInput);
const textOutput = renderText(document);
```

The `compile` function returns a tuple of the form `[document, errors]`, where `document` is the compiled result and `errors` is an array of any syntax errors encountered during compilation. The `document` is always produced even if there are errors, so you can choose to use it anyway (e.g. for a best-effort preview), but you should always check the `errors` array to see if there were any issues with the input.

`renderText` takes a compiled document and returns its plain-text projection.

### Tokenization

Two functions expose a document's words for indexing and search:

- `tokenize(document)` walks a compiled document in reading order and returns an array of word tokens. Each token carries its `text` (with any non-breaking spaces normalised to plain spaces, so `a~priori` reads as `"a priori"`) and its `[start, end)` offsets into the `renderText(document)` output — enough to highlight the word in the rendered text.
- `compile(text, { tokens: true })` compiles and tokenizes in a single pass, returning `[document, errors, tokens]`. These tokens additionally carry a `source` span: the word's `{ line, column }` range in the original Markit source. A bare `tokenize(document)` cannot recover this (the rendered text carries no provenance), so reach for the `{ tokens: true }` form whenever you need to map a word back to where it was written.

```typescript
import { compile, tokenize } from "@earlytexts/markit";

// Compile and tokenize in one pass; tokens carry source positions.
const [document, errors, tokens] = compile(markitInput, { tokens: true });
// tokens[0] === { text: "...", start, end, source: { start, end } }

// Or tokenize an already-compiled document (rendered-text offsets only):
const [doc] = compile(markitInput);
const tokens = tokenize(doc);
// tokens[0] === { text: "...", start, end }  // no `source` property
```

## Architecture

The compiler is error-tolerant: it always produces output and accumulates diagnostics, enabling live-preview workflows. Compilation runs as a four-stage pipeline: split → tree generation → metadata parsing → content parsing.

The `src/` directory separates the public API (the top-level modules, re-exported from `index.ts`) from the implementation details beneath them:

```
src/
├── compile.ts     # Public API: compile a Markit string → document (+ optional tokens)
├── format.ts      # Public API: autoformat a Markit string (orchestration only)
├── renderText.ts  # Public API: render a compiled document to plain text
├── tokenize.ts    # Public API: tokenize a compiled document into word tokens
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
