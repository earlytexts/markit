import * as path from "node:path";

export type CompileOutcome = { info: string; warning?: string };

export const outputPathFor = (inputPath: string, extension: string): string => {
  const parsedPath = path.parse(inputPath);
  return path.join(parsedPath.dir, `${parsedPath.name}.${extension}`);
};

export const describeCompileOutcome = (
  outputPath: string,
  errorCount: number,
): CompileOutcome => ({
  info: `Compiled to ${path.basename(outputPath)}`,
  warning:
    errorCount > 0 ? `Compilation logged ${errorCount} errors` : undefined,
});
