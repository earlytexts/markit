import type { MarkitError, Metadata, MetadataValue } from "../types.js";
import {
  footnoteReferenceSpec,
  RESERVED_BLOCK_KEYS,
  RESERVED_TEXT_KEYS,
} from "../types.js";
import type { TextTree } from "./generateTextTree.js";
import makeError from "./makeError.js";
import type { Line, RawBlock } from "./splitIntoBlocks.js";

/**
 * Parse the TextTree into a tree with metadata.
 */
export type TextTreeWithMetadata<
  TextMetadata extends Metadata,
  BlockMetadata extends Metadata,
> = Omit<TextTree, "blocks" | "children"> & {
  metadata: TextMetadata;
  metadataPositions: Record<keyof TextMetadata, MetadataPosition>; // expose this for error reporting when compiling external children
  blocks: BlockWithMetadata<BlockMetadata>[];
  children: TextTreeWithMetadata<TextMetadata, BlockMetadata>[];
};

export type BlockWithMetadata<BlockMetadata extends Metadata> = Omit<
  RawBlock,
  "lines"
> & {
  id: string;
  metadata: BlockMetadata;
  lines: Line[];
};

export type MetadataPosition = {
  line: number;
  column: number;
  length: number;
  arrayElementPositions: Array<{
    line: number;
    column: number;
    length: number;
  }>;
};

export default <TextMetadata extends Metadata, BlockMetadata extends Metadata>(
  textTree: TextTree,
): [TextTreeWithMetadata<TextMetadata, BlockMetadata>, MarkitError[]] => {
  return parseTextMetadata<TextMetadata, BlockMetadata>(textTree);
};

const parseTextMetadata = <
  TextMetadata extends Metadata,
  BlockMetadata extends Metadata,
>(
  text: TextTree,
): [TextTreeWithMetadata<TextMetadata, BlockMetadata>, MarkitError[]] => {
  // Check if first block is a metadata block (if it exists)
  const firstBlock = text.blocks[0];
  const firstLine = firstBlock?.lines[0];
  const isMetadata = firstLine?.content.match(/^\w+:/);

  // If there's a metadata block, parse it - otherwise metadata is empty
  const [metadata, metadataPositions, metadataErrors] = isMetadata
    ? parseMetadataBlock(firstBlock!)
    : [{}, {}, []];

  // If it was a metadata block, remove it from the blocks array for the rest of the parsing
  const contentBlocks = isMetadata ? text.blocks.slice(1) : text.blocks;

  // Parse metadata for each block, passing in previously parsed blocks for duplicate ID checking
  const parseBlockMetadataResult = contentBlocks.reduce(
    (acc, block) => {
      const [blockWithMetadata, blockErrors] =
        parseBlockMetadata<BlockMetadata>(
          block,
          acc.map((b) => b[0]),
        );
      acc.push([blockWithMetadata, blockErrors]);
      return acc;
    },
    [] as [BlockWithMetadata<BlockMetadata>, MarkitError[]][],
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
    metadata,
    metadataPositions,
    blocks: blocksWithMetadata,
    children: childrenWithMetadata,
  } as TextTreeWithMetadata<TextMetadata, BlockMetadata>;
  const errors = [
    ...metadataErrors,
    ...blockErrors,
    ...footnoteErrors,
    ...childrenErrors,
  ];
  return [textWithMetadata, errors];
};

const parseMetadataBlock = <TextMetadata extends Metadata>(
  block: RawBlock,
): [
  TextMetadata,
  Record<keyof TextMetadata, MetadataPosition>,
  MarkitError[],
] => {
  const errors: MarkitError[] = [];
  const metadata = {} as TextMetadata;
  const metadataPositions = {} as Record<keyof TextMetadata, MetadataPosition>;

  for (let index = 0; index < block.lines.length; index++) {
    const line = block.lines[index]!;

    // Check if this is a multiline array key (key: with no value or empty value)
    const multilineArrayMatch = line.content.match(/^(\w+)\s*:\s*$/);
    if (multilineArrayMatch) {
      const key = multilineArrayMatch[1]!;

      // Track position for this key
      metadataPositions[key as keyof TextMetadata] = {
        line: block.startLine + index,
        column: line.charOffset,
        length: line.content.length,
        arrayElementPositions: [],
      };

      // Collect array items from subsequent lines
      const arrayItems: (number | boolean | string)[] = [];
      let arrayIndex = index + 1;

      while (arrayIndex < block.lines.length) {
        const arrayLine = block.lines[arrayIndex]!;
        const arrayItemMatch = arrayLine.content.match(/^- (.+)$/);

        if (!arrayItemMatch) {
          // Not an array item, stop collecting
          break;
        }

        const itemString = arrayItemMatch[1]!.trim();
        const itemStartColumn =
          arrayLine.charOffset + arrayLine.content.indexOf(itemString);

        // Track position for this array element
        metadataPositions[key as keyof TextMetadata].arrayElementPositions.push(
          {
            line: block.startLine + arrayIndex,
            column: itemStartColumn,
            length: itemString.length,
          },
        );

        let itemValue: number | boolean | string;
        try {
          itemValue = JSON.parse(itemString);
        } catch {
          itemValue = itemString;
          errors.push(
            makeError({
              message: `Invalid metadata value: ${itemString}`,
              line: block.startLine + arrayIndex,
              column: itemStartColumn,
              length: itemString.length,
            }),
          );
        }

        arrayItems.push(itemValue);
        arrayIndex++;
      }

      if (arrayItems.length === 0) {
        errors.push(
          makeError({
            message: "Multiline array must have at least one item",
            line: block.startLine + index,
            column: line.charOffset,
            length: line.content.length,
          }),
        );
      } else {
        // Check for mixed types in the array
        const types = new Set(arrayItems.map((item) => typeof item));
        if (types.size > 1) {
          errors.push(
            makeError({
              message:
                "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
              line: block.startLine + index,
              column: line.charOffset,
              length: line.content.length,
            }),
          );
        }
        metadata[key as keyof TextMetadata] =
          arrayItems as TextMetadata[keyof TextMetadata];
      }

      // Skip the lines we've just processed
      index = arrayIndex - 1;
      continue;
    }

    // Regular key: value line
    const match = line.content.match(/^(\w+)\s*:\s*(.+)$/);
    if (!match) {
      errors.push(
        makeError({
          message: "Invalid metadata line, expected 'key: value'",
          line: block.startLine + index,
          column: line.charOffset,
          length: line.content.length,
        }),
      );
      continue;
    }

    const key = match[1]!;
    const valueString = match[2]!.trim();

    // Check for reserved keys (excluding 'children' which has its own handling)
    if (RESERVED_TEXT_KEYS.includes(key) && key !== "children") {
      errors.push(
        makeError({
          message: `The '${key}' metadata key is reserved and cannot be used in the document metadata`,
          line: block.startLine + index,
          column: line.charOffset,
          length: key.length,
        }),
      );
      continue;
    }

    // Track position for this key
    metadataPositions[key as keyof TextMetadata] = {
      line: block.startLine + index,
      column: line.charOffset,
      length: line.content.length,
      arrayElementPositions: [],
    };

    let value: MetadataValue;
    try {
      value = JSON.parse(valueString);
    } catch {
      value = valueString;
      errors.push(
        makeError({
          message: `Invalid metadata value: ${valueString}`,
          line: block.startLine + index,
          column: line.charOffset + line.content.indexOf(valueString),
          length: valueString.length,
        }),
      );
    }

    // Track array element positions for inline arrays
    if (Array.isArray(value)) {
      const arrayOpeningBracketIndex = line.content.indexOf(valueString);
      value.forEach((item) => {
        const itemString = JSON.stringify(item);
        const itemStartIndex = line.content.indexOf(
          itemString,
          arrayOpeningBracketIndex,
        );
        metadataPositions[
          key as keyof TextMetadata
        ]!.arrayElementPositions.push({
          line: block.startLine + index,
          column: line.charOffset + itemStartIndex,
          length: itemString.length,
        });
      });
    }

    // Check for mixed types in inline arrays
    if (Array.isArray(value)) {
      const types = new Set(value.map((item) => typeof item));
      if (types.size > 1) {
        errors.push(
          makeError({
            message:
              "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
            line: block.startLine + index,
            column: line.charOffset,
            length: line.content.length,
          }),
        );
      }
    }

    metadata[key as keyof TextMetadata] =
      value as TextMetadata[keyof TextMetadata];
  }

  return [metadata, metadataPositions, errors];
};

const parseBlockMetadata = <BlockMetadata extends Metadata>(
  block: RawBlock,
  previousBlocks: BlockWithMetadata<BlockMetadata>[],
): [BlockWithMetadata<BlockMetadata>, MarkitError[]] => {
  const errors: MarkitError[] = [];

  const [firstLine, ...otherLines] = block.lines;
  const blockTagMatch = firstLine.content.match(/^\{#(.+?)\}/);

  if (!blockTagMatch) {
    const message = firstLine.content.trim().startsWith("{#")
      ? "Block tag is not properly closed with '}'"
      : "Block is missing metadata tag '{#id}'";
    errors.push(
      makeError({
        message,
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length,
      }),
    );
  }

  const blockTagContent = blockTagMatch
    ? blockTagMatch[1]!.trim()
    : `${block.startLine}`;
  const blockTagParts = blockTagContent.split(",").map((part) => part.trim());

  // fallback to start line as ID if ID not provided
  // error will be reported by blockTagMatch check above
  let id = blockTagParts[0]!;

  // Validate block ID characters (only when a block tag was matched, not the fallback)
  if (blockTagMatch && !/^[^\s#{}]+$/.test(id)) {
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
    blockTagMatch &&
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

  const metadata: Record<string, MetadataValue> = {};
  blockTagParts.slice(1).forEach((part) => {
    const [key, valueString] = part.split("=").map((s) => s.trim());
    if (!key || !valueString) {
      errors.push(
        makeError({
          message: "Invalid block metadata, expected 'key=value'",
          line: block.startLine,
          column: firstLine.charOffset + firstLine.content.indexOf(part),
          length: part.length,
        }),
      );
      return;
    }

    if (RESERVED_BLOCK_KEYS.includes(key)) {
      errors.push(
        makeError({
          message: `Block tag key '${key}' is reserved and cannot be used in metadata`,
          line: block.startLine,
          column: firstLine.charOffset + firstLine.content.indexOf(part),
          length: key.length,
        }),
      );
      return;
    }

    let value: MetadataValue;
    try {
      value = JSON.parse(valueString);
    } catch {
      value = valueString;
      errors.push(
        makeError({
          message: `Invalid metadata value: ${valueString}`,
          line: block.startLine,
          column: firstLine.charOffset + firstLine.content.indexOf(valueString),
          length: valueString.length,
        }),
      );
    }

    metadata[key] = value;
  });

  const contentAfterTag = blockTagMatch
    ? firstLine.content.slice(blockTagMatch[0]!.length).trim()
    : firstLine.content.trim().startsWith("{#")
      ? ""
      : firstLine.content.trim();
  const newFirstLine = contentAfterTag
    ? {
        charOffset:
          firstLine.charOffset + firstLine.content.indexOf(contentAfterTag),
        content: contentAfterTag,
      }
    : null;

  const lines = newFirstLine ? [newFirstLine, ...otherLines] : otherLines;

  const blockWithMetadata = {
    ...block,
    id,
    metadata,
    lines,
  } as BlockWithMetadata<BlockMetadata>;

  return [blockWithMetadata, errors];
};
