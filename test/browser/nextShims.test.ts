import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import path from "node:path";
import { openPreview } from "./openPreview.js";

const root = path.resolve("test/fixtures/next-app");
let preview: Awaited<ReturnType<typeof openPreview>>;

beforeAll(async () => {
  preview = await openPreview(root, { file: path.join(root, "components/Nav.tsx"), exportName: "Nav" });
});
afterAll(async () => preview?.close());

describe("Next.js components render as Next renders them, without Next running", () => {
  it("renders without errors and sees process.env like a Next component does", async () => {
    expect(preview.errors).toEqual([]);
    expect(await preview.page.locator("nav").getAttribute("data-env")).toBe("development");
  });

  it("next/link becomes a plain anchor with the resolved href and the same attributes", async () => {
    const pricing = preview.page.locator("a", { hasText: "Pricing" });
    expect(await pricing.getAttribute("href")).toBe("/pricing");
    expect(await pricing.getAttribute("class")).toBe("font-bold");
    expect(await preview.page.locator("a", { hasText: "Docs" }).getAttribute("href")).toBe("/docs?v=2");
  });

  it("next/image renders an <img> with the import's intrinsic size, and fill mode covers its parent", async () => {
    const badge = preview.page.locator('img[alt="Badge"]');
    expect(await badge.getAttribute("width")).toBe("24");
    expect(await badge.getAttribute("height")).toBe("12");
    expect(await badge.evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBe(24);

    const dot = preview.page.locator('img[alt="Dot"]');
    expect(await dot.evaluate((img) => { const r = img.getBoundingClientRect(); return [r.width, r.height]; })).toEqual([48, 24]);
    expect(await preview.style('img[alt="Dot"]', "position")).toBe("absolute");
    expect(await preview.style('img[alt="Dot"]', "object-fit")).toBe("cover");
  });

  it("next/font/google and next/font/local work in any component, not only the root layout", async () => {
    const fonts = await openPreview(root, { file: path.join(root, "components/FontTitle.tsx"), exportName: "FontTitle" });
    try {
      expect(fonts.errors).toEqual([]);
      expect(await fonts.style("h1", "font-family")).toMatch(/^Inter, /);
      expect(await fonts.style("code", "font-family")).toMatch(/^"Roboto Mono", .*monospace/);
      const css = await fonts.page.locator("#cp-next-font-loaders").textContent();
      expect(css).toContain("--font-brand:");
      expect(css).toContain("public/fonts/Brand.woff2?raw");
    } finally { await fonts.close(); }
  });

});

describe("Next.js modules that only work inside Next", () => {
  let renderer: Renderer;
  beforeAll(async () => { renderer = await createRenderer({ root }); });
  afterAll(async () => renderer?.close());
  const at = (f: string) => path.join(root, f);

  it("usePathname and useParams return the route of the page the component lives on", async () => {
    const result = await renderer.render({ file: at("components/ProductPath.tsx"), exportName: "ProductPath" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Viewing /products/1 (product 1)");
  });

  it("next/router (pages router), next/head and next/script render without Next", async () => {
    const result = await renderer.render({ file: at("components/LegacyRouterInfo.tsx"), exportName: "LegacyRouterInfo" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Pages router at /blog/[slug] with slug 1");
  });

  it("next/dynamic loads the component behind its loading state", async () => {
    const result = await renderer.render({ file: at("components/LazyStats.tsx"), exportName: "LazyStats" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Heavy stats loaded");
  });

  it("an async server component using next/headers, next/cache and server-only renders", async () => {
    const result = await renderer.render({ file: at("app/(shop)/account/page.tsx") });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Plan Pro, theme default");
  });
});
