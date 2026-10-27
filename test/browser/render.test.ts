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
    for (const price of Array.from({ length: 20 }, (_, i) => i + 1)) {
      last = await renderer.render({ file: card, exportName: "ProductCard", props: { title: "Lamp", price } });
      timings.push(last.ms);
    }

    expect(last!.snapshot).toContain("$20.00");
    const p95 = [...timings].sort((a, b) => a - b)[Math.ceil(timings.length * 0.95) - 1];
    console.log("warm render p95", p95, "ms; samples", timings.join(","));
    expect(p95).toBeLessThanOrEqual(100);
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
      { id: "app/shop/page.tsx:7", props: { title: "Standing Desk", price: 499 }, unresolved: [] },
    ]);
  });

  it("finds usages that import the component through a barrel (index.ts re-exports, renamed or star)", async () => {
    expect((await renderer.listUsages(card, "ProductCard")).map((u) => u.id)).toEqual(["app/page.tsx:9", "app/page.tsx:10", "app/shop/page.tsx:7"]);
    expect(await renderer.listUsages(path.join(root, "components/Alert.tsx"), "Alert")).toEqual([
      { id: "app/shop/page.tsx:6", props: { title: "Sale ends soon", tone: "danger" }, unresolved: [] },
    ]);
    expect((await renderer.listUsages(path.join(root, "components/Greet.tsx"), "Greet")).map((u) => u.id)).toEqual(["app/shop/page.tsx:8"]);
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

  it("reloads the page (and says so) when a later render pulls in a package the first build did not have", async () => {
    await renderer.render({ file: path.join(root, "components/Alert.tsx"), exportName: "Alert", props: { title: "First" } });

    const result = await renderer.render({ file: path.join(root, "components/Greet.tsx"), exportName: "Greet", props: { name: "Ada" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Hello Ada!");
    expect(result.reloaded).toBe(true);

    const again = await renderer.render({ file: path.join(root, "components/Greet.tsx"), exportName: "Greet", props: { name: "Bo" } });
    expect(again.reloaded).toBe(false);
  });

  it("bundles every package a component needs before the first paint, so a cold render never reloads", async () => {
    const fresh = await createRenderer({ root });
    try {
      const result = await fresh.render({ file: path.join(root, "components/Greet.tsx"), exportName: "Greet", props: { name: "Cy" } });
      expect(result.errors).toEqual([]);
      expect(result.snapshot).toContain("Hello Cy!");
      expect(result.reloaded).toBe(false);
    } finally {
      await fresh.close();
    }
  });
});
