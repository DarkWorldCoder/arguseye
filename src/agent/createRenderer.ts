import { fileFromUrl } from "../server/fileUrl.js";
import { inspectRender, errorLocations, type AccessibilityEvidence, type ElementEvidence, type ErrorLocation } from "./inspectRender.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { installFixtures, validateFixtures, type RenderFixtures, type FixtureProvenance } from "./renderFixtures.js";
import { randomUUID } from "node:crypto";
import { routeFor, routePath } from "../project/routeFor.js";
import { defaultRouteFile } from "../project/appContext.js";
import path from "node:path";
import { compareCaptures, type DiffResult } from "./compareCaptures.js";
import { chromium, type Browser, type CDPSession, type Locator, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../server/createPreviewServer.js";
import { createResolver } from "../server/resolver.js";
import type { Frame, PreviewTarget } from "../server/page.js";
import { createUsageIndex } from "../usages/createUsageIndex.js";
import { type Usage } from "../usages/findUsages.js";
import { propsSchema, sampleProps, componentMetadata, type PropSchema } from "../props/propsSchema.js";
import { listExports, pickExport } from "../project/pickExport.js";
import { readFileSync } from "node:fs";
import { frameworkOf } from "../project/framework.js";
import { classicKind } from "../project/classicKind.js";
import { FileAccessError } from "../server/createFileAccess.js";

export type RenderRequest = PreviewTarget & {
  /** Explicit replay inputs; uses a fresh page so module-level reads are deterministic too. */
  fixtures?: RenderFixtures;
  /** Optional heavier accessibility and source inspection, outside the default render path. */
  inspection?: { accessibility?: boolean; sources?: boolean };
  viewport?: { width: number; height: number };
  /** Render with the props of a real usage, by its id from `listUsages` (e.g. `app/page.tsx:9`). */
  usage?: string;
  /** With `usage`: render inside the call site's JSX ancestors, so the parent's size, layout and background apply. */
  inContext?: boolean;
  /** Render inside a stand-in parent box of this size and background. */
  frame?: Frame;
  /** Steps run on the rendered component before capture, to reach a state (open, filled, hovered). */
  actions?: Action[];
  /** Storage seeded before the component mounts (logged-in, feature flags); cleared again afterwards. */
  storage?: { local?: Record<string, string>; session?: Record<string, string> };
};

/** One step: a verb with its target (`{ role, name }`, `{ text }`, `{ label }`, `{ placeholder }`, `{ testId }` or `{ selector }`). */
export type Action = {
  click?: Target; dblclick?: Target; hover?: Target; fill?: Target; type?: Target; check?: Target; uncheck?: Target; select?: Target; focus?: Target;
  press?: string; wait?: number; scroll?: { y?: number; x?: number };
  value?: string;
};
export type Target = { role?: string; name?: string; text?: string; label?: string; placeholder?: string; testId?: string; selector?: string; exact?: boolean };

export type RenderResult = {
  /** PNG cropped to the rendered component. */
  png: Buffer;
  fixtureProvenance?: FixtureProvenance;
  build?: PreviewServer["build"];
  accessibility?: AccessibilityEvidence;
  elements?: ElementEvidence[];
  errorLocations?: ErrorLocation[];
  environment?: { locale: string; timezoneId: string; reducedMotion: "reduce" | "no-preference"; clock: "system" | "fixed"; random: "runtime" | "seeded" };
  /** Scheduled application/dependency timers, distinct from observed instability or engine deadlines. */
  scheduledTimers?: number;
  /** Immutable baseline id, absent when rendering failed. */
  captureId?: string;
  /** What was rendered and how; a diff replays the same request against the current source. */
  target: { file: string; exportName: string; props: Record<string, unknown> } & Pick<RenderRequest, "usage" | "inContext" | "frame" | "actions" | "storage" | "theme" | "fixtures" | "inspection">;
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
  /** The ancestors (tag or component name) the component was rendered inside, outermost first. */
  contextApplied?: string[];
  /** Visible <canvas> elements (WebGL scenes, charts): their content is only in the PNG, not in the snapshot. */
  canvases?: Array<{ width: number; height: number }>;
  /** Visible elements the component rendered outside itself (dialogs, menus, toasts in a portal), included in the capture and snapshot. */
  portals?: number;
  /** Requests the render made that failed, as "GET /api/me → 404" (at most 10). */
  failedRequests?: string[];
  /** console.error messages logged during the render (deduplicated, at most 5): often the reason behind an error. */
  console?: string[];
  /** How many of the requested actions ran before capture (all of them unless one failed). */
  actionsApplied?: number;
  /** What changed since the previous render of the same target in this session (absent on the first render). */
  changes?: Changes;
  /** Layout and template files the component was rendered inside, root first (project-relative). */
  layoutsApplied?: string[];
  /** Caller-authored browser setup; overrides inferred providers/plugins, not the full application. */
  setupApplied?: string;
  /** Where the time went, in ms: bundling/crawl, page load or swap, settling (fonts, images), capture. */
  timings?: { prepare: number; show: number; settle: number; capture: number; layout: number; screenshot: number; accessibility: number; inspection?: number };
};

export type Changes = {
  status: "unchanged" | "changed" | "incomplete";
  changedPercent: number;
  changedPixels: number;
  /** Where the pixels changed, in the new image. */
  changedRegion: { x: number; y: number; width: number; height: number } | null;
  snapshotChanged: boolean;
  /** Accessibility-tree lines removed (-) and added (+) since the previous render. */
  snapshotDiff: string;
  newErrors: string[];
  resolvedErrors: string[];
  newWarnings: string[];
  resolvedWarnings: string[];
};

/** Retained browser pages and PNG buffers; excludes transient response buffers and Chromium heap. */
export type SessionResources = { pages: number; captures: number; history: number; pngBytes: number };
export type SessionLimits = { pages: number; captures: number; history: number; pngBytes: number };

/** Cancels queued/in-flight work; the deadline starts when this request begins executing. */
export type RenderControl = { signal?: AbortSignal; timeoutMs?: number };

export type Renderer = {
  resources(): SessionResources;
  render(request: RenderRequest, control?: RenderControl): Promise<RenderResult>;
  /** Renders one bounded page from a single usage-index query. */
  renderUsages(request: RenderRequest & { offset?: number; limit?: number }, control?: RenderControl): Promise<{ results: Array<RenderResult & { usage: string }>; total: number; nextOffset: number | null }>;
  diff(baselineId: string, control?: RenderControl): Promise<DiffResult>;
  /** Imports a persisted CLI capture into this renderer's bounded session cache. */
  restoreCapture(capture: RenderResult): string;
  listUsages(file: string, exportName?: string): Promise<Usage[]>;
  /** What the component accepts, from its TypeScript type, plus sample props that satisfy the required ones. */
  describeProps(file: string, exportName?: string): Promise<{ props: PropSchema[]; sample: Record<string, unknown>; metadata?: Awaited<ReturnType<typeof componentMetadata>> }>;
  /** Resolves once the project-wide warm-up (if enabled) has finished. */
  ready(): Promise<void>;
  server: PreviewServer;
  close(): Promise<void>;
};

/** Renders components headlessly so an agent can see them without running the app or a browser. */
export async function createRenderer(options: { root: string; server?: PreviewServer; warmup?: boolean; buildMode?: "native" | "vite"; limits?: Partial<SessionLimits> }): Promise<Renderer> {
  const limits = { pages: 4, captures: 64, history: 16, pngBytes: 64 * 1024 * 1024, ...options.limits };
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid session limit ${key}: ${value}`);
  const server = options.server ?? await createPreviewServer({ root: options.root, warmup: options.warmup, buildMode: options.buildMode });
  const usages = createUsageIndex(options.root, { readSource: server.readSource, version: server.version });
  let browser: Browser;
  try { browser = await launchChrome(); } catch (error) { if (!options.server) await server.close(); throw error; }
  const captures = new Map<string, RenderResult>();
  let queue: Promise<unknown> = Promise.resolve();
  type Job = { guard(): void; pages: Set<Promise<Page>>; openPages: Set<Page> };
  const jobs = new AsyncLocalStorage<Job>();
  const guard = () => jobs.getStore()?.guard();
  let closing = false;
  const serial = <T>(work: () => Promise<T>, control: RenderControl = {}): Promise<T> => {
    const timeout = control.timeoutMs ?? 30000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120000) return Promise.reject(new Error("Render deadline must be between 1 and 120000 ms"));
    const result = queue.then(async () => {
      let stopped: Error | undefined;
      const job: Job = { pages: new Set(), openPages: new Set(), guard() { if (stopped) throw stopped; if (closing) throw new Error("Arguseye session is closed"); } };
      let rejectStop: (e: Error) => void;
      const stop = (message: string) => {
        stopped = new Error(message);
        for (const pending of job.pages) {
          for (const [key, value] of pages) if (value === pending) pages.delete(key);
          void pending.then((page) => page.close()).catch(() => {});
        }
        for (const page of job.openPages) void page.close().catch(() => {});
        rejectStop(stopped);
      };
      const interrupted = new Promise<never>((_, reject) => { rejectStop = reject; });
      const abort = () => stop("Render cancelled; no capture was saved. Render again to continue.");
      const timer = setTimeout(() => stop(`Render timed out after ${timeout} ms; no capture was saved. Check async setup, network fixtures or retry with a longer deadline.`), timeout);
      control.signal?.addEventListener("abort", abort, { once: true });
      try {
        if (control.signal?.aborted) abort();
        return await Promise.race([interrupted, jobs.run(job, async () => { guard(); return work(); })]);
      } finally { clearTimeout(timer); control.signal?.removeEventListener("abort", abort); }
    });
    queue = result.catch(() => {}); return result;
  };
  function remember(result: RenderResult): string {
    const id = randomUUID();
    captures.set(id, { ...structuredClone(result), png: Buffer.from(result.png), captureId: id });
    trim();
    return id;
  }

  /** One warm page per viewport: later renders swap the target in place instead of reloading. */
  const pages = new Map<string, Promise<Page>>();
  const isolatedPages = new WeakSet<Page>();
  const pageErrors = new WeakMap<Page, string[]>();
  /** console.error output of the current render: apps explain many failures there (env validation, prop types). */
  const pageConsole = new WeakMap<Page, string[]>();
  /** Requests the component made that failed (4xx/5xx or no response): why it may show a loading or error state. */
  const pageFailures = new WeakMap<Page, string[]>();
  const loadedModules = new WeakMap<Page, Set<string>>();
  const cdp = new WeakMap<Page, CDPSession>();
  /** Last result per target signature, so a re-render can say what changed without a baseline id. */
  const lastResults = new Map<string, RenderResult>();
  const replacedRoots = new WeakSet<Page>();
  const retainedBytes = () => [...captures.values(), ...lastResults.values()].reduce((bytes, r) => bytes + r.png.byteLength, 0);
  function trim() {
    while (lastResults.size > limits.history) lastResults.delete(lastResults.keys().next().value!);
    while (captures.size > limits.captures) captures.delete(captures.keys().next().value!);
    while (retainedBytes() > limits.pngBytes && lastResults.size) lastResults.delete(lastResults.keys().next().value!);
    while (retainedBytes() > limits.pngBytes && captures.size) captures.delete(captures.keys().next().value!);
  }
  async function retainPage(key: string, page: Promise<Page>) {
    pages.delete(key); pages.set(key, page);
    while (pages.size > limits.pages) {
      const oldest = pages.keys().next().value!;
      const evicted = pages.get(oldest)!; pages.delete(oldest);
      await evicted.then((p) => p.close()).catch(() => {});
    }
    try { return await page; } catch (error) { if (pages.get(key) === page) pages.delete(key); throw error; }
  }


  /**
   * After the package warm-up, the default page is opened with the most common route's providers already
   * loaded, so the first component render only has to load its own modules.
   */
  const prewarmed: Promise<void> = (async () => {
    await server.ready();
    if (!options.warmup) return;
    // A speculative React page must not add missing React packages to a Vue-only project's bundle.
    if (!createResolver().resolveFileSync(path.join(options.root, "package.json"), "react").path) return;
    try {
      // The usage index parses the whole project on its first use (seconds on a large codebase): do it now.
      await usages.list(path.join(options.root, "package.json"), "default");
      const route = defaultRouteFile(options.root);
      const viewport = { width: 1280, height: 800 };
      const key = `react:${viewport.width}x${viewport.height}`;
      if (!pages.has(key)) await retainPage(key, warmPage(viewport, { file: "/@empty", exportName: "default", route }));
    } catch {
      // the first render will load the page itself
    }
  })();

  /** The colour scheme each warm page currently emulates. */
  const schemes = new WeakMap<Page, PreviewTarget["theme"]>();
  const pointerDirty = new WeakSet<Page>();

  /** Bundle generation each warm page was loaded under. */
  const generations = new WeakMap<Page, number>();
  const epochs = new WeakMap<Page, number>();
  const fixtureEvidence = new WeakMap<Page, FixtureProvenance>();

  async function warmPage(viewport: { width: number; height: number }, target: PreviewTarget, fixtures?: RenderFixtures, storage?: RenderRequest["storage"]): Promise<Page> {
    guard();
    const page = await browser.newPage({ viewport, locale: fixtures?.locale, timezoneId: fixtures?.timezoneId, serviceWorkers: "block" });
    if (fixtures || storage) isolatedPages.add(page);
    jobs.getStore()?.openPages.add(page);
    try { guard(); } catch (error) { await page.close(); throw error; }
    const evidence = await installFixtures(page, server.url, fixtures, storage);
    if (evidence) fixtureEvidence.set(page, evidence);
    await page.mouse.move(-1, -1);
    // Scroll reveals respecting reduced motion stay visible without inventing a scroll journey or overriding styles.
    await page.emulateMedia({ colorScheme: target.theme ?? null, reducedMotion: fixtures?.reducedMotion ?? "reduce" });
    schemes.set(page, target.theme);
    const errors: string[] = [];
    const loaded = new Set<string>(); loadedModules.set(page, loaded);
    page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.startsWith("/@fs/")) { try { loaded.add(fileFromUrl(url.pathname.slice(4))); } catch {} } });
    pageErrors.set(page, errors);
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    const logged: string[] = [];
    pageConsole.set(page, logged);
    page.on("console", (m) => { if (m.type() === "error" && logged.length < 20) logged.push(m.text().slice(0, 500)); });
    const failed: string[] = [];
    pageFailures.set(page, failed);
    const own = (url: URL) => url.pathname.startsWith("/@") || url.pathname === "/favicon.ico";
    const where = (url: URL) => (url.host === new URL(server.url).host ? url.pathname + url.search : url.href).slice(0, 200);
    page.on("response", (r) => { const url = new URL(r.url()); if (r.status() >= 400 && !own(url) && failed.length < 20) failed.push(`${r.request().method()} ${where(url)} → ${r.status()}`); });
    page.on("requestfailed", (r) => { const url = new URL(r.url()); if (!own(url) && failed.length < 20) failed.push(`${r.method()} ${where(url)} → ${r.failure()?.errorText ?? "failed"}`); });
    try { await load(page, target); } catch (error) { await page.close(); throw error; }
    cdp.set(page, await page.context().newCDPSession(page));
    return page;
  }

  /** Navigates a page to `target`; the server bundles the packages it needs before responding. */
  async function load(page: Page, target: PreviewTarget) {
    const { generation } = await server.prepare(target.file, prepareContext(target), target.route);
    guard();
    await page.goto(new URL(server.pageUrl(target, { live: false }), server.url).href);
    await page.waitForFunction(() => (window as any).__CP__?.ready || (window as any).__CP__?.status === "error", null, { timeout: 15000 });
    epochs.set(page, await page.evaluate(() => Promise.race([(window as any).__CP__.ready, new Promise((_, reject) => (window as any).__CP__.setTimeout(() => reject(new Error("Component setup did not become ready within 15 s")), 15000))]).then(() => (window as any).__CP__.epoch)));
    guard();
    // Agents get the settled frame: transitions end instantly, animations hold still, no blinking caret.
    await page.addStyleTag({ content: FREEZE_MOTION });
    generations.set(page, generation);
  }

  async function describeProps(file: string, exportName?: string) {
    server.assertAccess(path.resolve(options.root, file));
    const props = await propsSchema(file, exportName ?? (await exportOf(file)), server.readSource);
    return { props, sample: sampleProps(props), metadata: await componentMetadata(file, server.readSource) };
  }

  /** Given props win; else a named usage's props; else, with nothing to go on, samples from the type. */
  async function resolveProps(target: PreviewTarget, usage: string | undefined, resolved?: Usage): Promise<{ props: Record<string, unknown>; propsSource: RenderResult["propsSource"]; unresolved: string[] }> {
    if (usage) {
      const found = resolved ?? (await usages.list(target.file, target.exportName)).find((u) => u.id === usage);
      if (!found) {
        const known = (await usages.list(target.file, target.exportName)).map((u) => u.id);
        throw new Error(`No usage "${usage}" of ${target.exportName ?? "default"} from ${path.relative(options.root, target.file)}. ${known.length ? "Usages: " + known.join(", ") : "It has no usages in the project; pass props instead."}`);
      }
      return { props: { ...found.props, ...target.props }, propsSource: "usage", unresolved: found.unresolved };
    }
    if (target.props && Object.keys(target.props).length) return { props: target.props, propsSource: "given", unresolved: [] };
    const sample = sampleProps(await propsSchema(target.file, target.exportName, server.readSource).catch((error) => {
      if (error instanceof FileAccessError) throw error;
      return [];
    }));
    return Object.keys(sample).length ? { props: sample, propsSource: "sample", unresolved: [] } : { props: {}, propsSource: "none", unresolved: [] };
  }

/** Settled frame: transitions end at once, finite animations jump to their final state, spinners stop, no caret. */

  /** Classic scripts (a widget .js, an .html with classic <script>s) get a fresh page per render, under their own key. */
  async function classicOf(file: string) {
    return /\.(c?js|html)$/.test(file) ? classicKind(file, await server.readSource(path.resolve(options.root, file))) : undefined;
  }
  function pageKey(file: string, viewport: { width: number; height: number }, classic: ReturnType<typeof classicKind>) {
    return `${classic ? "classic" : frameworkOf(file)}:${viewport.width}x${viewport.height}`;
  }

  /** The export a caller means when they name none: the default, else the file's component (first PascalCase export). */
  async function exportOf(file: string): Promise<string | undefined> {
    return pickExport(file, await server.readSource(path.resolve(options.root, file)).catch(() => ""));
  }

  return {
    server,
    resources: () => ({ pages: pages.size, captures: captures.size, history: lastResults.size, pngBytes: retainedBytes() }),
    listUsages: async (file, exportName) => { server.assertAccess(path.resolve(options.root, file)); return usages.list(file, exportName ?? (await exportOf(file))); },
    describeProps,
    ready: () => prewarmed,
    render: (request, control) => serial(() => renderWithProvider(request), control),
    renderUsages: (request, control) => serial(async () => {
      const { offset = 0, limit = 12, ...target } = request;
      server.assertAccess(path.resolve(options.root, target.file));
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error("Usage page requires offset >= 0 and limit between 1 and 12");
      target.exportName ??= await exportOf(target.file);
      const all = await usages.list(path.resolve(options.root, target.file), target.exportName);
      const results: Array<RenderResult & { usage: string }> = [];
      for (const usage of all.slice(offset, offset + limit)) results.push({ ...await render({ ...target, usage: usage.id }, usage), usage: usage.id });
      return { results, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : null };
    }, control),
    restoreCapture: (capture) => {
      if ((capture.build?.mode ?? "native") !== (server.build?.mode ?? "native")) throw new Error(`Baseline uses ${capture.build?.mode ?? "native"} compilation; create a renderer with the same buildMode before comparing.`);
      return remember(capture);
    },
    diff: (baselineId, control) => serial(async () => {
      const before = captures.get(baselineId);
      if (!before) throw new Error(`Unknown or expired baseline "${baselineId}"; render the component again to capture a new baseline.`);
      // Same props, parent box, frame, actions and storage as the baseline. The usage is replayed only for its
      // ancestors (in-context), so a baseline without context still compares after its call site moved.
      const { usage, inContext, ...replay } = structuredClone(before.target);
      const after = await renderWithProvider({ ...replay, ...(inContext && usage ? { usage, inContext } : {}), viewport: before.viewport });
      after.unresolved = unique([...before.unresolved, ...after.unresolved]);
      after.propsSource = before.propsSource;
      // Replayed sample/runtime inputs retain their provenance; old asset/provider failures can resolve.
      const inputWarnings = before.warnings.filter((w) => w.startsWith("Runtime usage inputs were not evaluated:") || w.startsWith("Sample props were generated from types;"));
      after.warnings = unique([...after.warnings, ...inputWarnings]);
      after.complete &&= !after.unresolved.length && !inputWarnings.length;
      if (after.changes && !after.complete) after.changes.status = "incomplete";
      if (after.captureId && captures.has(after.captureId)) { captures.set(after.captureId, { ...structuredClone(after), png: Buffer.from(after.png) }); trim(); }
      const page = await pages.get(pageKey(before.target.file, before.viewport, await classicOf(before.target.file)))!;
      return compareCaptures(page, { ...structuredClone(before), png: Buffer.from(before.png) }, after);
    }, control),
    async close() {
      closing = true;
      await queue;
      captures.clear(); lastResults.clear(); pages.clear();
      await browser.close();
      if (!options.server) await server.close();
    },
  };

  /**
   * Compound components (Radix, shadcn) throw "`Tooltip` must be used within `TooltipProvider`" when rendered alone.
   * When the same file exports that provider, render once more inside it, as every real use of the part would be.
   */
  async function renderWithProvider(request: RenderRequest): Promise<RenderResult> {
    const first = await render(request);
    const needed = first.errors.join("\n").match(/must be used within\s+[`'"<]*([A-Z]\w*)/)?.[1];
    if (!needed || request.inContext || request.frame) return first;
    const file = path.resolve(options.root, request.file);
    let exported: string[] = [];
    try { exported = listExports(file, readFileSync(file, "utf8")); } catch {}
    if (!exported.includes(needed)) return first;
    const second = await render(request, undefined, needed);
    if (second.errors.length) return first;
    second.warnings.push(`Rendered inside ${needed} from the same file: the component throws without it.`);
    second.complete = false;
    if (second.captureId && captures.has(second.captureId)) captures.set(second.captureId, { ...structuredClone(second), png: Buffer.from(second.png) });
    return second;
  }

  async function render({ viewport = { width: 1280, height: 800 }, usage, inContext, frame, actions = [], storage, fixtures, inspection, ...rest }: RenderRequest, resolved?: Usage, provider?: string): Promise<RenderResult> {
      guard();
      validateFixtures(fixtures);
      const started = performance.now();
      if (![viewport.width, viewport.height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192)) throw new Error(`Invalid viewport "${viewport.width}x${viewport.height}"`);
      // Disk edits are registered before anything (usage index, route lookup) reads the files and refreshes their mtimes.
      server.syncDisk();
      rest.file = path.resolve(options.root, rest.file);
      server.assertAccess(rest.file);
      rest.exportName ??= await exportOf(rest.file);
      const classic = await classicOf(rest.file);
      if (classic === "script" && server.build?.mode === "vite") throw new Error("Classic-script widgets currently use native mode; retry with --build-mode native.");
      // A widget script has no props type to sample: its props are the config it is given, or none.
      const { props, propsSource, unresolved } = classic === "script" && !usage
        ? { props: rest.props ?? {}, propsSource: Object.keys(rest.props ?? {}).length ? "given" as const : "none" as const, unresolved: [] }
        : await resolveProps(rest, usage, resolved);
      const target: PreviewTarget = { fresh: true, ...rest, props, frame };
      if (inContext && usage) {
        const found = resolved ?? (await usages.list(rest.file, rest.exportName)).find((u) => u.id === usage);
        if (found?.context?.length) {
          target.context = found.context;
          target.contextFile = path.resolve(options.root, found.id.split(":")[0]);
        }
      }
      if (provider) {
        target.context = [{ kind: "component", source: "./" + path.basename(rest.file), importName: provider, props: {} }];
        target.contextFile = rest.file;
      }
      target.route = classic === "script" ? undefined : resolved ? path.resolve(options.root, resolved.id.split(":")[0]) : await routeFor(options.root, rest.file, rest.exportName, usage, (f, e) => usages.list(f, e));
      Object.assign(target, routePath(options.root, target.route));
      // A Next layout renders <html>/<body>, which cannot mount inside a preview. It is every preview's wrapper
      // already, so render its chain (providers, elements, html/body classes) down to this layout around its children.
      const layout = isLayoutFile(options.root, rest.file) && (rest.exportName ?? "default") === "default";
      if (layout) {
        target.file = "/@empty";
        target.route = rest.file;
        target.props = { children: typeof props.children === "string" ? props.children : "Page content" };
      }
      const contextApplied = target.context?.flatMap((w) => w.kind === "prelude" ? [] : (w.kind === "host" ? w.tag : w.member ? `${w.importName}.${w.member}` : w.importName === "default" ? path.basename(w.source) : w.importName));
      if (server.build?.mode === "vite") await server.prepare(target.file, prepareContext(target), target.route);
      const key = pageKey(rest.file, viewport, classic);
      // Classic scripts leave globals and "already loaded" guards behind: never run one on a page used before.
      if ((fixtures || storage || classic) && pages.has(key)) { const old = pages.get(key)!; pages.delete(key); await old.then((p) => p.close()).catch(() => {}); }
      let warm = pages.get(key);
      // Explicit browser inputs cannot leak into the next ordinary render through its warm page.
      if (warm && (replacedRoots.has(await warm) || isolatedPages.has(await warm))) { pages.delete(key); await (await warm).close(); warm = undefined; }
      const isNew = !warm;
      warm ??= warmPage(viewport, target, fixtures, storage);
      jobs.getStore()?.pages.add(warm);
      const page = await retainPage(key, warm);
      guard();
      jobs.getStore()?.openPages.add(page);
      const errors = pageErrors.get(page)!;
      errors.length = 0;
      const logged = pageConsole.get(page)!;
      logged.length = 0;
      const failedRequests = pageFailures.get(page)!;
      failedRequests.length = 0;
      let reloaded = false;
      const marks: number[] = [performance.now()];
      if (pointerDirty.has(page)) { await page.mouse.move(-1, -1); pointerDirty.delete(page); }
      if (!isNew) {
        // A warm page may have been used for the other theme; re-emulate only on a change (it is a CDP round trip).
        if (schemes.get(page) !== rest.theme) { await page.emulateMedia({ colorScheme: rest.theme ?? null }); schemes.set(page, rest.theme); }
        const state = server.syncDisk();
        const { generation } = await server.prepare(target.file, prepareContext(target), target.route);
        if (generation !== generations.get(page) || frameworkOf(rest.file) === "html" && epochs.get(page) !== state.epoch) {
          reloaded = true;
          await load(page, target);
        } else {
          const shownEpoch = await page.evaluate(async ([t, s, loaded, context, storage]) => {
            if (scrollX || scrollY) window.scrollTo(0, 0);
            if (document.activeElement !== document.body) (document.activeElement as HTMLElement | null)?.blur?.();
            localStorage.clear(); sessionStorage.clear();
            for (const [key, value] of Object.entries(storage?.local ?? {})) localStorage.setItem(key, value);
            for (const [key, value] of Object.entries(storage?.session ?? {})) sessionStorage.setItem(key, value);
            const cp = (window as any).__CP__;
            const sameEpoch = cp.epoch === s.epoch;
            const changed = loaded.filter((f) => s.versions[f] && s.versions[f] !== cp.versions[f]);
            Object.assign(cp, s);
            const updateErrors: string[] = [];
            for (const file of changed) {
              if (/\.(css|scss|sass)$/.test(file) || sameEpoch) {
                try { await cp.importModule(cp.fileUrl(file) + "?e=" + s.epoch + "&v=" + s.versions[file]); } catch (error) { updateErrors.push(String(error)); }
              }
            }
            if (sameEpoch && changed.some((f) => !/\.(css|scss|sass)$/.test(f))) cp.refresh?.performReactRefresh();
            if (document.documentElement.className !== (context.htmlClass ?? "")) document.documentElement.className = context.htmlClass ?? "";
            // A previous forced theme must not leave its inline UA color-scheme on the next plain render.
            document.documentElement.style.colorScheme = t.theme ?? "";
            if (t.theme) document.documentElement.classList.toggle("dark", t.theme === "dark");
            if (document.body.className !== (context.bodyClass ?? "")) document.body.className = context.bodyClass ?? "";
            for (const url of context.globalCssUrls) { try { await cp.importModule(url); } catch (error) { updateErrors.push(String(error)); } }
            await cp.show(t, s);
            cp.errors.push(...updateErrors);
            return cp.epoch;
          }, [target, state, [...loadedModules.get(page)!], server.context(), storage] as const);
          epochs.set(page, shownEpoch);
        }
      }

      guard();
      marks.push(performance.now());
      const actionsApplied = await runActions(page, actions, errors);
      if (actions.length) pointerDirty.add(page);

      const warnings: string[] = server.warnings(rest.file);
      if (unresolved.length) warnings.push("Runtime usage inputs were not evaluated: " + unresolved.join(", "));
      if (propsSource === "sample" && !layout) warnings.push("Sample props were generated from types; these are not real application data.");
      if (layout) warnings.push(`Rendered as the app uses it: the layout chain down to ${path.relative(options.root, rest.file)} (providers, elements, <html>/<body> classes) around ${JSON.stringify(target.props!.children)}.`);

      const settled = await page.evaluate(async () => {
        // JavaScript animations (charts drawing in, springs) move the DOM every frame and CSS freezing cannot stop
        // them: they are fast-forwarded, and anything still moving is waited out (at most 2.5 s).
        const cp = (window as any).__CP__;
        // The page's own frame wait, which does not count as the app asking for a frame.
        const nextFrame = () => (cp.frame ? cp.frame() : new Promise((done) => requestAnimationFrame(() => done(undefined))));
        let moved = 0;
        const watcher = new MutationObserver((records) => { moved += records.length; });
        watcher.observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
        let infiniteWebAnimation = false;
        const finishAnimations = () => {
          let active = 0;
          for (const animation of document.getAnimations()) {
            if (animation.playState === "finished" || animation.playState === "idle") continue;
            const end = animation.effect?.getComputedTiming().endTime;
            if (typeof end === "number" && Number.isFinite(end)) {
              if (animation.playState === "paused" && animation.currentTime === end) continue;
              try { animation.finish(); } catch { animation.pause(); animation.currentTime = end; }
              active++;
            }
            else { animation.pause(); animation.currentTime = 0; infiniteWebAnimation = true; }
          }
          return active;
        };
        let webAnimations = finishAnimations();
        // When the app has frames pending (an animation), one frame with animation time pushed ahead; if anything
        // moved, keep pushing until two frames in a row are still: an animation started on mount reaches its end
        // frame within a couple of frames. No pending frame, no wait.
        if (!cp.frame || cp.rafPending > 0 || webAnimations) { cp.fastForward?.(60000); await nextFrame(); webAnimations += finishAnimations(); await Promise.resolve(); }
        let animating = false;
        if (moved || webAnimations) {
          const until = performance.now() + 2500;
          let still = 0;
          while (still < 2 && performance.now() < until) { moved = 0; cp.fastForward?.(60000); await nextFrame(); const finished = finishAnimations(); await Promise.resolve(); still = moved || finished ? 0 : still + 1; }
          animating = still < 2;
        }
        watcher.disconnect();
        // ResizeObserver clients can debounce their first measurement, so the default 300×150 canvas can
        // briefly look settled. Require stable CSS/buffer sizes for 100 ms, with a real one-second bound.
        let canvasesPending = false;
        if (document.querySelector("canvas")) {
          const frame = () => new Promise((done) => requestAnimationFrame(() => done(undefined)));
          let previous = "", stable = 0, stableSince = performance.now();
          const until = performance.now() + 1000;
          while ((stable < 6 || performance.now() - stableSince < 100) && performance.now() < until) {
            await frame();
            const sizes = [...document.querySelectorAll("canvas")].map((c) => {
              const { width, height } = c.getBoundingClientRect();
              return { width, height, bufferWidth: c.width, bufferHeight: c.height };
            }).filter((c) => c.width && c.height);
            const current = JSON.stringify(sizes);
            const sized = sizes.every((c) => Math.abs(c.bufferWidth - Math.round(c.width * devicePixelRatio)) <= 1 && Math.abs(c.bufferHeight - Math.round(c.height * devicePixelRatio)) <= 1);
            stable = sized && current === previous ? stable + 1 : 0;
            if (!stable) stableSince = performance.now();
            previous = current;
          }
          canvasesPending = stable < 6 || performance.now() - stableSince < 100;
        }
        // A complete image can still be undecoded, especially async WebP below the viewport or inside an SVG.
        const images = [...document.images], decoding = new Set(images), decodeFailed = new Set<HTMLImageElement>();
        if (images.length || document.fonts.status !== "loaded") {
          await Promise.race([
            Promise.allSettled([document.fonts.ready, ...images.map((img) => Promise.resolve().then(() => img.decode()).catch(() => { decodeFailed.add(img); }).finally(() => { decoding.delete(img); }))]),
            new Promise((r) => cp.setTimeout(r, 1000)),
          ]);
        }
        return { assets: [...document.images].filter((img) => !img.complete || !img.naturalWidth || decoding.has(img) || decodeFailed.has(img)).map((img) => img.getAttribute("src") ?? "unknown image").concat(document.fonts.status === "loaded" ? [] : ["fonts"], canvasesPending ? ["canvases"] : [], animating ? ["animations still running after 2.5 s"] : []), pendingFrames: cp.rafPending > 0, infiniteWebAnimation };
      });
      if (settled.assets.length) warnings.push("Assets did not settle: " + settled.assets.join(", "));
      if (settled.pendingFrames) warnings.push("Animation-frame callbacks remain pending; capture stability is not established.");
      if (settled.infiniteWebAnimation) warnings.push("Infinite web animation paused at its first frame for verification; its running state was not captured.");
      marks.push(performance.now());
      const { box, inPage, runtimeWarnings, portals, canvases, empty, environment, rootIntact, scheduledTimers } = await page.evaluate(() => {
        // The box the component sits in (a frame or the call site's innermost ancestor), else the root's height and
        // the horizontal extent of what it rendered, so a 340 px card is not captured as wide as the viewport.
        const framed = document.querySelector("[data-cp-box]");
        // A root layout renders <html>/<body>, which React 19 takes over, replacing #root: capture the body then.
        const root = document.getElementById("root") ?? document.body;
        const r = (framed ?? root).getBoundingClientRect();
        // Dialogs, menus, popovers and toasts render into a portal on <body>, outside #root: the capture grows to
        // include whatever is visible there (a modal overlay makes it the whole viewport, as on screen).
        // An embed widget's host is often an empty box whose (shadow) children are fixed-position: measure those.
        const drawn = (el: Element): DOMRect[] => {
          const own = el.getBoundingClientRect(), sized = (b: DOMRect) => b.width > 0 && b.height > 0;
          if (sized(own) && !el.shadowRoot) return [own];
          const boxes = sized(own) ? [own] : [];
          let budget = 500;
          const walk = (node: Element | ShadowRoot) => {
            for (const child of node.children) {
              if (budget-- <= 0) return;
              const b = child.getBoundingClientRect();
              if (sized(b)) boxes.push(b); else walk(child);
              if (child.shadowRoot) walk(child.shadowRoot);
            }
          };
          if (el.shadowRoot) walk(el.shadowRoot);
          if (!boxes.length) walk(el);
          return boxes;
        };
        const portaled = framed ? [] : [...document.body.children]
          .filter((el) => el !== root && !["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"].includes(el.tagName))
          .flatMap(drawn);
        // Nothing in the root (a widget that only mounts on <body>): the capture is what it mounted, not the top-left.
        let [left, right, top, bottom] = !framed && !r.height && portaled.length ? [Infinity, -Infinity, Infinity, -Infinity] : [r.left, r.right, r.top, r.bottom];
        if (!framed) {
          const spans = [...root.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
          if (spans.length) [left, right] = [Math.max(r.left, Math.min(...spans.map((b) => b.left))), Math.min(r.right, Math.max(...spans.map((b) => b.right)))];
        }
        for (const b of portaled) {
          left = Math.max(0, Math.min(left, b.left)); top = Math.max(0, Math.min(top, b.top));
          right = Math.min(innerWidth, Math.max(right, b.right)); bottom = Math.min(innerHeight, Math.max(bottom, b.bottom));
        }
        return {
          environment: (window as any).__CP__.environment,
          rootIntact: !!document.getElementById("root"),
          box: { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
          portals: portaled.length,
          // A <canvas> (WebGL, charts) has no accessible content: report it so an agent knows the pixels are the evidence.
          canvases: [...document.querySelectorAll("canvas")].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0).map((b) => ({ width: Math.round(b.width), height: Math.round(b.height) })),
          // Nothing with a size and no text: the component returned null or empty elements for these props.
          empty: !portaled.length && !root.innerText.trim() && ![...root.querySelectorAll("*")].some((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; }),
          inPage: (window as any).__CP__.errors as string[],
          scheduledTimers: (window as any).__CP__.pendingTimers(),
          runtimeWarnings: ((window as any).__CP__.warnings ?? []) as string[],
        };
      });
      // With portaled content the snapshot is the whole body, so an open dialog's text and buttons are in it.
      const layoutAt = performance.now();
      let screenshotAt = layoutAt, accessibilityAt = layoutAt;
      const [png, snapshot] = await Promise.all([
        capture(page, cdp.get(page)!, box).then((png) => { screenshotAt = performance.now(); return png; }),
        page.locator(portals || !rootIntact ? "body" : "#root").ariaSnapshot().then((snapshot) => { accessibilityAt = performance.now(); return snapshot; }),
      ]);

      const capturedAt = performance.now();
      warnings.push(...runtimeWarnings);
      if (failedRequests.length) warnings.push(`Requests failed (the preview has no app server or backend; pass data as props or seed storage): ${unique(failedRequests).slice(0, 5).join("; ")}`);
      const allErrors = unique([...inPage, ...errors]);
      const locations = allErrors.length ? await errorLocations(allErrors, server) : [];
      let inspectionResult = {};
      if (inspection) {
        try { inspectionResult = await inspectRender(page, server, inspection, portals || !rootIntact ? "body" : "#root"); }
        catch (error) { warnings.push("Requested inspection did not complete: " + String((error as Error).message ?? error)); }
      }
      if (empty && !allErrors.length) warnings.push("The component rendered nothing visible with these props (it returned null or elements with no size). Pass props that make it render: see describe_props, list_usages or `usage`.");
      if (allErrors.some((e) => /provider|context/i.test(e))) warnings.push("Application providers could not be reconstructed completely; inspect the render errors.");
      guard();
      const evidence = fixtureEvidence.get(page);
      if (evidence?.network?.blocked.length) warnings.push("Unmatched network requests blocked by fixtures: " + evidence.network.blocked.join("; "));
      const setup = classic === "script" ? undefined : server.setupFor(rest.file);
      const result: RenderResult = {
        png, snapshot, scheduledTimers, ...inspectionResult, ...(locations.length ? { errorLocations: locations } : {}), environment: { ...environment, clock: fixtures?.now !== undefined ? "fixed" : "system", random: fixtures?.randomSeed !== undefined ? "seeded" : "runtime" }, build: server.build ?? { mode: "native", executesVitePlugins: false }, ...(evidence ? { fixtureProvenance: structuredClone(evidence) } : {}), errors: allErrors, ms: Math.round(performance.now() - started), reloaded, propsSource, contextApplied,
        ...(portals ? { portals } : {}),
        ...(canvases.length ? { canvases } : {}),
        ...(failedRequests.length ? { failedRequests: unique(failedRequests).slice(0, 10) } : {}),
        ...(logged.length ? { console: unique(logged.filter((l) => !allErrors.some((e) => e.includes(l)))).slice(0, 5) } : {}),
        layoutsApplied: server.layoutsFor(target.route),
        setupApplied: setup ? path.relative(options.root, setup) : undefined,
        timings: { prepare: Math.round(marks[0] - started), show: Math.round(marks[1] - marks[0]), settle: Math.round(marks[2] - marks[1]), capture: Math.round(capturedAt - marks[2]), layout: Math.round(layoutAt - marks[2]), screenshot: Math.round(screenshotAt - layoutAt), accessibility: Math.round(accessibilityAt - layoutAt), ...(inspection || locations.length ? { inspection: Math.round(performance.now() - capturedAt) } : {}) },
        ...(actions.length ? { actionsApplied } : {}),
        target: structuredClone({
          file: rest.file, exportName: rest.exportName ?? "default", props,
          ...(usage ? { usage } : {}), ...(inContext ? { inContext } : {}), ...(frame ? { frame } : {}), ...(actions.length ? { actions } : {}), ...(storage ? { storage } : {}), ...(rest.theme ? { theme: rest.theme } : {}), ...(fixtures ? { fixtures } : {}), ...(inspection ? { inspection } : {}),
        }), viewport: { ...viewport },
        sourceRevision: server.sourceRevision(), unresolved, warnings: unique(warnings), complete: !allErrors.length && !warnings.length,
      };
      if (png.byteLength > limits.pngBytes) {
        result.warnings.push("PNG retention budget exceeded; save this response to an explicit capture directory or increase the session pngBytes limit before capturing a baseline."); result.complete = false;
      } else if (!allErrors.length) result.captureId = remember(result);
      const signature = JSON.stringify([rest.file, rest.exportName ?? "default", props, viewport, target.context, frame, actions, storage, rest.theme, fixtures, inspection]);
      const previous = lastResults.get(signature);
      if (previous) {
        const diff = await compareCaptures(page, { ...structuredClone(previous), png: Buffer.from(previous.png) }, result);
        result.changes = {
          status: diff.status, changedPercent: diff.changedPercent, changedPixels: diff.changedPixels, changedRegion: diff.changedRegion, snapshotChanged: diff.snapshotChanged,
          snapshotDiff: lineDiff(previous.snapshot, result.snapshot), newErrors: diff.newErrors, resolvedErrors: diff.resolvedErrors,
          newWarnings: diff.newWarnings, resolvedWarnings: diff.resolvedWarnings,
        };
      }
      guard();
      lastResults.delete(signature);
      if (png.byteLength <= limits.pngBytes) lastResults.set(signature, { ...structuredClone(result), png: Buffer.from(result.png) });
      trim();
      // The page's own React root is gone (a layout rendered <html>/<body>): later renders get a fresh page.
      if (!rootIntact) replacedRoots.add(page);
      return result;
  }
}

/** Lines removed (-) and added (+) between two snapshots; enough for an agent to see what its edit did to the tree. */
function lineDiff(before: string, after: string): string {
  const a = before.split("\n"), b = after.split("\n");
  const inB = new Set(b), inA = new Set(a);
  return [...a.filter((l) => !inB.has(l)).map((l) => "- " + l.trim()), ...b.filter((l) => !inA.has(l)).map((l) => "+ " + l.trim())].join("\n");
}

/** Runs the requested steps inside #root; stops at the first failure and records it as a readable error. */
async function runActions(page: Page, actions: Action[], errors: string[]): Promise<number> {
  const root = page.locator("#root");
  const TIMEOUT = 2000;
  let applied = 0;
  for (const [index, action] of actions.entries()) {
    const label = `action ${index + 1} (${describeAction(action)})`;
    try {
      const verb = (["click", "dblclick", "hover", "fill", "type", "check", "uncheck", "select", "focus"] as const).find((v) => action[v]);
      if (verb) {
        const target = locate(root, action[verb]!);
        if (verb === "fill") await target.fill(action.value ?? "", { timeout: TIMEOUT });
        else if (verb === "type") await target.pressSequentially(action.value ?? "", { timeout: TIMEOUT });
        else if (verb === "select") await target.selectOption(action.value ?? "", { timeout: TIMEOUT });
        else if (verb === "check") await target.check({ timeout: TIMEOUT });
        else if (verb === "uncheck") await target.uncheck({ timeout: TIMEOUT });
        else if (verb === "focus") await target.focus({ timeout: TIMEOUT });
        else if (verb === "hover") await target.hover({ timeout: TIMEOUT });
        else if (verb === "dblclick") await target.dblclick({ timeout: TIMEOUT });
        else await target.click({ timeout: TIMEOUT });
      } else if (action.press) await page.keyboard.press(action.press);
      else if (action.scroll) await page.evaluate((s) => window.scrollTo({ left: s.x ?? 0, top: s.y ?? 0 }), action.scroll);
      else if (action.wait) await page.waitForTimeout(Math.min(action.wait, 5000));
      else throw new Error("unknown action");
      applied++;
    } catch (error) {
      const message = String((error as Error).message ?? error).split("\n")[0];
      errors.push(/timeout|not found|no element/i.test(message) ? `${label}: target not found within ${TIMEOUT} ms` : `${label}: ${message}`);
      break;
    }
  }
  return applied;
}

function locate(root: Locator, t: Target): Locator {
  if (t.selector) return root.locator(t.selector).first();
  if (t.testId) return root.getByTestId(t.testId).first();
  if (t.label) return root.getByLabel(t.label, { exact: t.exact }).first();
  if (t.placeholder) return root.getByPlaceholder(t.placeholder, { exact: t.exact }).first();
  if (t.role) return root.getByRole(t.role as any, { name: t.name, exact: t.exact }).first();
  if (t.text) return root.getByText(t.text, { exact: t.exact }).first();
  if (t.name) return root.getByText(t.name, { exact: t.exact }).first();
  throw new Error("target needs role, text, label, placeholder, testId or selector");
}

function describeAction(a: Action): string {
  const verb = Object.keys(a).find((k) => !["value", "exact"].includes(k)) ?? "?";
  const t = (a as any)[verb];
  const what = typeof t === "object" && t ? JSON.stringify(t.name ?? t.text ?? t.label ?? t.placeholder ?? t.testId ?? t.selector ?? t) : JSON.stringify(t);
  return `${verb} ${what}${a.value !== undefined ? " = " + JSON.stringify(a.value) : ""}`;
}

/** What `prepare` must bundle for a target's call-site context, if any. */
const prepareContext = (target: PreviewTarget) =>
  target.context?.length && target.contextFile ? { file: target.contextFile, wrappers: target.context } : undefined;

const FREEZE_MOTION = `*, *::before, *::after {
  transition-duration: 0s !important; transition-delay: 0s !important;
  animation-duration: 0.001s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  caret-color: transparent !important;
}`;

/** Captures enclosing device pixels without letting application canvas overrides influence verification. */
async function capture(page: Page, session: CDPSession, box: { x: number; y: number; width: number; height: number }): Promise<Buffer> {
  const viewport = page.viewportSize()!;
  // Text line boxes are usually fractional. Include every covered device pixel without resampling it.
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.x + box.width) - Math.floor(box.x), height: Math.ceil(box.y + box.height) - Math.floor(box.y) };
  const within = viewport.width * viewport.height <= 4_194_304 && clip.x >= 0 && clip.y >= 0 && clip.x + clip.width <= viewport.width && clip.y + clip.height <= viewport.height;
  // macOS Chromium still stalls on clipped surfaces; keep its viewport surface and crop in an isolated realm.
  const viewportCrop = within && process.platform === "darwin";
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    ...(!viewportCrop ? { clip: { ...(within ? clip : box), scale: 1 } } : {}),
    optimizeForSpeed: true,
    captureBeyondViewport: !within,
  });
  if (viewportCrop) {
    const { frameTree } = await session.send("Page.getFrameTree");
    const { executionContextId } = await session.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "arguseye-png-crop" });
    // App overrides of Image/canvas APIs must not change or break verification pixels.
    const result = await session.send("Runtime.callFunctionOn", {
      executionContextId, awaitPromise: true, returnByValue: true,
      functionDeclaration: `async function(data, box) {
        const image = new Image(); image.src = "data:image/png;base64," + data; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = box.width; canvas.height = box.height;
        canvas.getContext("2d").drawImage(image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
        return canvas.toDataURL("image/png").split(",")[1];
      }`,
      arguments: [{ value: data }, { value: clip }],
    });
    if (result.exceptionDetails) throw new Error("Screenshot crop failed: " + (result.exceptionDetails.exception?.description ?? result.exceptionDetails.text));
    return Buffer.from(result.result.value, "base64");
  }
  return Buffer.from(data, "base64");
}

/** Playwright's headless shell (a stripped Chromium) when installed: lighter and quicker to start than full Chrome. */
async function launchChrome(): Promise<Browser> {
  const attempts: Array<() => Promise<Browser>> = [
    // Verification captures must not wait for the host display's compositor cadence.
    () => chromium.launch({ channel: "chromium-headless-shell", args: ["--disable-frame-rate-limit"] }),
    () => chromium.launch({ channel: "chrome", args: ["--disable-frame-rate-limit"] }),
    () => chromium.launch({ args: ["--disable-frame-rate-limit"] }),
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const unique = (xs: string[]) => [...new Set(xs)];

/** Next App Router layouts and templates, which render the document around every page below them. */
function isLayoutFile(root: string, file: string): boolean {
  return /^(src\/)?app\/(.+\/)?(layout|template)\.[jt]sx?$/.test(path.relative(root, file).split(path.sep).join("/"));
}
