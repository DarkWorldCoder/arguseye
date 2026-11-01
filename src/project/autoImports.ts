import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

/** What a file may use without importing it: name → module and export, as auto-import tools declare them. */
export type AutoImports = Map<string, { from: string; name: string }>;

const IMPORT_FILES = ["auto-imports.d.ts", "src/auto-imports.d.ts", "types/auto-imports.d.ts", "src/types/auto-imports.d.ts", ".nuxt/imports.d.ts", ".nuxt/types/imports.d.ts"];
const COMPONENT_FILES = ["components.d.ts", "src/components.d.ts", "types/components.d.ts", "src/types/components.d.ts", ".nuxt/components.d.ts"];

const cache = new Map<string, { mtime: number; value: any }>();
const cached = <T>(file: string, read: () => T): T => {
  const mtime = statSync(file).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.value;
  const value = read();
  cache.set(file, { mtime, value });
  return value;
};

/** A module path from a declaration file: relative paths become absolute (they are relative to the .d.ts). */
const target = (dts: string, from: string) => (from.startsWith(".") ? path.resolve(path.dirname(dts), from) : from);

/**
 * Auto-imports declared by unplugin-auto-import (`const ref: typeof import('vue')['ref']`) or Nuxt
 * (`export { ref, computed } from 'vue'`), read from the declaration file the tool writes into the project.
 */
export function readAutoImports(root: string): AutoImports {
  const map: AutoImports = new Map();
  for (const rel of IMPORT_FILES) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    for (const [local, value] of cached(file, () => parseImportDeclarations(file))) if (!map.has(local)) map.set(local, value);
  }
  return map;
}

function parseImportDeclarations(file: string): Array<[string, { from: string; name: string }]> {
  const text = readFileSync(file, "utf8");
  const out: Array<[string, { from: string; name: string }]> = [];
  for (const m of text.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*:\s*typeof\s+import\(\s*['"]([^'"]+)['"]\s*\)\s*\[\s*['"]([^'"]+)['"]\s*\]/gm)) {
    out.push([m[1], { from: target(file, m[2]), name: m[3] }]);
  }
  for (const m of text.matchAll(/^\s*export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
    if (/^\s*export\s+type\b/.test(m[0])) continue;
    for (const part of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      if (part.startsWith("type ")) continue;
      const [name, local] = part.split(/\s+as\s+/).map((s) => s.trim());
      out.push([local ?? name, { from: target(file, m[2]), name }]);
    }
  }
  return out;
}

/** Components registered by unplugin-vue-components or Nuxt (`HelloCard: typeof import('./HelloCard.vue')['default']`). */
export function readAutoComponents(root: string): Array<{ name: string; from: string; export: string }> {
  const out: Array<{ name: string; from: string; export: string }> = [];
  const seen = new Set<string>();
  for (const rel of COMPONENT_FILES) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    const entries = cached(file, () => [...readFileSync(file, "utf8").matchAll(/^\s*['"]?([A-Z][\w]*)['"]?\s*:\s*typeof\s+import\(\s*['"]([^'"]+)['"]\s*\)\s*\[\s*['"]([^'"]+)['"]\s*\]/gm)]
      .map((m) => ({ name: m[1], from: target(file, m[2]), export: m[3] })));
    for (const e of entries) if (!seen.has(e.name)) { seen.add(e.name); out.push(e); }
  }
  return out;
}

/** The import lines a compiled module needs for auto-imported names it uses but neither imports nor declares. */
export function autoImportLines(file: string, code: string, imports: AutoImports): string[] {
  if (!imports.size) return [];
  let program: any;
  try { program = parseSync(file.replace(/\.[^.]+$/, "") + ".js", code).program; } catch { return []; }
  const declared = new Set<string>(), used = new Set<string>();
  const bind = (n: any) => {
    if (!n) return;
    if (n.type === "Identifier") declared.add(n.name);
    else if (n.type === "ObjectPattern") n.properties.forEach((p: any) => bind(p.type === "RestElement" ? p.argument : p.value));
    else if (n.type === "ArrayPattern") n.elements.forEach(bind);
    else if (n.type === "AssignmentPattern") bind(n.left);
    else if (n.type === "RestElement") bind(n.argument);
  };
  const walk = (n: any, parent: any, key: string) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, parent, key)); return; }
    switch (n.type) {
      case "ImportSpecifier": case "ImportDefaultSpecifier": case "ImportNamespaceSpecifier": declared.add(n.local.name); return;
      case "VariableDeclarator": bind(n.id); break;
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": if (n.id) bind(n.id); n.params?.forEach(bind); break;
      case "ClassDeclaration": if (n.id) bind(n.id); break;
      case "CatchClause": bind(n.param); break;
      case "Identifier": {
        const property = (parent?.type === "MemberExpression" && key === "property" && !parent.computed) || (parent?.type === "Property" && key === "key" && !parent.computed && !parent.shorthand);
        if (!property) used.add(n.name);
        return;
      }
    }
    for (const [k, v] of Object.entries(n)) if (k !== "parent" && v && typeof v === "object") walk(v, n, k);
  };
  walk(program, null, "");
  const lines: string[] = [];
  for (const name of used) {
    const found = imports.get(name);
    if (!found || declared.has(name)) continue;
    lines.push(found.name === "default" ? `import ${name} from ${JSON.stringify(found.from)};` : `import { ${found.name === name ? name : `${found.name} as ${name}`} } from ${JSON.stringify(found.from)};`);
  }
  return lines;
}

/** A module that registers the declared components on a Vue app, each loaded when a preview first uses it. */
export function autoComponentsModule(components: Array<{ name: string; from: string; export: string }>): string {
  if (!components.length) return "export default null;";
  const entries = components.map((c) => `  app.component(${JSON.stringify(c.name)}, defineAsyncComponent(() => import(${JSON.stringify(c.from)}).then((m) => m[${JSON.stringify(c.export)}])));`);
  return `import { defineAsyncComponent } from "vue";\nexport default function register(app) {\n${entries.join("\n")}\n}\n`;
}
