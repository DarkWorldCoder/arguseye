import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";

function copyFixture(): string {
  const src = path.resolve("test/fixtures/react-app");
  const dir = mkdtempSync(path.join(os.tmpdir(), "cp-watch-"));
  cpSync(src, dir, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(src, "node_modules"), path.join(dir, "node_modules"));
  return dir;
}

let root: string;
let server: PreviewServer;
let browser: Browser;
beforeAll(async () => {
  root = copyFixture();
  server = await createPreviewServer({ root, watch: true });
  browser = await chromium.launch({ channel: "chrome" });
});
afterAll(async () => { await browser?.close(); await server?.close(); rmSync(root, { recursive: true, force: true }); });

describe("hot reload from disk (no editor involved)", () => {
  it("updates an open preview when a file is saved by anyone, keeping component state", async () => {
    const card = path.join(root, "components/ProductCard.tsx");
    const page = await browser.newPage();
    await page.goto(new URL(server.pageUrl({ file: card, exportName: "ProductCard", props: { title: "Lamp", price: 5 } }), server.url).href);
    await page.getByRole("button").click();
    await page.getByRole("button").click();

    const started = performance.now();
    writeFileSync(card, readFileSync(card, "utf8").replace("Add to cart", "Buy now"));
    await page.getByRole("button", { name: "Buy now (2)" }).waitFor({ timeout: 3000 });
    expect(performance.now() - started).toBeLessThan(1500);

    writeFileSync(path.join(root, "components/ProductCard.css"), readFileSync(path.join(root, "components/ProductCard.css"), "utf8").replace("rgb(22, 101, 52)", "rgb(200, 0, 0)"));
    await expect.poll(() => page.locator(".card__price").evaluate((el) => getComputedStyle(el).color), { timeout: 3000 }).toBe("rgb(200, 0, 0)");
    expect(await page.getByRole("button").textContent()).toBe("Buy now (2)");
  });
});
