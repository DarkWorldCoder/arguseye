import { builtinModules } from "node:module";
import { readFileSync, rmSync, cpSync } from "node:fs";
import { rolldown } from "rolldown";

rmSync("dist", { recursive: true, force: true });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
// The checked-in contributions and runtime validation derive from one capability inventory.
const inventory = JSON.parse(readFileSync("src/project/templateEngines.json", "utf8"));
const extensions = [...new Set(["tsx", "jsx", "vue", "svelte", "html", "js", "mjs", "cjs", "tpl", ...Object.values(inventory).flatMap((entry) => entry.suffixes.map((suffix) => suffix.split(".").at(-1)))])];
const when = "isWorkspaceTrusted && resourceScheme == file && !explorerResourceIsFolder && resourceExtname =~ /\\.(" + extensions.join("|") + ")$/";
for (const entries of Object.values(pkg.contributes.menus)) for (const entry of entries) if (entry.command === "componentPreview.open" && entry.when !== when) throw new Error("Preview menu inventory is stale. Run node scripts/updatePreviewMenus.mjs.");
const external = [
  "vscode",
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  ...Object.keys(pkg.dependencies ?? {}),
].map((name) => new RegExp(`^${name.replace(/[/.]/g, "\\$&")}(/|$)`));

const cli = await rolldown({ input: { cli: "src/cli.ts" }, platform: "node", external });
await cli.write({ dir: "dist", format: "esm", entryFileNames: "[name].mjs", banner: "#!/usr/bin/env node" });
await cli.close();

// The dependency bundle worker: a separate process so Rolldown's memory is released after each large build.
const worker = await rolldown({ input: { "bundle-worker": "src/server/bundleWorker.ts", "vite-compatibility-worker": "src/server/viteCompatibilityWorker.ts" }, platform: "node", external });
await worker.write({ dir: "dist", format: "esm", entryFileNames: "[name].mjs" });
await worker.close();

// The extension host loads CommonJS; the ESM-only deps are loaded lazily with import() inside it.
const extension = await rolldown({ input: { extension: "src/extension/extension.ts" }, platform: "node", external });
await extension.write({ dir: "dist", format: "cjs", entryFileNames: "[name].cjs", chunkFileNames: "[name]-[hash].cjs" });
await extension.close();

// Native workers must survive extraction of either npm or VSIX packages.
cpSync("src/server/templateWorkers", "dist/template-workers", { recursive: true });
