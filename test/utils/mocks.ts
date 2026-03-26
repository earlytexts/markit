export const createMockFileLoader =
  (files: Record<string, string>) => (path: string) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  };
