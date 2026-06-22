# Markit Project Guidelines

Markit is a markup language for textual preservation. The compiler is error-tolerant: it always produces output and accumulates diagnostics, enabling live preview workflows.

Syntax: [SPECIFICATION.md](../SPECIFICATION.md)

## Architecture

**Pipeline**: split → tree generation → metadata parsing → content parsing

- [src/types.ts](../src/types.ts): Domain model and grammar constants (element types, specs)
- [src/compile.ts](../src/compile.ts): Compilation orchestration
- [src/compile/](../src/compile/): Pipeline stage implementations
- [src/format.ts](../src/format.ts): Formatter entrypoint (state machine)
- [src/format/](../src/format/): Handlers for each formatter state
- [src/renderHTML.ts](../src/renderHTML.ts): Converts compiler output to HTML
- [src/renderText.ts](../src/renderText.ts): Converts compiler output to plain text
- [src/tei/](../src/tei/): Lossless conversion to/from TCP/TEI XML (`fromTEIXML`/`toTEIXML`); self-contained `xml.ts` reader/writer, a schema adapter, and the two walkers
- [vscode-markit/](../vscode-markit/): VS Code LSP extension — thin wrapper, delegates to core, has no tests

## Source Code Organization

The `src/` directory is organized to separate public API from implementation details:

```
src/
├── lib/           # Shared utilities used by multiple modules
├── compile/       # Compiler pipeline implementation
├── format/        # Formatter state machine implementation
├── compile.ts     # Public API: compilation function (orchestration only)
├── format.ts      # Public API: autoformatting function (orchestration only)
├── renderHTML.ts  # Public API: HTML rendering (self-contained)
├── renderText.ts  # Public API: text rendering (self-contained)
├── types.ts       # Public API: language definition (types, grammar constants)
└── index.ts       # Public API entry point (re-exports)
```

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

## Commands

```bash
npm run format                             # Format with Prettier
npm test                                   # Type check, format, and run all tests
npx vitest run test/compile.tag.test.ts    # Run a single test file
npm run test:coverage                      # Coverage report
npm run build                              # Build compiler
npm run build:vscode                       # Build VS Code extension
```

## Coding Guidelines

- Tests check for correct formatting. Always run `npm run format` before testing.
- Tests must always have 100% coverage. Use `npm run test:coverage` to check - then either add tests or remove dead/defensive code if less than 100%.
- Write the tests first, then implement the code to make them pass. This ensures test coverage and helps clarify requirements.

## Conversation Guidelines

Be direct at all times. You have been trained on an enormous amount of collective wisdom, and the person you are speaking to wants the benefit of that wisdom. They do not want you to reinforce or put a positive spin on their ideas if you think they are flawed.
