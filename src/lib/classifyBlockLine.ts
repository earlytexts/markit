import {
  blockquoteSpec,
  headingSpec,
  listSpec,
  stageDirectionSpec,
  tableSpec,
} from "../types.js";

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
  | { kind: "stageDirection" }
  | { kind: "verseListItem" }
  | { kind: "unorderedListItem"; indent: number }
  | { kind: "orderedListItem"; indent: number; number: number }
  | { kind: "tableRow" }
  | { kind: "tableSeparator" }
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

  // Stage direction: starts with the stage-direction marker
  if (content.startsWith(stageDirectionSpec.marker)) {
    return { kind: "stageDirection" };
  }

  // Verse line: starts with verse marker and space (no indentation)
  if (content.startsWith(`${listSpec.verseMarker} `)) {
    return { kind: "verseListItem" };
  }

  // Unordered list item: starts with optional spaces, hyphen, and space
  const unorderedMatch = new RegExp(
    `^(\\s*)\\${listSpec.unorderedMarker} `,
  ).exec(content);
  if (unorderedMatch) {
    const indent = unorderedMatch[1]!.length;
    return { kind: "unorderedListItem", indent };
  }

  // Ordered list item: starts with optional spaces, digit(s), period, and space
  const orderedMatch = /^(\s*)(\d+)\. /.exec(content);
  if (orderedMatch) {
    const indent = orderedMatch[1]!.length;
    const number = parseInt(orderedMatch[2]!, 10);
    return { kind: "orderedListItem", indent, number };
  }

  // Table separator row: contains only dashes and pipes
  if (tableSpec.separatorPattern.test(content)) {
    return { kind: "tableSeparator" };
  }

  // Table row: line must start or end with | (after trimming), or have | with surrounding whitespace
  // This distinguishes tables from inline pageBreak syntax (/// or //ref//) which appears mid-paragraph
  const trimmed = content.trim();
  if (trimmed.startsWith("|") || trimmed.endsWith("|")) {
    // Looks like a table row with proper formatting
    return { kind: "tableRow" };
  }

  // Everything else is a paragraph
  return { kind: "paragraph" };
};
