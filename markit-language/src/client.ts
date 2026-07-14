import { renderText } from "@earlytexts/markit";
import { commands, ExtensionContext } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import createLanguageClient from "./client/languageClient.ts";
import compileCommand from "./client/compileCommand.ts";
import showPreview from "./client/showPreview.ts";
import renderHtml from "./client/lib/renderHtml.ts";

let client: LanguageClient;

export const activate = (context: ExtensionContext): void => {
  client = createLanguageClient(context);
  client.start();

  context.subscriptions.push(
    commands.registerCommand("markit.showPreview", showPreview(context)),
  );

  context.subscriptions.push(
    commands.registerCommand("markit.compileToHTML", async () => {
      await compileCommand("html", renderHtml);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand("markit.compileToJSON", async () => {
      await compileCommand("json", (document) => JSON.stringify(document));
    }),
  );

  context.subscriptions.push(
    commands.registerCommand("markit.compileToText", async () => {
      await compileCommand("txt", renderText);
    }),
  );
};

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) return undefined;
  return client.stop();
};
