# Language Specification

## Document Structure

A Markit _document_ is a UTF-8 or UTF-16 encoded text file with a `.mit`
extension. Every document contains one root _text_, which may in turn contain
nested _child texts_, forming a tree. Each text consists of _blocks_ —
individual units of content — separated by one or more blank lines.

Here is a short example showing all the structural elements:

```
# My.Document

author: "Jane Smith"

{#1}
The first paragraph of this text, with a footnote reference <n1>.

{#2, revised=true}
The second paragraph.

{#n1}
This is the footnote.

## My.Document.Chapter

{#0}
£1 Chapter One £1

{#1}
Content of the first chapter.
```

### ID block

Every text begins with an _id block_: a single line of the form `# ID`, `## ID`,
`### ID`, etc. The number of `#` symbols gives the nesting level (1 for the root
text, 2 for immediate children, and so on). The ID is a unique identifier for
the text and may contain letters, numbers, and full stops. Using full stops as a
namespace separator (e.g. `My.Document.Chapter`) is conventional but not
required.

### Metadata block

The id block may be followed by an optional _metadata block_: one or more lines
of YAML key-value pairs that attach arbitrary metadata to the text. See the
[YAML Metadata](#yaml-metadata) section for the supported syntax. The keys `id`,
`blocks`, and `children` are reserved: `children` declares external child texts
(see [Child texts](#child-texts)), and `id` and `blocks` may not be used as
metadata keys at all.

### Content blocks

After the metadata block (or id block, if there is no metadata), a text may have
zero or more _content blocks_. Each content block begins with a _metadata tag_
on its own line — a block ID surrounded by curly brackets and preceded by `#`,
e.g. `{#0}`, `{#1}`, `{#2}`. The content of the block follows, either on the
same line after a space, or on the next line. Block IDs must be unique within
their text, but need not be unique across the whole document.

It is conventional (but not required) to use sequential numbers for block IDs,
and use `0` for the title block if there is one.

Any ID beginning with `n` (e.g. `{#n1}`, `{#n.2}`, `{#n*}`) marks a _footnote
block_; footnote block IDs may contain letters, numbers, full stops, and
asterisks. Footnote blocks must come last among the content blocks.

A metadata tag may include additional `key=value` metadata pairs separated by
commas: `{#1, key1=true, key2=42, key3="hello"}`. Keys must be alphanumeric
identifiers; the keys `id` and `content` are reserved. Values can be the Boolean
`true` or `false`, a number, or a double-quoted string (with `\"` to escape a
literal quote).

The content following the metadata tag is the _content text_: plain text with
optional inline markup (described below). Whitespace is largely insignificant —
line breaks are treated as spaces, and multiple consecutive spaces are collapsed
to one.

### Child texts

After all content blocks, a text may have zero or more _child texts_. There are
two ways to declare child texts: inline and external.

**Inline children** are defined directly in the same file, immediately after the
parent's content blocks. An inline child text is a text at exactly one level
deeper than its parent, and it ends at the start of the next text at the same or
higher level.

**External children** are declared via the reserved `children` key in the
parent's metadata block. Its value must be an array of strings, each a file path
pointing to another `.mit` file:

```
# My.Document

children:
  - "chapters/one.mit"
  - "chapters/two.mit"

{#1}
Introduction.
```

Each path is resolved relative to the parent file. Absolute paths are also
accepted. If a path does not have a `.mit` extension, the compiler first tries
the path as given, then appends `.mit` and tries again. External children are
compiled recursively and may themselves declare further external children;
circular dependencies produce a diagnostic error.

When a text has both inline and external children, **inline children come
first**, followed by external children in the order they appear in the `children`
array. In the JSON output, all children — inline and external alike — appear in
the same `children` array.

## YAML Metadata

YAML metadata blocks support a subset of YAML syntax. Values can be any of the
following:

- Boolean values: `true` and `false`
- Numbers (e.g. `42`, `3.14`, `-1`, etc.)
- Strings, which _must_ be surrounded by double quotation marks (`"`). Double
  quotation marks inside a string can be escaped with a backslash `\`.
- Inline arrays, which are comma-separated lists of values surrounded by square
  brackets, e.g. `[value1, value2, value3]`.
- Multiline arrays, which are lists of values where each value is on a new line
  and preceded by two spaces, a hyphen, and another space:

  ```
  array:
    - value1
    - value2
    - value3
  ```

- Values in arrays can be Booleans, numbers, or strings, but all values in a
  given array must be of the same type.

Note that object values are _not_ (currently) supported.

## Inline Markup: Special Characters

| Markit Input | Meaning              | HTML Output                          |
| ------------ | -------------------- | ------------------------------------ |
| `~`          | a non-breaking space | `&nbsp;`                             |
| `~~`         | a large space / tab  | `&emsp;`                             |
| `//`         | a line break         | `<br />`                             |
| `\|`         | a page break         | `<span class="page-break"></span>`   |
| `{SS}`       | section symbol       | `§`                                  |
| `{ae}`       | "ae" ligature        | `æ`                                  |
| `{AE}`       | "AE" ligature        | `Æ`                                  |
| `{oe}`       | "oe" ligature        | `œ`                                  |
| `{OE}`       | "OE" ligature        | `Œ`                                  |
| `{-}`        | an en dash           | `–`                                  |
| `{--}`       | an em dash           | `—`                                  |
| `<nID>`      | footnote reference   | `<a href="#nID"><sup>[ID]</sup></a>` |

> **Note:** The page break marker is a single `|` character. In the table above
> it appears as `` `\|` `` because `|` has special meaning in Markdown tables;
> the backslash is a Markdown formatting artifact, not part of the Markit syntax.

Footnote references must be to footnote blocks in the same text (e.g. `<n1>`
must refer to a block with the ID `n1` in the same text).

## Inline Markup: Formatting

| Markit Input    | Meaning                      | HTML Output                       |
| --------------- | ---------------------------- | --------------------------------- |
| `£1 Title £1`   | a level 1 heading            | `<h1>Title</h1>`                  |
| `£2 Title £2`   | a level 2 heading            | `<h2>Title</h2>`                  |
| `£3 Title £3`   | a level 3 heading            | `<h3>Title</h3>`                  |
| `£4 Title £4`   | a level 4 heading            | `<h4>Title</h4>`                  |
| `£5 Title £5`   | a level 5 heading            | `<h5>Title</h5>`                  |
| `£6 Title £6`   | a level 6 heading            | `<h6>Title</h6>`                  |
| `"text"`        | an inline quotation          | `<q>text</q>`                     |
| `""text""`      | a block quotation            | `<blockquote>text</blockquote>`   |
| `*text*`        | strong text                  | `<strong>text</strong>`           |
| `_text_`        | emphasised text              | `<em>text</em>`                   |
| `$text$`        | foreign text                 | `<em class="foreign">text</em>`   |
| `$$text$$`      | Greek text in Latin alphabet | `<em class="foreign">…</em>`      |
| `@text@`        | margin comment               | `<span class="aside">text</span>` |
| `++insertion++` | editorial insertion          | `<ins>insertion</ins>`            |
| `--deletion--`  | editorial deletion           | `<del>deletion</del>`             |
| `[citation]`    | citation                     | `<cite>citation</cite>`           |

The heading marker `£` must be followed by a space and then the heading content,
and closed by the same level marker preceded by a space (e.g. `£2 Subtitle £2`).
Headings may span multiple lines, but the opening and closing markers must be on
lines that are part of the same content block.

_Inline formatting_ can be nested, but must be properly closed and cannot
overlap. _Block-level formatting_ (i.e. headings and block quotations) cannot be
nested.

### Greek Transliteration

Inside `$$...$$`, Latin characters are transliterated to their Greek
equivalents. Digraphs are matched first (before single characters), in the order
shown:

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

A lowercase `s` that is immediately followed by a word boundary (whitespace,
punctuation, or end of content) is rendered as final sigma `ς` instead of `σ`.
Any character not listed above passes through unchanged.

Example: `$$philosophia$$` → `φιλοσοφια` (`ph`→`φ`, `i`→`ι`, `l`→`λ`, `o`→`ο`,
`s`→`σ`, `o`→`ο`, `ph`→`φ`, `i`→`ι`, `a`→`α`).

## Escaping Special Characters

In inline markup, the backslash `\` serves as an escape character. It is
required before any special characters if you want to include that character
literally. The special characters are: `~`, `{`, `£`, `"`, `*`, `_`, `$`, `+`,
`<`, `[`, and `|`.

Note that a backslash is not necessary before a single `/`, `+`, or `-`, since
these characters only have a special meaning in pairs. But if you want two of
these next to each other you must escape the second (e.g. `/\/`, `+\+`). And a
literal backslash must itself be escaped (`\\`).

## JSON Output

The compiler is error-tolerant: it always produces a JSON output and accumulates
diagnostics, which makes it suitable for live-preview workflows. Each public API
returns an `[output, errors]` tuple.

When compiled to JSON, a Markit document is represented as an object. Metadata
fields are spread as top-level properties alongside the fixed structural keys:

- `id`: the ID of the text (from the id block)
- _(any metadata keys from the metadata block, as top-level properties)_
- `blocks`: an array of content blocks (see below)
- `children`: an array of child texts (inline first, then external), each with the same top-level structure. The `children` metadata key is not present in this output — it is consumed by the compiler to load external files.

Each block in `blocks` is an object with:

- `id`: the ID of the block (from the metadata tag)
- _(any metadata keys from the metadata tag, as top-level properties)_
- `content`: an array of content elements (see below)

For example, a text with `author: "Jane"` metadata and a block
`{#1, revised=true}` would produce:

```json
{
  "id": "My.Text",
  "author": "Jane",
  "blocks": [
    {
      "id": "1",
      "revised": true,
      "content": [...]
    }
  ],
  "children": []
}
```

### Content Elements

Each element in a `content` array is an object with a `type` field. The possible
types and their shapes are:

| Type                | Shape                                                   | Notes                                                     |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `plainText`         | `{ "type": "plainText", "content": "..." }`             | `content` is a plain string                               |
| `nbSpace`           | `{ "type": "nbSpace" }`                                 | `~` — non-breaking space                                  |
| `emSpace`           | `{ "type": "emSpace" }`                                 | `~~` — em space / tab                                     |
| `lineBreak`         | `{ "type": "lineBreak" }`                               | `//` — line break                                         |
| `pageBreak`         | `{ "type": "pageBreak" }`                               | `\|` — page break                                         |
| `strong`            | `{ "type": "strong", "content": [...] }`                | `content` is an array of elements                         |
| `emphasis`          | `{ "type": "emphasis", "content": [...] }`              | `content` is an array of elements                         |
| `quote`             | `{ "type": "quote", "content": [...] }`                 | `content` is an array of elements                         |
| `blockquote`        | `{ "type": "blockquote", "content": [...] }`            | `content` is an array of elements                         |
| `foreign`           | `{ "type": "foreign", "content": [...] }`               | `content` is an array of elements                         |
| `greek`             | `{ "type": "greek", "content": [...] }`                 | `content` is an array of elements (after transliteration) |
| `aside`             | `{ "type": "aside", "content": [...] }`                 | `content` is an array of elements                         |
| `insertion`         | `{ "type": "insertion", "content": [...] }`             | `content` is an array of elements                         |
| `deletion`          | `{ "type": "deletion", "content": [...] }`              | `content` is an array of elements                         |
| `citation`          | `{ "type": "citation", "content": [...] }`              | `content` is an array of elements                         |
| `heading`           | `{ "type": "heading", "level": 1–6, "content": [...] }` | `content` is an array of elements                         |
| `footnoteReference` | `{ "type": "footnoteReference", "id": "n1" }`           | `id` is the referenced footnote ID                        |

For example, the Markit input `This is *strong* text.` is represented as:

```json
[
  { "type": "plainText", "content": "This is " },
  {
    "type": "strong",
    "content": [{ "type": "plainText", "content": "strong" }]
  },
  { "type": "plainText", "content": " text." }
]
```

Note that wrapper elements always wrap their content in an array, even when the
content is just a single plain text string.

## Differences from Markdown

Markit is intentionally similar to Markdown in structure, but many Markdown
conventions do not apply. The following Markdown patterns are **not valid** in
Markit:

| Markdown pattern          | Markit equivalent or note                                    |
| ------------------------- | ------------------------------------------------------------ |
| `**bold**`                | Use `*bold*` (single asterisk)                               |
| `# Heading`               | `# ID` is a text ID block, not a heading — use `£1 Title £1` |
| `[link text](url)`        | `[text]` is a _citation_ element, not a hyperlink            |
| `> blockquote`            | Use `""text""`                                               |
| `` `code` ``              | No inline code support                                       |
| ` ```code block``` `      | No fenced code blocks                                        |
| `---` (horizontal rule)   | Not supported                                                |
| `![alt](url)`             | No image support                                             |
| `- item` / `1. item`      | No list support                                              |
| YAML front matter (`---`) | Markit metadata is a plain YAML block (no `---` delimiters)  |

Additionally, note that `"text"` (a word surrounded by double quotation marks)
creates an _inline quotation element_ in Markit — it is not a literal string.
