import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import { createResolver } from "../server/resolver.js";

/** What the app wraps every component in: global stylesheets and the root `<html>`/`<body>` attributes. */
export type AppContext = {
  /** The root layout / app entry this was read from, if any. */
  entry?: string;
  globalCss: string[];
  htmlClass?: string;
  bodyClass?: string;
};

/** Root layouts and app entries, most specific first (Next app router, pages router, Vite). */
const ENTRIES = [
  "app/layout", "src/app/layout",
  "pages/_app", "src/pages/_app",
  "src/main", "src/index", "src/App",
];
const EXTS = [".tsx", ".jsx", ".ts", ".js"];
const STYLE = /\.(css|scss|sass)$/;

/** Reads the project's root layout statically, so previews get the same global styles as the app. */
export function detectAppContext(root: string): AppContext {
  const entry = ENTRIES.flatMap((e) => EXTS.map((x) => path.join(root, e + x))).find((f) => existsSync(f));
  if (!entry) return { globalCss: [] };

  const code = readFileSync(entry, "utf8");
  const { program, module } = parseSync(entry, code);
  const resolver = createResolver();
  const globalCss = module.staticImports
    .map((imp) => imp.moduleRequest.value)
    .filter((spec) => STYLE.test(spec))
    .flatMap((spec) => resolver.resolveFileSync(entry, spec).path ?? []);

  const context: AppContext = { entry, globalCss };
  new Visitor({
    JSXOpeningElement(node: any) {
      if (node.name.type !== "JSXIdentifier" || (node.name.name !== "html" && node.name.name !== "body")) return;
      const className = node.attributes.find(
        (a: any) => a.type === "JSXAttribute" && a.name.name === "className",
      )?.value;
      const value = literalClass(className);
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
