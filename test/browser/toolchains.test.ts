import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { openPreview } from "./openPreview.js";

const root = path.resolve("test/fixtures/tw3-app");
let preview: Awaited<ReturnType<typeof openPreview>>;

beforeAll(async () => {
  preview = await openPreview(root, { file: path.join(root, "src/components/Card.tsx"), exportName: "Card", props: { label: "Hi" } });
});
afterAll(async () => preview?.close());

describe("projects styled with Tailwind v3 via PostCSS and Sass", () => {
  it("renders without errors", () => {
    expect(preview.errors).toEqual([]);
  });

  it("runs the project's PostCSS config (Tailwind v3 with its tailwind.config theme)", async () => {
    // Expected values: tailwind.config.js brand #123456; Tailwind v3 p-5 = 1.25rem, rounded-lg = 0.5rem.
    expect(await preview.style("body", "font-family")).toBe("Verdana, sans-serif");
    expect(await preview.style("#root > div", "background-color")).toBe("rgb(18, 52, 86)");
    expect(await preview.style("#root > div", "padding-top")).toBe("20px");
    expect(await preview.style("#root > div", "border-top-left-radius")).toBe("8px");
  });

  it("compiles SCSS modules with the project's sass", async () => {
    expect(await preview.style("#root > div", "margin-top")).toBe("11px");
    expect(await preview.style("span", "word-spacing")).toBe("22px");
  });
});
