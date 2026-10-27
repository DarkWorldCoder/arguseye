import { chromium, type Browser, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";
import type { PreviewTarget } from "../../src/server/page.js";

/** A preview server plus a real Chrome page showing `target`, for tests that inspect computed styles. */
export async function openPreview(root: string, target: PreviewTarget) {
  const server: PreviewServer = await createPreviewServer({ root });
  const browser: Browser = await chromium.launch({ channel: "chrome" });
  const page: Page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(new URL(server.pageUrl(target), server.url).href);
  await page.waitForFunction(() => (window as any).__CP__?.ready);
  await page.evaluate(() => (window as any).__CP__.ready);
  errors.push(...(await page.evaluate(() => (window as any).__CP__.errors as string[])));
  const style = (selector: string, prop: string) =>
    page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  return {
    server,
    page,
    errors,
    style,
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}
