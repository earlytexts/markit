import { format } from "markit";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit } from "vscode-languageserver/node";

export default (textDocument: TextDocument): TextEdit[] => {
  const text = textDocument.getText();
  const formatted = format(text);

  if (formatted === text) return [];

  // Replace entire document content
  return [
    TextEdit.replace(
      {
        start: { line: 0, character: 0 },
        end: textDocument.positionAt(text.length),
      },
      formatted,
    ),
  ];
};
