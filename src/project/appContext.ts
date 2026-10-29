import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  /** What the layouts nest around `{children}`, outermost first: providers and host elements. */
  wrappers: Wrapper[];
  /** Context that could not be reconstructed statically; successful pixels must not conceal these gaps. */
  warnings: string[];
  /** Layout and template files applied, root first, relative to the project. */
  layouts: string[];
};

export type Wrapper =
  | { kind: "host"; tag: string; props: Record<string, unknown> }
  | { kind: "component"; source: string; importName: string; member?: string; props: Record<string, unknown>; refs?: Record<string, Ref> };

/** A prop whose value is an identifier imported by the layout (e.g. `theme={theme}`): re-imported by the wrapper. */
export type Ref = { source: string; importName: string; member?: string };

/** Components that only inject global styles; as siblings of `{children}` they still shape every page. */
const GLOBAL_STYLE_SIBLINGS = new Set(["CssBaseline", "ScopedCssBaseline", "GlobalStyles", "Global"]);

/** Root layouts and app entries, most specific first (Next app router, pages router, Vite). */
const ENTRIES = [
  "app/layout", "src/app/layout",
  "pages/_app", "src/pages/_app",
  "src/main", "src/index", "src/App",
];
const EXTS = [".tsx", ".jsx", ".ts", ".js"];
const STYLE = /\.(css|scss|sass)$/;

/** Reads the project's root layout statically, so previews get the same global styles as the app. */
export function detectAppContext(
  root: string,
  readSource: (file: string) => string = (file) => readFileSync(file, "utf8"),
  routeFile?: string,
): AppContext {
  const entry = ENTRIES.flatMap((e) => EXTS.map((x) => path.join(root, e + x))).find((f) => existsSync(f));
  if (!entry) return { globalCss: [], wrappers: [], warnings: [], layouts: [] };

  // Next nests the root layout, then each directory's layout and template, down to the page.
  const files = [entry, ...nestedLayoutFiles(root, entry, routeFile)];
  const resolver = createResolver();
  const warnings: string[] = [];
  const context: AppContext = { entry, globalCss: [], wrappers: [], warnings, layouts: files.map((f) => path.relative(root, f)) };
  for (const file of files) {
    const code = readSource(file);
    const { program, module } = parseSync(file, code);
    context.globalCss.push(
      ...module.staticImports.map((imp) => imp.moduleRequest.value).filter((spec) => STYLE.test(spec)).flatMap((spec) => resolver.resolveFileSync(file, spec).path ?? []),
    );
    context.wrappers.push(...wrapperChain(program, code, warnings));
    if (file === entry) readHtmlBodyClasses(program, context, entry, warnings);
  }
  return context;
}

function readHtmlBodyClasses(program: any, context: AppContext, entry: string, warnings: string[]) {
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
}

/** `layout.*` then `template.*` in each directory from the app dir down to the route file's directory. */
function nestedLayoutFiles(root: string, rootLayout: string, routeFile: string | undefined): string[] {
  const appDir = path.dirname(rootLayout);
  if (!routeFile || !routeFile.startsWith(appDir + path.sep)) return [];
  const files: string[] = [];
  const segments = path.relative(appDir, path.dirname(routeFile)).split(path.sep).filter(Boolean);
  for (let depth = 0; depth <= segments.length; depth++) {
    const dir = path.join(appDir, ...segments.slice(0, depth));
    for (const kind of ["layout", "template"]) {
      const file = EXTS.map((x) => path.join(dir, kind + x)).find((f) => existsSync(f));
      if (file && file !== rootLayout) files.push(file);
    }
  }
  return files;
}

/** The page whose layout chain is the most common in the project: the route a component most likely lives in. */
export function defaultRouteFile(root: string): string | undefined {
  const entry = ENTRIES.flatMap((e) => EXTS.map((x) => path.join(root, e + x))).find((f) => existsSync(f));
  if (!entry) return undefined;
  const byChain = new Map<string, string[]>();
  for (const page of findPages(path.dirname(entry))) {
    const key = nestedLayoutFiles(root, entry, page).join("|");
    byChain.set(key, [...(byChain.get(key) ?? []), page]);
  }
  const best = [...byChain.values()].sort((a, b) => b.length - a.length)[0];
  return best?.sort((a, b) => a.length - b.length)[0];
}

function findPages(dir: string, depth = 0): string[] {
  if (depth > 8) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory() && !name.name.startsWith("_") && name.name !== "api") out.push(...findPages(full, depth + 1));
    else if (/^page\.(tsx|jsx|ts|js)$/.test(name.name)) out.push(full);
  }
  return out;
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
  const elements = chain ?? [];
  for (const [index, el] of elements.entries()) {
    const name = el.openingElement.name;
    const props: Record<string, unknown> = {};
    const refs: Record<string, Ref> = {};
    for (const attr of el.openingElement.attributes) {
      if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") { warnings.push("Runtime provider input omitted: " + code.slice(attr.start, attr.end)); continue; }
      const expr = attr.value?.type === "JSXExpressionContainer" ? attr.value.expression : undefined;
      const ref = expr ? importedRef(expr, imports, code) : undefined;
      if (ref) { refs[attr.name.name] = ref; continue; }
      try {
        props[attr.name.name] = attr.value === null ? true : expr ? literal(expr) : literal(attr.value);
      } catch {
        warnings.push("Runtime provider input omitted: " + code.slice(attr.start, attr.end));
      }
    }
    if (name.type === "JSXIdentifier" && /^[a-z]/.test(name.name)) {
      if (!HOST_SKIP.has(name.name)) wrappers.push({ kind: "host", tag: name.name, props });
    } else {
      const rootName = name.type === "JSXMemberExpression" ? memberRoot(name) : name.type === "JSXIdentifier" ? name.name : undefined;
      const imported = rootName ? imports.get(rootName) : undefined;
      if (!imported) warnings.push("Local layout wrapper could not be imported: " + (rootName ?? "unknown"));
      else {
        const member = name.type === "JSXMemberExpression" ? code.slice(name.start, name.end).split(".").slice(1).join(".") : undefined;
        wrappers.push({ kind: "component", source: imported.source, importName: imported.importName, member, props, ...(Object.keys(refs).length ? { refs } : {}) });
      }
    }
    // Global-style siblings inside this element (e.g. <CssBaseline />) shape the page as much as a wrapper does.
    for (const child of el.children) {
      if (child.type !== "JSXElement" || child === elements[index + 1]) continue;
      const childName = child.openingElement.name;
      if (childName.type !== "JSXIdentifier" || !GLOBAL_STYLE_SIBLINGS.has(childName.name)) continue;
      const imported = imports.get(childName.name);
      if (imported) wrappers.push({ kind: "component", source: imported.source, importName: imported.importName, props: {} });
    }
  }
  return wrappers;
}

/** `theme={theme}` or `theme={themes.light}` where the root identifier is imported: something the wrapper can import too. */
function importedRef(expr: any, imports: Map<string, { source: string; importName: string }>, code: string): Ref | undefined {
  const rootName = expr.type === "Identifier" ? expr.name : expr.type === "MemberExpression" ? memberRootExpr(expr) : undefined;
  const imported = rootName ? imports.get(rootName) : undefined;
  if (!imported) return undefined;
  const member = expr.type === "MemberExpression" ? code.slice(expr.start, expr.end).split(".").slice(1).join(".") : undefined;
  return { source: imported.source, importName: imported.importName, member };
}

function memberRootExpr(n: any): string | undefined {
  return n.type === "MemberExpression" ? memberRootExpr(n.object) : n.type === "Identifier" ? n.name : undefined;
}

function memberRoot(n: any): string | undefined {
  return n.type === "JSXMemberExpression" ? memberRoot(n.object) : n.type === "JSXIdentifier" ? n.name : undefined;
}

/**
 * Source of a module whose default export nests `children` inside `wrappers`. With `markInnermost`, the innermost
 * element gets `data-cp-box`, which the capture uses as the box the component sits in.
 */
export function wrapperModule(wrappers: Wrapper[], { markInnermost = false, css = [] as string[] } = {}): string {
  const imports: string[] = css.map((file) => `import ${JSON.stringify(file)};`);
  const exprs: string[] = [];
  const importOf = (local: string, importName: string, source: string) =>
    importName === "default" ? `import ${local} from ${JSON.stringify(source)};`
    : importName === "*" ? `import * as ${local} from ${JSON.stringify(source)};`
    : `import { ${importName} as ${local} } from ${JSON.stringify(source)};`;
  wrappers.forEach((w, i) => {
    const props = markInnermost && i === wrappers.length - 1 ? { ...w.props, "data-cp-box": "" } : w.props;
    if (w.kind === "host") return exprs.push(`h(${JSON.stringify(w.tag)}, ${JSON.stringify(props)}`);
    const local = `W${i}`;
    imports.push(importOf(local, w.importName, w.source));
    const refEntries = Object.entries(w.refs ?? {}).map(([prop, ref], j) => {
      const refLocal = `R${i}_${j}`;
      imports.push(importOf(refLocal, ref.importName, ref.source));
      return `${JSON.stringify(prop)}: ${refLocal}${ref.member ? "." + ref.member : ""}`;
    });
    const propsCode = refEntries.length ? `{ ...${JSON.stringify(props)}, ${refEntries.join(", ")} }` : JSON.stringify(props);
    exprs.push(`h(${local}${w.member ? "." + w.member : ""}, ${propsCode}`);
  });
  const tree = exprs.length ? exprs.join(", ") + ", children" + ")".repeat(exprs.length) : "children";
  return `import { createElement as h } from "react";
${imports.join("\n")}
export default function AppWrapper({ children }) { return ${tree}; }
`;
}
