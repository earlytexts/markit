/**
 * Source-provenance recording flag. While it is on — set by
 * `compile(text, { tokens: true })` around the parse — `parseElements` fills in
 * each `plainText` node's `sources` (its per-character source positions), so
 * `tokenize` can map a token's rendered offset back to a source line/column.
 *
 * The flag keeps provenance off the common no-tokens compile path (and out of
 * the catalogue): without it every compile would build per-character positions
 * and every `plainText` node would carry a `sources` array.
 */
let recording = false;

/** Run `fn` with plainText provenance recording on, restoring the prior state. */
export const withProvenance = <T>(fn: () => T): T => {
  const previous = recording;
  recording = true;
  try {
    return fn();
  } finally {
    recording = previous;
  }
};

/** Whether `parseElements` should record plainText provenance right now. */
export const isRecording = (): boolean => recording;
