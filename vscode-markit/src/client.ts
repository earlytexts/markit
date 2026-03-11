import { compileToHTML, compileToJson, compileToText } from "markit";
import * as path from "path";
import { ExtensionContext, commands } from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
import compileCommand from "./client/compile.js";
import showPreview from "./client/preview.js";

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
      await compileCommand("html", compileToHTML);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand("markit.compileToJSON", async () => {
      await compileCommand("json", compileToJson);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand("markit.compileToText", async () => {
      await compileCommand("txt", compileToText);
    }),
  );
};

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) return undefined;
  return client.stop();
};
