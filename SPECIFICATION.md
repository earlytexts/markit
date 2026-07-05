# Markit: Language Specification

Markit is a markup language for textual preservation. Files use the `.mit` extension. The compiler is error-tolerant: it always produces JSON output and accumulates diagnostics separately.

## 1. Document Structure

### 1.1. Texts and IDs

A Markit document is a tree of _texts_. Each text begins with one or more `#` characters followed by a unique ID. Depth is indicated by the number of `#` characters. IDs are case-sensitive, must not contain whitespace or `#`, and must be unique among siblings.

```
# Title

...

## Chapter1

...

### Section1

..

## Chapter2

...
```

In the compiled output, parent IDs are prepended with `.` (e.g. `Title.Chapter1.Section2`).

### 1.2. Text Metadata

Text IDs can optionally be followed by a _metadata block_, starting with `[metadata]` and containing TOML-style `key = value` pairs. Supported value types: Boolean, number, string, and homogeneous arrays of these. You can create nested objects one level deep with subsequent `[metadata.<key>]` blocks.

```
# Title

[metadata]
reviewed = true
year = 1721
title = "A Treatise of Human Nature"
tags = ["philosophy"]

[metadata.links]
wikipedia = "https://en.wikipedia.org/wiki/..."
googleBooks = "https://books.google.com/..."
```

Unlike TEI-XML, Markit does not have a fixed set of metadata fields. You can use any keys you like, and the compiler will preserve them in the output JSON.

### 1.3. Content Blocks

Following the metadata (if any), each text contains zero or more _content blocks_. A content block starts with a _block tag_: `{#id}`. Block IDs cannot contain whitespace, `#`, `{`, or `}`.

There are four _types_ of content block, determined by the block ID:

| ID pattern    | Type        | Rules                                                                 |
| ------------- | ----------- | --------------------------------------------------------------------- |
| `title`       | `title`     | At most one per text; must be the first block                         |
| `subtitle`    | `subtitle`  | Any number; anywhere; output IDs become `Text.subtitle1`, `subtitle2` |
| `n` + chars   | `footnote`  | Must appear after all paragraph blocks; referenced via `<nID>`        |
| anything else | `paragraph` |                                                                       |

Block tags can optionally include _block metadata_: comma-separated `key=value` pairs after the ID. These follow the same rules as text metadata, except that nested objects are not supported. For example:

```
{#1, speaker="Philo", modified=true}
```

## 2. Block-Level Elements

Inside a block, content is parsed into block-level elements. A blank line is required to separate two elements of the same type; otherwise elements of different types end automatically at the start of the next one.

### 2.1. Headings

Lines starting with `^` followed by a number from 1 to 6 indicate headings of different levels. Headings are only permitted in `title` and `subtitle` blocks. The number after the caret indicates the display size (1 being the largest, 6 being the smallest).

```
^3 A
^1 TREATISE
^4 OF
^2 Human Nature
```

### 2.2. Stage Directions

Lines starting with `:` indicate stage directions. Consecutive lines collapse into a single paragraph inside the stage direction; for multiple paragraphs, leave a blank line starting with `:`.

```
: This is a stage direction.
:
: Second paragraph inside the stage direction.
```

A stage direction may contain any block-level element except a heading. Strip one `:` (and an optional single space) from each line, and the remainder is parsed as ordinary block content — so a stage direction can hold lists, verse, tables, and nested block quotations or stage directions, not just paragraphs (see §2.3 for an example).

### 2.3. Block Quotations

Lines starting with `>` indicate block quotations. Consecutive lines collapse into a single paragraph inside the block quotation; for multiple paragraphs, leave a blank line starting with `>`.

```
> This is a block quote.
>
> Second paragraph inside the quote.
```

A block quotation may contain any block-level element except a heading. Each line has one `>` (and an optional single space) stripped, and the remainder is parsed as ordinary block content. So a quotation can hold lists, verse, tables, and nested quotations or stage directions. Nesting a quotation uses a doubled marker (`>>`), and a heading inside a quotation is a syntax error.

```
> As the argument runs:
>
> - first the premise,
> - then the inference.
>
> * And a snatch of quoted verse
> * closes the passage.
```

### 2.4. Lists

Markit supports both ordered and unordered lists, with nesting to arbitrary depth. Unordered list items start with `-`, ordered list items start with a number followed by a period (e.g. `1.`). Nested lists use 2-space indent. Ordered lists can start at any number; subsequent items always increment by 1.

```
- Item 1
- Item 2
  - Subitem 2.1
  - Subitem 2.2

3. Item starting at 3
4. Item 4
```

### 2.5. Verse

Lines of verse start with `*`. A blank line separates stanzas (each stanza is a separate block).

```
* Fear no more the heat o' the sun,
* Nor the furious winter's rages;
* Thou thy worldly task hast done,
* Home art gone, and ta'en thy wages.

* Golden lads and girls all must,
* As chimney-sweepers, come to dust.
```

### 2.6. Tables

Tables are defined by rows of pipe-separated cells, with an optional header row. The first row determines the number of columns. For example:

```
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

Without separator row, the table is rendered without a header.

### 2.7. Paragraphs

If a line does not match any of the above patterns, it is treated as a paragraph. Consecutive lines form one paragraph.

```
This is a paragraph.
This is the same paragraph, because there is no blank line in between.

This is a new paragraph, because of the blank line.
```

## 3. Inline Elements

### 3.1. Types and Syntax

Block-level elements can contain a mixture of plan text and inline elements. Inline elements are marked with special syntax, for example `*strong*` for strong text, `_emphasis_` for emphasis, `"quote"` for inline quotations, etc. The full list of inline element types and their syntax is as follows:

| Syntax              | Type                | Notes                                                |
| ------------------- | ------------------- | ---------------------------------------------------- |
| `"text"`            | `quote`             | Inline quotation                                     |
| `*text*`            | `strong`            | Small-caps                                           |
| `_text_`            | `emphasis`          | Italics                                              |
| `^text^`            | `superscript`       | Superscript                                          |
| `,,text,,`          | `subscript`         | Subscript                                            |
| `@text@`            | `speaker`           | Speaker name in dialogue                             |
| `::text::`          | `stageDirection`    | Stage direction in dialogue                          |
| `#text#`            | `aside`             | Margin comment                                       |
| `<nID>`             | `footnoteReference` | Must match a `footnote` block in same text           |
| `~`                 | `nbSpace`           | Non-breaking space                                   |
| `~~`                | `emSpace`           | Em space / tab                                       |
| `\\`                | `lineBreak`         | Line break                                           |
| `///`               | `pageBreak`         | No page reference                                    |
| `//ref//`           | `pageBreak`         | `ref` is any non-whitespace string                   |
| `[+text+]`          | `insertion`         | Editorial insertion                                  |
| `[-text-]`          | `deletion`          | Editorial deletion                                   |
| `[?text?]`          | `uncertain`         | Illegible or uncertain text                          |
| `[...]`             | `illegible`         | Completely illegible text                            |
| `$text$`            | `language`          | Generic foreign text; no `lang` in output            |
| `$xx:text$`         | `language`          | `lang` set to ISO 639 code (`la`, `fr`, `grc`, etc.) |
| `[text]`            | `citation`          | Cited work                                           |
| `[p:text]`          | `person`            | Person name                                          |
| `[l:text]`          | `place`             | Place name                                           |
| `[o:text]`          | `org`               | Organization name                                    |
| `<<tag…>>…<</tag>>` | `element`           | Generic/raw element (escape hatch); see §3.4         |

### 3.2. Whitespace

In inline content, multiple spaces collapse to one space, and multiple blank lines collapse to one blank line. Single line breaks within a block are treated as spaces.

You can use the `~` (non-breaking space), `~~` (em space / tab), and `\\` (line break) markers to preserve spacing/breaks explicitly.

### 3.3. Escape Sequences

Prefix any special character with `\` to use it literally (e.g. `\*`, `\\`, `\{`). A trailing `\` with nothing after it is treated as a literal backslash.

### 3.4. Generic Elements

Markit's inline vocabulary is deliberately small. For markup that has no native equivalent — chiefly when importing from richer formats such as TEI/TCP XML — a generic _element_ provides a lossless escape hatch. Its syntax mirrors XML, but with doubled angle brackets so it never collides with footnote references (`<nID>`):

```
<<TAG attr="value">>content<</TAG>>
<<TAG attr="value"/>>
```

The first form wraps further inline content (which may itself contain native elements or nested generic elements); the second is self-closing/empty. The tag name and ordered attributes are preserved verbatim, so a foreign element survives a round trip unchanged. Attribute values are read literally between double quotes and therefore cannot contain a `"` (encode it as `&quot;`). A `<<` that does not open a well-formed start tag is treated as literal text.

This element carries no inherent display semantics; renderers fall back to emitting its content. It is intended for machine-generated documents (e.g. the output of `fromTEIXML`) and the long tail of preserved markup, not for everyday authoring.

## 4. Transliteration Modes

### 4.1. Character Mode `{...}`

You can wrap plain text in curly braces `{...}` to apply character-level transformations, such as digraphs and diacritics. This is useful for inputting accented and other special characters not easily typed on a keyboard.

**Digraphs** (matched first):

| Input | Output | Input | Output |
| ----- | ------ | ----- | ------ |
| `ae`  | `æ`    | `AE`  | `Æ`    |
| `oe`  | `œ`    | `OE`  | `Œ`    |
| `c,`  | `ç`    | `C,`  | `Ç`    |

**Diacritics** (written after base character):

| Marker  | Diacritic  | Example  | Output |
| ------- | ---------- | -------- | ------ |
| `/`     | acute      | `{e/}`   | `é`    |
| `` ` `` | grave      | ``{a`}`` | `à`    |
| `^`     | circumflex | `{a^}`   | `â`    |
| `"`     | diaeresis  | `{a"}`   | `ä`    |

**Special symbols**:

| Marker | Output        |
| ------ | ------------- |
| `$`    | `§` (section) |
| `-`    | `–` (en-dash) |
| `--`   | `—` (em-dash) |

### 4.2. Greek Mode `{{...}}`

You can wrap plain text in double curly braces `{{...}}` to apply Latin-to-Greek transliteration on top of diacritics. This is intended for inputting Ancient Greek text without needing a Greek keyboard.

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

### 4.3. General Notes on Transliteration Modes

Transliteration is applied before any other parsing, including parsing of inline elements. This means that you cannot use inline element syntax (`*`, `_`, etc.) inside a transliteration block, because it will be treated as literal characters and not parsed as inline elements.

You can escape special characters inside transliteration blocks with `\` as usual, but note that the set of special characters is different. For example, `*` and `_` are not special characters; `^` is a special character; `"` is also a special character, but has a different meaning (diaeresis instead of quotation).
