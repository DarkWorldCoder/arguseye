import type { Wrapper } from "../project/appContext.js";
import { literal } from "./findUsages.js";

export type ImportLike = { source: string; name: string; local: string };
export type JsxSpan = { node: any; start: number; end: number };

const HOST_SKIP = new Set(["html", "body", "head"]);

/**
 * The JSX elements a call site sits inside, outermost first, with their literal props: the box a component is
 * rendered into. Elements are matched by span, so no parent pointers are needed.
 */
export function jsxContext(callOffset: number, elements: JsxSpan[], imports: ImportLike[], code: string): Wrapper[] {
  const byLocal = new Map(imports.map((i) => [i.local, i]));
  const ancestors = elements
    .filter((el) => el.start < callOffset && el.end > callOffset && el.node.openingElement?.start !== callOffset)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const wrappers: Wrapper[] = [];
  for (const { node } of ancestors) {
    const name = node.openingElement.name;
    const props: Record<string, unknown> = {};
    for (const attr of node.openingElement.attributes) {
      if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") continue;
      try {
        props[attr.name.name] = attr.value === null ? true : attr.value.type === "JSXExpressionContainer" ? literal(attr.value.expression) : literal(attr.value);
      } catch {
        // depends on runtime values: left out
      }
    }
    if (name.type === "JSXIdentifier" && /^[a-z]/.test(name.name)) {
      if (!HOST_SKIP.has(name.name)) wrappers.push({ kind: "host", tag: name.name, props });
      continue;
    }
    const rootName = name.type === "JSXMemberExpression" ? memberRoot(name) : name.type === "JSXIdentifier" ? name.name : undefined;
    const imported = rootName ? byLocal.get(rootName) : undefined;
    if (!imported) continue; // defined in the usage file itself: cannot be imported from outside
    const member = name.type === "JSXMemberExpression" ? code.slice(name.start, name.end).split(".").slice(1).join(".") : undefined;
    wrappers.push({ kind: "component", source: imported.source, importName: imported.name, member, props });
  }
  return wrappers;
}

function memberRoot(n: any): string | undefined {
  return n.type === "JSXMemberExpression" ? memberRoot(n.object) : n.type === "JSXIdentifier" ? n.name : undefined;
}
