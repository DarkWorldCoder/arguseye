import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { publicEnv } from "./publicEnv.js";

export interface KitConfig {
  /** True when the project uses SvelteKit (a svelte.config with `kit`, or @sveltejs/kit installed). */
  kit: boolean;
  /** `$lib` and `kit.alias` entries, as absolute paths. */
  aliases: Array<{ find: string; replacement: string }>;
  /** `kit.env.publicPrefix`, default `PUBLIC_`. */
  publicPrefix: string;
}

/** Reads the SvelteKit settings previews need from svelte.config.(js|mjs|ts) statically, without running it. */
export function readKitConfig(root: string): KitConfig {
  const file = ["svelte.config.js", "svelte.config.mjs", "svelte.config.ts"].map((f) => path.join(root, f)).find((f) => existsSync(f));
  let installed = false;
  try { const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")); installed = Boolean(pkg.dependencies?.["@sveltejs/kit"] ?? pkg.devDependencies?.["@sveltejs/kit"]); } catch {}
  const config: KitConfig = { kit: installed, aliases: [], publicPrefix: "PUBLIC_" };
  let lib = "src/lib";
  if (file) {
    try {
      const { program } = parseSync(file, readFileSync(file, "utf8"));
      const kit = findProperty(program, "kit");
      if (kit) config.kit = true;
      const str = (n: any) => (n?.type === "Literal" && typeof n.value === "string" ? n.value : undefined);
      lib = str(prop(prop(kit, "files"), "lib")) ?? lib;
      config.publicPrefix = str(prop(prop(kit, "env"), "publicPrefix")) ?? config.publicPrefix;
      const alias = prop(kit, "alias");
      for (const p of alias?.type === "ObjectExpression" ? alias.properties : []) {
        const key = p.key?.type === "Identifier" ? p.key.name : str(p.key);
        const value = str(p.value);
        if (key && value) config.aliases.push({ find: key, replacement: path.resolve(root, value) });
      }
    } catch {}
  }
  if (config.kit) config.aliases.unshift({ find: "$lib", replacement: path.resolve(root, lib) });
  return config;
}

/** `$env/static/public` and `$env/dynamic/public` from the project's env files; private env is not sent to a page. */
export function kitEnvModule(root: string, specifier: string, publicPrefix: string): string {
  const env = specifier.endsWith("/public") ? publicEnv(root, [publicPrefix]) : {};
  if (specifier.startsWith("$env/dynamic/")) return `export const env = ${JSON.stringify(env)};`;
  return Object.entries(env).filter(([k]) => /^[A-Za-z_$][\w$]*$/.test(k)).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join("\n")
    + (specifier.endsWith("/private") ? `\nconsole.warn(${JSON.stringify(specifier + " is server-only; the preview provides no values.")});` : "");
}

const prop = (obj: any, name: string) => obj?.type === "ObjectExpression" ? obj.properties.find((p: any) => p.type === "Property" && (p.key.name === name || p.key.value === name))?.value : undefined;

/** The first object property named `name` anywhere in the config (the `kit` block, wherever the config object sits). */
function findProperty(node: any, name: string): any {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) { for (const n of node) { const f = findProperty(n, name); if (f) return f; } return undefined; }
  if (node.type === "Property" && (node.key?.name === name || node.key?.value === name) && node.value?.type === "ObjectExpression") return node.value;
  for (const [key, value] of Object.entries(node)) if (key !== "parent" && value && typeof value === "object") { const f = findProperty(value, name); if (f) return f; }
  return undefined;
}
