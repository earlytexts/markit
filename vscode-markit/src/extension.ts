import { renderText } from "@earlytexts/markit";
import * as path from "node:path";
import { commands, ExtensionContext } from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import compileCommand from "./surface/compile.ts";
import showPreview from "./surface/preview.ts";
import renderHtml from "./lib/renderHtml.ts";

let client: LanguageClient;

export const activate = (context: ExtensionContext): void => {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "markit" }],
  };

  client = new LanguageClient(
    "markitLanguageServer",
    "Markit Language Server",
    serverOptions,
    clientOptions,
  );

  client.start();

  context.subscriptions.push(
    commands.registerCommand("markit.showPreview", async () => {
      await showPreview(context);
    }),
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
