import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import { createResolver } from "../server/resolver.js";
import { literal } from "../usages/findUsages.js";

/** What the app wraps every component in: global stylesheets and the root `<html>`/`<body>` attributes. */
export type AppContext = {
  /** The root layout / app entry this was read from, if any. */
  entry?: string;
  globalCss: string[];
  htmlClass?: string;
  bodyClass?: string;
  /** What the layout nests around `{children}`, outermost first: providers and host elements. */
  wrappers: Wrapper[];
  /** Context that could not be reconstructed statically; successful pixels must not conceal these gaps. */
  warnings: string[];
};

export type Wrapper =
  | { kind: "host"; tag: string; props: Record<string, unknown> }
  | { kind: "component"; source: string; importName: string; member?: string; props: Record<string, unknown> };

/** Root layouts and app entries, most specific first (Next app router, pages router, Vite). */
const ENTRIES = [
  "app/layout", "src/app/layout",
  "pages/_app", "src/pages/_app",
  "src/main", "src/index", "src/App",
];
const EXTS = [".tsx", ".jsx", ".ts", ".js"];
const STYLE = /\.(css|scss|sass)$/;

/** Reads the project's root layout statically, so previews get the same global styles as the app. */
export function detectAppContext(root: string, readSource: (file: string) => string = (file) => readFileSync(file, "utf8")): AppContext {
  const entry = ENTRIES.flatMap((e) => EXTS.map((x) => path.join(root, e + x))).find((f) => existsSync(f));
  if (!entry) return { globalCss: [], wrappers: [], warnings: [] };

  const code = readSource(entry);
  const { program, module } = parseSync(entry, code);
  const resolver = createResolver();
  const globalCss = module.staticImports
    .map((imp) => imp.moduleRequest.value)
    .filter((spec) => STYLE.test(spec))
    .flatMap((spec) => resolver.resolveFileSync(entry, spec).path ?? []);

  const warnings: string[] = [];
  const context: AppContext = { entry, globalCss, wrappers: wrapperChain(program, code, warnings), warnings };
  new Visitor({
    JSXOpeningElement(node: any) {
      if (node.name.type !== "JSXIdentifier" || (node.name.name !== "html" && node.name.name !== "body")) return;
      const className = node.attributes.find(
        (a: any) => a.type === "JSXAttribute" && a.name.name === "className",
      )?.value;
      const value = literalClass(className);
      if (className && value === undefined) warnings.push(`${entry}: runtime ${node.name.name} className could not be reconstructed.`);
      if (value !== undefined) context[node.name.name === "html" ? "htmlClass" : "bodyClass"] = value;
    },
  }).visit(program);
  return context;
}

function literalClass(value: any): string | undefined {
  if (!value) return undefined;
  if (value.type === "Literal" && typeof value.value === "string") return value.value;
  const expr = value.type === "JSXExpressionContainer" ? value.expression : undefined;
  if (expr?.type === "Literal" && typeof expr.value === "string") return expr.value;
  if (expr?.type === "TemplateLiteral" && !expr.expressions.length) return expr.quasis[0].value.cooked;
  return undefined;
}

const HOST_SKIP = new Set(["html", "body", "head"]);

/**
 * The JSX ancestors of `{children}` in the layout's default export. Providers are kept with the literal props
 * the layout passes; props that need runtime values are dropped. Elements defined in the layout file itself
 * cannot be imported, so they are skipped.
 */
function wrapperChain(program: any, code: string, warnings: string[]): Wrapper[] {
  const imports = new Map<string, { source: string; importName: string }>();
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration") continue;
    for (const spec of node.specifiers) {
      const importName = spec.type === "ImportDefaultSpecifier" ? "default" : spec.type === "ImportNamespaceSpecifier" ? "*" : spec.imported.name ?? spec.imported.value;
      imports.set(spec.local.name, { source: node.source.value, importName });
    }
  }

  let chain: any[] | undefined;
  const isChildren = (n: any) =>
    n?.type === "JSXExpressionContainer" &&
    (n.expression.type === "Identifier" && n.expression.name === "children" ||
      n.expression.type === "MemberExpression" && n.expression.property?.name === "children");
  const walk = (node: any, ancestors: any[]): void => {
    if (!node || chain) return;
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      if (node.children.some(isChildren)) {
        chain = node.type === "JSXElement" ? [...ancestors, node] : ancestors;
        return;
      }
      for (const child of node.children) walk(child, node.type === "JSXElement" ? [...ancestors, node] : ancestors);
      return;
    }
    if (node.type === "JSXExpressionContainer") return walk(node.expression, ancestors);
    if (node.type === "ConditionalExpression") { walk(node.consequent, ancestors); walk(node.alternate, ancestors); return; }
    if (node.type === "LogicalExpression") return walk(node.right, ancestors);
    if (node.type === "ParenthesizedExpression") return walk(node.expression, ancestors);
  };
  new Visitor({
    ReturnStatement(node: any) { if (!chain) walk(node.argument, []); },
    ArrowFunctionExpression(node: any) { if (!chain && node.expression) walk(node.body, []); },
  }).visit(program);

  const wrappers: Wrapper[] = [];
  for (const el of chain ?? []) {
    const name = el.openingElement.name;
    const props: Record<string, unknown> = {};
    for (const attr of el.openingElement.attributes) {
      if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") { warnings.push("Runtime provider input omitted: " + code.slice(attr.start, attr.end)); continue; }
      try {
        props[attr.name.name] = attr.value === null ? true : attr.value.type === "JSXExpressionContainer" ? literal(attr.value.expression) : literal(attr.value);
      } catch {
        warnings.push("Runtime provider input omitted: " + code.slice(attr.start, attr.end));
      }
    }
    if (name.type === "JSXIdentifier" && /^[a-z]/.test(name.name)) {
      if (!HOST_SKIP.has(name.name)) wrappers.push({ kind: "host", tag: name.name, props });
      continue;
    }
    const rootName = name.type === "JSXMemberExpression" ? memberRoot(name) : name.type === "JSXIdentifier" ? name.name : undefined;
    const imported = rootName ? imports.get(rootName) : undefined;
    if (!imported) { warnings.push("Local layout wrapper could not be imported: " + (rootName ?? "unknown")); continue; }
    const member = name.type === "JSXMemberExpression" ? code.slice(name.start, name.end).split(".").slice(1).join(".") : undefined;
    wrappers.push({ kind: "component", source: imported.source, importName: imported.importName, member, props });
  }
  return wrappers;
}

function memberRoot(n: any): string | undefined {
  return n.type === "JSXMemberExpression" ? memberRoot(n.object) : n.type === "JSXIdentifier" ? n.name : undefined;
}

/** Source of a module whose default export nests `children` inside the layout's wrappers. */
export function wrapperModule(wrappers: Wrapper[]): string {
  const imports: string[] = [];
  const exprs: string[] = [];
  wrappers.forEach((w, i) => {
    if (w.kind === "host") return exprs.push(`h(${JSON.stringify(w.tag)}, ${JSON.stringify(w.props)}`);
    const local = `W${i}`;
    const source = JSON.stringify(w.source);
    imports.push(
      w.importName === "default" ? `import ${local} from ${source};`
      : w.importName === "*" ? `import * as ${local} from ${source};`
      : `import { ${w.importName} as ${local} } from ${source};`,
    );
    exprs.push(`h(${local}${w.member ? "." + w.member : ""}, ${JSON.stringify(w.props)}`);
  });
  const tree = exprs.length ? exprs.join(", ") + ", children" + ")".repeat(exprs.length) : "children";
  return `import { createElement as h } from "react";
${imports.join("\n")}
export default function AppWrapper({ children }) { return ${tree}; }
`;
}
