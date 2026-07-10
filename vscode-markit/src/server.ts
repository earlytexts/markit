import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { evictDocument } from "./surface/compileCache.ts";
import getDiagnostics from "./surface/diagnostics.ts";
import getFoldingRanges from "./surface/foldingRanges.ts";
import getFormattingEdits from "./surface/formatting.ts";

// Trailing debounce for diagnostics: recompiling on every keystroke makes
// large documents feel sluggish, so wait for a brief pause in typing.
const DIAGNOSTICS_DEBOUNCE_MS = 200;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    foldingRangeProvider: true,
    documentFormattingProvider: true,
  },
}));

const pendingDiagnostics = new Map<string, NodeJS.Timeout>();

documents.onDidChangeContent((change) => {
  const { uri } = change.document;
  clearTimeout(pendingDiagnostics.get(uri));
  pendingDiagnostics.set(
    uri,
    setTimeout(() => {
      pendingDiagnostics.delete(uri);
      // change.document is live, so this sees the latest content
      const diagnostics = getDiagnostics(change.document);
      connection.sendDiagnostics({ uri, diagnostics });
    }, DIAGNOSTICS_DEBOUNCE_MS),
  );
});

documents.onDidClose((event) => {
  const { uri } = event.document;
  clearTimeout(pendingDiagnostics.get(uri));
  pendingDiagnostics.delete(uri);
  evictDocument(uri);
  connection.sendDiagnostics({ uri, diagnostics: [] });
});

connection.onFoldingRanges((params) => {
  const textDocument = documents.get(params.textDocument.uri);
  if (!textDocument) return [];
  return getFoldingRanges(textDocument);
});

connection.onDocumentFormatting((params) => {
  const textDocument = documents.get(params.textDocument.uri);
  if (!textDocument) return [];
  return getFormattingEdits(textDocument);
});

documents.listen(connection);
connection.listen();
