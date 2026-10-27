import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import { createResolver } from "../server/resolver.js";

export type Usage = {
  /** `relative/file.tsx:line`, stable enough for an agent to pass back as `usage`. */
  id: string;
  /** Props written as literals at the call site. */
  props: Record<string, unknown>;
  /** Props that depend on runtime values, as written, e.g. `user={user}` or `{...rest}`. */
  unresolved: string[];
};

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".turbo"]);
const SOURCE = /\.(t|j)sx?$/;

/** Finds every JSX usage of `exportName` from `componentFile` in the project and the props it passes. */
export async function findUsages(root: string, componentFile: string, exportName = "default"): Promise<Usage[]> {
  const resolver = createResolver();
  const hint = exportName === "default" ? path.parse(componentFile).name : exportName;
  const usages: Array<Usage & { file: string; line: number }> = [];

  for (const file of await sourceFiles(root)) {
    if (file === componentFile) continue;
    const code = await readFile(file, "utf8");
    if (!code.includes(hint)) continue;
    const { program, module } = parseSync(file, code);

    const locals = new Set<string>();
    for (const imp of module.staticImports) {
      if (resolver.resolveFileSync(file, imp.moduleRequest.value).path !== componentFile) continue;
      for (const entry of imp.entries) {
        const imported = entry.importName.kind === "Default" ? "default" : entry.importName.name;
        if (imported === exportName) locals.add(entry.localName.value);
      }
    }
    if (!locals.size) continue;

    new Visitor({
      JSXOpeningElement(node: any) {
        if (node.name.type !== "JSXIdentifier" || !locals.has(node.name.name)) return;
        const props: Record<string, unknown> = {};
        const unresolved: string[] = [];
        for (const attr of node.attributes) {
          if (attr.type === "JSXSpreadAttribute") {
            unresolved.push(code.slice(attr.start, attr.end));
            continue;
          }
          const name = attr.name.type === "JSXIdentifier" ? attr.name.name : code.slice(attr.name.start, attr.name.end);
          try {
            props[name] = attrValue(attr.value);
          } catch {
            unresolved.push(code.slice(attr.start, attr.end));
          }
        }
        const line = code.slice(0, node.start).split("\n").length;
        usages.push({ id: `${path.relative(root, file)}:${line}`, file, line, props, unresolved });
      },
    }).visit(program);
  }

  return usages
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    .map(({ id, props, unresolved }) => ({ id, props, unresolved }));
}

export class NotLiteral extends Error {}

function attrValue(value: any): unknown {
  if (value === null) return true;
  if (value.type === "JSXExpressionContainer") return literal(value.expression);
  return literal(value);
}

/** Evaluates literal expressions only; anything that needs runtime values throws NotLiteral. */
export function literal(node: any): unknown {
  switch (node.type) {
    case "Literal":
      return node.value;
    case "TemplateLiteral":
      if (node.expressions.length) throw new NotLiteral();
      return node.quasis.map((q: any) => q.value.cooked).join("");
    case "ArrayExpression":
      return node.elements.map((el: any) => (el === null ? null : literal(el)));
    case "ObjectExpression":
      return Object.fromEntries(
        node.properties.map((p: any) => {
          if (p.type !== "Property" || p.computed) throw new NotLiteral();
          const key = p.key.type === "Identifier" ? p.key.name : String(literal(p.key));
          return [key, literal(p.value)];
        }),
      );
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "Literal") return -node.argument.value;
      throw new NotLiteral();
    case "Identifier":
      if (node.name === "undefined") return undefined;
      throw new NotLiteral();
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "ParenthesizedExpression":
      return literal(node.expression);
    default:
      throw new NotLiteral();
  }
}

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : sourceFiles(full);
      return SOURCE.test(e.name) ? [full] : [];
    }),
  );
  return nested.flat();
}
