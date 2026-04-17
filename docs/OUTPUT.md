# Markit Output Format

Markit documents are compiled to a JSON format that captures the hierarchical structure of texts and their content.

1. [Top-Level Structure](#1-top-level-structure)
2. [Block Content](#2-block-content)
3. [Error Handling](#3-error-handling)

## 1. Top-Level Structure

Each text is represented as a JSON object with the following properties:

- `id`: the ID of the text (from the id block)
- `metadata`: an object containing the text's metadata (omitted if no metadata block is present)
- `blocks`: an array of content blocks (see below)
- `children`: an array of child texts, each with the same top-level structure

For example, a text with `author = "Jane"` metadata and a block `{#1}` would produce:

```json
{
  "id": "Text",
  "metadata": {
    "author": "Jane"
  },
  "blocks": [
    {
      "id": "Text.1",
      "content": [...]
    }
  ],
  "children": []
}
```

Note that the block ID of `1` becomes `Text.1` in the output, to ensure uniqueness across the whole document.

## 2. Block Content

Each element in a block's `content` array is a `BlockElement`:

| Type         | Shape                                        | Notes                                     |
| ------------ | -------------------------------------------- | ----------------------------------------- |
| `Heading`    | `{ "type": "heading", "content": [...] }`    | `content` is an array of `HeadingLine`s   |
| `Paragraph`  | `{ "type": "paragraph", "content": [...] }`  | `content` is an array of `InlineElement`s |
| `Blockquote` | `{ "type": "blockquote", "content": [...] }` | `content` is an array of `Paragraph`s     |

`Heading` content is made up of `HeadingLine`s::

| Type          | Shape                                                       | Notes                                     |
| ------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `HeadingLine` | `{ "type": "headingLine", "level": 1-6, "content": [...] }` | `content` is an array of `InlineElement`s |

`Paragraph` and `HeadingLine` content is made up of `InlineElement`s:

| Type                | Shape                                                     | Notes                                                  |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `Strong`            | `{ "type": "strong", "content": [...] }`                  | `content` is an array of `InlineElement`s              |
| `Emphasis`          | `{ "type": "emphasis", "content": [...] }`                | `content` is an array of `InlineElement`s              |
| `Quote`             | `{ "type": "quote", "content": [...] }`                   | `content` is an array of `InlineElement`s              |
| `Blockquote`        | `{ "type": "blockquote", "content": [...] }`              | `content` is an array of `InlineElement`s              |
| `Language`          | `{ "type": "language", "lang": "grc", "content": [...] }` | `lang` is an ISO 639 code; omitted for generic `$...$` |
| `Person`            | `{ "type": "person", "content": [...] }`                  | `content` is an array of `InlineElement`s              |
| `Place`             | `{ "type": "place", "content": [...] }`                   | `content` is an array of `InlineElement`s              |
| `Speaker`           | `{ "type": "speaker", "content": [...] }`                 | `content` is an array of `InlineElement`s              |
| `Aside`             | `{ "type": "aside", "content": [...] }`                   | `content` is an array of `InlineElement`s              |
| `Insertion`         | `{ "type": "insertion", "content": [...] }`               | `content` is an array of `InlineElement`s              |
| `Deletion`          | `{ "type": "deletion", "content": [...] }`                | `content` is an array of `InlineElement`s              |
| `Uncertain`         | `{ "type": "uncertain", "content": [...] }`               | `content` is an array of `InlineElement`s              |
| `Highlight`         | `{ "type": "highlight", "content": [...] }`               | `content` is an array of `InlineElement`s              |
| `Citation`          | `{ "type": "citation", "content": [...] }`                | `content` is an array of `InlineElement`s              |
| `PlainText`         | `{ "type": "plainText", "content": "..." }`               | `content` is a plain string                            |
| `NbSpace`           | `{ "type": "nbSpace" }`                                   | `~` — non-breaking space                               |
| `EmSpace`           | `{ "type": "emSpace" }`                                   | `~~` — em space / tab                                  |
| `LineBreak`         | `{ "type": "lineBreak" }`                                 | `//` — line break                                      |
| `PageBreak`         | `{ "type": "pageBreak", "ref": "12r" }`                   | `\|\|` or `\|ref\|`; `ref` is omitted for bare breaks  |
| `Illegible`         | `{ "type": "illegible" }`                                 | `???` — illegible text                                 |
| `FootnoteReference` | `{ "type": "footnoteReference", "id": "n1" }`             | `id` is the referenced footnote ID                     |

For example, the Markit input `This is *strong* text.` is represented as:

```json
{
  "type": "paragraph",
  "content": [
    { "type": "plainText", "content": "This is " },
    {
      "type": "strong",
      "content": [{ "type": "plainText", "content": "strong" }]
    },
    { "type": "plainText", "content": " text." }
  ]
}
```

## 3. Error Handling

The compiler is error-tolerant: it always produces a JSON output and accumulates diagnostics (returning them separately as a list of errors), which makes it suitable for live-preview workflows. The output will always be structurally valid, but may be incoherent in case of syntax errors - no guarantees are made in such cases.
