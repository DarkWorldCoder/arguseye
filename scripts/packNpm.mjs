import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// npm needs a scoped name; the extension manifest must keep its existing unscoped identity.
const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const stage = mkdtempSync(path.join(os.tmpdir(), "arguseye-npm-"));
const destination = path.join(root, "artifacts");
const run = (args, cwd) => execFileSync(npm, args, { cwd, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
try {
  const [inventory] = JSON.parse(run(["pack", "--dry-run", "--ignore-scripts", "--json"], root));
  for (const { path: relative } of inventory.files) {
    const output = path.join(stage, relative);
    mkdirSync(path.dirname(output), { recursive: true });
    copyFileSync(path.join(root, relative), output);
  }
  const manifest = JSON.parse(readFileSync(path.join(stage, "package.json"), "utf8"));
  manifest.name = "@ayushniroula/arguseye";
  for (const key of ["scripts", "devDependencies", "publisher", "displayName", "activationEvents", "contributes", "galleryBanner", "main"]) delete manifest[key];
  delete manifest.engines.vscode;
  writeFileSync(path.join(stage, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  mkdirSync(destination, { recursive: true });
  const [packed] = JSON.parse(run(["pack", "--ignore-scripts", "--json", "--pack-destination", destination], stage));
  const artifact = path.join(destination, packed.filename);
  console.log(`${manifest.name}@${manifest.version}: ${artifact}`);
  if (process.argv.includes("--publish")) execFileSync(npm, ["publish", artifact, "--access", "public"], { cwd: root, stdio: "inherit" });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
