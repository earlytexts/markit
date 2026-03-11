import * as esbuild from "esbuild";
import { readFileSync } from "fs";

// Read package.json to get dependencies
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "es2022",
  format: "esm",
  sourcemap: true,
  external,
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
}
