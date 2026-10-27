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

const bundle = await rolldown({ input: { cli: "src/cli.ts" }, platform: "node", external });
await bundle.write({ dir: "dist", format: "esm", entryFileNames: "[name].mjs", banner: "#!/usr/bin/env node" });
await bundle.close();
