import { findClosingBrace, splitTopLevelCommas } from "../lib/blockTagLexer.js";
import type { MarkitError, Metadata, MetadataValue } from "../types.js";
import { endLine, footnoteReferenceSpec, startLine } from "../types.js";
import type { TextTree } from "./generateTextTree.js";
import makeError from "../lib/makeError.js";
import parseMetadataValue from "./parseMetadataValue.js";
import type { Line, RawBlock } from "./splitIntoBlocks.js";

/**
 * Parse the TextTree into a tree with metadata.
 */
export type TextTreeWithMetadata = Omit<TextTree, "blocks" | "children"> & {
  metadata?: Metadata;
  blocks: BlockWithMetadata[];
  children: TextTreeWithMetadata[];
};

export type BlockWithMetadata = Omit<RawBlock, "lines"> & {
  id: string;
  metadata?: Metadata;
  lines: Line[];
};

export default (textTree: TextTree): [TextTreeWithMetadata, MarkitError[]] => {
  return parseTextMetadata(textTree);
};

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

  // Parse all metadata blocks if any were found
  const metadataBlocks = text.blocks.slice(0, metadataBlockCount);
  const contentBlocks = text.blocks.slice(metadataBlockCount);

  const allMetadataErrors: MarkitError[] = [];
  const metadata: Metadata | undefined =
    metadataBlocks.length > 0
      ? {
          [startLine]: metadataBlocks[0]!.startLine,
          [endLine]: metadataBlocks.at(-1)!.endLine,
        }
      : undefined;
  let hasTopLevelBlock = false;

  for (const block of metadataBlocks) {
    const [subkey, parsedMetadata, errors] = parseMetadataBlock(block);
    allMetadataErrors.push(...errors);

    if (subkey === null) {
      // Top-level [metadata] block
      hasTopLevelBlock = true;
      Object.assign(metadata!, parsedMetadata);
    } else {
      // Nested [metadata.subkey] block
      if (!hasTopLevelBlock) {
        const firstLine = block.lines[0]!;
        allMetadataErrors.push(
          makeError({
            message: `Nested metadata block '[metadata.${subkey}]' must appear after the top-level '[metadata]' block`,
            line: block.startLine,
            column: firstLine.charOffset,
            length: firstLine.content.length,
          }),
        );
      }
      metadata![subkey] = Object.assign(
        parsedMetadata as Record<string, MetadataValue>,
        { [startLine]: block.startLine, [endLine]: block.endLine },
      );
    }
  }

  // Parse metadata for each block, passing in previously parsed blocks for duplicate ID checking
  const parseBlockMetadataResult = contentBlocks.reduce(
    (acc, block) => {
      const [blockWithMetadata, blockErrors] = parseBlockMetadata(
        block,
        acc.map((b) => b[0]),
      );
      acc.push([blockWithMetadata, blockErrors]);
      return acc;
    },
    [] as [BlockWithMetadata, MarkitError[]][],
  );
  const blocksWithMetadata = parseBlockMetadataResult.map(
    (result) => result[0],
  );
  const blockErrors = parseBlockMetadataResult.flatMap((result) => result[1]);

  // Validate footnote ordering: footnote blocks must appear after all paragraph blocks
  const footnoteErrors: MarkitError[] = [];
  let firstFootnoteIndex: number | null = null;
  for (let i = 0; i < blocksWithMetadata.length; i++) {
    const isFootnote = footnoteReferenceSpec.pattern.test(
      blocksWithMetadata[i]!.id,
    );
    if (isFootnote && firstFootnoteIndex === null) {
      firstFootnoteIndex = i;
    } else if (!isFootnote && firstFootnoteIndex !== null) {
      const footnoteBlock = blocksWithMetadata[firstFootnoteIndex]!;
      const rawFootnoteBlock = contentBlocks[firstFootnoteIndex]!;
      footnoteErrors.push(
        makeError({
          message: "Footnote blocks must appear after all paragraph blocks",
          line: footnoteBlock.startLine,
          column: rawFootnoteBlock.lines[0]!.charOffset,
          length: footnoteBlock.id.length + 3, // {# + id + }
        }),
      );
      break;
    }
  }

  // Parse metadata for children recursively
  const parseChildrenResult = text.children.map(parseTextMetadata);
  const childrenWithMetadata = parseChildrenResult.map((result) => result[0]);
  const childrenErrors = parseChildrenResult.flatMap((result) => result[1]);

  // Put it all together and return
  const textWithMetadata = {
    ...text,
    ...(metadata ? { metadata } : {}),
    blocks: blocksWithMetadata,
    children: childrenWithMetadata,
  };
  const errors = [
    ...allMetadataErrors,
    ...blockErrors,
    ...footnoteErrors,
    ...childrenErrors,
  ];
  return [textWithMetadata, errors];
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

  // Header must be valid — caller already checked, but guard anyway
  if (!headerMatch) {
    errors.push(
      makeError({
        message: `Invalid metadata header '${firstLine.content.trim()}' — only '[metadata]' and '[metadata.<key>]' are allowed`,
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

    // Check if this is a multiline array key (key = [ with no closing ] on same line)
    const multilineArrayMatch = line.content.match(/^(\w+)\s*=\s*\[(.*)$/);
    if (multilineArrayMatch) {
      const key = multilineArrayMatch[1]!;
      const rest = multilineArrayMatch[2]!.trim();

      // If the opening [ has content or a closing ], treat as inline — fall through to regular key=value
      if (rest === "" || rest === ",") {
        // Collect array items from subsequent lines until we hit ] or ],
        const arrayItems: (number | boolean | string)[] = [];
        let arrayIndex = index + 1;

        while (arrayIndex < lines.length) {
          const arrayLine = lines[arrayIndex]!;
          const trimmed = arrayLine.content.trim();

          // End of array
          if (trimmed === "]" || trimmed === "],") {
            arrayIndex++;
            break;
          }

          // Strip trailing comma from item
          const itemString = trimmed.replace(/,$/, "").trim();
          const itemStartColumn =
            arrayLine.charOffset + arrayLine.content.indexOf(itemString);

          const { value: itemValue, diagnostics } =
            parseMetadataValue(itemString);
          if (diagnostics.includes("invalid-value")) {
            errors.push(
              makeError({
                message: `Invalid metadata value: ${itemString}`,
                line: block.startLine + 1 + arrayIndex,
                column: itemStartColumn,
                length: itemString.length,
              }),
            );
          }

          arrayItems.push(itemValue as number | boolean | string);
          arrayIndex++;
        }

        if (arrayItems.length === 0) {
          errors.push(
            makeError({
              message: "Multiline array must have at least one item",
              line: block.startLine + 1 + index,
              column: line.charOffset,
              length: line.content.length,
            }),
          );
        } else {
          const types = new Set(arrayItems.map((item) => typeof item));
          if (types.size > 1) {
            errors.push(
              makeError({
                message:
                  "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
                line: block.startLine + 1 + index,
                column: line.charOffset,
                length: line.content.length,
              }),
            );
          } else {
            result[key] = arrayItems as MetadataValue;
          }
        }

        index = arrayIndex - 1;
        continue;
      }
      // else fall through to regular key=value parsing (inline array on one line)
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
    if (diagnostics.includes("invalid-value")) {
      errors.push(
        makeError({
          message: `Invalid metadata value: ${valueString}`,
          line: block.startLine + 1 + index,
          column: line.charOffset + line.content.indexOf(valueString),
          length: valueString.length,
        }),
      );
    }
    if (diagnostics.includes("mixed-array")) {
      errors.push(
        makeError({
          message:
            "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
          line: block.startLine + 1 + index,
          column: line.charOffset,
          length: line.content.length,
        }),
      );
    }

    result[key] = value;
  }

  return [subkey, result, errors];
};

const parseBlockMetadata = (
  block: RawBlock,
  previousBlocks: BlockWithMetadata[],
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
        message: `Block ID '${id}' contains invalid characters (IDs may not contain whitespace, '#', '{', or '}')`,
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
        message: `Block ID '${id}' is not a valid footnote ID (footnote IDs must start with 'n' followed by at least one character)`,
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
    if (diagnostics.includes("invalid-value")) {
      errors.push(
        makeError({
          message: `Invalid metadata value: ${valueString}`,
          line: block.startLine,
          column: chunkColumn + valueLocalOffset,
          length: valueString.length,
        }),
      );
    }
    if (diagnostics.includes("mixed-array")) {
      errors.push(
        makeError({
          message:
            "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
          line: block.startLine,
          column: chunkColumn,
          length: chunk.content.length,
        }),
      );
    }

    metadata[key] = value;
  }

  // Title block validation: only one allowed, and it must be first
  if (id === "title") {
    if (previousBlocks.some((b) => b.id === "title")) {
      errors.push(
        makeError({
          message: "Only one title block is allowed per text",
          line: block.startLine,
          column: firstLine.charOffset,
          length: firstLine.content.length,
        }),
      );
    } else if (previousBlocks.length > 0) {
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
    const n = previousBlocks.filter((b) => b.id.startsWith("subtitle")).length;
    id = `subtitle${n + 1}`;
  }

  // check for duplicate block ID (title duplicates are already handled above)
  if (id !== "title" && previousBlocks.some((b) => b.id === id)) {
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
        charOffset:
          firstLine.charOffset + firstLine.content.indexOf(contentAfterTag),
        content: contentAfterTag,
      }
    : null;

  const lines = newFirstLine ? [newFirstLine, ...otherLines] : otherLines;

  const metadataWithRanges =
    Object.keys(metadata).length > 0
      ? Object.assign(metadata, {
          [startLine]: block.startLine,
          [endLine]: block.startLine,
        })
      : undefined;

  const blockWithMetadata: BlockWithMetadata = {
    ...block,
    id,
    ...(metadataWithRanges ? { metadata: metadataWithRanges } : {}),
    lines,
  };

  return [blockWithMetadata, errors];
};
