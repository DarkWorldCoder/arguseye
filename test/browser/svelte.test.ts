import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

const fixture = path.resolve("test/fixtures/svelte-app");
let root: string;
let renderer: Renderer;
beforeAll(async () => {
  // A copy, so the edit-on-disk test cannot leave the fixture changed.
  root = mkdtempSync(path.join(os.tmpdir(), "cp-svelte-"));
  cpSync(fixture, root, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(fixture, "node_modules"), path.join(root, "node_modules"));
  renderer = await createRenderer({ root });
});
afterAll(async () => { await renderer?.close(); rmSync(root, { recursive: true, force: true }); });

const badge = () => path.join(root, "src/lib/Badge.svelte");

describe("Svelte 5 components", () => {
  it("renders runes ($props, $derived) with the given props", async () => {
    const result = await renderer.render({ file: badge(), props: { label: "New", count: 3, tone: "warn" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("New: 3 (6)");
  });

  it("applies the component's scoped styles and the app's global CSS from main.ts", async () => {
    const preview = await openPreview(root, { file: badge(), props: { label: "Styled", count: 1, tone: "warn" } });
    try {
      expect(preview.errors).toEqual([]);
      expect(await preview.style(".badge", "color")).toBe("rgb(255, 62, 0)");
      expect(await preview.style(".badge", "background-color")).toBe("rgb(254, 243, 199)");
      expect(await preview.style("body", "font-family")).toBe("Georgia, serif");
    } finally { await preview.close(); }
  });

  it("finds call sites in .svelte markup with their literal props, and reports runtime ones", async () => {
    const usages = await renderer.listUsages(badge(), "default");
    expect(usages.map((u) => ({ id: u.id, props: u.props, unresolved: u.unresolved }))).toEqual([
      { id: "src/App.svelte:8", props: { label: "New", count: 3, tone: "warn" }, unresolved: [] },
      { id: "src/App.svelte:9", props: {}, unresolved: ["label={title}"] },
    ]);
    const counter = await renderer.listUsages(path.join(root, "src/lib/Counter.svelte"), "default");
    expect(counter.map((u) => [u.id, u.props])).toEqual([["src/App.svelte:11", { start: 5 }]]);
  });

  it("renders a call site's props and runs actions on $state", async () => {
    const fromUsage = await renderer.render({ file: badge(), usage: "src/App.svelte:8" });
    expect(fromUsage.errors).toEqual([]);
    expect(fromUsage.snapshot).toContain("New: 3 (6)");
    const clicked = await renderer.render({ file: path.join(root, "src/lib/Counter.svelte"), usage: "src/App.svelte:11", actions: [{ click: { role: "button" } }, { click: { role: "button" } }] });
    expect(clicked.errors).toEqual([]);
    expect(clicked.snapshot).toContain("Count: 7");
  });

  it("picks up an edit on disk, and reports a compile error with the file and position", async () => {
    const file = badge();
    const original = readFileSync(file, "utf8");
    writeFileSync(file, original.replace("({doubled})", "x{doubled}"));
    expect((await renderer.render({ file, props: { label: "Edited", count: 2 } })).snapshot).toContain("Edited: 2 x4");
    writeFileSync(file, original.replace("</span>", "</div>"));
    const broken = await renderer.render({ file, props: { label: "Broken" } });
    expect(broken.errors.join("\n")).toMatch(/Badge\.svelte:\d+:\d+/);
    writeFileSync(file, original);
  });
});
