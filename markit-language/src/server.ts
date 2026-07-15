import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { evictDocument } from "./server/compileCache.ts";
import getDiagnostics from "./server/documentDiagnostics.ts";
import getFoldingRanges from "./server/documentFolding.ts";
import getFormattingEdits from "./server/documentFormatting.ts";
import createKeyedDebouncer from "./server/lib/debounce.ts";

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

const diagnosticsDebouncer = createKeyedDebouncer<string, TextDocument>(
  DIAGNOSTICS_DEBOUNCE_MS,
  (uri, document) => {
    const diagnostics = getDiagnostics(document);
    connection.sendDiagnostics({ uri, diagnostics });
  },
);

documents.onDidChangeContent((change) => {
  // change.document is live, so the debouncer's callback sees the latest
  // content whenever the timer fires.
  diagnosticsDebouncer.trigger(change.document.uri, change.document);
});

documents.onDidClose((event) => {
  const { uri } = event.document;
  diagnosticsDebouncer.cancel(uri);
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
