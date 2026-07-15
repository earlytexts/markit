import { compileWithPositions, type MarkitDocument } from "@earlytexts/markit";
import * as fs from "node:fs";
import { window } from "vscode";
import {
  guardMarkitDocument,
  guardSavedDocument,
} from "./lib/documentGuard.ts";
import { describeCompileOutcome, outputPathFor } from "./lib/compileTarget.ts";

export default async (
  extension: string,
  compileFn: (document: MarkitDocument) => string,
): Promise<void> => {
  const editor = window.activeTextEditor;

  if (!editor) {
    window.showErrorMessage("No active editor found");
    return;
  }

  const document = editor.document;

  const guardMessage =
    guardMarkitDocument(document) ?? guardSavedDocument(document);
  if (guardMessage) {
    window.showErrorMessage(guardMessage);
    return;
  }

  // Save the document if it has unsaved changes
  if (document.isDirty) {
    await document.save();
  }

  const outputPath = outputPathFor(document.uri.fsPath, extension);

  try {
    const inputText = document.getText();
    const { document: markit, errors } = compileWithPositions(inputText);
    const outputText = compileFn(markit);

    fs.writeFileSync(outputPath, outputText, "utf-8");

    const outcome = describeCompileOutcome(outputPath, errors.length);
    window.showInformationMessage(outcome.info);
    if (outcome.warning) {
      window.showWarningMessage(outcome.warning);
    }
  } catch (error) {
    window.showErrorMessage(`Failed to write file: ${error}`);
  }
};
