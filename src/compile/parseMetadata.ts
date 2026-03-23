import type { MarkitError, MetadataValue } from "../types.js";
import type { TextTree } from "./generateTextTree.js";
import makeError from "./makeError.js";
import type { Line, RawBlock } from "./splitIntoBlocks.js";

/**
 * Parse the TextTree into a tree with metadata.
 */
export type TextTreeWithMetadata = Omit<TextTree, "blocks" | "children"> & {
  metadata: Record<string, MetadataValue>;
  blocks: BlockWithMetadata[];
  children: TextTreeWithMetadata[];
};

export type BlockWithMetadata = Omit<RawBlock, "lines"> & {
  id: string;
  metadata: Record<string, MetadataValue>;
  lines: Line[];
};

export default (textTree: TextTree): [TextTreeWithMetadata, MarkitError[]] => {
  return parseTextMetadata(textTree);
};

const parseTextMetadata = (
  text: TextTree,
): [TextTreeWithMetadata, MarkitError[]] => {
  const firstBlock = text.blocks[0];
  if (!firstBlock) {
    const parseChildrenResult = text.children.map(parseTextMetadata);
    const childrenWithMetadata = parseChildrenResult.map((result) => result[0]);
    const childrenErrors = parseChildrenResult.flatMap((result) => result[1]);
    return [
      { ...text, metadata: {}, blocks: [], children: childrenWithMetadata },
      childrenErrors,
    ];
  }

  const firstLine = firstBlock.lines[0];
  const isMetadata = firstLine.content.match(/^\w+:/);
  const [metadata, metadataErrors] = isMetadata
    ? parseMetadataBlock(firstBlock)
    : [{}, []];

  const contentBlocks = isMetadata ? text.blocks.slice(1) : text.blocks;
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

  const parseChildrenResult = text.children.map(parseTextMetadata);
  const childrenWithMetadata = parseChildrenResult.map((result) => result[0]);
  const childrenErrors = parseChildrenResult.flatMap((result) => result[1]);

  const textWithMetadata = {
    ...text,
    metadata,
    blocks: blocksWithMetadata,
    children: childrenWithMetadata,
  };

  const errors = [...metadataErrors, ...blockErrors, ...childrenErrors];
  return [textWithMetadata, errors];
};

const parseMetadataBlock = (
  block: RawBlock,
): [Record<string, MetadataValue>, MarkitError[]] => {
  const errors: MarkitError[] = [];
  const metadata: Record<string, MetadataValue> = {};

  for (let index = 0; index < block.lines.length; index++) {
    const line = block.lines[index]!;

    // Check if this is a multiline array key (key: with no value or empty value)
    const multilineArrayMatch = line.content.match(/^(\w+)\s*:\s*$/);
    if (multilineArrayMatch) {
      const key = multilineArrayMatch[1]!;

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
        let itemValue: number | boolean | string;
        try {
          itemValue = JSON.parse(itemString);
        } catch {
          itemValue = itemString;
          errors.push(
            makeError({
              message: `Invalid metadata value: ${itemString}`,
              line: block.startLine + arrayIndex,
              column:
                arrayLine.charOffset + arrayLine.content.indexOf(itemString),
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
        metadata[key] = arrayItems as MetadataValue;
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

    // Check for mixed types in inline arrays
    if (Array.isArray(value) && value.length > 0) {
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

    metadata[key] = value;
  }

  return [metadata, errors];
};

const parseBlockMetadata = (
  block: RawBlock,
  previousBlocks: BlockWithMetadata[],
): [BlockWithMetadata, MarkitError[]] => {
  const errors: MarkitError[] = [];

  const [firstLine, ...otherLines] = block.lines;
  const blockTagMatch = firstLine.content.match(/^{#(.+)}/);

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
  const id = blockTagParts[0]!;

  // check for duplicate block ID
  if (previousBlocks.some((b) => b.id === id)) {
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

  const contentAfterTag = firstLine.content
    .slice(blockTagMatch ? blockTagMatch[0]!.length : 0)
    .trim();
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
  };

  return [blockWithMetadata, errors];
};
