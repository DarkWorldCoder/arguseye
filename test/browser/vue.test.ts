import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
const root = path.resolve("test/fixtures/vue-app");
const file = path.join(root, "src/components/Card.vue");
let renderer: Renderer;
let browser: Browser;
beforeAll(async () => { renderer = await createRenderer({ root }); browser = await chromium.launch({ channel: "chrome" }); });
afterAll(async () => { await browser?.close(); await renderer?.close(); });
describe("Vue using the project's own runtime and SFC compiler", () => {
  it("renders a Vue-only project after package warm-up", async () => {
    const warming = await createRenderer({ root, warmup: true });
    try {
      await warming.ready();
      const result = await warming.render({ file, props: { title: "Warm Vue", price: 12 } });
      expect(result.errors).toEqual([]);
      expect(result.snapshot).toContain('heading "Warm Vue"');
    } finally { await warming.close(); }
  });
  it("renders script-setup TypeScript with scoped styles and global app CSS, without React installed", async () => {
    const result = await renderer.render({ file, props: { title: "Vue Desk", price: 12 } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('heading "Vue Desk"');
    expect(result.snapshot).toContain('button "Add (0)"');
    expect(result.captureId).toBeTruthy();
    const unchanged = await renderer.diff(result.captureId!);
    expect(unchanged.status).toBe("unchanged");
  });
  it("renders ordinary script exports and CSS modules", async () => {
    const result = await renderer.render({ file: path.join(root, "src/components/Notice.vue"), props: { title: "Notice" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Notice");
  });
  it("finds literal Vue template usages, kebab-case tags and unresolved bindings", async () => {
    expect(await renderer.listUsages(file)).toEqual([
      { id: "src/App.vue:6", props: { title: "Desk Lamp", price: 12 }, unresolved: [] },
      { id: "src/App.vue:7", props: { title: "Cable", price: 3 }, unresolved: [] },
      { id: "src/App.vue:8", props: { price: 5 }, unresolved: [':title="name"'] },
    ]);
  });
  it("keeps state on template/style edits and reports script resets", async () => {
    const page = await browser.newPage();
    const original = readFileSync(file, "utf8");
    try {
      await page.goto(renderer.server.url + renderer.server.pageUrl({ file, props: { title: "Lamp", price: 5 } }));
      await page.getByRole("button").click();
      const start = performance.now();
      renderer.server.updateBuffer(file, original.replace("Add (", "Buy ("));
      await page.getByRole("button", { name: "Buy (1)" }).waitFor();
      const ms = performance.now() - start;
      console.log("Vue edit-to-pixels", Math.round(ms), "ms; target 50 ms, enforced limit 100 ms");
      expect(ms).toBeLessThan(100);
      renderer.server.updateBuffer(file, original.replace("Add (", "Buy (").replace("rgb(0, 80, 120)", "rgb(255, 0, 0)"));
      await expect.poll(() => page.locator("h2").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 0, 0)");
      expect(await page.locator("button").innerText()).toBe("Buy (1)");
      renderer.server.updateBuffer(file, original.replace("ref(0)", "ref(7)"));
      await page.getByRole("button", { name: "Add (7)" }).waitFor();
      expect(await page.evaluate(() => (window as any).__CP__.warnings.join())).toContain("reset");
      expect(await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Georgia");
    } finally { renderer.server.updateBuffer(file, undefined); await page.close(); }
  });
});
