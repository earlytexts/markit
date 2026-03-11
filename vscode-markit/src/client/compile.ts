import * as fs from "fs";
import type { MarkitError } from "markit";
import * as path from "path";
import { window } from "vscode";

export default async (
  extension: string,
  compileFn: (input: string) => [string, MarkitError[]],
): Promise<void> => {
  const editor = window.activeTextEditor;

  if (!editor) {
    window.showErrorMessage("No active editor found");
    return;
  }

  const document = editor.document;

  if (document.languageId !== "markit") {
    window.showErrorMessage("Active file is not a Markit document");
    return;
  }

  if (document.isUntitled) {
    window.showErrorMessage("Please save the file before compiling");
    return;
  }

  // Save the document if it has unsaved changes
  if (document.isDirty) {
    await document.save();
  }

  const inputPath = document.uri.fsPath;
  const parsedPath = path.parse(inputPath);
  const outputPath = path.join(
    parsedPath.dir,
    `${parsedPath.name}.${extension}`,
  );

  try {
    const inputText = document.getText();
    const [outputText, errors] = compileFn(inputText);

    fs.writeFileSync(outputPath, outputText, "utf-8");

    window.showInformationMessage(`Compiled to ${path.basename(outputPath)}`);
    if (errors.length > 0) {
      window.showWarningMessage(`Compilation logged ${errors.length} errors`);
    }
  } catch (error) {
    window.showErrorMessage(`Failed to write file: ${error}`);
  }
};
