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

  it("finds where a component is used and the real props each usage passes", async () => {
    const usages = await renderer.listUsages(card, "ProductCard");

    expect(usages).toEqual([
      {
        id: "app/page.tsx:9",
        props: { title: "Wireless Headphones", price: 99, tags: ["audio", "bluetooth"], onSale: true },
        unresolved: [],
      },
      { id: "app/page.tsx:10", props: { title: "USB-C Cable", price: 9.5 }, unresolved: [] },
    ]);
  });

  it("renders a component with the props from a real usage", async () => {
    const result = await renderer.render({ file: card, exportName: "ProductCard", usage: "app/page.tsx:9" });

    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('heading "Wireless Headphones"');
    expect(result.snapshot).toContain("$99.00");
    expect(result.snapshot).toContain("bluetooth");
  });

  it("reports the server's real error when a module cannot be served, with the file and the import", async () => {
    const result = await renderer.render({ file: path.join(root, "components/Broken.tsx"), exportName: "Broken" });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Cannot resolve "./does-not-exist"');
    expect(result.errors[0]).toContain("components/Broken.tsx");
    expect(result.errors[0]).not.toContain("Failed to fetch");
  });
});
