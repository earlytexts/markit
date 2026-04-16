# Markit Transliteration Syntax

Markit provides two modes for transliteration and special character input: _character mode_ (enclosed in `{...}`) and _Greek mode_ (enclosed in `{{...}}`). These modes allow you to input characters that are common in early texts but difficult to type on standard keyboards, as well as to transliterate Latin input to Greek.

1. [Character Mode](#1-character-mode)
2. [Greek Mode](#2-greek-mode)
3. [Mixing Character/Greek Mode with Other Markup](#3-mixing-charactergreek-mode-with-other-markup)

## 1. Character Mode

`{#...}` at the start of a block defines the block ID. But within block content, a sequence enclosed in single curly braces `{...}` is processed in _character mode_.

Character mode allows you to input special characters and diacritics using ASCII sequences. The content inside `{...}` is processed as follows:

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

## 2. Greek Mode

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

## 3. Mixing Character/Greek Mode with Other Markup

Character mode and Greek mode can be used anywhere within block content (e.g. inside paragraphs, headings, foreign text, other inline elements). But you cannot nest other formatting elements inside them - they must always be the lowest level of markup. For example, ``_{a` priori}_`` is fine (character mode inside emphasis), but ``{_a` priori_}`` is not (emphasis inside character mode). Both are valid Markit, but the latter doesn't mean what you probably intend - it produces the literal string `_à priori_` without any formatting.

This is because character mode and Greek mode have _a different set of special characters_ - essentially a different sub-language inside Markit.

Special characters in character mode and Greek mode can be escaped with a backslash `\` if you need to use them without their special meaning. For example, `\|` in Greek mode produces a literal pipe character instead of an iota subscript, and `\^` in character mode produces a literal caret instead of a circumflex.
