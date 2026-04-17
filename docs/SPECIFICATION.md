# Language Specification

A Markit _document_ is a UTF-8 or UTF-16 encoded text file with a `.mit` extension. Valid Markit documents must conform to the syntax rules described in this specification.

1. [Document Structure](#1-document-structure)
2. [Text Metadata](#2-text-metadata)
3. [Content Blocks](#3-content-blocks)
4. [Block-Level Elements](#4-block-level-elements)
5. [Inline Elements](#5-inline-elements)
6. [Whitespace](#6-whitespace)

See also:

- [Markit Transliteration Syntax](TRANSLITERATION.md) for details on support for keying in non-Latin scripts and special characters with ASCII input.
- [Markit Output Format](OUTPUT.md) for details on the JSON format of compiled Markit documents.

## 1. Document Structure

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

## 2. Text Metadata

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

## 3. Content Blocks

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

## 4. Block-Level Elements

The content of a block consists of one or more _block-level elements_. (Note that "blocks" and "block-level elements" are different things: a block is a container for content, while block-level elements are the structural components of that content.)

A block-level element is either a heading, a paragraph, or a block quotation. The type of a block-level element is determined by its first character:

- A line starting with `^1`-`^6` is a heading line. The number after the `^` character indicates how large the text on that line should be (1 being the largest, 6 being the smallest). Consecutive heading lines are part of the same heading. Heading lines are only permitted in `title` and `subtitle` blocks (`title` and `subtitle` blocks can also contain other block-level elements).
- A line starting with `>` is a block quotation. Consecutive lines starting with `>` are part of the same block quotation.
- Anything else is a paragraph. Consecutive lines that don't start with any of the above are part of the same paragraph.

Block-level elements can be separated by blank lines, but in general this is not required. A block-level element ends at the start of the next block-level element or at the end of the block. A blank line is required to separate block-level elements of the same type (e.g. two consecutive paragraphs).

Block-level elements cannot contain other block-level elements, with the exception of block quotes, which necessarily contain at least one paragraph, and may contain more than one. For example:

```
> This block quotation.
>
> It contains two paragraphs.
```

Note that there is no _list_ element in Markit. If you want to represent a list (or e.g. lines of verse in poetry), you can use paragraphs with line breaks (`//`) to preserve the line structure:

```
{#1}
Tell me, O muse, of that ingenious hero who travelled far and wide //
after he had sacked the famous town of Troy. Many cities did he visit //
and many were the nations with whose manners and customs he was acquainted; //
...
```

## 5. Inline Elements

Block-level elements contain one or more _inline elements_. An inline element is either plain text or a special character sequence that represents some kind of formatting or semantic content. The following special character sequences are supported:

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

### Escape Sequences

To include a literal special character in the content, it must be escaped with a backslash (e.g. `\*` for a literal asterisk). The backslash itself can be escaped with another backslash (e.g. `\\` for a literal backslash).

## 6. Whitespace

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
