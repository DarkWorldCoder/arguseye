import { existsSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

const ENTRIES = ["src/main.ts", "src/main.js", "src/main.mts", "src/main.tsx", "main.ts", "main.js"];

/** The Vue app entry that calls createApp, if the project has one. */
export function vueEntry(root: string): string | undefined {
  return ENTRIES.map((e) => path.join(root, e)).find((f) => existsSync(f));
}

/**
 * The entry rewritten as `export default async function (app) { ... }`: `createApp(App)` becomes the preview's app
 * and `.mount(...)` is dropped, so every plugin, global component, directive and provide the app installs
 * (Pinia, vue-router, vue-i18n, UI libraries) is installed on the preview too, in the app's own order.
 * Undefined when the entry does not create a Vue app.
 */
export function vueSetupModule(entry: string, code: string): string | undefined {
  let program: any;
  try { program = parseSync(entry, code).program; } catch { return undefined; }
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type === "CallExpression") {
      const callee = node.callee;
      const name = callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && !callee.computed ? callee.property.name : undefined;
      if ((name === "createApp" || name === "createSSRApp") && (callee.type === "Identifier" || callee.object?.name === "Vue")) {
        edits.push({ start: node.start, end: node.end, text: "__cpApp" });
        return;
      }
      // x.mount("#app") → x: the preview mounts its own root.
      if (callee.type === "MemberExpression" && !callee.computed && callee.property.name === "mount") {
        edits.push({ start: callee.object.end, end: node.end, text: "" });
      }
    }
    for (const [key, value] of Object.entries(node)) if (key !== "parent" && value && typeof value === "object") visit(value);
  };
  visit(program);
  if (!edits.some((e) => e.text === "__cpApp")) return undefined;
  const text = (start: number, end: number) => {
    let out = "", at = start;
    for (const e of edits.filter((e) => e.start >= start && e.end <= end).sort((a, b) => a.start - b.start)) {
      out += code.slice(at, e.start) + e.text;
      at = e.end;
    }
    return out + code.slice(at, end);
  };
  const imports: string[] = [], body: string[] = [];
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") imports.push(code.slice(node.start, node.end));
    else if ((node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") && node.declaration) body.push(text(node.declaration.start, node.declaration.end));
    else if (node.type !== "ExportNamedDeclaration" && node.type !== "ExportAllDeclaration") body.push(text(node.start, node.end));
  }
  return `${imports.join("\n")}\nexport default async function setup(__cpApp) {\n${body.join("\n")}\n}\n`;
}
