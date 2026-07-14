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

## Architecture

The compiler is error-tolerant: it always produces output and accumulates diagnostics, enabling live preview workflows.

**Pipeline**: split → tree generation → metadata parsing → content parsing.

- [src/types.ts](./src/types.ts): Domain model and grammar constants (element types, specs)
- [src/compile.ts](./src/compile.ts): Compilation orchestration
- [src/compile/](./src/compile/): Pipeline stage implementations
- [src/format.ts](./src/format.ts): Formatter entrypoint (state machine)
- [src/format/](./src/format/): Handlers for each formatter state
- [src/renderText.ts](./src/renderText.ts): Converts compiler output to plain text
- [src/tokenize.ts](./src/tokenize.ts): Tokenizes a Markit document into a stream of word tokens
- [src/tei/](./src/tei/): Lossless conversion to/from TCP/TEI XML (`fromTEIXML`/`toTEIXML`)
- [vscode-markit/](./vscode-markit/): VS Code LSP extension (bundled with esbuild)

### Source code organization

The `src/` directory separates public API from implementation details:

```
src/
├── lib/           # Shared utilities used by multiple modules
├── compile/       # Compiler pipeline implementation
├── format/        # Formatter state machine implementation
├── compile.ts     # Public API: compilation function (orchestration only)
├── format.ts      # Public API: autoformatting function (orchestration only)
├── renderText.ts  # Public API: text rendering (self-contained)
├── types.ts       # Public API: language definition (types, grammar constants)
└── index.ts       # Public API entry point (re-exports)
```

### Source code conventions

- **TypeScript strict**: all options on; `noUncheckedIndexedAccess` means array access may be undefined
- **ES modules**: imports must include `.js`/`.ts` extensions (`verbatimModuleSyntax`)
- **Functional style**: pure functions, recursive tree traversal, minimal mutable state
- **Formatting**: Prettier with default settings

### Compiler design conventions

- **Error tolerance**: invalid constructs → emit diagnostic, continue with fallback parsing
- **Error positions**: 0-based internally, 1-based in public errors
- **Symbol metadata**: editor-only data (e.g. `startLine`/`endLine`) goes on symbols, not JSON keys
- **Grammar**: define element types and specs as constants in [src/types.ts](./src/types.ts), consumed by parsers
