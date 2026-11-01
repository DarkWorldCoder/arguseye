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
  browser = await chromium.launch({ channel: "chrome", args: ["--disable-frame-rate-limit"] });
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

    let notify!: (time: number) => void;
    const applied = new Promise<number>((resolve) => { notify = resolve; });
    await page.exposeFunction("recordVisibleEdit", () => notify(performance.now()));
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const button = document.querySelector("button");
        if (button?.textContent === "Buy now (3)" && button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
          observer.disconnect(); (window as any).recordVisibleEdit();
        }
      });
      observer.observe(document.getElementById("root")!, { subtree: true, childList: true, characterData: true });
    });
    const edited = onDisk(card).replace("Add to cart", "Buy now");
    const cpuBefore = process.cpuUsage();
    const started = performance.now();
    server.updateBuffer(card, edited);
    const updated = performance.now();
    const cpu = process.cpuUsage(cpuBefore);
    // Locator retries back off by 20/50/100 ms; sample visible DOM on frames instead of timing that backoff.
    await page.waitForFunction(() => {
      const button = document.querySelector("button");
      return button?.textContent === "Buy now (3)" && button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }, undefined, { polling: "raf", timeout: 2000 });
    const frameMs = performance.now() - started;
    const ms = (await applied) - started;
    console.log("React edit-to-visible-DOM", Math.round(ms), "ms; frame observation", Math.round(frameMs), "ms; target 50 ms, enforced DOM limit 100 ms");
    console.log("React update phases", JSON.stringify({ buffer: updated - started, bufferCpuMs: (cpu.user + cpu.system) / 1000 }));

    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThan(100);
    expect(await page.getByRole("button", { name: "Buy now (3)" }).isVisible()).toBe(true);
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

  it("keeps @font-face rules (and their loaded fonts) when an edit regenerates the stylesheet", async () => {
    await openCard();
    const fontFace = '@font-face { font-family: "Edit Font"; src: url(/missing-edit-font.woff2) format("woff2"); font-display: block; }\n';
    const withFont = fontFace + onDisk(cardCss);
    server.updateBuffer(cardCss, withFont);
    await expect.poll(() => page.evaluate(() => [...document.fonts].some((f) => f.family.includes("Edit Font")))).toBe(true);
    await page.evaluate(() => { (window as any).__face = [...document.fonts].find((f) => f.family.includes("Edit Font")); });

    // A class edit regenerates the stylesheet; the font rules are unchanged, so the face must survive (no reload, no text blink).
    server.updateBuffer(cardCss, withFont.replace("rgb(22, 101, 52)", "rgb(0, 0, 255)"));
    await expect.poll(() => page.locator(".card__price").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(0, 0, 255)");
    expect(await page.evaluate(() => [...document.fonts].includes((window as any).__face))).toBe(true);
  });

  it("re-runs importers when a plain (non-component) module changes", async () => {
    await openCard();

    server.updateBuffer(format, onDisk(format).replace("`$${price.toFixed(2)}`", "`USD ${price.toFixed(2)}`"));
    await page.getByText("USD 5.00").waitFor({ timeout: 2000 });
    server.updateBuffer(format, undefined);
  });
});
