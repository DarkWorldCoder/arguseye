import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { openPreview } from "./openPreview.js";

const root = path.resolve("test/fixtures/next-app");
let preview: Awaited<ReturnType<typeof openPreview>>;

beforeAll(async () => {
  preview = await openPreview(root, { file: path.join(root, "components/Hero.tsx"), exportName: "Hero", props: { title: "Ship faster", cta: "Start free" } });
});
afterAll(async () => preview?.close());

describe("the component looks exactly as in the app", () => {
  it("renders without errors", () => {
    expect(preview.errors).toEqual([]);
  });

  it("applies the root layout's global CSS and its <html>/<body> classes", async () => {
    expect(await preview.style("body", "font-family")).toBe("Georgia, serif");
    expect(await preview.style("section", "border-top-left-radius")).toBe("18px");
    expect(await preview.page.evaluate(() => document.body.className)).toBe("bg-zinc-50 text-zinc-900 antialiased");
    expect(await preview.page.evaluate(() => document.documentElement.className)).toBe("scroll-smooth");
  });

  it("generates Tailwind v4 utilities used by the component, with the project's theme", async () => {
    // Expected values come from tailwindcss/theme.css (v4.3) and the fixture's @theme block.
    expect(await preview.style("body", "background-color")).toBe("oklch(0.985 0 none)");
    expect(await preview.style("section", "background-color")).toBe("oklch(0.546 0.245 262.881)");
    expect(await preview.style("section", "padding-top")).toBe("32px");
    expect(await preview.style("a", "background-color")).toBe("rgb(255, 87, 34)");
    expect(await preview.style("a", "padding-left")).toBe("13px");
    expect(await preview.style("h1", "letter-spacing")).toBe("3px");
  });

  it("adds Tailwind classes typed in an unsaved edit", async () => {
    const hero = path.join(root, "components/Hero.tsx");
    const source = await import("node:fs").then((fs) => fs.readFileSync(hero, "utf8"));
    try {
      preview.server.updateBuffer(hero, source.replace("bg-blue-600 p-8", "bg-blue-600 p-8 uppercase tracking-[7px]"));
      await expect.poll(() => preview.style("section", "text-transform")).toBe("uppercase");
      expect(await preview.style("section", "letter-spacing")).toBe("7px");
    } finally {
      preview.server.updateBuffer(hero, undefined);
    }
  });

  it("loads assets: url() in CSS, imported images (Next-style objects) and public/ paths", async () => {
    const loaded = (selector: string) =>
      preview.page.locator(selector).evaluate((img: HTMLImageElement) => img.decode().then(() => [img.naturalWidth, img.naturalHeight]));
    expect(await loaded("#badge")).toEqual([24, 12]);
    expect(await loaded("#logo")).toEqual([4, 4]);
    expect(await preview.page.locator("#badge").getAttribute("width")).toBe("24");

    const background = await preview.style("h1", "background-image");
    const url = background.match(/url\("(.+)"\)/)![1];
    const res = await fetch(url);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(await res.text()).toContain('fill="red"');
  });
});
