import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
});
