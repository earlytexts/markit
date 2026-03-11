import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import getDiagnostics from "./server/diagnostics.js";
import getFoldingRanges from "./server/foldingRanges.js";
import getFormattingEdits from "./server/formatting.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    foldingRangeProvider: true,
    documentFormattingProvider: true,
  },
}));

documents.onDidChangeContent((change) => {
  const diagnostics = getDiagnostics(change.document);
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

documents.onDidClose((event) => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
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
