import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const card = path.join(root, "components/ProductCard.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("headless render (what an agent gets back)", () => {
  it("renders a component with given props to a PNG and a text snapshot", async () => {
    const result = await renderer.render({
      file: card,
      exportName: "ProductCard",
      props: { title: "Mechanical Keyboard", price: 129, tags: ["usb-c"] },
    });

    expect(result.errors).toEqual([]);
    expect(result.png.subarray(1, 4).toString()).toBe("PNG");
    expect(result.snapshot).toContain('heading "Mechanical Keyboard"');
    expect(result.snapshot).toContain("$129.00");
    expect(result.snapshot).toContain("usb-c");
    expect(result.snapshot).toContain('button "Add to cart (0)"');
  });

  it("re-renders a warm component in well under 100 ms with the new props", async () => {
    await renderer.render({ file: card, exportName: "ProductCard", props: { title: "Warm-up", price: 1 } });

    const timings: number[] = [];
    let last;
    for (const price of [10, 20, 30]) {
      last = await renderer.render({ file: card, exportName: "ProductCard", props: { title: "Lamp", price } });
      timings.push(last.ms);
    }

    expect(last!.snapshot).toContain("$30.00");
    expect(Math.min(...timings)).toBeLessThan(100);
  });
});
