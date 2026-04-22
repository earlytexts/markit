# Markit

Markit is a textual markup language similar to Markdown, but designed for use in textual preservation projects, as a more human-readable alternative to TEI XML. It compiles to JSON for representing document structure and metadata, while the text content itself can then be further compiled to either plain text or HTML.

Markit comes with a VS Code extension which supports syntax highlighting, block folding, in-editor error reporting, and a live preview of the rendered HTML output.

## How to Use

1. Install Microsoft's [VS Code](https://code.visualstudio.com/) editor.
2. Install the [vscode-markit](https://marketplace.visualstudio.com/items?itemName=earlytexts.vscode-markit) extension.
3. Write your Markit document in a `.mit` file, following the syntax specified in the [specification](./SPECIFICATION.md).
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
import { compile, renderHTML, renderText } from "@earlytexts/markit";

const markitInput = `...`; // your Markit document as a string
const [document, errors] = compile(markitInput);
const htmlOutput = renderHTML(document);
const textOutput = renderText(document);
```

The `compile` function returns a tuple of the form `[document, errors]`, where `document` is the compiled result and `errors` is an array of any syntax errors encountered during compilation. The `document` is always produced even if there are errors, so you can choose to use it anyway (e.g. for a best-effort preview), but you should always check the `errors` array to see if there were any issues with the input.

The two functions `renderHTML` and `renderText` take a compiled document and return a string - either an HTML representation of the document or plain text.
