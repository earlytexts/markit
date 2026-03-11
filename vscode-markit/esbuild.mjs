import * as esbuild from "esbuild";

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
