import { compile, type CompileResult } from "@earlytexts/markit";
import { TextDocument } from "vscode-languageserver-textdocument";

// One compile per document version, shared by every feature that needs the
// compiled document (diagnostics, folding ranges): repeated requests against
// the same version hit the cache instead of recompiling.
const cache = new Map<string, { version: number; result: CompileResult }>();

export const compileDocument = (textDocument: TextDocument): CompileResult => {
  const entry = cache.get(textDocument.uri);
  if (entry && entry.version === textDocument.version) return entry.result;
  const result = compile(textDocument.getText());
  cache.set(textDocument.uri, { version: textDocument.version, result });
  return result;
};

export const evictDocument = (uri: string): void => {
  cache.delete(uri);
};
