import compile from "./compile.js";
import type { CompileOptions, MarkitError } from "./types.js";

export default (
  input: string,
  options?: CompileOptions,
): [string, MarkitError[]] => {
  const [markit, errors] = compile(input, options);
  return [JSON.stringify(markit, null, 2), errors];
};
