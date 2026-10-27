import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { openPreview } from "./openPreview.js";

const root = path.resolve("test/fixtures/next-app");
let preview: Awaited<ReturnType<typeof openPreview>>;

beforeAll(async () => {
  preview = await openPreview(root, { file: path.join(root, "components/ThemedBadge.tsx"), exportName: "ThemedBadge", props: { label: "Themed" } });
});
afterAll(async () => preview?.close());

describe("components render inside the providers the root layout wraps the app in", () => {
  it("gets the layout's provider values (theme context with the literal props the layout passes)", async () => {
    expect(preview.errors).toEqual([]);
    expect(await preview.style("span", "color")).toBe("rgb(10, 20, 30)");
    expect(await preview.page.locator("span").getAttribute("data-density")).toBe("compact");
  });

  it("sits inside the same host elements the layout puts around pages", async () => {
    expect(await preview.page.locator(".theme-root main#page span").count()).toBe(1);
  });
});
