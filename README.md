# Markit

Markit is a textual markup language similar to Markdown, but designed for use in textual preservation projects, as a more human-readable alternative to TEI XML. It compiles to JSON for representing document structure and metadata, while the text content itself can further be compiled to either plain text (for search or analysis) or HTML (for display in a web page).

## How to Use

1. Install Microsoft's [VS Code](https://code.visualstudio.com/) editor.
2. Install the [vscode-markit](https://marketplace.visualstudio.com/items?itemName=earlytexts.vscode-markit) extension for Markit syntax highlighting, live preview, and other features.
3. Write your Markit document in a `.mit` file, following the syntax specified in the [specification](./SPECIFICATION.md). The editor will provide live feedback on any syntax errors.
4. Preview the rendered HTML output using the live preview feature (`Cmd+Shift+V` or `Ctrl+Shift+V`).
5. Compile your Markit document to JSON, HTML, or plain text using the provided commands (`Cmd+Shift+P` or `Ctrl+Shift+P` to open the command palette, then search for "Markit: Compile to JSON/HTML/Text").

## Markit Syntax

- See the [specification](./SPECIFICATION.md) for a complete description of the Markit syntax.
- See the [example.mit](./test/fixtures/example.mit) file for a sample Markit document demonstrating all the features.

## Programmatic Use (Advanced)

The Markit compiler is written in TypeScript and can be used programmatically in your own projects. You can install it via npm:

```bash
npm install @earlytexts/markit
```

Then you can import the compiler functions in your code:

```typescript
import {
  compile,
  compileToHTML,
  compileToJSON,
  compileToText,
} from "@earlytexts/markit";

const markitInput = `...`; // your Markit document as a string
const compiled = compile(markitInput);
const htmlOutput = compileToHTML(markitInput);
const jsonOutput = compileToJSON(markitInput);
const textOutput = compileToText(markitInput);
```

All these functions return a tuple of the form `[output, errors]`, where `output` is the compiled result and `errors` is an array of any syntax errors encountered during compilation.
The `output` is always produced even if there are errors, so you can choose to use it anyway (e.g. for a best-effort preview), but you should always check the `errors` array to see if there were any issues with the input.

The three functions `compileToJSON`, `compileToHTML`, `compileToText` all return a string as output. The base `compile` function returns a structured object representing the document, which can be useful if you want to produce your own custom mapping. See the [types](./src/types.ts) for a precise definition of the JSON output structure.
