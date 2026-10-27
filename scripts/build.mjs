import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";
import { rolldown } from "rolldown";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = [
  "vscode",
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  ...Object.keys(pkg.dependencies ?? {}),
].map((name) => new RegExp(`^${name.replace(/[/.]/g, "\\$&")}(/|$)`));

const cli = await rolldown({ input: { cli: "src/cli.ts" }, platform: "node", external });
await cli.write({ dir: "dist", format: "esm", entryFileNames: "[name].mjs", banner: "#!/usr/bin/env node" });
await cli.close();

// The extension host loads CommonJS; the ESM-only deps are loaded lazily with import() inside it.
const extension = await rolldown({ input: { extension: "src/extension/extension.ts" }, platform: "node", external });
await extension.write({ dir: "dist", format: "cjs", entryFileNames: "[name].cjs", chunkFileNames: "[name]-[hash].cjs" });
await extension.close();
