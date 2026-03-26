# Markit Project Guidelines

Markit is a markup language for textual preservation. The compiler is error-tolerant: it always produces output and accumulates diagnostics, enabling live preview workflows.

Syntax: [SPECIFICATION.md](../SPECIFICATION.md)
Example: [test/fixtures/example.mit](../test/fixtures/example.mit)

## Architecture

**Pipeline**: split → tree generation → metadata parsing → content parsing

- [src/types.ts](../src/types.ts): Domain model and grammar constants (element types, specs)
- [src/compile.ts](../src/compile.ts): Compilation orchestration
- [src/compile/](../src/compile/): Pipeline stage implementations
- [src/format.ts](../src/format.ts): Formatter entrypoint (state machine)
- [src/format/](../src/format/): Handlers for each formatter state
- [src/compileToHTML.ts](../src/compileToHTML.ts): HTML renderer (depends on `compile`)
- [src/compileToText.ts](../src/compileToText.ts): Plain text renderer (depends on `compile`)
- [src/compileToJSON.ts](../src/compileToJSON.ts): JSON renderer (depends on `compile`)
- [vscode-markit/](../vscode-markit/): VS Code LSP extension — thin wrapper, delegates to core, has no tests

All public APIs return `[output, errors]` tuples.

## Source Code Conventions

- **TypeScript strict**: all options on; `noUncheckedIndexedAccess` means array access may be undefined
- **ES modules**: imports must include `.js`/`.ts` extensions (`verbatimModuleSyntax`)
- **Functional style**: pure functions, recursive tree traversal, minimal mutable state
- **Formatting**: Prettier with default settings

## Compiler Design Conventions

- **Error tolerance**: invalid constructs → emit diagnostic, continue with fallback parsing
- **Error positions**: 0-based internally, 1-based in public errors
- **Symbol metadata**: editor-only data (e.g. `startLine`/`endLine`) goes on symbols, not JSON keys
- **Grammar**: define element types and specs as constants in [src/types.ts](../src/types.ts), consumed by parsers

## Language and Output Conventions

- **Reserved keys** — document: `id`, `metadata`, `blocks`, `children`; block: `id`, `type`, `content`, `metadata`
- **Whitespace**: trim content, collapse line breaks and spaces to single space (except `~`, `//`)

## Adding a New Language Feature

1. Read [SPECIFICATION.md](../SPECIFICATION.md) to understand the syntax being added
2. Write a failing test in `test/` — use only public APIs (`compile`, `format`, `compileToHTML`, `compileToText`, `compileToJSON`); cover valid cases and error cases
3. Add element type and spec constants to [src/types.ts](../src/types.ts)
4. Implement parsing in the relevant [src/compile/](../src/compile/) stage
5. Add rendering support in affected renderers
6. Run `npm test` — all tests must pass with 100% coverage

## Commands

```bash
npm test                                     # Type check, format, and run all tests
npx vitest run test/compile.tag.test.ts      # Run a single test file
npm run test:coverage                        # Coverage report
npm run build                                # Build compiler
npm run build:vscode                         # Build VS Code extension
npm run format                               # Format with Prettier
```
