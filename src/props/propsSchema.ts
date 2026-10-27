import { readFile } from "node:fs/promises";
import { parseSync } from "oxc-parser";
import { createResolver } from "../server/resolver.js";
import { literal } from "../usages/findUsages.js";

export type PropKind = "string" | "number" | "boolean" | "enum" | "array" | "object" | "function" | "node" | "unknown";

export type PropSchema = {
  name: string;
  kind: PropKind;
  required: boolean;
  description?: string;
  /** For `enum`: the literal values the type allows. */
  options?: unknown[];
  /** Default from the component's destructuring, when it is a literal. */
  default?: unknown;
  /** For `object`: the nested props. */
  fields?: PropSchema[];
};

const NODE_TYPES = new Set(["ReactNode", "ReactElement", "JSX.Element", "React.ReactNode", "React.ReactElement", "Element"]);

type Program = ReturnType<typeof parseSync>["program"];
type Ctx = { file: string; code: string; program: Program; comments: ReturnType<typeof parseSync>["comments"]; depth: number };

/** Reads what props a component accepts from its TypeScript parameter type, without running the TypeScript compiler. */
export async function propsSchema(file: string, exportName = "default"): Promise<PropSchema[]> {
  const ctx = await load(file, 0);
  const fn = componentFunction(ctx.program, exportName);
  const param = fn?.params?.[0] ?? fn?.params?.items?.[0];
  if (!param) return [];
  const defaults = defaultsOf(param);
  const typeNode = param.typeAnnotation?.typeAnnotation ?? param.left?.typeAnnotation?.typeAnnotation;
  if (!typeNode) return [...defaults.keys()].map((name) => ({ name, kind: "unknown" as const, required: false, default: defaults.get(name) }));
  const members = await membersOf(typeNode, ctx);
  return members.map((m) => (defaults.has(m.name) ? { ...m, required: false, default: defaults.get(m.name) } : m));
}

/** Props that let a component render when nothing in the project uses it yet: required ones only, plain values. */
export function sampleProps(schema: PropSchema[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of schema) {
    if (!prop.required || prop.kind === "function") continue;
    out[prop.name] = sample(prop);
  }
  return out;
}

function sample(prop: PropSchema): unknown {
  const label = prop.name.charAt(0).toUpperCase() + prop.name.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2");
  switch (prop.kind) {
    case "string":
    case "node":
      return label;
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return prop.options?.[0];
    case "array":
      return [];
    case "object":
      return sampleProps(prop.fields ?? []);
    default:
      return label;
  }
}

async function load(file: string, depth: number): Promise<Ctx> {
  const code = await readFile(file, "utf8");
  const { program, comments } = parseSync(file, code);
  return { file, code, program, comments, depth };
}

/** The function node behind an export: `export function X`, `export const X = () =>`, `export default …`, `export { X }`. */
function componentFunction(program: Program, exportName: string): any {
  const body = program.body as any[];
  const localFn = (name: string) => {
    for (const node of body) {
      const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
      if (!decl) continue;
      if (decl.type === "FunctionDeclaration" && decl.id?.name === name) return decl;
      if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.id?.name !== name) continue;
          const init = unwrap(d.init);
          if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") return init;
        }
      }
    }
    return undefined;
  };
  for (const node of body) {
    if (exportName === "default" && node.type === "ExportDefaultDeclaration") {
      const decl = unwrap(node.declaration);
      if (decl?.type === "FunctionDeclaration" || decl?.type === "ArrowFunctionExpression" || decl?.type === "FunctionExpression") return decl;
      if (decl?.type === "Identifier") return localFn(decl.name);
    }
    if (node.type === "ExportNamedDeclaration" && !node.declaration) {
      for (const spec of node.specifiers) if (spec.exported.name === exportName) return localFn(spec.local.name);
    }
  }
  return localFn(exportName);
}

/** Strips wrappers like `memo(…)`, `forwardRef(…)` and type assertions to reach the function. */
function unwrap(node: any): any {
  if (!node) return node;
  if (node.type === "CallExpression" && node.arguments[0]) return unwrap(node.arguments[0]);
  if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression" || node.type === "ParenthesizedExpression") return unwrap(node.expression);
  return node;
}

/** Literal defaults from `{ tone = "info", tags = [] }` in the parameter pattern. */
function defaultsOf(param: any): Map<string, unknown> {
  const defaults = new Map<string, unknown>();
  const pattern = param.type === "AssignmentPattern" ? param.left : param;
  if (pattern?.type !== "ObjectPattern") return defaults;
  for (const prop of pattern.properties) {
    if (prop.type !== "Property" || prop.value?.type !== "AssignmentPattern") continue;
    const name = prop.key.name ?? prop.key.value;
    try {
      defaults.set(name, literal(prop.value.right));
    } catch {
      // runtime default: the prop is still optional, just without a known value
      defaults.set(name, undefined);
    }
  }
  return defaults;
}

async function membersOf(typeNode: any, ctx: Ctx): Promise<PropSchema[]> {
  switch (typeNode.type) {
    case "TSTypeLiteral":
      return Promise.all(typeNode.members.filter((m: any) => m.type === "TSPropertySignature").map((m: any) => member(m, ctx)));
    case "TSIntersectionType": {
      const parts = await Promise.all(typeNode.types.map((t: any) => membersOf(t, ctx)));
      return mergeMembers(parts);
    }
    case "TSTypeReference": {
      const resolved = await resolveTypeName(typeName(typeNode.typeName), ctx);
      return resolved ? membersOf(resolved.node, resolved.ctx) : [];
    }
    case "TSParenthesizedType":
      return membersOf(typeNode.typeAnnotation, ctx);
    default:
      return [];
  }
}

/** Later declarations win (interface extends → own members override the base). */
function mergeMembers(parts: PropSchema[][]): PropSchema[] {
  const byName = new Map<string, PropSchema>();
  for (const part of parts) for (const m of part) byName.set(m.name, m);
  return [...byName.values()];
}

async function member(node: any, ctx: Ctx): Promise<PropSchema> {
  const name = node.key.name ?? node.key.value ?? ctx.code.slice(node.key.start, node.key.end);
  const schema: PropSchema = { name, kind: "unknown", required: !node.optional };
  const description = docComment(node, ctx);
  if (description) schema.description = description;
  if (node.typeAnnotation) Object.assign(schema, await kindOf(node.typeAnnotation.typeAnnotation, ctx));
  return schema;
}

async function kindOf(t: any, ctx: Ctx): Promise<Partial<PropSchema>> {
  switch (t.type) {
    case "TSStringKeyword":
    case "TSTemplateLiteralType":
      return { kind: "string" };
    case "TSNumberKeyword":
    case "TSBigIntKeyword":
      return { kind: "number" };
    case "TSBooleanKeyword":
      return { kind: "boolean" };
    case "TSLiteralType":
      return { kind: "enum", options: [literalValue(t.literal)] };
    case "TSArrayType":
      return { kind: "array" };
    case "TSTupleType":
      return { kind: "array" };
    case "TSFunctionType":
      return { kind: "function" };
    case "TSTypeLiteral":
      return { kind: "object", fields: await membersOf(t, ctx) };
    case "TSParenthesizedType":
      return kindOf(t.typeAnnotation, ctx);
    case "TSUnionType": {
      const parts = t.types.filter((u: any) => u.type !== "TSUndefinedKeyword" && u.type !== "TSNullKeyword");
      if (parts.length && parts.every((u: any) => u.type === "TSLiteralType")) {
        return { kind: "enum", options: parts.map((u: any) => literalValue(u.literal)) };
      }
      if (parts.length === 1) return kindOf(parts[0], ctx);
      if (parts.every((u: any) => u.type === "TSBooleanKeyword" || u.type === "TSLiteralType" && typeof literalValue(u.literal) === "boolean")) return { kind: "boolean" };
      return { kind: "unknown" };
    }
    case "TSTypeReference": {
      const name = typeName(t.typeName);
      if (NODE_TYPES.has(name)) return { kind: "node" };
      if (name === "Array" || name === "ReadonlyArray") return { kind: "array" };
      if (name === "Record" || name === "Partial" || name === "Readonly" || name === "Pick" || name === "Omit") {
        return name === "Record" ? { kind: "object" } : kindOf(t.typeArguments?.params?.[0] ?? t, ctx);
      }
      const resolved = await resolveTypeName(name, ctx);
      if (!resolved) return { kind: "unknown" };
      const inner = await kindOf(resolved.node, resolved.ctx);
      return inner.kind === "unknown" && resolved.node.type === "TSInterfaceBody" ? { kind: "object", fields: await membersOf(resolved.node, resolved.ctx) } : inner;
    }
    case "TSInterfaceBody":
      return { kind: "object", fields: await Promise.all(t.body.filter((m: any) => m.type === "TSPropertySignature").map((m: any) => member(m, ctx))) };
    default:
      return { kind: "unknown" };
  }
}

function literalValue(lit: any): unknown {
  if (lit.type === "UnaryExpression") return -lit.argument.value;
  if (lit.type === "TemplateLiteral") return lit.quasis.map((q: any) => q.value.cooked).join("");
  return lit.value;
}

function typeName(n: any): string {
  return n.type === "TSQualifiedName" ? `${typeName(n.left)}.${n.right.name}` : n.name;
}

/**
 * A type referenced by name: a local alias/interface (interfaces become a synthetic TSTypeLiteral including
 * `extends`), or one imported from another project file (followed one level).
 */
async function resolveTypeName(name: string, ctx: Ctx): Promise<{ node: any; ctx: Ctx } | undefined> {
  for (const node of ctx.program.body as any[]) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (decl?.type === "TSTypeAliasDeclaration" && decl.id.name === name) return { node: decl.typeAnnotation, ctx };
    if (decl?.type === "TSInterfaceDeclaration" && decl.id.name === name) {
      const own = { type: "TSTypeLiteral", members: decl.body.body };
      if (!decl.extends?.length) return { node: own, ctx };
      return { node: { type: "TSIntersectionType", types: [...decl.extends.map((e: any) => ({ type: "TSTypeReference", typeName: e.expression })), own] }, ctx };
    }
  }
  if (ctx.depth >= 2) return undefined;
  for (const node of ctx.program.body as any[]) {
    if (node.type !== "ImportDeclaration") continue;
    const spec = node.specifiers.find((s: any) => s.local.name === name);
    if (!spec) continue;
    const imported = spec.type === "ImportSpecifier" ? spec.imported.name ?? spec.imported.value : "default";
    const target = createResolver().resolveFileSync(ctx.file, node.source.value).path;
    if (!target || target.includes("/node_modules/")) return undefined;
    const next = await load(target, ctx.depth + 1);
    return resolveTypeName(imported, next);
  }
  return undefined;
}

/** The `/** … *​/` comment directly above a member, as one line. */
function docComment(node: any, ctx: Ctx): string | undefined {
  const before = ctx.comments.filter((c) => c.type === "Block" && c.end <= node.start && c.value.startsWith("*"));
  const last = before[before.length - 1];
  if (!last || /\S/.test(ctx.code.slice(last.end, node.start))) return undefined;
  return last.value.replace(/^\*+/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean).join(" ") || undefined;
}
