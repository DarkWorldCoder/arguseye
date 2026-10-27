import { chromium, type Browser, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../server/createPreviewServer.js";
import type { PreviewTarget } from "../server/page.js";

export type RenderRequest = PreviewTarget & {
  viewport?: { width: number; height: number };
};

export type RenderResult = {
  /** PNG cropped to the rendered component. */
  png: Buffer;
  /** Accessibility tree of the component, compact enough to read as text. */
  snapshot: string;
  errors: string[];
  ms: number;
};

export type Renderer = {
  render(request: RenderRequest): Promise<RenderResult>;
  server: PreviewServer;
  close(): Promise<void>;
};

/** Renders components headlessly so an agent can see them without running the app or a browser. */
export async function createRenderer(options: { root: string }): Promise<Renderer> {
  const server = await createPreviewServer({ root: options.root });
  const browser = await launchChrome();

  /** One warm page per viewport: later renders swap the target in place instead of reloading. */
  const pages = new Map<string, Promise<Page>>();
  const pageErrors = new WeakMap<Page, string[]>();

  async function warmPage(viewport: { width: number; height: number }, target: PreviewTarget): Promise<Page> {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    await page.goto(new URL(server.pageUrl(target), server.url).href);
    await page.waitForFunction(() => (window as any).__CP__?.ready, null, { timeout: 15000 });
    await page.evaluate(() => (window as any).__CP__.ready);
    return page;
  }

  return {
    server,
    async render({ viewport = { width: 1280, height: 800 }, ...rest }) {
      const started = performance.now();
      const target = { fresh: true, ...rest };
      const key = `${viewport.width}x${viewport.height}`;
      let warm = pages.get(key);
      const isNew = !warm;
      if (!warm) pages.set(key, (warm = warmPage(viewport, target)));
      const page = await warm;
      const errors = pageErrors.get(page)!;
      errors.length = 0;
      if (!isNew) await page.evaluate((t) => (window as any).__CP__.show(t), target);

      const { box, inPage } = await page.evaluate(() => {
        const r = document.getElementById("root")!.getBoundingClientRect();
        return {
          box: { x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) },
          inPage: (window as any).__CP__.errors as string[],
        };
      });
      const png = await page.screenshot({ clip: box, animations: "disabled", caret: "hide" });
      const snapshot = await page.locator("#root").ariaSnapshot();
      return { png, snapshot, errors: unique([...inPage, ...errors]), ms: Math.round(performance.now() - started) };
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}

async function launchChrome(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

const unique = (xs: string[]) => [...new Set(xs)];
