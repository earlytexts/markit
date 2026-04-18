import { blockquoteSpec, headingSpec } from "../types.js";

/**
 * Classification result for a line of block-level content.
 * This is an internal type used by the compiler and formatter to determine
 * how to parse/format a line.
 */
export type BlockLineKind =
  | { kind: "blank" }
  | { kind: "heading"; level: number }
  | { kind: "invalidHeading"; level: number }
  | { kind: "headingWithoutLevel" }
  | { kind: "blockquote" }
  | { kind: "paragraph" };

/**
 * Classify a line of block-level content.
 * Returns structured data indicating what type of block element the line represents.
 */
export default (content: string): BlockLineKind => {
  // Blank line
  if (content === "") {
    return { kind: "blank" };
  }

  // Heading with invalid level (digit > maxLevel)
  const invalidLevelMatch = new RegExp(
    `^\\${headingSpec.marker}([${headingSpec.maxLevel + 1}-9]) `,
  ).exec(content);
  if (invalidLevelMatch) {
    const level = parseInt(invalidLevelMatch[1]!, 10);
    return { kind: "invalidHeading", level };
  }

  // Heading marker without a level digit
  if (new RegExp(`^\\${headingSpec.marker} `).test(content)) {
    return { kind: "headingWithoutLevel" };
  }

  // Valid heading: marker followed by level digit and space
  const headingMatch = new RegExp(
    `^\\${headingSpec.marker}([${headingSpec.minLevel}-${headingSpec.maxLevel}]) `,
  ).exec(content);
  if (headingMatch) {
    const level = parseInt(headingMatch[1]!, 10);
    return { kind: "heading", level };
  }

  // Blockquote: starts with blockquote marker
  if (content.startsWith(blockquoteSpec.marker)) {
    return { kind: "blockquote" };
  }

  // Everything else is a paragraph
  return { kind: "paragraph" };
};
