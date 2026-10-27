import { chromium, type Browser, type CDPSession, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../server/createPreviewServer.js";
import type { PreviewTarget } from "../server/page.js";
import { findUsages, type Usage } from "../usages/findUsages.js";

export type RenderRequest = PreviewTarget & {
  viewport?: { width: number; height: number };
  /** Render with the props of a real usage, by its id from `listUsages` (e.g. `app/page.tsx:9`). */
  usage?: string;
};

export type RenderResult = {
  /** PNG cropped to the rendered component. */
  png: Buffer;
  /** Accessibility tree of the component, compact enough to read as text. */
  snapshot: string;
  errors: string[];
  ms: number;
  /** The page was reloaded first because this component needed packages bundled after the page loaded. */
  reloaded: boolean;
};

export type Renderer = {
  render(request: RenderRequest): Promise<RenderResult>;
  listUsages(file: string, exportName?: string): Promise<Usage[]>;
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
  const cdp = new WeakMap<Page, CDPSession>();
  /** Bundle generation each warm page was loaded under. */
  const generations = new WeakMap<Page, number>();

  async function warmPage(viewport: { width: number; height: number }, target: PreviewTarget): Promise<Page> {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    await load(page, target);
    cdp.set(page, await page.context().newCDPSession(page));
    return page;
  }

  /** Navigates a page to `target`; the server bundles the packages it needs before responding. */
  async function load(page: Page, target: PreviewTarget) {
    const { generation } = await server.prepare(target.file);
    await page.goto(new URL(server.pageUrl(target, { live: false }), server.url).href);
    await page.waitForFunction(() => (window as any).__CP__?.ready, null, { timeout: 15000 });
    await page.evaluate(() => (window as any).__CP__.ready);
    // Agents get the settled frame: transitions end instantly, animations hold still, no blinking caret.
    await page.addStyleTag({ content: FREEZE_MOTION });
    generations.set(page, generation);
  }

  return {
    server,
    listUsages: (file, exportName) => findUsages(options.root, file, exportName),
    async render({ viewport = { width: 1280, height: 800 }, usage, ...rest }) {
      const started = performance.now();
      const target = { fresh: true, ...rest, props: { ...(await usageProps(options.root, rest, usage)), ...rest.props } };
      const key = `${viewport.width}x${viewport.height}`;
      let warm = pages.get(key);
      const isNew = !warm;
      if (!warm) pages.set(key, (warm = warmPage(viewport, target)));
      const page = await warm;
      const errors = pageErrors.get(page)!;
      errors.length = 0;
      let reloaded = false;
      if (!isNew) {
        const state = server.syncDisk();
        const { generation } = await server.prepare(target.file);
        if (generation !== generations.get(page)) {
          reloaded = true;
          await load(page, target);
        } else {
          await page.evaluate(([t, s]) => (window as any).__CP__.show(t, s), [target, state] as const);
        }
      }

      const { box, inPage } = await page.evaluate(() => {
        const r = document.getElementById("root")!.getBoundingClientRect();
        return {
          box: { x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) },
          inPage: (window as any).__CP__.errors as string[],
        };
      });
      const [png, snapshot] = await Promise.all([capture(cdp.get(page)!, box), page.locator("#root").ariaSnapshot()]);
      return { png, snapshot, errors: unique([...inPage, ...errors]), ms: Math.round(performance.now() - started), reloaded };
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}

async function usageProps(root: string, target: PreviewTarget, usage: string | undefined) {
  if (!usage) return {};
  const found = (await findUsages(root, target.file, target.exportName)).find((u) => u.id === usage);
  if (!found) throw new Error(`No usage "${usage}" of ${target.exportName ?? "default"} from ${target.file}`);
  return found.props;
}

/** Settled frame: transitions end at once, finite animations jump to their final state, spinners stop, no caret. */
const FREEZE_MOTION = `*, *::before, *::after {
  transition-duration: 0s !important; transition-delay: 0s !important;
  animation-duration: 0.001s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  caret-color: transparent !important;
}`;

/** Screenshot through the DevTools protocol directly: no Playwright waiting, encoder tuned for speed. */
async function capture(session: CDPSession, box: { x: number; y: number; width: number; height: number }): Promise<Buffer> {
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...box, scale: 1 },
    optimizeForSpeed: true,
    captureBeyondViewport: true,
  });
  return Buffer.from(data, "base64");
}

async function launchChrome(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

const unique = (xs: string[]) => [...new Set(xs)];
