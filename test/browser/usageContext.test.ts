import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const card = path.join(root, "components/ProductCard.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

/** Width and height of a PNG from its IHDR chunk. */
const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe("a component inside the box its call site gives it", () => {
  it("lists the call site's ancestors with their literal props", async () => {
    const usage = (await renderer.listUsages(card, "ProductCard")).find((u) => u.id === "app/deals/page.tsx:7")!;
    expect(usage.context).toEqual([
      { kind: "host", tag: "main", props: { style: { background: "rgb(17, 24, 39)", padding: 24 } } },
      { kind: "host", tag: "aside", props: { className: "rail", style: { width: 320, height: 260, display: "flex" } } },
    ]);
  });

  it("renders inside those ancestors, so the parent's size and background apply", async () => {
    const result = await renderer.render({ file: card, exportName: "ProductCard", usage: "app/deals/page.tsx:7", inContext: true });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('heading "Deal of the day"');
    // The capture is the box the component sits in: the 320x260 aside (main's background shows through it).
    expect(pngSize(result.png)).toEqual({ width: 320, height: 260 });
    expect(result.contextApplied).toEqual(["main", "aside"]);
  });

  it("renders inside a frame of a given size and background when asked", async () => {
    const result = await renderer.render({
      file: card, exportName: "ProductCard", props: { title: "Framed", price: 1 },
      frame: { width: 240, height: 180, background: "rgb(0, 32, 82)" },
    });
    expect(result.errors).toEqual([]);
    expect(pngSize(result.png)).toEqual({ width: 240, height: 180 });
  });
});

describe("a diff against an in-context or framed baseline", () => {
  it("re-renders inside the same parent, so an unchanged component reports no change", async () => {
    const baseline = await renderer.render({ file: card, exportName: "ProductCard", usage: "app/deals/page.tsx:7", inContext: true });
    const diff = await renderer.diff(baseline.captureId!);
    expect(pngSize(diff.after.png)).toEqual({ width: 320, height: 260 });
    expect(diff.status).toBe("unchanged");
    expect(diff.after.contextApplied).toEqual(["main", "aside"]);
  });

  it("re-renders inside the same frame", async () => {
    const baseline = await renderer.render({
      file: card, exportName: "ProductCard", props: { title: "Framed", price: 1 },
      frame: { width: 240, height: 180, background: "rgb(0, 32, 82)" },
    });
    const diff = await renderer.diff(baseline.captureId!);
    expect(pngSize(diff.after.png)).toEqual({ width: 240, height: 180 });
    expect(diff.status).toBe("unchanged");
  });
});
