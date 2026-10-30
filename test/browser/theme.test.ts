import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

const root = path.resolve("test/fixtures/next-app");
const probe = path.join(root, "components/ThemeProbe.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("a forced theme in the preview page", () => {
  it("dark adds the class next to the app's own <html> class and sets color-scheme", async () => {
    const preview = await openPreview(root, { file: probe, exportName: "ThemeProbe", theme: "dark" });
    try {
      expect(preview.errors).toEqual([]);
      expect(await preview.page.evaluate(() => document.documentElement.className)).toBe("scroll-smooth dark");
      expect(await preview.page.evaluate(() => document.documentElement.style.colorScheme)).toBe("dark");
      // The fixture's `.dark [data-theme-probe]` rule applies, so the project's class-based dark styles show.
      expect(await preview.style("[data-theme-probe]", "color")).toBe("rgb(1, 2, 3)");
    } finally { await preview.close(); }
  });

  it("switching a shown page to light and back keeps the app's class and toggles only dark", async () => {
    const preview = await openPreview(root, { file: probe, exportName: "ThemeProbe", theme: "dark" });
    try {
      const show = (theme?: "light" | "dark") => preview.page.evaluate((t) => (window as any).__CP__.show(t), { file: probe, exportName: "ThemeProbe", theme });
      await show("light");
      expect(await preview.page.evaluate(() => document.documentElement.className)).toBe("scroll-smooth");
      expect(await preview.style("[data-theme-probe]", "color")).not.toBe("rgb(1, 2, 3)");
      await show("dark");
      expect(await preview.page.evaluate(() => document.documentElement.className)).toBe("scroll-smooth dark");
      await show(undefined); // no forced theme: whatever the page has stays
      expect(await preview.page.evaluate(() => document.documentElement.className)).toBe("scroll-smooth dark");
    } finally { await preview.close(); }
  });

  it("without a theme the page is the app as written", async () => {
    const preview = await openPreview(root, { file: probe, exportName: "ThemeProbe" });
    try {
      expect(await preview.page.evaluate(() => document.documentElement.className)).toBe("scroll-smooth");
      expect(await preview.page.evaluate(() => document.documentElement.style.colorScheme)).toBe("");
    } finally { await preview.close(); }
  });
});

describe("a forced theme in agent renders", () => {
  const request = { file: probe, exportName: "ThemeProbe" };

  it("emulates prefers-color-scheme, so media-query dark styles change the pixels", async () => {
    const light = await renderer.render({ ...request, theme: "light" });
    const dark = await renderer.render({ ...request, theme: "dark" });
    expect(light.errors).toEqual([]);
    expect(dark.errors).toEqual([]);
    expect(dark.target.theme).toBe("dark");
    expect(light.target.theme).toBe("light");
    // Same box, different fill: the fixture's only media-query rule paints the probe's background.
    expect(dark.png.length).toBeGreaterThan(0);
    expect(dark.png.equals(light.png)).toBe(false);
  });

  it("render_diff replays the baseline's theme", async () => {
    const dark = await renderer.render({ ...request, theme: "dark" });
    const diff = await renderer.diff(dark.captureId!);
    expect(diff.after.target.theme).toBe("dark");
    expect(diff.status).toBe("unchanged");
  });

  it("a warm page used for dark renders the app as written on the next plain request", async () => {
    await renderer.render({ ...request, theme: "dark" });
    const plain = await renderer.render(request);
    expect(plain.target.theme).toBeUndefined();
    const light = await renderer.render({ ...request, theme: "light" });
    expect(plain.png.equals(light.png)).toBe(true);
  });
});
