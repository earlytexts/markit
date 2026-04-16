# Language Specification

A Markit _document_ is a UTF-8 or UTF-16 encoded text file with a `.mit` extension. Valid Markit documents must conform to the syntax rules described in this specification. The Markit compiler takes a Markit document as input and produces a JSON representation of its structure and content as output, alongside a list of any syntax errors.

## Document Structure

A Markit document consists of one or more _texts_ arranged in a hierarchical tree structure. Each text starts with one or more `#` characters followed by a unique identifier (ID). The number of `#` characters indicates the text's level in the hierarchy (e.g. `#` for top-level texts, `##` for their children, etc.).

```
# Title

...

## Chapter1

...

### Section1

...

## Chapter2

...
```

IDs can be any non-empty string that doesn't contain whitespace or the `#` character. They are case-sensitive and must be unique relative to their parent text. In the compiled output, parent IDs are prepended to child IDs to ensure uniqueness across the whole document (e.g. `Title.Chapter1`, `Title.Chapter1.Section1`).

## Text Metadata

Every text ID (including child texts) can optionally be followed by a _metadata block_. A metadata block begins with the header `[metadata]` and contains TOML-style `key = value` pairs:

```
# Title

[metadata]
reviewed = true
reviewedOn = "2024-06-01"
firstPublished = 1721
title = "The Full Title of the Work"
tags = ["philosophy", "metaphysics"]
otherEditions = [
    "Title.Edition1",
    "Title.Edition2",
    "Title.Edition3"
]
```

Only a subset of TOML is supported. Booleans, numbers, strings, and arrays of these types are supported; dates and comments are not (dates can be represented as strings in whatever format is desired). Mixed arrays are not permitted (i.e. arrays can only contain one type of value).

### Nested Metadata

Nested objects are supported one level deep, using additional headers of the form `[metadata.<key>]`. These must appear after the top-level `[metadata]` block:

```
[metadata]
title = "The Full Title of the Work"

[metadata.links]
googleBooks = "https://books.google.com/..."
wikipedia = "https://en.wikipedia.org/wiki/..."
```

## Content Blocks

Following the metadata blocks (if any), a text can have any number of _content blocks_. A content block starts with a _block tag_ on a new line. A block tag contains (at least) a block ID, marked with a `#` character:

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

With the exception of `subtitle` (see below), block IDs must be unique (relative to the text). In the compiled output, block IDs are prefixed with the text's (full) ID to ensure uniqueness across the entire document (e.g. `Title.Chapter1.Section2.12`). They are conventionally numbered sequentially, but this is not required.

### Block Types

There are four types of content block, determined by the block ID:

- `title` blocks, which contain the title of the text. There can be at most one `title` block per text, and if present it must be the first block.
- `subtitle` blocks, which contain subtitles or section headings. There can be any number of `subtitle` blocks, and they can appear anywhere in the text. In the compiled output, they are given sequential IDs (e.g. `Title.subtitle1`, `Title.subtitle2`, etc.) to ensure uniqueness across the document.
- `n` blocks, which represent footnotes. They must appear at the end of the text, after all other content blocks. They can be referenced from inline markup in the content text (see below).
- Any other block (with any other ID) is a `paragraph` block.

## Content Text

### Block-Level Elements

The content of a block consists of one or more _block-level elements_. (Note that "blocks" and "block-level elements" are different things: a block is a container for content, while block-level elements are the structural components of that content.)

A block-level element is either a heading, a paragraph, or a block quotation. The type of a block-level element is determined by its first character:

- A line starting with `^1`-`^6` is a heading line. The number after the `^` character indicates how large the text on that line should be (1 being the largest, 6 being the smallest). Consecutive heading lines are treated as part of the same heading block. Heading lines are only permitted in `title` and `subtitle` blocks (`title` and `subtitle` blocks can also contain other block-level elements).
- A line starting with `>` is a block quotation. Consecutive lines starting with `>` are part of the same block quotation.
- Anything else is a paragraph. Consecutive lines that don't start with any of the above are part of the same paragraph.

Block-level elements can be separated by blank lines, but in general this is not required. A block-level element ends at the start of the next block-level element or at the end of the block. A blank line is required to separate block-level elements of the same type (e.g. two consecutive paragraphs).

Block-level elements cannot contain other block-level elements, with the exception of block quotes, which necessarily contain at least one paragraph, and may contain more than one. For example:

```
> This block quotation.
>
> It contains two paragraphs.
```

Note there is no _list_ element in Markit. If you want to represent a list (or e.g. lines of verse in poetry), you can use paragraphs with line breaks (`//`) to preserve the line structure:

```
{#1}
Tell me, O muse, of that ingenious hero who travelled far and wide //
after he had sacked the famous town of Troy. Many cities did he visit //
and many were the nations with whose manners and customs he was acquainted; //
...
```

### Inline Elements

Block-level elements contain one or more _inline elements_. An inline element is either plain text or a special character sequence that represents some kind of formatting or semantic content (e.g. emphasis, a footnote reference, etc.). The following special character sequences are supported:

| Markit Input    | Meaning                  | HTML Equivalent                                    |
| --------------- | ------------------------ | -------------------------------------------------- |
| `"text"`        | an inline quotation      | `<q>text</q>`                                      |
| `*text*`        | strong text              | `<strong>text</strong>`                            |
| `_text_`        | emphasised text          | `<em>text</em>`                                    |
| `$text$`        | foreign text             | `<em class="foreign">text</em>`                    |
| `$grc:text$`    | Ancient Greek text       | `<em lang="grc">text</em>`                         |
| `$la:text$`     | Latin text               | `<em lang="la">text</em>`                          |
| `$fr:text$`     | French text              | `<em lang="fr">text</em>`                          |
| `$xx:text$`     | text in language `xx`    | `<em lang="xx">text</em>`                          |
| `!person[name]` | person name              | `<span class="person">name</span>`                 |
| `!place[name]`  | place name               | `<span class="place">name</span>`                  |
| `%text%`        | speaker name in dialogue | `<span class="speaker">text</span>`                |
| `@text@`        | margin comment           | `<span class="aside">text</span>`                  |
| `++insertion++` | editorial insertion      | `<ins>insertion</ins>`                             |
| `--deletion--`  | editorial deletion       | `<del>deletion</del>`                              |
| `??uncertain??` | uncertain text           | `<span class="uncertain">uncertain</span>`         |
| `???`           | illegible text           | `<span class="illegible">&lt;illegible&gt;</span>` |
| `==highlight==` | editorial highlight      | `<mark>highlight</mark>`                           |
| `[citation]`    | citation                 | `<cite>citation</cite>`                            |
| `<nID>`         | footnote reference       | `<a href="#nID"><sup>[ID]</sup></a>`               |
| `~`             | a non-breaking space     | `&nbsp;`                                           |
| `~~`            | a large space / tab      | `&emsp;`                                           |
| `//`            | a line break             | `<br />`                                           |
| `\|\|`          | a page break             | `<span class="pageBreak"></span>`                  |
| `\|folio\|`     | a page break with number | `<span class="pageBreak" data-ref="folio"></span>` |

Footnote references must be to footnote blocks in the same text (e.g. `<n1>` must refer to a block with the ID `n1` in the same text).

Language codes follow ISO 639: use two-letter ISO 639-1 codes where available (e.g. `la`, `fr`), or three-letter ISO 639-3 codes where not (e.g. `grc` for Ancient Greek, which has no ISO 639-1 code).

Page breaks with references use any non-whitespace string as the folio/page number (e.g. `|12r|`, `|p.45|`). A lone `|` not matching the `||` or `|ref|` pattern is treated as a literal character.

### Character Mode

Inside content, a sequence enclosed in single curly braces `{...}` is processed in _character mode_. This enables inputting characters that are common in early texts but difficult to type on standard keyboards. The content between the braces is processed character by character and the result replaces the entire `{...}` sequence in the output.

**Diacritic markers** are written immediately after the base character they modify:

| Marker  | Diacritic  | Example input | Output |
| ------- | ---------- | ------------- | ------ |
| `/`     | acute      | `{e/}`        | `é`    |
| `` ` `` | grave      | ``{a`}``      | `à`    |
| `^`     | circumflex | `{a^}`        | `â`    |
| `"`     | diaeresis  | `{a"}`        | `ä`    |

Multiple diacritic markers can follow a single base character.

**Digraphs** are matched before base character + diacritic processing:

| Input | Output | Input | Output |
| ----- | ------ | ----- | ------ |
| `ae`  | `æ`    | `AE`  | `Æ`    |
| `oe`  | `œ`    | `OE`  | `Œ`    |
| `c,`  | `ç`    | `C,`  | `Ç`    |

**Special symbols:**

| Input | Output        |
| ----- | ------------- |
| `$`   | `§` (section) |
| `-`   | `–` (en dash) |
| `--`  | `—` (em dash) |

You cannot include inline markup inside character mode sequences, and standard special characters inside them (e.g. `*`, `_`) are treated as literal characters. Character mode can be combined with inline markup, but the latter must always be on the outide (e.g. ``_{a`} priori_`` instead of ``{_a` priori_}``).

### Greek Mode

A sequence enclosed in double curly braces `{{...}}` is processed in _Greek mode_. Greek mode combines character mode processing with Latin-to-Greek transliteration: Latin characters are converted to their Greek equivalents, and diacritic markers produce the correct Unicode combining characters.

**Transliteration digraphs** (matched before single characters):

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

**Single character transliteration:**

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

A lowercase `s` immediately followed by a word boundary (whitespace, punctuation, or end of content) is rendered as final sigma `ς` instead of `σ`. Diacritic markers are not word boundaries. Any character not listed above passes through unchanged.

**Greek diacritic markers** (written immediately after the base character):

| Marker  | Diacritic                |
| ------- | ------------------------ |
| `)`     | smooth breathing (psili) |
| `(`     | rough breathing (dasia)  |
| `/`     | acute accent             |
| `` ` `` | grave accent             |
| `^`     | circumflex (perispomeni) |
| `"`     | diaeresis                |
| `\|`    | iota subscript           |

When multiple markers follow one character, write them in canonical order: breathing → accent → diaeresis/iota-subscript (e.g. `a)/` for ἄ). Writing markers in the wrong order produces incorrect output without an error.

Examples:

| Input             | Output      |
| ----------------- | ----------- |
| `{{philosophia}}` | `φιλοσοφία` |
| `{{lo/gos}}`      | `λόγος`     |
| `{{a)}}`          | `ἀ`         |
| `{{a(/}}`         | `ἅ`         |
| `{{a)/}}`         | `ἄ`         |
| `{{a^}}`          | `ᾶ`         |
| `{{a\|}}`         | `ᾳ`         |

### Escaping Special Characters

To include a literal special character in the content, it must be escaped with a backslash (e.g. `\*` for a literal asterisk). The backslash itself can be escaped with another backslash (e.g. `\\` for a literal backslash).

Backslash escaping works everywhere, including inside character mode and Greek mode. Note, however, that the characters needing to be escaped are different in these modes: for example `^` needs to be escaped in character mode but not in regular mode; `|` needs to be escaped in Greek mode but not in regular mode or character mode.

## Whitespace

Whitespace is largely insignificant in Markit, except where it is necessary to avoid structural ambiguity. Multiple consecutive spaces are collapsed to one space, and multiple blank lines are collapsed to one blank line. Within content blocks, line breaks are treated as spaces. Use `~`, `~~`, and `//` to preserve spaces and line breaks in the output.

A blank line (i.e. a line containing only whitespace) is conventional to separate text IDs from metadata, metadata from content blocks, content blocks from each other, and block-level elements from each other within each content block. For example:

```
# Title

[metadata]
reviewed = true
reviewedOn = "2024-06-01"

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

## JSON Output

Markit documents are compiled to a JSON format that captures the hierarchical structure of texts and their content. Each text is represented as a JSON object with the following properties:

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

### Content Elements

Each element in a `content` array is a `BlockElement`:

| Type         | Shape                                        | Notes                                     |
| ------------ | -------------------------------------------- | ----------------------------------------- |
| `Heading`    | `{ "type": "heading", "content": [...] }`    | `content` is an array of `HeadingLine`s   |
| `Paragraph`  | `{ "type": "paragraph", "content": [...] }`  | `content` is an array of `InlineElement`s |
| `Blockquote` | `{ "type": "blockquote", "content": [...] }` | `content` is an array of `Paragraph`s     |

`Heading`s contain intermediate elements:

| Type          | Shape                                         | Notes                                     |
| ------------- | --------------------------------------------- | ----------------------------------------- |
| `HeadingLine` | `{ "type": "headingLine", "content": [...] }` | `content` is an array of `InlineElement`s |

Finally, there are several types of `InlineElement`:

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

Character mode and Greek mode sequences are processed into their final output characters before being represented in the JSON output. Their content therefore appears as `PlainText` elements in the output.

### Error Handling

The compiler is error-tolerant: it always produces a JSON output and accumulates diagnostics (returning them separately as a list of errors), which makes it suitable for live-preview workflows. The output will always be structurally valid, but may be incoherent in case of syntax errors - no guarantees are made in such cases.
