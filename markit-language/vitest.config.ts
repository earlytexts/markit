import { defineConfig } from "vitest/config";
import path from "node:path";

// The Markit library is the sibling package in this repo (published to JSR, not
// npm), so — as in esbuild.mjs — resolve its bare specifier to the TypeScript
// source directly rather than to an installed package.
export default defineConfig({
  resolve: {
    alias: {
      "@earlytexts/markit": path.resolve(
        import.meta.dirname,
        "../src/index.ts",
      ),
    },
  },
  test: {
    coverage: {
      include: ["src/client/lib/**", "src/server/lib/**"],
    },
  },
});
