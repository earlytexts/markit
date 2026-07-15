/**
 * Pure validation rules shared by the "compile" and "preview" commands.
 * Structural typing over vscode.TextDocument's relevant fields, so this needs
 * no "vscode" import at all.
 */

export type GuardableDocument = { languageId: string; isUntitled: boolean };

export const guardMarkitDocument = (
  document: GuardableDocument,
): string | undefined =>
  document.languageId !== "markit"
    ? "Active file is not a Markit document"
    : undefined;

export const guardSavedDocument = (
  document: GuardableDocument,
): string | undefined =>
  document.isUntitled ? "Please save the file before compiling" : undefined;
