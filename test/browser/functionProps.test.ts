import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("function props from JSON", () => {
  it('renders a prop given as { "$fn": source } as a real function (callbacks, formatters, loaders)', async () => {
    const result = await renderer.render({
      file: path.join(root, "components/PriceTag.tsx"),
      exportName: "PriceTag",
      props: { amount: 12.5, format: { $fn: "(n) => 'EUR ' + n.toFixed(2)" } },
    });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("EUR 12.50");
  });
});
