import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface ViteConfig {
  /** The config file these settings were read from, if any. */
  file?: string;
  /** `resolve.alias` entries with a string `find`, in config order. */
  aliases: Array<{ find: string; replacement: string }>;
  /** `define` entries whose value could be read statically, as the JS source Vite would inline. */
  define: Record<string, string>;
  /** `envPrefix`: env variables with these prefixes reach `import.meta.env`. */
  envPrefix: string[];
  /** `css.preprocessorOptions.scss.additionalData` (or `sass`): source Vite prepends to every Sass file. */
  sassAdditionalData?: string;
  /** Settings that need the config to run (computed aliases, defines), so they were left out. */
  warnings: string[];
}

const FILES = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cjs", "vitest.config.ts"];

/**
 * Reads the parts of a Vite config previews need (aliases, define, envPrefix) statically, without running it:
 * the config imports plugins and may have side effects, so only literal values and the usual path helpers
 * (`path.resolve(__dirname, "src")`, `fileURLToPath(new URL("./src", import.meta.url))`) are understood.
 */
export function readViteConfig(root: string): ViteConfig {
  const config: ViteConfig = { aliases: [], define: {}, envPrefix: ["VITE_"], warnings: [] };
  const file = FILES.map((f) => path.join(root, f)).find((f) => existsSync(f));
  if (!file) return config;
  config.file = file;
  let program: any;
  try {
    program = parseSync(file, readFileSync(file, "utf8")).program;
  } catch {
    config.warnings.push(`${path.basename(file)} could not be parsed; its aliases and defines are not applied.`);
    return config;
  }
  const dir = path.dirname(file);
  const object = configObject(program);
  if (!object) return config;
  const prop = (obj: any, name: string) => obj?.type === "ObjectExpression" ? obj.properties.find((p: any) => p.type === "Property" && keyName(p) === name)?.value : undefined;

  const alias = prop(prop(object, "resolve"), "alias");
  const add = (find: string | undefined, value: any) => {
    if (find === undefined) return;
    const replacement = evalPath(value, dir, root);
    if (replacement === undefined) config.warnings.push(`vite.config alias "${find}" is computed at runtime and was not applied.`);
    else config.aliases.push({ find, replacement });
  };
  if (alias?.type === "ObjectExpression") for (const p of alias.properties) if (p.type === "Property") add(keyName(p), p.value);
  if (alias?.type === "ArrayExpression") {
    for (const el of alias.elements) {
      const find = prop(el, "find");
      if (find?.type === "Literal" && typeof find.value === "string") add(find.value, prop(el, "replacement"));
      else if (find) config.warnings.push("vite.config regex aliases are not applied.");
    }
  }

  const define = prop(object, "define");
  if (define?.type === "ObjectExpression") {
    for (const p of define.properties) {
      const key = p.type === "Property" ? keyName(p) : undefined;
      const value = key === undefined ? undefined : literalSource(p.value);
      if (key !== undefined && value !== undefined) config.define[key] = value;
      else if (key !== undefined) config.warnings.push(`vite.config define "${key}" is computed at runtime and was not applied.`);
    }
  }

  const preprocessors = prop(prop(object, "css"), "preprocessorOptions");
  for (const lang of ["scss", "sass"]) {
    const data = prop(prop(preprocessors, lang), "additionalData");
    if (!data) continue;
    const value = staticValue(data);
    if (typeof value === "string") { config.sassAdditionalData = value; break; }
    config.warnings.push(`vite.config css.preprocessorOptions.${lang}.additionalData is computed at runtime and was not applied.`);
  }

  const envPrefix = prop(object, "envPrefix");
  if (envPrefix?.type === "Literal" && typeof envPrefix.value === "string") config.envPrefix = [envPrefix.value];
  if (envPrefix?.type === "ArrayExpression") config.envPrefix = envPrefix.elements.filter((e: any) => e?.type === "Literal" && typeof e.value === "string").map((e: any) => e.value);
  return config;
}

/** Applies the config's aliases the way Vite matches string aliases: the whole specifier, or a `find/` prefix. */
export function applyAlias(aliases: ViteConfig["aliases"], specifier: string): string | undefined {
  for (const { find, replacement } of aliases) {
    if (specifier === find) return replacement;
    if (specifier.startsWith(find.endsWith("/") ? find : find + "/")) return replacement.replace(/\/$/, "") + "/" + specifier.slice(find.length).replace(/^\//, "");
  }
  return undefined;
}

/** The object literal `export default defineConfig({...})`, `export default {...}` or a config function returns. */
function configObject(program: any): any {
  const isModuleExports = (n: any) => n.type === "ExpressionStatement" && n.expression.type === "AssignmentExpression"
    && n.expression.left.type === "MemberExpression" && n.expression.left.object.name === "module" && n.expression.left.property.name === "exports";
  const decl = program.body.find((n: any) => n.type === "ExportDefaultDeclaration")?.declaration ?? program.body.find(isModuleExports)?.expression.right;
  const unwrap = (node: any): any => {
    if (!node) return undefined;
    if (node.type === "ObjectExpression") return node;
    if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression" || node.type === "ParenthesizedExpression") return unwrap(node.expression);
    if (node.type === "CallExpression") return unwrap(node.arguments[0]);
    if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration") {
      if (node.body.type !== "BlockStatement") return unwrap(node.body);
      const ret = [...node.body.body].reverse().find((s: any) => s.type === "ReturnStatement");
      return unwrap(ret?.argument);
    }
    if (node.type === "Identifier") {
      for (const n of program.body) {
        const d = n.type === "VariableDeclaration" ? n : n.declaration?.type === "VariableDeclaration" ? n.declaration : undefined;
        const found = d?.declarations.find((x: any) => x.id.type === "Identifier" && x.id.name === node.name);
        if (found) return unwrap(found.init);
      }
    }
    return undefined;
  };
  return unwrap(decl);
}

function keyName(p: any): string | undefined {
  if (p.computed) return p.key.type === "Literal" && typeof p.key.value === "string" ? p.key.value : undefined;
  return p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? String(p.key.value) : undefined;
}

/** A define value's JS source: literals, and `JSON.stringify(<literal>)` as Vite configs usually write them. */
function literalSource(node: any): string | undefined {
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : JSON.stringify(node.value);
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.name === "JSON" && node.callee.property.name === "stringify") {
    const value = staticValue(node.arguments[0]);
    return value === undefined ? undefined : JSON.stringify(value);
  }
  return undefined;
}

function staticValue(node: any): unknown {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node.type === "ArrayExpression") { const out = node.elements.map(staticValue); return out.includes(undefined) ? undefined : out; }
  if (node.type === "ObjectExpression") {
    const out: Record<string, unknown> = {};
    for (const p of node.properties) { const k = p.type === "Property" ? keyName(p) : undefined; const v = p.type === "Property" ? staticValue(p.value) : undefined; if (k === undefined || v === undefined) return undefined; out[k] = v; }
    return out;
  }
  return undefined;
}

/** A replacement path: string literals and the path/URL helpers configs use around __dirname and import.meta.url. */
function evalPath(node: any, dir: string, root: string): string | undefined {
  const str = (n: any): string | undefined => {
    if (!n) return undefined;
    if (n.type === "Literal" && typeof n.value === "string") return n.value;
    if (n.type === "Identifier" && (n.name === "__dirname" || n.name === "dirname")) return dir;
    if (n.type === "TemplateLiteral") {
      let out = "";
      for (let i = 0; i < n.quasis.length; i++) {
        out += n.quasis[i].value.cooked;
        if (i < n.expressions.length) { const v = str(n.expressions[i]); if (v === undefined) return undefined; out += v; }
      }
      return out;
    }
    if (n.type === "CallExpression") {
      const callee = n.callee.type === "MemberExpression" ? n.callee.property.name : n.callee.name;
      if (callee === "cwd") return root;
      if (callee === "fileURLToPath") return str(n.arguments[0]);
      if (callee === "resolve" || callee === "join") {
        const parts = n.arguments.map(str);
        if (parts.includes(undefined)) return undefined;
        return callee === "resolve" ? path.resolve(dir, ...parts) : path.join(...parts);
      }
      if (callee === "dirname") { const v = str(n.arguments[0]); return v === undefined ? undefined : path.dirname(v); }
    }
    if (n.type === "NewExpression" && n.callee.name === "URL") {
      const rel = str(n.arguments[0]);
      const base = n.arguments[1];
      const isMeta = base?.type === "MemberExpression" && base.object.type === "MetaProperty" && base.property.name === "url";
      return rel !== undefined && isMeta ? path.resolve(dir, rel) : undefined;
    }
    if (n.type === "MemberExpression" && n.property.name === "pathname") return str(n.object);
    if (n.type === "MemberExpression" && n.object.type === "MetaProperty" && (n.property.name === "dirname")) return dir;
    return undefined;
  };
  const value = str(node);
  if (value === undefined) return undefined;
  if (path.isAbsolute(value) && !existsSync(value) && existsSync(path.join(root, value))) return path.join(root, value);
  return path.isAbsolute(value) ? value : value.startsWith(".") ? path.resolve(root, value) : value;
}
