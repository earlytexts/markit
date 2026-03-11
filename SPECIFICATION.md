# Language Specification

## General Rules and Terms

- A Markit _document_ is a UTF-8 or UTF-16 encoded text file with a `.mit` extension that contains one complete _text_.
  - A _text_ is a series of _blocks_ and (optionally) _child texts_, separated by one or more _blank lines_ (i.e. a line with either nothing on it or only whitespace).
  - The main/root text in a document must be level 1, and any child texts must be exactly one level deeper than their parent text. A text terminates either at the end of the document, or at the start of the next text of an equal or higher level (meaning that a child text must come after all blocks in its parent text).
    - The first block in a text must be the _id block_. The _id block_ is a single line indicating the ID and level of the text. It is of the form `# ID`, `## ID`, `### ID`, etc. where the number of `#`s indicate the level of the text (just as with Markdown headers), and the ID is a unique identifier for the text. The ID can contain only letters, numbers, and full stops.
    - The second block may be a _metadata block_. A _metadata block_ contains arbitrary metadata for the text in YAML format. Any YAML is valid, except that blank lines are not permitted (since blank lines indicate the end of the block), and the keys `id`, `blocks`, and `children` are reserved (since these are used in the JSON output for the text ID, content blocks, and child texts respectively).
    - Zero or more _content blocks_ may follow the metadata block (or the id block, if there is no metadata).
      - A _content block_ consists of a _metadata tag_, followed by a space or a single line break, followed by _content text_.
        - A _metadata tag_ consists of a unique identifier for the block (relative to the text), preceded by a `#`, and surrounded by curly brackets, e.g. `{#0}`, `{#1}`, `{#a}`, `{#n1}`. Block identifiers need not be unique across the whole document, and typically won't be - most texts will number their blocks starting from 1, so any child text will likely have blocks with the same IDs as blocks in the parent text or any sibling texts.
        - Any alphanumeric string is a valid block identifier, but certain values have special significance:
          - `{#0}` represents the _title block_ for the text. If present, it must be the _first_ block (after the metadata), and at most one is allowed per text.
          - Any ID beginning with `n` (e.g. `{#n1}`, `{#n2}`, `{#na}`, `{#n*}`) represents a _footnote block_. _Footnote blocks_ must come _last_ in the content blocks.
          - Every other ID represents a _paragraph block_. Paragraph blocks must come in the middle of the content blocks (after the _title block_ and before any _footnote blocks_).
          - Typically a text will consist of a title block, and then _either_ paragraph blocks (with or without footnotes) _or_ child texts. But any combination is permitted - only the order is enforced (title, paragraphs, footnotes, child texts).
        - A _metadata tag_ may also include additional metadata for the block in the form of comma-separated `key=value` pairs, e.g `{#1, key1=value1, key2=value2}`.
          - Block metadata keys must be alphanumeric identifiers. The keys `id`, `type`, and `content` are reserved (since these are used in the JSON output for the block ID, type, and content respectively).
          - Block metadata values can be either the Boolean values `true` and `false`, numbers, or strings. Strings must be surrounded by either single or double quotation marks. Single-quoted strings may included double quotation marks unescaped, and vice-versa; otherwise quotation marks can be escaped with a backslash `\`.
        - _Content text_ consists of text with some inline markup. Whitespace is relatively meaningless, in that content is trimmed, line breaks are replaced with spaces, and multiple adjacent spaces are reduced to a single space. The supported inline markup is shown in the table below.
    - Zero or more _child texts_ may follow the _content blocks_. A _child text_ is a _text_ that is exactly one level deeper than its parent text.

## Inline Markup: Special Characters

| Markit Input | Meaning             | HTML Output                          |
| ------------ | ------------------- | ------------------------------------ | -------------------------- | -------- |
| `~`          | a space             | `&nbsp;`                             |
| `~~`         | a large space / tab | `&emsp;`                             |
| `//`         | a line break        | `<br />`                             |
| `            | `                   | a page break                         | `<span class="page-break"> | </span>` |
| `{SS}`       | section symbol      | `§`                                  |
| `{ae}`       | "ae" ligature       | `æ`                                  |
| `{AE}`       | "AE" ligature       | `Æ`                                  |
| `{oe}`       | "oe" ligature       | `œ`                                  |
| `{OE}`       | "OE" ligature       | `Œ`                                  |
| `{-}`        | an en dash          | `–`                                  |
| `{--}`       | an em dash          | `—`                                  |
| `<nID>`      | footnote reference  | `<a href="#nID"><sup>[ID]</sup></a>` |

Footnote references must be to footnote blocks in the same text (e.g. `<n1>` must refer to a block with the ID `n1` in the same text).

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
| `$$techt$$`     | Greek text in Latin alphabet | `<em class="foreign">τεχτ</em>`   |
| `@text@`        | margin comment               | `<span class="aside">text</span>` |
| `++insertion++` | editorial insertion          | `<ins>insertion</ins>`            |
| `--deletion--`  | editorial deletion           | `<del>deletion</del>`             |
| `[citation]`    | citation                     | `<cite>citation</cite>`           |

_Inline formatting_ can be nested, but must be properly closed and cannot overlap. _Block-level formatting_ (i.e. headings and block quotations) cannot be nested.

## Escaping Special Characters

In inline markup, the backslash `\` serves as an escape character. It is required before any special characters if you want to include that character literally. The special characters are: `~`, `{`, `£`, `"`, `*`, `_`, `$`, `+`, `<`, and `[`.

Note that a backslash is not necessary before a single `/`, `+`, or `-`, since these characters only have a special meaning in pairs. But if you want two of these next to each other you must escape the second (e.g. `/\/`, `+\+`). And a literal backslash must itself be escaped (`\\`).

## JSON Output

When compiled to JSON, a Markit document is represented as an object with the following properties:

- `id`: the ID of the text (from the id block)
- `metadata`: whatever metadata is included in the metadata block, as key-value pairs
- `blocks`: an array of content blocks, where each block is an object with the following properties:
  - `id`: the ID of the block (from the metadata tag)
  - `metadata`: whatever metadata is included in the metadata tag, as key-value pairs
  - `content`: the content text, with inline markup represented as nested objects (see below)
- `children`: an array of child texts, where each child text is an object with the same structure as above (i.e. with `id`, `metadata`, `blocks`, and `children` properties)

In the content text, inline markup is represented as nested objects with a `type` property indicating the type of markup (e.g. `strong`, `em`, `heading`, etc.), and a `content` property containing the text content (with any further nested markup represented as additional objects). For example, the Markit input `This is *strong* text.` would be represented in JSON as:

```json
{
  "content": [
    { "type": "plainText", "content": "This is " },
    { "type": "strong", "content": "strong" },
    { "type": "plainText", "content": " text." }
  ]
}
```

For a complete and precise specification of the JSON output, see the types defined in `src/types.ts`.
