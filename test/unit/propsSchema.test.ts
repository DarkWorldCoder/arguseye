import { describe, expect, it } from "vitest";
import path from "node:path";
import { propsSchema, sampleProps } from "../../src/props/propsSchema.js";

const root = path.resolve("test/fixtures/react-app");
const alert = path.join(root, "components/Alert.tsx");
const card = path.join(root, "components/ProductCard.tsx");

describe("props inferred from the component's TypeScript type", () => {
  it("lists each prop with its kind, options, default and whether it is required", async () => {
    const schema = await propsSchema(alert, "Alert");

    expect(schema).toEqual([
      { name: "title", kind: "string", required: true, description: "Short heading shown in bold." },
      { name: "tone", kind: "enum", required: false, options: ["info", "success", "danger"], default: "info" },
      { name: "count", kind: "number", required: false },
      { name: "dismissible", kind: "boolean", required: false, default: true },
      { name: "tags", kind: "array", required: false, default: [] },
      { name: "action", kind: "object", required: false, fields: [
        { name: "label", kind: "string", required: true },
        { name: "href", kind: "string", required: true },
      ] },
      { name: "onClose", kind: "function", required: false },
      { name: "children", kind: "node", required: false },
    ]);
  });

  it("follows an exported type alias used as the props type", async () => {
    const schema = await propsSchema(card, "ProductCard");
    expect(schema.map((p) => `${p.name}${p.required ? "" : "?"}:${p.kind}`)).toEqual([
      "title:string", "price:number", "tags?:array", "onSale?:boolean",
    ]);
  });

  it("makes sample props that satisfy the required ones, so a brand-new component renders", async () => {
    const sample = sampleProps(await propsSchema(alert, "Alert"));
    expect(sample).toEqual({ title: "Title" });

    const cardSample = sampleProps(await propsSchema(card, "ProductCard"));
    expect(cardSample).toEqual({ title: "Title", price: 0 });

    // A required function prop gets a revivable stand-in, so `format(amount)` style props render instead of throwing.
    const fnSample = sampleProps([{ name: "format", kind: "function", required: true }]);
    expect(fnSample.format).toEqual({ $fn: expect.stringContaining("=>") });
    expect(new Function("return " + (fnSample.format as any).$fn)()(12)).toBe("12");
  });
});
