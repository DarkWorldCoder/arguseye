import { randomUUID } from "node:crypto";
import { defaultRouteFile } from "../project/appContext.js";
import path from "node:path";
import { compareCaptures, type DiffResult } from "./compareCaptures.js";
import { chromium, type Browser, type CDPSession, type Locator, type Page } from "playwright-core";
import { createPreviewServer, type PreviewServer } from "../server/createPreviewServer.js";
import type { Frame, PreviewTarget } from "../server/page.js";
import { createUsageIndex } from "../usages/createUsageIndex.js";
import { type Usage } from "../usages/findUsages.js";
import { propsSchema, sampleProps, type PropSchema } from "../props/propsSchema.js";

export type RenderRequest = PreviewTarget & {
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
  /** The ancestors (tag or component name) the component was rendered inside, outermost first. */
  contextApplied?: string[];
  /** How many of the requested actions ran before capture (all of them unless one failed). */
  actionsApplied?: number;
  /** What changed since the previous render of the same target in this session (absent on the first render). */
  changes?: Changes;
  /** Layout and template files the component was rendered inside, root first (project-relative). */
  layoutsApplied?: string[];
  /** Where the time went, in ms: bundling/crawl, page load or swap, settling (fonts, images), capture. */
  timings?: { prepare: number; show: number; settle: number; capture: number };
};

export type Changes = {
  status: "unchanged" | "changed" | "incomplete";
  changedPercent: number;
  changedPixels: number;
  snapshotChanged: boolean;
  /** Accessibility-tree lines removed (-) and added (+) since the previous render. */
  snapshotDiff: string;
  newErrors: string[];
  resolvedErrors: string[];
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
  /** Resolves once the project-wide warm-up (if enabled) has finished. */
  ready(): Promise<void>;
  server: PreviewServer;
  close(): Promise<void>;
};

/** Renders components headlessly so an agent can see them without running the app or a browser. */
export async function createRenderer(options: { root: string; server?: PreviewServer; warmup?: boolean }): Promise<Renderer> {
  const server = options.server ?? await createPreviewServer({ root: options.root, warmup: options.warmup });
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
  const loadedModules = new WeakMap<Page, Set<string>>();
  const cdp = new WeakMap<Page, CDPSession>();
  /** Last result per target signature, so a re-render can say what changed without a baseline id. */
  const lastResults = new Map<string, RenderResult>();

  /** Bundle generation each warm page was loaded under. */
  const generations = new WeakMap<Page, number>();

  async function warmPage(viewport: { width: number; height: number }, target: PreviewTarget): Promise<Page> {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    const loaded = new Set<string>(); loadedModules.set(page, loaded);
    page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.startsWith("/@fs/")) loaded.add(decodeURIComponent(url.pathname.slice(4))); });
    pageErrors.set(page, errors);
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    await load(page, target);
    cdp.set(page, await page.context().newCDPSession(page));
    return page;
  }

  /** Navigates a page to `target`; the server bundles the packages it needs before responding. */
  async function load(page: Page, target: PreviewTarget) {
    const { generation } = await server.prepare(target.file, prepareContext(target), target.route);
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
    ready: () => server.ready(),
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

  async function render({ viewport = { width: 1280, height: 800 }, usage, inContext, frame, actions = [], storage, ...rest }: RenderRequest, resolved?: Usage): Promise<RenderResult> {
      const started = performance.now();
      if (![viewport.width, viewport.height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192)) throw new Error(`Invalid viewport "${viewport.width}x${viewport.height}"`);
      // Disk edits are registered before anything (usage index, route lookup) reads the files and refreshes their mtimes.
      server.syncDisk();
      rest.file = path.resolve(options.root, rest.file);
      const { props, propsSource, unresolved } = await resolveProps(rest, usage, resolved);
      const target: PreviewTarget = { fresh: true, ...rest, props, frame };
      if (inContext && usage) {
        const found = resolved ?? (await usages.list(rest.file, rest.exportName)).find((u) => u.id === usage);
        if (found?.context?.length) {
          target.context = found.context;
          target.contextFile = path.resolve(options.root, found.id.split(":")[0]);
        }
      }
      // The page whose layouts and templates wrap the render: the usage's page, else a page that uses it, else the most common route.
      const usageFile = (id: string) => path.resolve(options.root, id.split(":")[0]);
      let route = usage ? usageFile(usage) : resolved ? usageFile(resolved.id) : undefined;
      if (!route) {
        const any = (await usages.list(rest.file, rest.exportName)).find((u) => /(^|\/)page\.[jt]sx?:/.test(u.id));
        route = any ? usageFile(any.id) : rest.file.includes(`${path.sep}app${path.sep}`) ? rest.file : defaultRouteFile(options.root);
      }
      target.route = route;
      const contextApplied = target.context?.map((w) => (w.kind === "host" ? w.tag : w.member ? `${w.importName}.${w.member}` : w.importName === "default" ? path.basename(w.source) : w.importName));
      const key = `${rest.file.endsWith(".vue") ? "vue" : "react"}:${viewport.width}x${viewport.height}`;
      let warm = pages.get(key);
      const isNew = !warm;
      if (!warm) pages.set(key, (warm = warmPage(viewport, target)));
      const page = await warm;
      const errors = pageErrors.get(page)!;
      errors.length = 0;
      let reloaded = false;
      const marks: number[] = [performance.now()];
      // Storage is per render: cleared, then seeded, so one render's state never leaks into the next.
      await page.evaluate((s) => {
        localStorage.clear();
        sessionStorage.clear();
        for (const [k, v] of Object.entries(s?.local ?? {})) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(s?.session ?? {})) sessionStorage.setItem(k, v);
      }, storage ?? null);
      if (isNew && storage) await page.evaluate((t) => (window as any).__CP__.show(t), target); // mounted before the seed: show again
      if (!isNew) {
        const state = server.syncDisk();
        const { generation } = await server.prepare(target.file, prepareContext(target), target.route);
        if (generation !== generations.get(page)) {
          reloaded = true;
          await load(page, target);
        } else {
          await page.evaluate(async ([t, s, loaded, context]) => {
            const cp = (window as any).__CP__;
            const sameEpoch = cp.epoch === s.epoch;
            const changed = loaded.filter((f) => s.versions[f] && s.versions[f] !== cp.versions[f]);
            Object.assign(cp, s);
            const updateErrors: string[] = [];
            for (const file of changed) {
              if (/\.(css|scss|sass)$/.test(file) || sameEpoch) {
                try { await cp.importModule("/@fs" + file + "?e=" + s.epoch + "&v=" + s.versions[file]); } catch (error) { updateErrors.push(String(error)); }
              }
            }
            if (sameEpoch && changed.some((f) => !/\.(css|scss|sass)$/.test(f))) cp.refresh?.performReactRefresh();
            if (document.documentElement.className !== (context.htmlClass ?? "")) document.documentElement.className = context.htmlClass ?? "";
            if (document.body.className !== (context.bodyClass ?? "")) document.body.className = context.bodyClass ?? "";
            for (const url of context.globalCssUrls) { try { await cp.importModule(url); } catch (error) { updateErrors.push(String(error)); } }
            await cp.show(t, s);
            cp.errors.push(...updateErrors);
            return cp.status;
          }, [target, state, [...loadedModules.get(page)!], server.context()] as const);
        }
      }

      marks.push(performance.now());
      const actionsApplied = await runActions(page, actions, errors);

      const warnings: string[] = server.warnings(rest.file);
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
      marks.push(performance.now());
      const { box, inPage, runtimeWarnings } = await page.evaluate(() => {
        // The box the component sits in (a frame or the call site's innermost ancestor), else the whole root.
        const r = (document.querySelector("[data-cp-box]") ?? document.getElementById("root")!).getBoundingClientRect();
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
        png, snapshot, errors: allErrors, ms: Math.round(performance.now() - started), reloaded, propsSource, contextApplied,
        layoutsApplied: server.layoutsFor(target.route),
        timings: { prepare: Math.round(marks[0] - started), show: Math.round(marks[1] - marks[0]), settle: Math.round(marks[2] - marks[1]), capture: Math.round(performance.now() - marks[2]) },
        ...(actions.length ? { actionsApplied } : {}),
        target: structuredClone({ file: rest.file, exportName: rest.exportName ?? "default", props }), viewport: { ...viewport },
        sourceRevision: server.sourceRevision(), unresolved, warnings, complete: !allErrors.length && !warnings.length,
      };
      if (!allErrors.length) result.captureId = remember(result);
      const signature = JSON.stringify([rest.file, rest.exportName ?? "default", props, viewport, target.context, frame, actions, storage]);
      const previous = lastResults.get(signature);
      if (previous) {
        const diff = await compareCaptures(page, { ...structuredClone(previous), png: Buffer.from(previous.png) }, result);
        result.changes = {
          status: diff.status, changedPercent: diff.changedPercent, changedPixels: diff.changedPixels, snapshotChanged: diff.snapshotChanged,
          snapshotDiff: lineDiff(previous.snapshot, result.snapshot), newErrors: diff.newErrors, resolvedErrors: diff.resolvedErrors,
        };
      }
      lastResults.set(signature, { ...structuredClone(result), png: Buffer.from(result.png) });
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

/** Playwright's headless shell (a stripped Chromium) when installed: lighter and quicker to start than full Chrome. */
async function launchChrome(): Promise<Browser> {
  const attempts: Array<() => Promise<Browser>> = [
    () => chromium.launch({ channel: "chromium-headless-shell" }),
    () => chromium.launch({ channel: "chrome" }),
    () => chromium.launch(),
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
