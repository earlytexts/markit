import compile from "./compile.js";
import type { MarkitError } from "./types.js";

export default (input: string): [string, MarkitError[]] => {
  const [markit, errors] = compile(input);
  return [JSON.stringify(markit, null, 2), errors];
};
