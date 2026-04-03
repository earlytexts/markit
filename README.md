# Markit

Markit is a textual markup language similar to Markdown, but designed for use in
textual preservation projects, as a more human-readable alternative to TEI XML.
It compiles to JSON for representing document structure and metadata, while the
text content itself can further be compiled to either plain text (for search or
analysis) or HTML (for display in a web page).

## How to Use

1. Install Microsoft's [VS Code](https://code.visualstudio.com/) editor.
2. Install the
   [vscode-markit](https://marketplace.visualstudio.com/items?itemName=earlytexts.vscode-markit)
   extension for Markit syntax highlighting, live preview, and other features.
3. Write your Markit document in a `.mit` file, following the syntax specified
   in the [specification](./SPECIFICATION.md). The editor will provide live
   feedback on any syntax errors.
4. Preview the rendered HTML output using the live preview feature
   (`Cmd+Shift+V` or `Ctrl+Shift+V`).
5. Compile your Markit document to JSON, HTML, or plain text using the provided
   commands (`Cmd+Shift+P` or `Ctrl+Shift+P` to open the command palette, then
   search for "Markit: Compile to JSON/HTML/Text").

## Markit Syntax

- See the [specification](./SPECIFICATION.md) for a complete description of the
  Markit syntax.
- See the [example.mit](./test/fixtures/example.mit) file for a sample Markit
  document demonstrating all the features.

## Programmatic Use (Advanced)

The Markit compiler is written in TypeScript and can be used programmatically in
your own projects. You can install it via npm:

```bash
npm install @earlytexts/markit
```

Then you can import the compiler functions in your code:

```typescript
import { compile, renderHTML, renderText } from "@earlytexts/markit";

const markitInput = `...`; // your Markit document as a string
const options = {
  filePath: "path/to/your/document.mit", // required for resolving relative paths to external children
  embedExternalChildren: true, // defaults to true, set to false to not embed external children
};
const [document, errors] = compile(markitInput, options);
const htmlOutput = renderHTML(document);
const textOutput = renderText(document);
```

The `compile` function returns a tuple of the form `[document, errors]`, where
`document` is the compiled result and `errors` is an array of any syntax errors
encountered during compilation. The `document` is always produced even if there
are errors, so you can choose to use it anyway (e.g. for a best-effort preview),
but you should always check the `errors` array to see if there were any issues
with the input.

The second `options` argument is optional, but the `filePath` is required if you
are using (and want to embed) external children, since paths to external children
are relative to the parent document.

The two functions `renderHTML` and `renderText` take a compiled document and
return a string - either an HTML representation of the document or plain text.

For working with metadata in TypeScript, you can pass `TextMetadata` and
`BlockMetadata` types as type parameters to the `compile` function, which will
allow you to have type safety when accessing metadata in the compiled document.
For example:

```typescript
import { compile } from "@earlytexts/markit";

type TextMetadata = {
  title: string;
  author: string;
  published: number;
};

type BlockMetadata = {
  type: string;
};

const markitInput = `...`; // your Markit document as a string
const [document, errors] = compile<TextMetadata, BlockMetadata>(markitInput);

document.title; // TypeScript knows this is a string
document.author; // TypeScript knows this is a string
document.published; // TypeScript knows this is a number
document.blocks[0].type; // TypeScript knows this is a string
```

Note there is no built-in validation of metadata values - this just tells
TypeScript what the metadata _should_ look like, but it's up to you to ensure
that the actual metadata in the Markit document matches this structure.
