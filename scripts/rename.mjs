// Renames the project everywhere: npm package, CLI, VS Code extension id, manifests, skill, docs, installer.
// Usage: node scripts/rename.mjs <new-name> [--owner <github-user>]
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const [, , newName, ...rest] = process.argv;
const owner = rest.includes("--owner") ? rest[rest.indexOf("--owner") + 1] : "DarkWorldCoder";
if (!newName || !/^[a-z][a-z0-9-]*$/.test(newName)) { console.error("usage: node scripts/rename.mjs <lowercase-name> [--owner user]"); process.exit(2); }
const oldName = JSON.parse(readFileSync("package.json", "utf8")).name;
const title = (n) => n.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const skip = new Set(["node_modules", ".git", "dist", "dist-test", ".vscode-test", "benchmarks"]);
const files = [];
const walk = (dir) => { for (const e of readdirSync(dir)) { const f = path.join(dir, e); if (skip.has(e)) continue; statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx|mjs|json|md|yml|yaml)$/.test(e) && files.push(f); } };
walk(".");

let changed = 0;
for (const f of files) {
  const before = readFileSync(f, "utf8");
  let after = before
    .replaceAll(`ayushniroula/${oldName}`, `${owner}/${oldName}`)        // repo owner first
    .replaceAll(`${owner}/${oldName}`, `${owner}/${newName}`)
    .replaceAll(oldName, newName)
    .replaceAll(title(oldName), title(newName));
  if (after !== before) { writeFileSync(f, after); changed++; }
}
// the skill folder carries the name
const oldSkill = path.join("skills", oldName), newSkill = path.join("skills", newName);
if (existsSync(oldSkill) && oldSkill !== newSkill) renameSync(oldSkill, newSkill);
console.log(`renamed ${oldName} -> ${newName} in ${changed} files; repo ${owner}/${newName}`);
console.log("next: npm run build && npm test && git commit -am 'Rename to " + newName + "'");
