import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";

const root = path.resolve("test/fixtures/react-app");
const card = path.join(root, "components/ProductCard.tsx");
const cardCss = path.join(root, "components/ProductCard.css");
const format = path.join(root, "components/format.ts");
const onDisk = (file: string) => readFileSync(file, "utf8");

let server: PreviewServer;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await createPreviewServer({ root });
  browser = await chromium.launch({ channel: "chrome" });
});
afterEach(() => {
  for (const file of [card, cardCss, format]) server.updateBuffer(file, undefined);
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function openCard() {
  page = await browser.newPage();
  await page.goto(new URL(server.pageUrl({ file: card, exportName: "ProductCard", props: { title: "Lamp", price: 5 } }), server.url).href);
  await page.getByRole("button").waitFor();
}

describe("live updates from unsaved edits", () => {
  it("swaps an edited component in place, keeping its state, within the budget", async () => {
    await openCard();
    for (let i = 0; i < 3; i++) await page.getByRole("button").click();

    const started = performance.now();
    server.updateBuffer(card, onDisk(card).replace("Add to cart", "Buy now"));
    await page.getByRole("button", { name: "Buy now (3)" }).waitFor({ timeout: 2000 });
    const ms = performance.now() - started;
    console.log("React edit-to-pixels", Math.round(ms), "ms; target 50 ms, enforced limit 100 ms");

    expect(ms).toBeLessThan(100);
    server.updateBuffer(card, undefined);
    await page.getByRole("button", { name: "Add to cart (3)" }).waitFor({ timeout: 2000 });
  });

  it("applies an edited stylesheet without re-rendering", async () => {
    await openCard();
    await page.getByRole("button").click();

    server.updateBuffer(cardCss, onDisk(cardCss).replace("rgb(22, 101, 52)", "rgb(0, 0, 255)"));
    await expect.poll(() => page.locator(".card__price").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(0, 0, 255)");
    expect(await page.getByRole("button").textContent()).toBe("Add to cart (1)");
    server.updateBuffer(cardCss, undefined);
  });

  it("re-runs importers when a plain (non-component) module changes", async () => {
    await openCard();

    server.updateBuffer(format, onDisk(format).replace("`$${price.toFixed(2)}`", "`USD ${price.toFixed(2)}`"));
    await page.getByText("USD 5.00").waitFor({ timeout: 2000 });
    server.updateBuffer(format, undefined);
  });
});
