import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { engineForSuffix, TEMPLATE_ENGINES } from "./templateEngines.js";

/** Explicit project context keeps engine selection and native execution reproducible. */
export type TemplateConfig = {
  version: 1;
  limits?: { timeoutMs?: number };
  mappings?: Array<{ pattern: string; engine: string }>;
  roots?: string[];
  static?: Record<string, string>;
  runtimes?: Record<string, string>;
  profiles?: Record<string, Record<string, unknown> | string>;
  options?: Record<string, Record<string, unknown>>;
  setup?: Record<string, string>;
  adapters?: Record<string, { command: string[]; suffixes?: string[] }>;
};
/** Reads declarative engine selection without executing project code or starting an interpreter. */
export function templateConfig(root: string, read: (file: string) => string = (file) => readFileSync(file, "utf8")): TemplateConfig {
  const file = path.join(root, "arguseye.templates.json");
  let source: string;
  try { source = read(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1 }; throw error; }
  let config: any;
  try { config = JSON.parse(source); } catch (error) { throw new Error(`${file}: ${(error as Error).message}`); }
  if (config?.version !== 1) throw new Error(`${file}: expected template configuration version 1`);
  for (const key of ["roots", "mappings"]) if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error(`${file}: ${key} must be an array`);
  if (config.limits?.timeoutMs !== undefined && (!Number.isSafeInteger(config.limits.timeoutMs) || config.limits.timeoutMs < 1 || config.limits.timeoutMs > 20000)) throw new Error(`${file}: timeoutMs must be between 1 and 20000`);
  const object = (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value);
  for (const key of ["static", "runtimes", "profiles", "options", "setup", "adapters"]) if (config[key] !== undefined && !object(config[key])) throw new Error(`${file}: ${key} must be an object`);
  if (config.roots?.length === 0) throw new Error(`${file}: roots must contain at least one directory`);
  if (config.roots?.some((value: unknown) => typeof value !== "string" || !value)) throw new Error(`${file}: roots must contain nonempty paths`);
  if (config.mappings?.some((value: any) => !object(value) || typeof value.pattern !== "string" || typeof value.engine !== "string")) throw new Error(`${file}: mappings require pattern and engine strings`);
  for (const key of ["static", "runtimes", "setup"]) if (Object.values(config[key] ?? {}).some((value) => typeof value !== "string" || !value)) throw new Error(`${file}: ${key} values must be nonempty strings`);
  for (const prefix of Object.keys(config.static ?? {})) if (!prefix.startsWith("/") || !prefix.endsWith("/") || prefix.includes("..")) throw new Error(`${file}: static prefixes must be absolute URL directories ending in /`);
  for (const value of Object.values(config.options ?? {})) if (!object(value)) throw new Error(`${file}: engine options must be objects`);
  for (const [name, adapter] of Object.entries(config.adapters ?? {}) as Array<[string, any]>) {
    if (!object(adapter) || !Array.isArray(adapter.command) || !adapter.command.length || adapter.command.some((v: unknown) => typeof v !== "string" || !v) || (adapter.suffixes && (!Array.isArray(adapter.suffixes) || adapter.suffixes.some((v: unknown) => typeof v !== "string" || !v.startsWith("."))))) throw new Error(`${file}: adapter ${name} needs a command array and optional dot-prefixed suffixes`);
  }
  return config;
}
/** Matches configured template paths without treating template syntax as proof of an engine. */
export function templateEngine(root: string, file: string, config: TemplateConfig, explicit?: string, allowAmbiguous = false, read: (file: string) => string = (file) => readFileSync(file, "utf8")): string | undefined {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const mapped = config.mappings?.find(({ pattern }) => {
    if (typeof pattern !== "string") throw new Error("Template mapping pattern must be a string");
    const expression = pattern.split("**/").map((p) => p.split("*").map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join("(?:.*/)?");
    return new RegExp("^" + expression + "$").test(relative);
  })?.engine;
  const custom = Object.entries(config.adapters ?? {}).find(([, adapter]) => adapter.suffixes?.some((suffix) => file.endsWith(suffix)))?.[0];
  let inferred = engineForSuffix(file);
  if (inferred === "liquidjs") {
    const rubyLock = path.join(root, "Gemfile.lock"), nodeManifest = path.join(root, "package.json");
    const ruby = existsSync(rubyLock) && /^    liquid \(/m.test(read(rubyLock));
    let node = false;
    if (existsSync(nodeManifest)) { const pkg = JSON.parse(read(nodeManifest)); node = !!(pkg.dependencies?.liquidjs || pkg.devDependencies?.liquidjs); }
    if (ruby && !node) inferred = "liquid";
    if (ruby && node && !explicit && !mapped && !custom) {
      if (allowAmbiguous) return undefined;
      throw new Error(`Both Ruby Liquid and LiquidJS are declared for ${file}; choose engine liquid or liquidjs explicitly.`);
    }
  }
  const selected = explicit ?? mapped ?? custom ?? inferred;
  if (selected && !Object.hasOwn(TEMPLATE_ENGINES, selected) && !Object.hasOwn(config.adapters ?? {}, selected)) throw new Error(`Unknown template engine "${selected}" for ${file}. Configure an adapter or choose ${Object.keys(TEMPLATE_ENGINES).join(", ")}.`);
  if (!allowAmbiguous && !selected && file.endsWith(".tpl")) throw new Error(`Template engine is ambiguous for ${file}; select an engine or add an arguseye.templates.json mapping.`);
  return selected;
}
