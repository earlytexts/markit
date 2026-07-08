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

/** Client entry — depends on the `vscode` module which must be external */
const clientBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/client.ts"],
  outfile: "dist/client.js",
  external: ["vscode"],
});

/** Server entry — no external dependencies except node builtins */
const serverBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
});

if (watch) {
  // In watch mode, rebuild both on change
  const ctx1 = await esbuild.context({
    ...sharedOptions,
    entryPoints: ["src/client.ts"],
    outfile: "dist/client.js",
    external: ["vscode"],
  });
  const ctx2 = await esbuild.context({
    ...sharedOptions,
    entryPoints: ["src/server.ts"],
    outfile: "dist/server.js",
  });
  await Promise.all([ctx1.watch(), ctx2.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([clientBuild, serverBuild]);
}
