import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { openPreview } from "./openPreview.js";

const root = path.resolve("test/fixtures/next-app");
let preview: Awaited<ReturnType<typeof openPreview>>;

beforeAll(async () => {
  preview = await openPreview(root, { file: path.join(root, "components/ApiBadge.tsx"), exportName: "ApiBadge" });
});
afterAll(async () => preview?.close());

describe("public env vars from the project's .env files", () => {
  it("exposes NEXT_PUBLIC_* with Next's precedence (.env.local over .env) and keeps everything else out", async () => {
    expect(preview.errors).toEqual([]);
    expect(await preview.page.locator("code").textContent()).toBe("https://api.local.test");
    expect(await preview.page.locator("code").getAttribute("data-secret")).toBe("undefined");
  });
});
