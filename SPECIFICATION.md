# Language Specification

## Document Structure

A Markit _document_ is a UTF-8 or UTF-16 encoded text file with a `.mit` extension. It consists of one or more _texts_ arranged in a hierarchical tree structure. Each text starts with one or more `#` characters followed by a unique identifier (ID). The number of `#` characters indicates the text's level in the hierarchy (e.g. `#` for top-level texts, `##` for their children, etc.).

```
# Author.Title

...

## Author.Title.Chapter1

...

### Author.Title.Chapter1.Section1

...

### Author.Title.Chapter2

...
```

IDs can be any non-empty string that doesn't contain whitespace or the `#` character. They are case-sensitive and must be unique across the document. They should also be unique across your corpus, but the compiler does not enforce this.

It is conventional (and recommended) to use dot notation for IDs, as in the example above, but this is not required.

## Text Metadata

Every text ID can optionally be followed by _metadata_ in a YAML-like format. It is conventional to leave a blank line between the ID and the metadata, but this is not required.

```
# Author.Title

reviewed: true
reviewedOn: "2024-06-01"
firstPublished: 1721
title: "The Full Title of the Work"
tags: ["philosophy", "metaphysics"]
otherEditions:
  - "Author.Title.Edition1"
  - "Author.Title.Edition2"
  - "Author.Title.Edition3"
```

Only a subset of YAML is supported:

- Values can be strings, numbers, Booleans (`true` or `false`), or arrays of strings/numbers/Booleans. Objects and nested structures are not supported.
- Strings _must_ be enclosed in double quotes. A double quote inside a string must be escaped with a backslash (e.g. `\"`).
- Arrays cannot be of mixed types (e.g. `["string", 123]` is not allowed).
- Arrays can be written in inline format (e.g. `tags` in the example above) or in block format (e.g. `otherEditions` in the example above).

The keys `id` and `blocks` are reserved and cannot be used in metadata. The `id` key is reserved for the text's ID, and the `blocks` key is reserved for the text's content blocks (described below).

## External Children

The `children` key is reserved for the text's children. These can either be defined _internally_ (i.e. in the same file, as above), or _externally_ (i.e. in separate files). The `children` key is used to declare external children:

```
# Author.Title

children:
  - "chapters/chapter1"
  - "chapters/chapter2"
```

External children are declared as file paths relative to the parent text's file. Including the `.mit` extension is optional. You can also link to a directory, in which case the compiler looks for an `index.mit` file in that directory.

External children must be valid Markit documents in their own right. In particular, they must start with a _top-level_ text ID (i.e. one that starts with a single `#` character); when embedded, they will have a level one lower than their parent. External children can themselves declare further external children, to arbitrary depth. These will all be embedded in the parent text's tree of children.

Internal and external children can be included in the same text. When this is the case, internal children come first, followed by external children in the order they appear in the `children` array.

## Content Blocks

Following the metadata (or the text ID if there is no metadata), a text can have any number of _content blocks_. A content block starts with a _block tag_ on a new line. A block tag contains (at least) a block ID, marked with a `#` character:

```
{#title}
...

{#1}
...

{#2}
...

{#subtitle}
...

{#3}
...

{#subtitle}
...

{#n1}
...
```

Block IDs must be unique within the immediate text (not within the whole document). In the compiled output, their IDs will be prefixed with the text's ID to ensure uniqueness across the entire document. They are conventionally numbered sequentially, but this is not required.

### Block Types

There are four types of content block, determined by the block ID:

- `title` blocks, which contain the title of the text. There can be at most one `title` block per text, and if present it must be the first block.
- `subtitle` blocks, which contain subtitles or section headings. There can be any number of `subtitle` blocks, and they can appear anywhere in the text. In the compiled output, they are given sequential IDs (e.g. `Author.Title.subtitle1`, `Author.Title.subtitle2`, etc.) to ensure uniqueness across the document.
- `n` blocks, which represent footnotes. They must appear at the end of the text, after all other content blocks. They can be referenced from inline markup in the content text (see below).
- Any other block ID is treated as a `paragraph` block.

### Block Metadata

Block tags can also include optional metadata as a comma-separated list of key-value pairs:

```
{#1, page=12, language="en"}
```

Values can be strings (enclosed in double quotes), numbers, or Booleans (`true` or `false`). The keys `id` and `content` are reserved and cannot be used in block metadata. The `id` key is reserved for the block's ID, and the `content` key is reserved for the block's content text.

### Special Metadata Keys

The keys `subsection` and `speaker` have a special meaning when used in paragraph blocks:

- `subsection` is used for a subsection number (and must be a number)
- `speaker` is used for the name of a speaker in a dialogue (and must be a string)

In the HTML or text output, these are rendered as a prefix to the block's first line, followed by a full-stop, i.e. `1. Rest of content...`, `Speaker. Rest of content...`.

## Content Text

### Block-Level Elements

The content of a block consists of one or more _block-level elements_. (Note that "blocks" and "block-level elements" are different things: a block is a container for content, while block-level elements are the structural components of that content.)

A block-level element is either a heading, a paragraph, a block quotation, or a list. The type of a block-level element is determined by its first character:

- A line starting with `^1`-`^6` is a heading line. The number after the `^` character indicates how large the text on that line should be (1 being the largest, 6 being the smallest). Consecutive heading lines are treated as part of the same heading block. Heading lines are only permitted in `title` and `subtitle` blocks (`title` and `subtitle` blocks can also contain other block-level elements).
- A line starting with `>` is a block quotation. Consecutive lines starting with `>` are part of the same block quotation.
- A line starting with `-` is a list item. Consecutive lines starting with `-` are part of the same list. (Nested lists are not supported.)
- A line starting with a number followed by a full stop (e.g. `1.`, `2.`, etc.) is a numbered list item. Consecutive lines starting with a number followed by a full stop are part of the same numbered list.
- Anything else is a paragraph. Consecutive lines that don't start with any of the above are part of the same paragraph.

Block-level elements can be separated by blank lines, but in general this is not required. A block-level element ends at the start of the next block-level element or at the end of the block. A blank line is required to separate block-level elements of the same type (e.g. two consecutive paragraphs).

Block-level elements _cannot_ in general contain other block-level elements, with the exception of block quotes, which may contain either paragraphs or lists (but not headings or other block quotes). For example:

```
> This block quotation.
>
> It containts two paragraphs, followed by a list:
>
> - Item 1
> - Item 2
```

In fact, block quotations can _only_ contain either paragraphs or lists - because the text inside a block quotation is necessarily inside a paragraph (if it isn't a list). But this is a technical detail that in practice you can ignore.

### Inline Elements

Block-level elements contain one or more _inline elements_. An inline element is either plain text or a special character sequence that represents some kind of formatting or semantic content (e.g. emphasis, a footnote reference, etc.). The following special character sequences are supported:

| Markit Input    | Meaning                      | HTML Equivalent                      |
| --------------- | ---------------------------- | ------------------------------------ |
| `"text"`        | an inline quotation          | `<q>text</q>`                        |
| `*text*`        | strong text                  | `<strong>text</strong>`              |
| `_text_`        | emphasised text              | `<em>text</em>`                      |
| `$text$`        | foreign text                 | `<em class="foreign">text</em>`      |
| `$$text$$`      | Greek text in Latin alphabet | `<em class="foreign">…</em>`         |
| `@text@`        | margin comment               | `<span class="aside">text</span>`    |
| `++insertion++` | editorial insertion          | `<ins>insertion</ins>`               |
| `--deletion--`  | editorial deletion           | `<del>deletion</del>`                |
| `==highlight==` | editorial highlight          | `<mark>highlight</mark>`             |
| `[citation]`    | citation                     | `<cite>citation</cite>`              |
| `~`             | a non-breaking space         | `&nbsp;`                             |
| `~~`            | a large space / tab          | `&emsp;`                             |
| `//`            | a line break                 | `<br />`                             |
| `\|`            | a page break                 | `<span class="page-break"></span>`   |
| `{SS}`          | section symbol               | `§`                                  |
| `{ae}`          | "ae" ligature                | `æ`                                  |
| `{AE}`          | "AE" ligature                | `Æ`                                  |
| `{oe}`          | "oe" ligature                | `œ`                                  |
| `{OE}`          | "OE" ligature                | `Œ`                                  |
| `{-}`           | an en dash                   | `–`                                  |
| `{--}`          | an em dash                   | `—`                                  |
| `<nID>`         | footnote reference           | `<a href="#nID"><sup>[ID]</sup></a>` |

(**Note:** If you're reading this document as raw text, the page break marker is a single `|` character. In the table above it appears as `` `\|` `` because `|` has special meaning in Markdown tables; the backslash is a Markdown formatting artifact, not part of the Markit syntax.)

Footnote references must be to footnote blocks in the same text (e.g. `<n1>` must refer to a block with the ID `n1` in the same text).

### Escaping Special Characters

To include a literal special character in the content, it must be escaped with a backslash (e.g. `\*` for a literal asterisk). The backslash itself can be escaped with another backslash (e.g. `\\` for a literal backslash). Any character that is not listed above can be included without escaping.

### Greek Transliteration

Inside `$$...$$`, Latin characters are transliterated to their Greek equivalents. Digraphs are matched first (before single characters), in the order shown:

| Latin input | Greek output |
| ----------- | ------------ |
| `th`        | `θ`          |
| `Th` / `TH` | `Θ`          |
| `ph`        | `φ`          |
| `Ph` / `PH` | `Φ`          |
| `ch`        | `χ`          |
| `Ch` / `CH` | `Χ`          |
| `ps`        | `ψ`          |
| `Ps` / `PS` | `Ψ`          |

After digraph matching, single characters are translated:

| Latin | Greek | Latin | Greek |
| ----- | ----- | ----- | ----- |
| `a`   | `α`   | `A`   | `Α`   |
| `b`   | `β`   | `B`   | `Β`   |
| `g`   | `γ`   | `G`   | `Γ`   |
| `d`   | `δ`   | `D`   | `Δ`   |
| `e`   | `ε`   | `E`   | `Ε`   |
| `z`   | `ζ`   | `Z`   | `Ζ`   |
| `h`   | `η`   | `H`   | `Η`   |
| `i`   | `ι`   | `I`   | `Ι`   |
| `k`   | `κ`   | `K`   | `Κ`   |
| `l`   | `λ`   | `L`   | `Λ`   |
| `m`   | `μ`   | `M`   | `Μ`   |
| `n`   | `ν`   | `N`   | `Ν`   |
| `x`   | `ξ`   | `X`   | `Ξ`   |
| `o`   | `ο`   | `O`   | `Ο`   |
| `p`   | `π`   | `P`   | `Π`   |
| `r`   | `ρ`   | `R`   | `Ρ`   |
| `s`   | `σ`   | `S`   | `Σ`   |
| `t`   | `τ`   | `T`   | `Τ`   |
| `u`   | `υ`   | `U`   | `Υ`   |
| `y`   | `υ`   | `Y`   | `Υ`   |
| `w`   | `ω`   | `W`   | `Ω`   |

A lowercase `s` that is immediately followed by a word boundary (whitespace, punctuation, or end of content) is rendered as final sigma `ς` instead of `σ`. Any character not listed above passes through unchanged.

Example: `$$philosophia$$` → `φιλοσοφια` (`ph`→`φ`, `i`→`ι`, `l`→`λ`, `o`→`ο`, `s`→`σ`, `o`→`ο`, `ph`→`φ`, `i`→`ι`, `a`→`α`).

## Whitespace

Whitespace is largely insignificant in Markit, except where it is necessary to avoid structural ambiguity. Multiple consecutive spaces are collapsed to one space, and multiple blank lines are collapsed to one blank line. Within content blocks, line breaks are treated as spaces.

A blank line (i.e. a line containing only whitespace) is conventional to separate text IDs from metadata, metadata from content blocks, content blocks from each other, and block-level elements from each other within each content block. For example:

```
# Author.Title

reviewed: true
reviewedOn: "2024-06-01"

{#title}
^1 Title

{#1}
This is the first paragraph.

> The paragraph contains a block quote.

The paragraph continues here.

{#2}
This is the second paragraph.
```

But blank lines are only strictly necessary between block-level elements of the same type (otherwise the text on the next line would be interpreted as part of the same element).

## Differences from Markdown

Markit is inspired by Markdown, and aims to be as similar as possible, while meeting the specific needs of early text preservation. The main differences are:

- Markit uses `#` for document structure and text IDs. Headings from source texts typically span multiple lines, and are therefore marked up with `^` symbols in `title` and `subtitle` blocks instead.
- Markit supports YAML-style metadata and block tags, neither of which have any Markdown equivalent.
- Markit uses a slightly different syntax for `_italics_` and `*bold*` - distinguishing between these two on the basis of the character, not how many of them there are.
- Markit has more special characters and inline formatting options than Markdown.
- Markit has a built-in system for Greek transliteration.
- Markit doesn't have some things Markdown does (e.g. links, images, tables, code blocks).

## JSON Output

Markit documents are compiled to a JSON format that captures the hierarchical structure of texts and their content. Each text is represented as a JSON object with the following properties:

- `id`: the ID of the text (from the id block)
- _(any metadata keys from the metadata block, as top-level properties)_
- `blocks`: an array of content blocks (see below)
- `children`: an array of child texts (inline first, then external), each with the same top-level structure

For example, a text with `author: "Jane"` metadata and a block `{#1, revised=true}` would produce:

```json
{
  "id": "My.Text",
  "author": "Jane",
  "blocks": [
    {
      "id": "My.Text.1",
      "revised": true,
      "content": [...]
    }
  ],
  "children": []
}
```

Note that the block ID of `1` becomes `My.Text.1` in the output, to ensure uniqueness across the whole document.

### Content Elements

Each element in a `content` array is a `BlockElement`:

| Type         | Shape                                                         | Notes                                     |
| ------------ | ------------------------------------------------------------- | ----------------------------------------- |
| `Heading`    | `{ "type": "heading", "content": [...] }`                     | `content` is an array of `HeadingLine`s   |
| `Paragraph`  | `{ "type": "paragraph", "content": [...] }`                   | `content` is an array of `InlineElement`s |
| `Blockquote` | `{ "type": "blockquote", "content": [...] }`                  | `content` is an array of `InlineElement`s |
| `List`       | `{ "type": "list", "ordered": true/false, "content": [...] }` | `content` is an array of `ListItem`s      |

`Heading`s and `List`s contain intermediate elements:

| Type          | Shape                                         | Notes                                     |
| ------------- | --------------------------------------------- | ----------------------------------------- |
| `HeadingLine` | `{ "type": "headingLine", "content": [...] }` | `content` is an array of `InlineElement`s |
| `ListItem`    | `{ "type": "listItem", "content": [...] }`    | `content` is an array of `InlineElement`s |

Finally, there are several types of `InlineElement`:

| Type                | Shape                                         | Notes                                     |
| ------------------- | --------------------------------------------- | ----------------------------------------- |
| `Strong`            | `{ "type": "strong", "content": [...] }`      | `content` is an array of `InlineElement`s |
| `Emphasis`          | `{ "type": "emphasis", "content": [...] }`    | `content` is an array of `InlineElement`s |
| `Quote`             | `{ "type": "quote", "content": [...] }`       | `content` is an array of `InlineElement`s |
| `Blockquote`        | `{ "type": "blockquote", "content": [...] }`  | `content` is an array of `InlineElement`s |
| `Foreign`           | `{ "type": "foreign", "content": [...] }`     | `content` is an array of `InlineElement`s |
| `Greek`             | `{ "type": "greek", "content": [...] }`       | `content` is an array of `InlineElement`s |
| `Aside`             | `{ "type": "aside", "content": [...] }`       | `content` is an array of `InlineElement`s |
| `Insertion`         | `{ "type": "insertion", "content": [...] }`   | `content` is an array of `InlineElement`s |
| `Deletion`          | `{ "type": "deletion", "content": [...] }`    | `content` is an array of `InlineElement`s |
| `Highlight`         | `{ "type": "highlight", "content": [...] }`   | `content` is an array of `InlineElement`s |
| `Citation`          | `{ "type": "citation", "content": [...] }`    | `content` is an array of `InlineElement`s |
| `PlainText`         | `{ "type": "plainText", "content": "..." }`   | `content` is a plain string               |
| `NbSpace`           | `{ "type": "nbSpace" }`.                      | `~` — non-breaking space                  |
| `EmSpace`           | `{ "type": "emSpace" }`                       | `~~` — em space / tab                     |
| `LineBreak`         | `{ "type": "lineBreak" }`                     | `//` — line break                         |
| `PageBreak`         | `{ "type": "pageBreak" }`                     | `\|` — page break                         |
| `FootnoteReference` | `{ "type": "footnoteReference", "id": "n1" }` | `id` is the referenced footnote ID        |

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

### Error Handling

The compiler is error-tolerant: it always produces a JSON output and accumulates diagnostics (returning them separately as a list of errors), which makes it suitable for live-preview workflows. The output will always be structurally valid, but may be incoherent in case of syntax errors - no guarantees are made in such cases.
