import type { CompileOptions, MarkitDocument, MarkitError } from "../types.js";
import makeError from "./makeError.js";
import type { TextTreeWithMetadata } from "./parseMetadata.js";

/**
 * Recursively compile external children from the children metadata field.
 * (Takes the same compile function as an argument to allow for recursion without circular imports.)
 */
export default (
  treeWithMetadata: TextTreeWithMetadata,
  options: CompileOptions,
  loadingStack: Set<string>,
  compile: (
    text: string,
    options: CompileOptions,
    loadingStack: Set<string>,
  ) => [MarkitDocument, MarkitError[]],
): [MarkitDocument[], MarkitError[]] => {
  // Look for children metadata array
  const childrenPaths = treeWithMetadata.metadata.children;

  // If it doesn't exist, we're done
  if (!childrenPaths) {
    return [[], []];
  }

  // If it does exist, check it's an array
  const childrenPositions = treeWithMetadata.metadataPositions.children!;
  if (!Array.isArray(childrenPaths)) {
    const error = makeError({
      message:
        "The 'children' metadata field must be an array of strings (file paths)",
      line: childrenPositions.line,
      column: childrenPositions.column,
      length: childrenPositions.length,
    });
    return [[], [error]];
  }

  // Also check we have what we need to load external children
  if (!options.loadFile || !options.currentFilePath) {
    const error = makeError({
      message:
        "Cannot load external children: no file loader provided to compile()",
      line: childrenPositions.line,
      column: childrenPositions.column,
      length: childrenPositions.length,
    });
    return [[], [error]];
  }

  // Okay, now we can start loading and compiling them
  const errors: MarkitError[] = [];
  const externalChildren: MarkitDocument[] = [];

  for (let i = 0; i < childrenPaths.length; i++) {
    const childPath = childrenPaths[i];
    const elementPosition = childrenPositions.arrayElementPositions[i]!;

    // Check it's a string
    if (typeof childPath !== "string") {
      errors.push(
        makeError({
          message:
            "Each item in 'children' metadata array must be a string (file path)",
          line: elementPosition.line,
          column: elementPosition.column,
          length: elementPosition.length,
        }),
      );
      continue;
    }

    // Resolve path relative to parent file
    const resolvedPath = resolvePath(options.currentFilePath, childPath);
    const normalizedPath = normalizePath(resolvedPath);

    // Check for circular dependencies
    if (loadingStack.has(normalizedPath)) {
      errors.push(
        makeError({
          message: "Circular dependency detected",
          line: elementPosition.line,
          column: elementPosition.column,
          length: elementPosition.length,
        }),
      );
      continue;
    } else {
      // Add to loading stack for next checks down the tree
      loadingStack.add(normalizedPath);
    }

    // Try to load the file...
    let fileContent: string | null = null;
    let actualPath = resolvedPath;
    try {
      // Try as given first
      fileContent = options.loadFile(resolvedPath);
    } catch {
      // Then try with .mit extension
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
            line: elementPosition.line,
            column: elementPosition.column,
            length: elementPosition.length,
          }),
        );
        continue;
      }
    }

    // Compile the child document recursively
    const [childDocument, childErrors] = compile(
      fileContent,
      {
        ...options,
        currentFilePath: actualPath,
      },
      loadingStack,
    );

    // Add the child any any child errors to our results
    externalChildren.push(childDocument);
    errors.push(...childErrors.map((error) => ({ ...error, file: childPath })));
  }

  // Return the compiled external children and any errors
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
