import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const card = path.join(root, "components/ProductCard.tsx");
/** Usages without their call-site context, which other tests cover. */
const stripContext = (usages: Array<{ id: string; props: unknown; unresolved: unknown }>) => usages.map(({ id, props, unresolved }) => ({ id, props, unresolved }));
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("headless render (what an agent gets back)", () => {
  it("rejects outside targets consistently for rendering, prop inspection and usage discovery", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cp-outside-target-"));
    const file = path.join(dir, "Outside.tsx");
    writeFileSync(file, 'export default function Outside({ title }: { title: string }) { return <h1>{title}</h1> }');
    try {
      await expect(renderer.describeProps(file, "default")).rejects.toThrow(file);
      await expect(renderer.listUsages(file, "default")).rejects.toThrow(file);
      await expect(renderer.renderUsages({ file, exportName: "default" })).rejects.toThrow(file);
      await expect(renderer.render({ file })).rejects.toThrow(file);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("bounds imported prop types too and inspects unsaved type edits", async () => {
    const inspector = await createRenderer({ root });
    const outside = mkdtempSync(path.join(os.tmpdir(), "cp-private-types-"));
    const inside = mkdtempSync(path.join(root, ".cp-type-boundary-"));
    const secret = path.join(outside, "Private.ts");
    const file = path.join(inside, "Card.tsx");
    const local = path.join(inside, "Props.ts");
    writeFileSync(secret, 'export type Props = { title: "private-canary-never-return" };');
    writeFileSync(file, `import type { Props } from ${JSON.stringify(secret)}; export default function Card({ title }: Props) { return <h1>{title}</h1> }`);
    try {
      await expect(inspector.describeProps(file)).rejects.toThrow(secret);
      await expect(inspector.render({ file })).rejects.toThrow(secret);
      writeFileSync(local, 'export type Props = { title: string };');
      writeFileSync(file, 'import type { Props } from "./Props"; export default function Card({ title }: Props) { return <h1>{title}</h1> }');
      expect((await inspector.describeProps(file)).props[0].kind).toBe("string");
      inspector.server.updateBuffer(local, 'export type Props = { title: "first" | "second" };');
      expect((await inspector.describeProps(file)).props[0].options).toEqual(["first", "second"]);
    } finally { await inspector.close(); rmSync(inside, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
  });
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
    expect(result.timings).toEqual(expect.objectContaining({ layout: expect.any(Number), screenshot: expect.any(Number), accessibility: expect.any(Number) }));
    for (const phase of [result.timings!.layout, result.timings!.screenshot, result.timings!.accessibility]) expect(phase).toBeGreaterThanOrEqual(0);
  });

  it("picks the component export itself when none is named and the file has no default export", async () => {
    const result = await renderer.render({ file: path.join(root, "components/Alert.tsx"), props: { title: "Saved" } });

    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Saved");
  });

  it("captures exact offset pixels both inside and beyond the viewport", async () => {
    const file = path.join(root, "components/CaptureProbe.tsx");
    const source = readFileSync(file, "utf8");
    const cases = [
      { height: 120, expected: { width: 340, height: 120 }, pixels: 40800 },
      { height: 900, expected: { width: 340, height: 900 }, pixels: 306000 },
      { height: 120, viewport: { width: 4096, height: 2048 }, expected: { width: 340, height: 120 }, pixels: 40800 },
      // x=17.25..357.75 covers 341 device pixels; y=0..120.5 covers 121 rows.
      { height: 120.5, width: 340.5, offset: 17.25, expected: { width: 341, height: 121 }, pixels: 41261 },
    ];
    for (const { height, width, offset, viewport, expected, pixels } of cases) {
      const white = await renderer.render({ file, props: { color: "white", height, width, offset }, viewport });
      expect(white.errors).toEqual([]);
      renderer.server.updateBuffer(file, source.replace("background: color", 'background: "black"'));
      try {
        const changed = await renderer.diff(white.captureId!);
        expect(changed.after.errors).toEqual([]);
        expect(changed.dimensions).toEqual({ before: expected, after: expected });
        expect(changed.changedPixels).toBe(pixels);
        expect(changed.changedPercent).toBe(100);
      } finally { renderer.server.updateBuffer(file, undefined); }
    }
  });

  it("captures pixels without invoking the application's canvas encoder", async () => {
    const result = await renderer.render({ file: path.join(root, "components/CaptureProbe.tsx"), props: { color: "red", height: 120, blockCanvasEncoding: true } });
    expect(result.errors).toEqual([]);
    expect(result.png.readUInt32BE(16)).toBe(340);
    expect(result.png.readUInt32BE(20)).toBe(120);
  });

  it("finishes finite native animations and exposes the freeze of an infinite animation", async () => {
    const file = path.join(root, "components/NativeAnimation.tsx");
    const still = await renderer.render({ file, props: { animated: false } });
    const finished = await renderer.render({ file, props: { animated: true } });
    expect(finished.errors).toEqual([]);
    expect(finished.png.equals(still.png)).toBe(true);
    const looping = await renderer.render({ file, props: { animated: true, loop: true } });
    expect(looping.errors).toEqual([]);
    expect(looping.complete).toBe(false);
    expect(looping.warnings.join()).toContain("Infinite web animation paused");
  });

  it("re-renders a warm component in well under 100 ms with the new props", async () => {
    await renderer.render({ file: card, exportName: "ProductCard", props: { title: "Warm-up", price: 1 } });

    const timings: number[] = [];
    let last;
    for (const price of Array.from({ length: 20 }, (_, i) => i + 1)) {
      last = await renderer.render({ file: card, exportName: "ProductCard", props: { title: "Lamp", price } });
      timings.push(last.ms);
      if (last.ms > 100) console.log("warm render over budget", JSON.stringify(last.timings));
    }

    expect(last!.snapshot).toContain("$20.00");
    const p95 = [...timings].sort((a, b) => a - b)[Math.ceil(timings.length * 0.95) - 1];
    console.log("warm render p95", p95, "ms; samples", timings.join(","));
    expect(p95).toBeLessThanOrEqual(100);
  });

  it("finds where a component is used and the real props each usage passes", async () => {
    const usages = await renderer.listUsages(card, "ProductCard");

    expect(stripContext(usages)).toEqual([
      { id: "app/deals/page.tsx:7", props: { title: "Deal of the day", price: 49, onSale: true }, unresolved: [] },
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
    expect((await renderer.listUsages(card, "ProductCard")).map((u) => u.id)).toEqual(["app/deals/page.tsx:7", "app/page.tsx:9", "app/page.tsx:10", "app/shop/page.tsx:7"]);
    expect(stripContext(await renderer.listUsages(path.join(root, "components/Alert.tsx"), "Alert"))).toEqual([
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
      const warm = await fresh.render({ file: path.join(root, "components/Greet.tsx"), exportName: "Greet", props: { name: "Di" } });
      expect(warm.reloaded).toBe(false);
    } finally {
      await fresh.close();
    }
  });

  it("renders components that use canary React APIs (cache) in an app-router project", async () => {
    const result = await renderer.render({ file: path.join(root, "components/Cached.tsx"), exportName: "Cached" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("cached 7");
  });

  it("gives packages that use Node's Buffer the polyfill Next's client build gives them, from the project's next", async () => {
    const result = await renderer.render({ file: path.join(root, "components/TokenBadge.tsx"), exportName: "TokenBadge" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("imported via next, global via next");
  });
});


it("discovers and renders the same usages through a canonical project-root alias", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cp-root-alias-")), alias = path.join(directory, "project");
  symlinkSync(root, alias, "junction");
  const aliased = await createRenderer({ root: alias });
  try {
    const file = path.join(alias, "components/ProductCard.tsx");
    expect((await aliased.listUsages(file, "ProductCard")).some((u) => u.id === "app/page.tsx:9")).toBe(true);
    const result = await aliased.render({ file, exportName: "ProductCard", usage: "app/page.tsx:9" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Wireless Headphones");
  } finally { await aliased.close(); rmSync(directory, {recursive:true,force:true}); }
});
