import type {
  CompileOptions,
  MarkitDocument,
  MarkitError,
  MetadataValue,
} from "../types.js";
import makeError from "./makeError.js";

/**
 * Load external children from the children metadata field.
 *
 * @param metadata The parsed metadata containing the children field
 * @param options Compilation options including file loader and current file path
 * @param loadingStack Set of file paths currently being loaded (for circular dependency detection)
 * @param metadataStartLine The starting line of the metadata block for error reporting
 * @returns A tuple of [MarkitDocument[], MarkitError[]]
 */
export default (
  metadata: Record<string, MetadataValue>,
  options: CompileOptions | undefined,
  loadingStack: Set<string>,
  metadataStartLine: number,
  compile: (
    text: string,
    options?: CompileOptions,
    loadingStack?: Set<string>,
  ) => [MarkitDocument, MarkitError[]],
): [MarkitDocument[], MarkitError[]] => {
  const childrenPaths = metadata.children;

  // If no children metadata or no file loader, return empty
  if (!childrenPaths || !options?.loadFile || !options?.currentFilePath) {
    return [[], []];
  }

  // children should be validated as string[] in parseMetadata, but check anyway
  if (!Array.isArray(childrenPaths)) {
    return [[], []];
  }

  const externalChildren: MarkitDocument[] = [];
  const errors: MarkitError[] = [];

  for (const childPath of childrenPaths) {
    if (typeof childPath !== "string") {
      continue; // Already validated in parseMetadata
    }

    // Resolve path relative to parent file
    const resolvedPath = resolvePath(options.currentFilePath, childPath);
    const normalizedPath = normalizePath(resolvedPath);

    // Check for circular dependencies
    if (loadingStack.has(normalizedPath)) {
      errors.push(
        makeError({
          message: `Circular dependency detected: ${childPath}`,
          line: metadataStartLine,
          column: 0,
          length: 0,
        }),
      );
      continue;
    }

    // Try to load the file (first as-is, then with .mit extension)
    let fileContent: string | null = null;
    let actualPath = resolvedPath;

    try {
      fileContent = options.loadFile(resolvedPath);
    } catch {
      // Try with .mit extension
      const pathWithExtension = resolvedPath.endsWith(".mit")
        ? resolvedPath
        : `${resolvedPath}.mit`;
      try {
        fileContent = options.loadFile(pathWithExtension);
        actualPath = pathWithExtension;
      } catch (error) {
        errors.push(
          makeError({
            message: `Cannot load external child: ${childPath}`,
            line: metadataStartLine,
            column: 0,
            length: 0,
          }),
        );
        continue;
      }
    }

    // Add to loading stack for circular dependency detection
    const newLoadingStack = new Set(loadingStack);
    newLoadingStack.add(normalizedPath);

    // Compile the child document recursively
    const [childDoc, childErrors] = compile(
      fileContent,
      {
        ...options,
        currentFilePath: actualPath,
      },
      newLoadingStack,
    );

    externalChildren.push(childDoc);

    // Add file context to child errors
    const childErrorsWithFile = childErrors.map((error) => ({
      ...error,
      file: childPath,
    }));
    errors.push(...childErrorsWithFile);
  }

  return [externalChildren, errors];
};

/**
 * Resolve a relative path against a parent file path.
 * Simple implementation that handles basic relative paths.
 */
const resolvePath = (parentPath: string, relativePath: string): string => {
  // If relative path is absolute-ish (starts with / or \), just return it
  if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    return relativePath;
  }

  // Get the directory of the parent file
  const lastSlash = Math.max(
    parentPath.lastIndexOf("/"),
    parentPath.lastIndexOf("\\"),
  );

  if (lastSlash < 0) {
    // No slash in parent path, relativePath is relative to current directory
    return relativePath;
  }

  // Get parent directory (keep the leading slash if present)
  const parentDir = parentPath.substring(0, lastSlash + 1);

  // Combine parent directory with relative path
  return `${parentDir}${relativePath}`;
};

/**
 * Normalize a file path for comparison (handle different path separators).
 */
const normalizePath = (path: string): string => {
  return path.replace(/\\/g, "/").toLowerCase();
};
