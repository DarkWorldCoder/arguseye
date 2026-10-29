import type { Wrapper } from "../project/appContext.js";
import { createUsageIndex } from "./createUsageIndex.js";

export type Usage = {
  /** `relative/file.tsx:line`, stable enough for an agent to pass back as `usage`. */
  id: string;
  /** Props written as literals at the call site. */
  props: Record<string, unknown>;
  /** Props that depend on runtime values, as written, e.g. `user={user}` or `{...rest}`. */
  unresolved: string[];
  /** The JSX ancestors the call site sits in (outermost first): the box the component is rendered into. */
  context?: Wrapper[];
};

/** Finds literal-prop variants through imports and local re-exports. Renderers keep an index across calls. */
export async function findUsages(root: string, componentFile: string, exportName = "default"): Promise<Usage[]> {
  return createUsageIndex(root).list(componentFile, exportName);
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
