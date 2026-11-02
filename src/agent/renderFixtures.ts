import { createHash } from "node:crypto";
import type { Page } from "playwright-core";

/** Explicit browser inputs; response bodies and storage are replayed, never inferred from a user's session. */
export type RenderFixtures = {
  now?: string;
  randomSeed?: number;
  locale?: string;
  timezoneId?: string;
  reducedMotion?: "reduce" | "no-preference";
  network?: { policy: "passthrough" | "block-unmatched"; responses: Array<{ url: string; method?: string; status?: number; contentType?: string; body: string }> };
};
/** Records fixture identity and actual routing outcomes without duplicating response bodies. */
export type FixtureProvenance = { digest: string; clock?: string; randomSeed?: number; locale?: string; timezoneId?: string; reducedMotion?: "reduce" | "no-preference"; network?: { policy: "passthrough" | "block-unmatched"; matched: string[]; blocked: string[] } };

/** Rejects unbounded/ambiguous fixtures before starting browser effects. */
export function validateFixtures(fixtures?: RenderFixtures): void {
  if (!fixtures) return;
  if (fixtures.reducedMotion !== undefined && !["reduce", "no-preference"].includes(fixtures.reducedMotion)) throw new Error(`Invalid reducedMotion fixture "${fixtures.reducedMotion}"`);
  if (fixtures.now !== undefined && !Number.isFinite(Date.parse(fixtures.now))) throw new Error(`Invalid fixture time "${fixtures.now}"`);
  if (fixtures.randomSeed !== undefined && (!Number.isInteger(fixtures.randomSeed) || fixtures.randomSeed < 0 || fixtures.randomSeed > 0xffffffff)) throw new Error("randomSeed must be an unsigned 32-bit integer");
  if (fixtures.network) {
    if (!["passthrough", "block-unmatched"].includes(fixtures.network.policy)) throw new Error("Unknown fixture network policy");
    if (fixtures.network.responses.length > 50 || Buffer.byteLength(JSON.stringify(fixtures.network)) > 1_048_576) throw new Error("Network fixtures allow at most 50 responses and 1 MiB of JSON");
    const seen = new Set<string>();
    for (const r of fixtures.network.responses) {
      if (!r.url.startsWith("/") && !/^https?:\/\//.test(r.url)) throw new Error(`Fixture URL must be a path or HTTP URL: ${r.url}`);
      if (r.status !== undefined && (!Number.isInteger(r.status) || r.status < 200 || r.status > 599)) throw new Error(`Invalid fixture status: ${r.status}`);
      const key = `${r.method ?? "GET"} ${r.url}`;
      if (seen.has(key)) throw new Error(`Duplicate network fixture: ${key}`);
      seen.add(key);
    }
  }
}

/** Seeds before any project module executes; timers and cryptographic randomness remain real. */
export async function installFixtures(page: Page, origin: string, fixtures: RenderFixtures | undefined, storage: { local?: Record<string, string>; session?: Record<string, string> } | undefined): Promise<FixtureProvenance | undefined> {
  await page.addInitScript(({ fixtures, storage }) => {
    (window as any).__CP_ENGINE_NOW__ = Date.now.bind(Date);
    if (fixtures?.now !== undefined) {
      const Original = Date, now = Original.parse(fixtures.now);
      (window as any).Date = new Proxy(Original, { construct(target, args) { return Reflect.construct(target, args.length ? args : [now]); }, apply() { return new Original(now).toString(); }, get(target, key) { return key === "now" ? () => now : Reflect.get(target, key); } });
    }
    if (fixtures?.randomSeed !== undefined) {
      let seed = fixtures.randomSeed >>> 0;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    }
    try {
      localStorage.clear(); sessionStorage.clear();
      for (const [k, v] of Object.entries(storage?.local ?? {})) localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(storage?.session ?? {})) sessionStorage.setItem(k, v);
    } catch { /* about:blank has no storage origin. */ }
  }, { fixtures, storage });
  if (!fixtures) return;
  const provenance: FixtureProvenance = { digest: createHash("sha256").update(JSON.stringify({ fixtures, storage })).digest("hex"), clock: fixtures.now, randomSeed: fixtures.randomSeed, locale: fixtures.locale, timezoneId: fixtures.timezoneId, reducedMotion: fixtures.reducedMotion };
  if (fixtures.network) {
    const net = provenance.network = { policy: fixtures.network.policy, matched: [] as string[], blocked: [] as string[] };
    await page.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      // Engine transport is never a mockable application API.
      if (url.origin === origin && (url.pathname === "/" && request.isNavigationRequest() || url.pathname.startsWith("/@"))) return route.continue();
      const fixture = fixtures.network!.responses.find((r) => request.method() === (r.method ?? "GET").toUpperCase() && (r.url === url.href || url.origin === origin && r.url === url.pathname + url.search));
      if (fixture) {
        if (net.matched.length < 50) net.matched.push(`${request.method()} ${fixture.url}`);
        return route.fulfill({ status: fixture.status ?? 200, contentType: fixture.contentType ?? "text/plain", body: fixture.body });
      }
      if (net.policy === "block-unmatched") {
        const asset = url.origin === origin && ["script", "stylesheet", "image", "font"].includes(request.resourceType());
        if (!asset) { if (net.blocked.length < 50) net.blocked.push(`${request.method()} ${url.origin === origin ? url.pathname + url.search : url.href}`); return route.abort("blockedbyclient"); }
      }
      return route.continue();
    });
    if (net.policy === "block-unmatched") await page.routeWebSocket("**/*", (socket) => { if (net.blocked.length < 50) net.blocked.push(`WebSocket ${socket.url()}`); socket.close(); });
  }
  return provenance;
}
