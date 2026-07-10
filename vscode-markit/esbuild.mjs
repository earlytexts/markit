import * as esbuild from "esbuild";
import path from "node:path";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const sharedOptions = {
  bundle: true,
  platform: "node",
  target: "es2022",
  format: "cjs",
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
  // The library is the sibling package in this repo, published to JSR rather
  // than npm; esbuild compiles its TypeScript source directly.
  alias: {
    "@earlytexts/markit": path.resolve(import.meta.dirname, "../src/index.ts"),
  },
};

// The extension has two bundles, mirroring its two entry points: the client
// (extension.ts, activated by VSCode) and the language server (server.ts,
// spawned by the client over IPC).
/** Client entry — depends on the `vscode` module which must be external */
const clientOptions = {
  ...sharedOptions,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
};

/** Server entry — no external dependencies except node builtins */
const serverOptions = {
  ...sharedOptions,
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
};

if (watch) {
  const ctx1 = await esbuild.context(clientOptions);
  const ctx2 = await esbuild.context(serverOptions);
  await Promise.all([ctx1.watch(), ctx2.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([
    esbuild.build(clientOptions),
    esbuild.build(serverOptions),
  ]);
}
