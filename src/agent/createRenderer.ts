import { randomUUID } from "node:crypto";
import path from "node:path";
import { compareCaptures, type DiffResult } from "./compareCaptures.js";
import { chromium, type Browser, type CDPSession, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../server/createPreviewServer.js";
import type { PreviewTarget } from "../server/page.js";
import { createUsageIndex } from "../usages/createUsageIndex.js";
import { type Usage } from "../usages/findUsages.js";
import { propsSchema, sampleProps, type PropSchema } from "../props/propsSchema.js";

export type RenderRequest = PreviewTarget & {
  viewport?: { width: number; height: number };
  /** Render with the props of a real usage, by its id from `listUsages` (e.g. `app/page.tsx:9`). */
  usage?: string;
};

export type RenderResult = {
  /** PNG cropped to the rendered component. */
  png: Buffer;
  /** Immutable baseline id, absent when rendering failed. */
  captureId?: string;
  target: { file: string; exportName: string; props: Record<string, unknown> };
  viewport: { width: number; height: number };
  sourceRevision: string;
  unresolved: string[];
  warnings: string[];
  complete: boolean;
  /** Accessibility tree of the component, compact enough to read as text. */
  snapshot: string;
  errors: string[];
  ms: number;
  /** The page was reloaded first because this component needed packages bundled after the page loaded. */
  reloaded: boolean;
  /** Where the props came from: given by the caller, a real usage, or samples made from the TypeScript type. */
  propsSource: "given" | "usage" | "sample" | "none";
};

export type Renderer = {
  render(request: RenderRequest): Promise<RenderResult>;
  /** Renders one bounded page from a single usage-index query. */
  renderUsages(request: RenderRequest & { offset?: number; limit?: number }): Promise<{ results: Array<RenderResult & { usage: string }>; total: number; nextOffset: number | null }>;
  diff(baselineId: string): Promise<DiffResult>;
  /** Imports a persisted CLI capture into this renderer's bounded session cache. */
  restoreCapture(capture: RenderResult): string;
  listUsages(file: string, exportName?: string): Promise<Usage[]>;
  /** What the component accepts, from its TypeScript type, plus sample props that satisfy the required ones. */
  describeProps(file: string, exportName?: string): Promise<{ props: PropSchema[]; sample: Record<string, unknown> }>;
  server: PreviewServer;
  close(): Promise<void>;
};

/** Renders components headlessly so an agent can see them without running the app or a browser. */
export async function createRenderer(options: { root: string; server?: PreviewServer }): Promise<Renderer> {
  const server = options.server ?? await createPreviewServer({ root: options.root });
  const usages = createUsageIndex(options.root, { readSource: server.readSource, version: server.version });
  let browser: Browser;
  try { browser = await launchChrome(); } catch (error) { if (!options.server) await server.close(); throw error; }
  const captures = new Map<string, RenderResult>();
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work); queue = result.catch(() => {}); return result;
  };
  function remember(result: RenderResult): string {
    const id = randomUUID();
    captures.set(id, { ...structuredClone(result), png: Buffer.from(result.png), captureId: id });
    if (captures.size > 64) captures.delete(captures.keys().next().value!);
    return id;
  }

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

  async function describeProps(file: string, exportName?: string) {
    const props = await propsSchema(file, exportName);
    return { props, sample: sampleProps(props) };
  }

  /** Given props win; else a named usage's props; else, with nothing to go on, samples from the type. */
  async function resolveProps(target: PreviewTarget, usage: string | undefined, resolved?: Usage): Promise<{ props: Record<string, unknown>; propsSource: RenderResult["propsSource"]; unresolved: string[] }> {
    if (usage) {
      const found = resolved ?? (await usages.list(target.file, target.exportName)).find((u) => u.id === usage);
      if (!found) throw new Error(`No usage "${usage}" of ${target.exportName ?? "default"} from ${target.file}`);
      return { props: { ...found.props, ...target.props }, propsSource: "usage", unresolved: found.unresolved };
    }
    if (target.props && Object.keys(target.props).length) return { props: target.props, propsSource: "given", unresolved: [] };
    const sample = sampleProps(await propsSchema(target.file, target.exportName).catch(() => []));
    return Object.keys(sample).length ? { props: sample, propsSource: "sample", unresolved: [] } : { props: {}, propsSource: "none", unresolved: [] };
  }

/** Settled frame: transitions end at once, finite animations jump to their final state, spinners stop, no caret. */

  return {
    server,
    listUsages: (file, exportName) => usages.list(file, exportName),
    describeProps,
    render: (request) => serial(() => render(request)),
    renderUsages: (request) => serial(async () => {
      const { offset = 0, limit = 12, ...target } = request;
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error("Usage page requires offset >= 0 and limit between 1 and 12");
      const all = await usages.list(path.resolve(options.root, target.file), target.exportName);
      const results: Array<RenderResult & { usage: string }> = [];
      for (const usage of all.slice(offset, offset + limit)) results.push({ ...await render({ ...target, usage: usage.id }, usage), usage: usage.id });
      return { results, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : null };
    }),
    restoreCapture: remember,
    diff: (baselineId) => serial(async () => {
      const before = captures.get(baselineId);
      if (!before) throw new Error(`Unknown or expired baseline "${baselineId}"; render the component again to capture a new baseline.`);
      const after = await render({ ...structuredClone(before.target), viewport: before.viewport });
      after.unresolved = [...before.unresolved];
      after.warnings = unique([...before.warnings, ...after.warnings]);
      after.complete &&= before.complete;
      const page = await pages.get(`${before.target.file.endsWith(".vue") ? "vue" : "react"}:${before.viewport.width}x${before.viewport.height}`)!;
      return compareCaptures(page, { ...structuredClone(before), png: Buffer.from(before.png) }, after);
    }),
    async close() {
      await queue;
      captures.clear();
      await browser.close();
      if (!options.server) await server.close();
    },
  };

  async function render({ viewport = { width: 1280, height: 800 }, usage, ...rest }: RenderRequest, resolved?: Usage): Promise<RenderResult> {
      const started = performance.now();
      if (![viewport.width, viewport.height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192)) throw new Error(`Invalid viewport "${viewport.width}x${viewport.height}"`);
      rest.file = path.resolve(options.root, rest.file);
      const { props, propsSource, unresolved } = await resolveProps(rest, usage, resolved);
      const target = { fresh: true, ...rest, props };
      const key = `${rest.file.endsWith(".vue") ? "vue" : "react"}:${viewport.width}x${viewport.height}`;
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

      const warnings: string[] = server.warnings();
      if (unresolved.length) warnings.push("Runtime usage inputs were not evaluated: " + unresolved.join(", "));
      if (propsSource === "sample") warnings.push("Sample props were generated from types; these are not real application data.");

      const settled = await page.evaluate(async () => {
        const pending = [...document.images].filter((img) => !img.complete);
        if (pending.length || document.fonts.status !== "loaded") {
          await Promise.race([
            Promise.allSettled([document.fonts.ready, ...pending.map((img) => img.decode())]),
            new Promise((r) => setTimeout(r, 300)),
          ]);
        }
        return [...document.images].filter((img) => !img.complete || !img.naturalWidth).map((img) => img.getAttribute("src") ?? "unknown image").concat(document.fonts.status === "loaded" ? [] : ["fonts"]);
      });
      if (settled.length) warnings.push("Assets did not settle: " + settled.join(", "));
      const { box, inPage, runtimeWarnings } = await page.evaluate(() => {
        const r = document.getElementById("root")!.getBoundingClientRect();
        return {
          box: { x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) },
          inPage: (window as any).__CP__.errors as string[],
          runtimeWarnings: ((window as any).__CP__.warnings ?? []) as string[],
        };
      });
      const [png, snapshot] = await Promise.all([capture(cdp.get(page)!, box), page.locator("#root").ariaSnapshot()]);
      warnings.push(...runtimeWarnings);
      const allErrors = unique([...inPage, ...errors]);
      if (allErrors.some((e) => /provider|context/i.test(e))) warnings.push("Application providers could not be reconstructed completely; inspect the render errors.");
      const result: RenderResult = {
        png, snapshot, errors: allErrors, ms: Math.round(performance.now() - started), reloaded, propsSource,
        target: structuredClone({ file: rest.file, exportName: rest.exportName ?? "default", props }), viewport: { ...viewport },
        sourceRevision: server.sourceRevision(), unresolved, warnings, complete: !allErrors.length && !warnings.length,
      };
      if (!allErrors.length) result.captureId = remember(result);
      return result;
  }
}

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
