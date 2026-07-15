import { findClosingBrace, splitTopLevelCommas } from "../lib/blockTagLexer.ts";
import type {
  MarkitError,
  Metadata,
  MetadataSource,
  MetadataValue,
  SourceRange,
} from "../types.ts";
import { footnoteReferenceSpec } from "../lib/grammar.ts";
import type { TextTree } from "./generateTextTree.ts";
import lineRange from "../lib/lineRange.ts";
import makeError from "../lib/makeError.ts";
import parseMetadataValue from "./parseMetadataValue.ts";
import type { Line, RawBlock } from "./splitIntoBlocks.ts";

/**
 * Parse the TextTree into a tree with metadata. `metadataSource` is always
 * computed here; parseContent attaches it to the output only when compiling
 * with positions.
 */
export type TextTreeWithMetadata = Omit<TextTree, "blocks" | "children"> & {
  metadata?: Metadata;
  metadataSource?: MetadataSource;
  blocks: BlockWithMetadata[];
  children: TextTreeWithMetadata[];
};

export type BlockWithMetadata = Omit<RawBlock, "lines"> & {
  id: string;
  metadata?: Metadata;
  metadataSource?: MetadataSource;
  lines: Line[];
};

export default (
  textTree: TextTree,
): [TextTreeWithMetadata, MarkitError[]] => parseTextMetadata(textTree);

const parseTextMetadata = (
  text: TextTree,
): [TextTreeWithMetadata, MarkitError[]] => {
  // Consume all leading blocks that start with a [header] (before the first content block).
  // Valid headers ([metadata] and [metadata.subkey]) are parsed; invalid ones produce errors.
  let metadataBlockCount = 0;
  for (const block of text.blocks) {
    const firstLine = block.lines[0];
    if (firstLine?.content.match(/^\[.+\]$/)) {
      metadataBlockCount++;
    } else {
      break;
    }
  }
  const metadataBlocks = text.blocks.slice(0, metadataBlockCount);
  const contentBlocks = text.blocks.slice(metadataBlockCount);

  // Build the text's metadata from its leading metadata blocks
  const [metadata, metadataSource, metadataErrors] = buildTextMetadata(
    metadataBlocks,
  );

  // Parse metadata for each block, tracking the ids seen so far for duplicate
  // checking, title placement, and subtitle auto-numbering
  const blocksWithMetadata: BlockWithMetadata[] = [];
  const blockErrors: MarkitError[] = [];
  const seenIds = new Set<string>();
  let subtitleCount = 0;
  for (const block of contentBlocks) {
    const [blockWithMetadata, errors] = parseBlockMetadata(
      block,
      seenIds,
      subtitleCount,
      blocksWithMetadata.length,
    );
    blocksWithMetadata.push(blockWithMetadata);
    blockErrors.push(...errors);
    seenIds.add(blockWithMetadata.id);
    if (/^subtitle\d+$/.test(blockWithMetadata.id)) subtitleCount++;
  }

  const footnoteErrors = validateFootnoteOrder(
    blocksWithMetadata,
    contentBlocks,
  );

  // Parse metadata for children recursively
  const parseChildrenResult = text.children.map(parseTextMetadata);
  const childrenWithMetadata = parseChildrenResult.map((result) => result[0]);
  const childrenErrors = parseChildrenResult.flatMap((result) => result[1]);

  // Put it all together and return
  const textWithMetadata = {
    ...text,
    ...(metadata ? { metadata } : {}),
    ...(metadataSource ? { metadataSource } : {}),
    blocks: blocksWithMetadata,
    children: childrenWithMetadata,
  };
  const errors = [
    ...metadataErrors,
    ...blockErrors,
    ...footnoteErrors,
    ...childrenErrors,
  ];
  return [textWithMetadata, errors];
};

/**
 * Build a text's metadata (and its source ranges) from its leading metadata
 * blocks: top-level `[metadata]` pairs merged flat, each `[metadata.<key>]`
 * block nested under its key. Returns undefined metadata when there are no
 * metadata blocks at all.
 */
const buildTextMetadata = (
  metadataBlocks: RawBlock[],
): [Metadata | undefined, MetadataSource | undefined, MarkitError[]] => {
  if (metadataBlocks.length === 0) return [undefined, undefined, []];

  const errors: MarkitError[] = [];
  const metadata: Metadata = {};
  const nestedRanges: Record<string, SourceRange> = {};
  let hasTopLevelBlock = false;

  for (const block of metadataBlocks) {
    const [subkey, parsedMetadata, blockErrors] = parseMetadataBlock(block);
    errors.push(...blockErrors);

    if (subkey === null) {
      // Top-level [metadata] block
      hasTopLevelBlock = true;
      Object.assign(metadata, parsedMetadata);
    } else {
      // Nested [metadata.subkey] block
      if (!hasTopLevelBlock) {
        const firstLine = block.lines[0]!;
        errors.push(
          makeError({
            message:
              `Nested metadata block '[metadata.${subkey}]' must appear after the top-level '[metadata]' block`,
            line: block.startLine,
            column: firstLine.charOffset,
            length: firstLine.content.length,
          }),
        );
      }
      metadata[subkey] = parsedMetadata;
      nestedRanges[subkey] = lineRange(block.startLine, block.endLine);
    }
  }

  const metadataSource: MetadataSource = {
    source: lineRange(
      metadataBlocks[0]!.startLine,
      metadataBlocks.at(-1)!.endLine,
    ),
    ...(Object.keys(nestedRanges).length > 0 ? { nested: nestedRanges } : {}),
  };

  return [metadata, metadataSource, errors];
};

/**
 * Validate footnote ordering: footnote blocks must appear after all paragraph
 * blocks. Reports at most one error, on the first out-of-place footnote.
 */
const validateFootnoteOrder = (
  blocks: BlockWithMetadata[],
  rawBlocks: RawBlock[],
): MarkitError[] => {
  let firstFootnoteIndex: number | null = null;
  for (let i = 0; i < blocks.length; i++) {
    const isFootnote = footnoteReferenceSpec.pattern.test(blocks[i]!.id);
    if (isFootnote && firstFootnoteIndex === null) {
      firstFootnoteIndex = i;
    } else if (!isFootnote && firstFootnoteIndex !== null) {
      const footnoteBlock = blocks[firstFootnoteIndex]!;
      const rawFootnoteBlock = rawBlocks[firstFootnoteIndex]!;
      return [
        makeError({
          message: "Footnote blocks must appear after all paragraph blocks",
          line: footnoteBlock.startLine,
          column: rawFootnoteBlock.lines[0]!.charOffset,
          length: footnoteBlock.id.length + 3, // {# + id + }
        }),
      ];
    }
  }
  return [];
};

/**
 * Parse a single metadata block (starting with [metadata] or [metadata.subkey]).
 * Returns [subkey, parsedObject, errors] where subkey is null for top-level [metadata].
 */
const parseMetadataBlock = (
  block: RawBlock,
): [string | null, Record<string, MetadataValue>, MarkitError[]] => {
  const errors: MarkitError[] = [];
  const result: Record<string, MetadataValue> = {};

  const firstLine = block.lines[0]!;
  const headerMatch = firstLine.content.match(/^\[metadata(?:\.(\w+))?\]$/);

  // The caller consumes every leading `[...]` block as a metadata block, but
  // only checks the bracket shape — a header that is not `[metadata]` or
  // `[metadata.<key>]` is caught and reported here.
  if (!headerMatch) {
    errors.push(
      makeError({
        message:
          `Invalid metadata header '${firstLine.content.trim()}' — only '[metadata]' and '[metadata.<key>]' are allowed`,
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length,
      }),
    );
    return [null, result, errors];
  }

  const subkey = headerMatch[1] ?? null;

  // Parse lines after the header
  const lines = block.lines.slice(1);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;

    // A multiline array opener: `key = [` with nothing (or a bare comma) after
    // the bracket. An opener with content or a closing `]` on the same line is
    // an inline array, handled by the regular key=value parse below.
    const multilineArrayMatch = line.content.match(/^(\w+)\s*=\s*\[(.*)$/);
    const rest = multilineArrayMatch ? multilineArrayMatch[2]!.trim() : null;
    if (multilineArrayMatch && (rest === "" || rest === ",")) {
      const key = multilineArrayMatch[1]!;
      const [value, nextIndex] = parseMultilineArray(
        lines,
        index,
        block.startLine,
        errors,
      );
      if (value !== null) result[key] = value;
      index = nextIndex - 1;
      continue;
    }

    // Regular key = value line
    const match = line.content.match(/^(\w+)\s*=\s*(.+)$/);
    if (!match) {
      errors.push(
        makeError({
          message: "Invalid metadata line, expected 'key = value'",
          line: block.startLine + 1 + index,
          column: line.charOffset,
          length: line.content.length,
        }),
      );
      continue;
    }

    const key = match[1]!;
    const valueString = match[2]!.trim();

    const { value, diagnostics } = parseMetadataValue(valueString);
    errors.push(
      ...valueErrors(diagnostics, valueString, {
        line: block.startLine + 1 + index,
        valueColumn: line.charOffset + line.content.indexOf(valueString),
        lineColumn: line.charOffset,
        lineLength: line.content.length,
      }),
    );

    result[key] = value;
  }

  return [subkey, result, errors];
};

/**
 * Parse the items of a multiline array whose `key = [` opener is at
 * `lines[index]`, consuming lines until the closing `]` (or `],`). Returns the
 * array value — or null when it is empty or mixes types, which is reported —
 * and the index of the first line after the array.
 */
const parseMultilineArray = (
  lines: Line[],
  index: number,
  blockStartLine: number,
  errors: MarkitError[],
): [MetadataValue | null, number] => {
  const opener = lines[index]!;
  const items: (number | boolean | string)[] = [];
  let arrayIndex = index + 1;

  while (arrayIndex < lines.length) {
    const line = lines[arrayIndex]!;
    const trimmed = line.content.trim();

    // End of array
    if (trimmed === "]" || trimmed === "],") {
      arrayIndex++;
      break;
    }

    // Strip trailing comma from item
    const itemString = trimmed.replace(/,$/, "").trim();
    const itemStartColumn = line.charOffset +
      line.content.indexOf(itemString);

    const { value, diagnostics } = parseMetadataValue(itemString);
    if (diagnostics.includes("invalid-value")) {
      errors.push(
        makeError({
          message: `Invalid metadata value: ${itemString}`,
          line: blockStartLine + 1 + arrayIndex,
          column: itemStartColumn,
          length: itemString.length,
        }),
      );
    }

    items.push(value as number | boolean | string);
    arrayIndex++;
  }

  if (items.length === 0) {
    errors.push(
      makeError({
        message: "Multiline array must have at least one item",
        line: blockStartLine + 1 + index,
        column: opener.charOffset,
        length: opener.content.length,
      }),
    );
    return [null, arrayIndex];
  }

  const types = new Set(items.map((item) => typeof item));
  if (types.size > 1) {
    errors.push(
      makeError({
        message:
          "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
        line: blockStartLine + 1 + index,
        column: opener.charOffset,
        length: opener.content.length,
      }),
    );
    return [null, arrayIndex];
  }

  return [items as MetadataValue, arrayIndex];
};

const parseBlockMetadata = (
  block: RawBlock,
  seenIds: ReadonlySet<string>,
  subtitleCount: number,
  previousBlockCount: number,
): [BlockWithMetadata, MarkitError[]] => {
  const errors: MarkitError[] = [];

  const [firstLine, ...otherLines] = block.lines;
  const isBlockTag = firstLine.content.startsWith("{#");
  const closingBrace = isBlockTag ? findClosingBrace(firstLine.content, 2) : -1;
  const hasValidTag = isBlockTag && closingBrace !== -1;

  if (!isBlockTag) {
    errors.push(
      makeError({
        message: "Block is missing metadata tag '{#id}'",
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length,
      }),
    );
  } else if (closingBrace === -1) {
    errors.push(
      makeError({
        message: "Block tag is not properly closed with '}'",
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length,
      }),
    );
  }

  // Parse the tag body (between `{#` and `}`) into comma-separated chunks.
  // The first chunk is the ID; the rest are key=value metadata pairs.
  const chunks = hasValidTag
    ? splitTopLevelCommas(firstLine.content.slice(2, closingBrace))
    : [];

  let id = chunks[0]?.content ?? `${block.startLine}`;
  const metadata: Record<string, MetadataValue> = {};

  // Validate block ID characters (only when a block tag was matched, not the fallback)
  if (hasValidTag && !/^[^\s#{}]+$/.test(id)) {
    const idOffset = firstLine.content.indexOf(id, 2);
    errors.push(
      makeError({
        message:
          `Block ID '${id}' contains invalid characters (IDs may not contain whitespace, '#', '{', or '}')`,
        line: block.startLine,
        column: firstLine.charOffset + idOffset,
        length: id.length,
      }),
    );
  } else if (
    hasValidTag &&
    id.startsWith("n") &&
    !footnoteReferenceSpec.pattern.test(id)
  ) {
    const idOffset = firstLine.content.indexOf(id, 2);
    errors.push(
      makeError({
        message:
          `Block ID '${id}' is not a valid footnote ID (footnote IDs must start with 'n' followed by at least one character)`,
        line: block.startLine,
        column: firstLine.charOffset + idOffset,
        length: id.length,
      }),
    );
  }

  // Parse metadata pairs from the remaining chunks.
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const chunkColumn = firstLine.charOffset + 2 + chunk.offset;
    const match = /^(\w+)\s*=\s*(.+)$/.exec(chunk.content);
    if (!match) {
      errors.push(
        makeError({
          message: "Invalid metadata pair, expected 'key=value'",
          line: block.startLine,
          column: chunkColumn,
          length: chunk.content.length,
        }),
      );
      continue;
    }
    const key = match[1]!;
    const valueString = match[2]!;
    const valueLocalOffset = chunk.content.length - valueString.length;

    const { value, diagnostics } = parseMetadataValue(valueString);
    errors.push(
      ...valueErrors(diagnostics, valueString, {
        line: block.startLine,
        valueColumn: chunkColumn + valueLocalOffset,
        lineColumn: chunkColumn,
        lineLength: chunk.content.length,
      }),
    );

    metadata[key] = value;
  }

  // Title block validation: only one allowed, and it must be first
  if (id === "title") {
    if (seenIds.has("title")) {
      errors.push(
        makeError({
          message: "Only one title block is allowed per text",
          line: block.startLine,
          column: firstLine.charOffset,
          length: firstLine.content.length,
        }),
      );
    } else if (previousBlockCount > 0) {
      errors.push(
        makeError({
          message: "Title block must be the first block in the text",
          line: block.startLine,
          column: firstLine.charOffset,
          length: firstLine.content.length,
        }),
      );
    }
  }

  // Subtitle auto-numbering: multiple subtitle blocks are allowed; each gets a unique compiled ID
  if (id === "subtitle") {
    id = `subtitle${subtitleCount + 1}`;
  }

  // check for duplicate block ID (title duplicates are already handled above)
  if (id !== "title" && seenIds.has(id)) {
    errors.push(
      makeError({
        message: `Duplicate block ID: #${id}`,
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length,
      }),
    );
  }

  const contentAfterTag = hasValidTag
    ? firstLine.content.slice(closingBrace + 1).trim()
    : isBlockTag
    ? ""
    : firstLine.content.trim();
  const newFirstLine = contentAfterTag
    ? {
      lineNumber: firstLine.lineNumber,
      charOffset: firstLine.charOffset +
        firstLine.content.indexOf(contentAfterTag),
      content: contentAfterTag,
    }
    : null;

  const lines = newFirstLine ? [newFirstLine, ...otherLines] : otherLines;

  const hasMetadata = Object.keys(metadata).length > 0;

  const blockWithMetadata: BlockWithMetadata = {
    ...block,
    id,
    ...(hasMetadata
      ? {
        metadata,
        metadataSource: {
          source: lineRange(block.startLine, block.startLine),
        },
      }
      : {}),
    lines,
  };

  return [blockWithMetadata, errors];
};

/**
 * Map a parsed value's diagnostics to compiler errors: an invalid value is
 * reported at the value itself, a mixed-type array at the whole line or pair.
 */
const valueErrors = (
  diagnostics: string[],
  valueString: string,
  at: {
    line: number;
    valueColumn: number;
    lineColumn: number;
    lineLength: number;
  },
): MarkitError[] => [
  ...(diagnostics.includes("invalid-value")
    ? [
      makeError({
        message: `Invalid metadata value: ${valueString}`,
        line: at.line,
        column: at.valueColumn,
        length: valueString.length,
      }),
    ]
    : []),
  ...(diagnostics.includes("mixed-array")
    ? [
      makeError({
        message:
          "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
        line: at.line,
        column: at.lineColumn,
        length: at.lineLength,
      }),
    ]
    : []),
];
