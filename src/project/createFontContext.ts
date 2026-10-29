import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { createResolver } from "../server/resolver.js";
import { rewriteCssUrls } from "../server/assets.js";
import { literal } from "../usages/findUsages.js";

/** Reuses the project's built Next font faces when resolving static root font classes, without running Next. */
export function createFontContext(root: string, readSource: (file: string) => string) {
  const resolver = createResolver();
  const modules = new Map<string, { code: string; program: any }>();
  let built: { selector: string; body: string; file: string }[] | undefined;
  const styles = new Set<string>();

  function rules() {
    if (built) return built;
    built = [];
    for (const directory of [".next/static/css", ".next/static/chunks"]) {
      const base = path.join(root, directory);
      if (!existsSync(base)) continue;
      for (const name of readdirSync(base, { recursive: true })) {
        if (typeof name !== "string" || !name.endsWith(".css")) continue;
        const file = path.join(base, name);
        const css = readFileSync(file, "utf8");
        // Next emits flat font-face and CSS-module rules. Ignore application rules entirely.
        for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          const selector = match[1].trim();
          if (selector === "@font-face" || /--[\w-]+\s*:/.test(match[2]) && /^\.[\w-]+$/.test(selector)) {
            built.push({ selector, body: match[2], file });
          }
        }
      }
    }
    return built;
  }

  function font(family: string, variable: string) {
    const declarations = rules();
    const rule = declarations.find(r => r.body.split(";").some(d => {
      const at = d.indexOf(":");
      return d.slice(0, at).trim() === variable && d.slice(at + 1).split(",")[0].trim().replace(/["']/g, "") === family;
    }));
    if (!rule) return undefined;
    styles.add(`${rule.selector}{${rule.body}}`);
    for (const face of declarations) {
      if (face.selector !== "@font-face") continue;
      const name = face.body.match(/font-family\s*:\s*([^;]+)/)?.[1].trim().replace(/["']/g, "");
      if (name === family || name === family + " Fallback") styles.add(rewriteCssUrls(`@font-face{${face.body}}`, face.file));
    }
    return { variable: rule.selector.slice(1) };
  }

  function program(file: string) {
    const code = readSource(file);
    let cached = modules.get(file);
    if (cached?.code !== code) { cached = { code, program: parseSync(file, code).program }; modules.set(file, cached); }
    return cached!.program;
  }

  function evaluate(node: any, file: string, visiting: Set<string>): unknown {
    if (!node) return undefined;
    if (node.type === "JSXExpressionContainer") return evaluate(node.expression, file, visiting);
    if (node.type === "Literal") return node.value;
    if (node.type === "TemplateLiteral") {
      const values = node.expressions.map((n: any) => evaluate(n, file, visiting));
      if (values.some((value: unknown) => typeof value !== "string")) return undefined;
      return node.quasis.map((q: any, i: number) => q.value.cooked + (values[i] ?? "")).join("");
    }
    if (node.type === "MemberExpression" && !node.computed) {
      const value = evaluate(node.object, file, visiting);
      return value && typeof value === "object" ? (value as Record<string, unknown>)[node.property.name] : undefined;
    }
    if (node.type === "Identifier") return binding(node.name, file, visiting);
    if (node.type === "CallExpression" && node.callee.type === "Identifier") {
      const imports = program(file).body.filter((n: any) => n.type === "ImportDeclaration" && n.source.value === "next/font/google");
      const specifier = imports.flatMap((n: any) => n.specifiers).find((n: any) => n.local.name === node.callee.name && n.type === "ImportSpecifier");
      if (!specifier) return undefined;
      try {
        const options = literal(node.arguments[0]) as Record<string, unknown>;
        if (typeof options.variable !== "string") return undefined;
        return font(specifier.imported.name.replaceAll("_", " "), options.variable);
      } catch { return undefined; }
    }
    return undefined;
  }

  function binding(name: string, file: string, visiting: Set<string>): unknown {
    const key = file + ":" + name;
    if (visiting.has(key)) return undefined;
    const next = new Set([...visiting, key]);
    for (const item of program(file).body) {
      const node = item.type === "ExportNamedDeclaration" ? item.declaration : item;
      if (node?.type === "VariableDeclaration") {
        const declaration = node.declarations.find((d: any) => d.id.type === "Identifier" && d.id.name === name);
        if (declaration) return evaluate(declaration.init, file, next);
      }
      if (node?.type !== "ImportDeclaration" || !/^(\.|@\/)/.test(node.source.value)) continue;
      const specifier = node.specifiers.find((s: any) => s.local.name === name && s.type === "ImportSpecifier");
      if (!specifier) continue;
      const resolved = resolver.resolveFileSync(file, node.source.value).path;
      if (resolved) return binding(specifier.imported.name ?? specifier.imported.value, resolved, next);
    }
    return undefined;
  }

  return {
    resolveClass(file: string, node: any): string | undefined {
      try { const value = evaluate(node, file, new Set()); return typeof value === "string" ? value : undefined; }
      catch { return undefined; }
    },
    stylesheet: () => [...styles].join("\n"),
  };
}
