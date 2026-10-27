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
});
