# Markit Project Guidelines

## Overview

Markit is a textual markup language similar to Markdown, designed for textual preservation projects. The compiler is a best-effort, error-tolerant pipeline that always produces output even when encountering errors, enabling live preview and gradual fixing workflows.

For language specification, see [SPECIFICATION.md](../SPECIFICATION.md).

## Architecture

- **Core compiler**: Functional pipeline with sequential stages (split → tree generation → metadata parsing → content parsing)
- **Tuple return convention**: All public APIs return `[output, errors]` tuples—always produce output, accumulate diagnostics
- **Position tracking**: Use symbol-based `startLine`/`endLine` metadata (not regular JSON keys) for editor tooling integration
- **Output formats**: Base compiler produces structured objects; separate renderers for HTML/JSON/text
- **Formatter**: Line-by-line state machine with context transitions and buffered content

Key modules:

- [src/compile.ts](../src/compile.ts): Main compilation orchestration
- [src/types.ts](../src/types.ts): Shared domain model and grammar constants
- [src/format.ts](../src/format.ts): Document formatter entry point
- [src/compile/](../src/compile/): Pipeline stage implementations
- [src/format/](../src/format/): Formatting state machine handlers

The VS Code extension ([vscode-markit/](../vscode-markit/)) is a thin wrapper that delegates all semantic operations to the core compiler.

## Code Style

- **TypeScript**: Strict mode with all strict options enabled ([tsconfig.json](../tsconfig.json))
- **Functional style**: Prefer pure functions, minimize mutable state, favour recursive traversal for tree operations
- **ES modules**: All imports must include `.js`/`.ts` extensions (verbatimModuleSyntax enabled)
- **Array safety**: Use `noUncheckedIndexedAccess` — array access may be undefined
- **Error tolerance**: Invalid constructs should produce diagnostics and continue with fallback parsing
- **Formatting**: Prettier with default settings

## Contributing

- For every new language feature, always write a failing test first
- Verify tests pass and coverage is 100% before submitting a PR

## Build and Test

```bash
# Install dependencies
npm install

# Build compiler
npm run build

# Build VS Code extension
npm run build:vscode

# Run tests (includes type checking and format validation)
npm test

# Run tests in watch mode
npm run test:watch

# View test coverage
npm run test:coverage

# Type check without building
npm run check

# Format code
npm run format
```

## Testing Conventions

There are six text files in the `test` directory:

- `compile.test.ts`: Tests for the main compilation pipeline, describing all the all the expected behaviours for _valid_ Markit code
- `compile.errors.test.ts`: Tests for error handling in the compilation pipeline, describing all the expected behaviours for _invalid_ Markit code
- `format.test.ts`: Tests for the formatter, describing all the expected behaviours for _valid_ Markit code (we're not specifying how the formatter handles invalid code)
- `compile.html.test.ts`: A test that the HTML renderer produces the expected output for a fixture file that illustrates all the features of the language (`test/fixtures/example.mit` → `test/fixtures/example.html`), alongside a basic test that it passes core compiler errors through
- `compile.text.test.ts`: A test that the text renderer produces the expected output for a fixture file that illustrates all the features of the language (`test/fixtures/example.mit` → `test/fixtures/example.txt`), alongside a basic test that it passes core compiler errors through
- `compile.json.test.ts`: Two basic tests that the JSON renderer produces the same output as the core compiler but as a JSON string, and passes errors through

New tests should be added to `compile.test.ts` or `compile.errors.test.ts`, depending on whether they describe valid or invalid code. The other four test files should rarely need to be updated.

Tests should only call the public APIs (`compile`, `format`, `compileToHTML`, `compileToText`, and `compileToJSON`), and should aim for 100% code coverage (and no dead code).

## Conventions

- **Error positions**: Internally use 0-based offsets, normalize to 1-based line/column for public errors
- **Grammar centralization**: Element types and specs are defined as constants in [src/types.ts](../src/types.ts), consumed by parsers
- **Recursive document traversal**: Standard pattern for compilation, rendering, and folding
- **Reserved metadata keys**: `id`, `metadata`, `blocks`, `children` (document); `id`, `type`, `content`, `metadata` (block)
- **Symbol metadata pattern**: Store editor-only metadata on symbols to keep JSON output clean
- **Whitespace handling**: Content is trimmed, line breaks → spaces, multiple spaces → single space (except explicit markers like `~`, `//`)

## VS Code Extension

Located in [vscode-markit/](../vscode-markit/), structured as LSP client-server:

- **Client**: Extension host, handles commands and preview webview
- **Server**: LSP process, provides diagnostics, folding, formatting
- **Integration**: Direct imports from main compiler package
- **Preview sync**: Uses `data-line` attributes from HTML output for editor-to-preview scrolling

Build separately with `npm run build:vscode`.
