import { createRequire } from "node:module";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import { createResolver } from "../server/resolver.js";
import { literal, type Usage } from "./findUsages.js";
import { jsxContext, type JsxSpan } from "./jsxContext.js";
import type { Wrapper } from "../project/appContext.js";

type Import = { source: string; name: string; local: string };
type Call = { local: string; offset: number; props: Record<string, unknown>; unresolved: string[]; context?: Wrapper[] };
type Parsed = { code: string; imports: Import[]; exports: Array<{ name: string; local: string; source?: string }>; calls: Call[] };
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vscode-test", "dist-test"]);
const SOURCE = /\.(?:[jt]sx?|vue|svelte)$/;

/** An incremental source index shared across usage queries and renders; only edited modules are parsed again. */
export function createUsageIndex(root: string, options: { readSource?: (file: string) => Promise<string>; version?: (file: string) => number } = {}) {
  const resolver = createResolver();
  const modules = new Map<string, { key: string; parsed: Parsed }>();
  const dirs = new Map<string, { mtime: number; files: string[]; dirs: string[] }>();
  async function files(dir: string): Promise<string[]> {
    const info = await stat(dir);
    let cached = dirs.get(dir);
    if (!cached || cached.mtime !== info.mtimeMs) {
      const entries = await readdir(dir, { withFileTypes: true });
      cached = { mtime: info.mtimeMs, files: entries.filter((e) => e.isFile() && SOURCE.test(e.name)).map((e) => path.join(dir, e.name)), dirs: entries.filter((e) => e.isDirectory() && !SKIP.has(e.name)).map((e) => path.join(dir, e.name)) };
      dirs.set(dir, cached);
    }
    return [...cached.files, ...(await Promise.all(cached.dirs.map(files))).flat()];
  }
  async function refresh() {
    const found = await files(root);
    const alive = new Set(found);
    for (const key of modules.keys()) if (!alive.has(key)) modules.delete(key);
    await Promise.all(found.map(async (file) => {
      const info = await stat(file);
      const key = `${info.mtimeMs}:${info.ctimeMs}:${info.size}:${options.version?.(file) ?? 0}`;
      if (modules.get(file)?.key === key) return;
      const code = await (options.readSource ?? ((f) => readFile(f, "utf8")))(file);
      modules.set(file, { key, parsed: parseModule(file, code, root) });
    }));
  }
  const resolve = (file: string, spec: string) => resolver.resolveFileSync(file, spec).path;
  function pointsTo(file: string, name: string, target: string, exportName: string, seen = new Set<string>()): boolean {
    if (file === target && name === exportName) return true;
    const key = `${file}#${name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const parsed = modules.get(file)?.parsed;
    if (!parsed) return false;
    for (const exp of parsed.exports) {
      if (exp.name !== name && !(exp.name === "*" && name !== "default")) continue;
      if (exp.source) {
        const next = resolve(file, exp.source);
        if (next && pointsTo(next, exp.local === "*" ? name : exp.local, target, exportName, new Set(seen))) return true;
      } else {
        const imp = parsed.imports.find((i) => i.local === exp.local);
        const next = imp && resolve(file, imp.source);
        if (imp && next && pointsTo(next, imp.name, target, exportName, new Set(seen))) return true;
      }
    }
    return false;
  }
  return {
    async list(file: string, exportName = "default"): Promise<Usage[]> {
      await refresh();
      const result: Array<Usage & { file: string; line: number; column: number }> = [];
      for (const [caller, { parsed }] of modules) {
        if (caller === file) continue;
        const locals = new Set(parsed.imports.filter((imp) => {
          const next = resolve(caller, imp.source);
          return next && pointsTo(next, imp.name, file, exportName);
        }).map((imp) => imp.local));
        for (const call of parsed.calls) {
          if (!locals.has(call.local)) continue;
          const prefix = parsed.code.slice(0, call.offset);
          const line = prefix.split("\n").length;
          const column = call.offset - prefix.lastIndexOf("\n");
          result.push({ id: `${path.relative(root, caller)}:${line}`, file: caller, line, column, props: call.props, unresolved: call.unresolved, context: call.context });
        }
      }
      const counts = new Map<string, number>();
      for (const r of result) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
      return result.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column).map(({ id, column, props, unresolved, context }) => ({ id: counts.get(id)! > 1 ? `${id}:${column}` : id, props, unresolved, context }));
    },
  };
}

function parseModule(file: string, code: string, root: string): Parsed {
  if (file.endsWith(".vue")) return parseVue(file, code, root);
  if (file.endsWith(".svelte")) return parseSvelte(file, code, root);
  const result: Parsed = { code, imports: [], exports: [], calls: [] };
  const { program } = parseSync(file, code);
  for (const node of program.body as any[]) {
    if (node.type === "ImportDeclaration" && node.importKind !== "type") {
      for (const spec of node.specifiers) {
        if (spec.importKind === "type") continue;
        result.imports.push({ source: node.source.value, local: spec.local.name, name: spec.type === "ImportDefaultSpecifier" ? "default" : spec.imported?.name ?? spec.imported?.value ?? "*" });
      }
    }
    if (node.type === "ExportAllDeclaration") result.exports.push({ name: "*", local: "*", source: node.source.value });
    if (node.type === "ExportNamedDeclaration" && node.exportKind !== "type") {
      for (const spec of node.specifiers) result.exports.push({ name: spec.exported.name ?? spec.exported.value, local: spec.local.name ?? spec.local.value, source: node.source?.value });
    }
  }
  const elements: JsxSpan[] = [];
  new Visitor({ JSXElement(node: any) {
    elements.push({ node, start: node.start, end: node.end });
    const opening = node.openingElement;
    if (opening.name.type !== "JSXIdentifier") return;
    const props: Record<string, unknown> = {}, unresolved: string[] = [];
    for (const attr of opening.attributes) {
      if (attr.type === "JSXSpreadAttribute") { for (const key of Object.keys(props)) delete props[key]; unresolved.push(code.slice(attr.start, attr.end)); continue; }
      const name = attr.name.name;
      try { props[name] = attr.value === null ? true : literal(attr.value.type === "JSXExpressionContainer" ? attr.value.expression : attr.value); }
      catch { delete props[name]; unresolved.push(code.slice(attr.start, attr.end)); }
    }
    const children = node.children.filter((c: any) => c.type !== "JSXText" || c.value.trim());
    if (children.length === 1 && children[0].type === "JSXText") props.children = children[0].value.trim();
    else if (children.length) unresolved.push("children=" + code.slice(children[0].start, children.at(-1).end));
    result.calls.push({ local: opening.name.name, offset: opening.start, props, unresolved });
  } }).visit(program);
  for (const call of result.calls) call.context = jsxContext(call.offset, elements, result.imports, code);
  return result;
}

/**
 * A .svelte file: imports from its instance <script>, usages from component tags in the markup. Literal attribute
 * values become props (text, or a `{...}` expression that is a literal); anything else is reported unresolved.
 * Reads the Svelte 5 "modern" AST, or Svelte 4's legacy one.
 */
function parseSvelte(file: string, code: string, root: string): Parsed {
  const compiler = createRequire(path.join(root, "package.json"))("svelte/compiler");
  let ast: any, modern = true;
  try { ast = compiler.parse(code, { filename: file, modern: true }); } catch { ast = compiler.parse(code, { filename: file }); }
  if (!ast.fragment) modern = false;
  const scriptNode = ast.instance;
  const script = scriptNode ? (modern ? code.slice(scriptNode.content.start, scriptNode.content.end) : code.slice(scriptNode.content.start, scriptNode.content.end)) : "";
  const result = parseModule(file + ".ts", script, root);
  result.code = code; result.calls = [];
  const expressionValue = (start: number, end: number) => {
    const expr = parseSync("expression.ts", "(" + code.slice(start, end) + ")").program.body[0] as any;
    return literal(expr.expression);
  };
  function attributeValue(value: any): unknown {
    if (value === true) return true;
    const parts = Array.isArray(value) ? value : [value];
    if (parts.every((p: any) => p.type === "Text")) return parts.map((p: any) => p.data ?? p.raw ?? "").join("");
    if (parts.length === 1 && (parts[0].type === "ExpressionTag" || parts[0].type === "MustacheTag")) return expressionValue(parts[0].expression.start, parts[0].expression.end);
    throw new Error("not literal");
  }
  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    const isComponent = modern ? node.type === "Component" : node.type === "InlineComponent";
    if (isComponent) {
      const imp = result.imports.find((i) => i.local === node.name);
      if (imp) {
        const props: Record<string, unknown> = {}, unresolved: string[] = [];
        for (const attr of node.attributes ?? []) {
          const source = code.slice(attr.start, attr.end);
          if (attr.type !== "Attribute") { unresolved.push(source); continue; }
          try { props[attr.name] = attributeValue(attr.value); } catch { unresolved.push(source); }
        }
        const children = modern ? node.fragment?.nodes ?? [] : node.children ?? [];
        if (children.some((c: any) => c.type !== "Text" || (c.data ?? "").trim())) unresolved.push("children=" + code.slice(node.start, node.end).slice(0, 80));
        result.calls.push({ local: imp.local, offset: node.start, props, unresolved });
      }
    }
    const kids = modern ? [...(node.fragment?.nodes ?? []), ...(node.nodes ?? [])] : node.children ?? [];
    for (const child of kids) walk(child);
    for (const key of ["consequent", "alternate", "body", "fallback", "pending", "then", "catch"]) if (node[key]) walk(node[key]);
  }
  walk(modern ? ast.fragment : ast.html);
  return result;
}

function parseVue(file: string, code: string, root: string): Parsed {
  const compiler = createRequire(path.join(root, "package.json"))("vue/compiler-sfc");
  const { descriptor } = compiler.parse(code, { filename: file });
  const script = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join("\n");
  const result = parseModule(file + ".ts", script, root);
  result.code = code; result.calls = [];
  const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  function walk(node: any) {
    if (node.type === 1) {
      const imp = result.imports.find((i) => kebab(i.local) === kebab(node.tag));
      if (imp) {
        const props: Record<string, unknown> = {}, unresolved: string[] = [];
        for (const attr of node.props) {
          if (attr.type === 6) props[attr.name] = attr.value?.content ?? true;
          else if (attr.name === "bind" && attr.arg?.isStatic && attr.exp) {
            try {
              const expr = parseSync("expression.ts", "(" + attr.exp.content + ")").program.body[0] as any;
              props[attr.arg.content] = literal(expr.expression);
            } catch { unresolved.push(attr.loc.source); }
          } else unresolved.push(attr.loc.source);
        }
        if (node.children?.some((c: any) => c.type !== 2 || c.content.trim())) unresolved.push("slots=" + node.loc.source);
        result.calls.push({ local: imp.local, offset: node.loc.start.offset, props, unresolved });
      }
    }
    for (const child of node.children ?? []) walk(child);
  }
  if (descriptor.template?.ast) walk(descriptor.template.ast);
  return result;
}
