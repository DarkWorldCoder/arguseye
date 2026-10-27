import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const file = path.join(root, "components/ProductCard.tsx");
const target = { file, exportName: "ProductCard", props: { title: "Desk", price: 3 } };
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("render evidence and edit verification", () => {
  it("returns reproducible, structured evidence and a capture id", async () => {
    const result = await renderer.render(target);
    expect(result.target).toEqual({ file, exportName: "ProductCard", props: target.props });
    expect(result.viewport).toEqual({ width: 1280, height: 800 });
    expect(result.sourceRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(result.captureId).toBeTruthy();
    expect(result.unresolved).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.warnings).toEqual(expect.any(Array));
  });

  it("compares identical frames without calling them correct", async () => {
    const baseline = await renderer.render(target);
    const result = await renderer.diff(baseline.captureId!);
    expect(result.status).toBe("unchanged");
    expect(result.changedPixels).toBe(0);
    expect(result.changedPercent).toBe(0);
    expect(result.snapshotChanged).toBe(false);
    expect(result.newErrors).toEqual([]);
  });

  it("compares unsaved text, style and size edits using immutable resolved props", async () => {
    const baseline = await renderer.render(target);
    baseline.target.props.title = "MUTATED";
    const source = readFileSync(file, "utf8");
    try {
      renderer.server.updateBuffer(file, source.replace("Add to cart", "Buy now").replace('<article className={clsx("card", onSale && "card--sale")}>', '<article className={clsx("card", onSale && "card--sale")} style={{width: 300, padding: 30}}>'));
      const result = await renderer.diff(baseline.captureId!);
      expect(result.status).toBe("changed");
      expect(result.changedPixels).toBeGreaterThan(0);
      expect(result.changedPercent).toBeGreaterThan(0);
      expect(result.after.snapshot).toContain("Buy now");
      expect(result.after.snapshot).toContain("Desk");
      expect(result.after.sourceRevision).not.toBe(result.before.sourceRevision);
      expect(result.snapshotChanged).toBe(true);
      expect(result.dimensions.after.height).not.toBe(result.dimensions.before.height);
      expect(result.diffPng.subarray(1, 4).toString()).toBe("PNG");
    } finally { renderer.server.updateBuffer(file, undefined); }
  });

  it("reports render failures and recovery as incomplete evidence", async () => {
    const baseline = await renderer.render(target);
    try {
      renderer.server.updateBuffer(file, 'export function ProductCard() { throw new Error("provider unavailable"); }');
      const failed = await renderer.diff(baseline.captureId!);
      expect(failed.status).toBe("incomplete");
      expect(failed.newErrors.join()).toContain("provider unavailable");
      expect(failed.after.captureId).toBeUndefined();
      renderer.server.updateBuffer(file, undefined);
      const recovered = await renderer.diff(baseline.captureId!);
      expect(recovered.after.errors).toEqual([]);
    } finally { renderer.server.updateBuffer(file, undefined); }
  });

  it("serializes simultaneous renders so their props and images cannot cross", async () => {
    const results = await Promise.all(["One", "Two", "Three"].map((title) => renderer.render({ ...target, props: { title, price: 1 } })));
    for (const [i, result] of results.entries()) {
      expect(result.snapshot).toContain(["One", "Two", "Three"][i]);
      expect(result.errors).toEqual([]);
    }
  });

  it("names unknown baseline ids and explains how to recover", async () => {
    await expect(renderer.diff("expired-id")).rejects.toThrow(/expired-id.*render/i);
  });
});

it("evicts the oldest capture after 64 newer successful renders", async () => {
  const oldest = await renderer.render(target);
  let last = oldest;
  for (let i = 0; i < 64; i++) last = await renderer.render(target);
  await expect(renderer.diff(oldest.captureId!)).rejects.toThrow(/expired.*render/i);
  const compared = await renderer.diff(last.captureId!);
  expect(compared.before.captureId).toBe(last.captureId);
  expect(compared.after.errors).toEqual([]);
  expect(compared.after.snapshot).toBe(compared.before.snapshot);
}, 20000);

it("reports unsettled assets and marks their comparisons incomplete", async () => {
  const source = readFileSync(file, "utf8");
  try {
    renderer.server.updateBuffer(file, source.replace("<h2", '<img src="/missing-image.png"/><h2'));
    const result = await renderer.render(target);
    expect(result.warnings.join()).toContain("Assets did not settle");
    expect(result.complete).toBe(false);
    expect((await renderer.diff(result.captureId!)).status).toBe("incomplete");
  } finally { renderer.server.updateBuffer(file, undefined); }
});

it("detects a stylesheet-only edit on the warm headless page", async () => {
  const cssFile = path.join(root, "components/ProductCard.css");
  const baseline = await renderer.render(target);
  try {
    renderer.server.updateBuffer(cssFile, readFileSync(cssFile, "utf8").replace("rgb(22, 101, 52)", "rgb(0, 0, 255)"));
    const diff = await renderer.diff(baseline.captureId!);
    expect(diff.status).toBe("changed");
    expect(diff.changedPixels).toBeGreaterThan(0);
    expect(diff.snapshotChanged).toBe(false);
    expect(diff.after.sourceRevision).not.toBe(diff.before.sourceRevision);
  } finally { renderer.server.updateBuffer(cssFile, undefined); }
});

it("reports resolved errors when a persisted failed render is repaired", async () => {
  try {
    renderer.server.updateBuffer(file, 'export function ProductCard() { throw new Error("missing provider"); }');
    const failed = await renderer.render(target);
    expect(failed.errors.join()).toContain("missing provider");
    const baseline = renderer.restoreCapture(failed);
    renderer.server.updateBuffer(file, undefined);
    const result = await renderer.diff(baseline);
    expect(result.resolvedErrors.join()).toContain("missing provider");
    expect(result.after.errors).toEqual([]);
    expect(result.status).toBe("incomplete");
  } finally { renderer.server.updateBuffer(file, undefined); }
});
