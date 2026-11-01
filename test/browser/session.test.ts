import { expect, it } from "vitest";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import os from "node:os";

const root = path.resolve("test/fixtures/react-app");
const target = { file: path.join(root, "components/ProductCard.tsx"), exportName: "ProductCard", props: { title: "Desk", price: 3 } };

it("bounds warm pages and retained PNGs while evicted captures explain recovery", async () => {
  const renderer = await createRenderer({ root, limits: { pages: 2, captures: 2, history: 1, pngBytes: 1_000_000 } });
  try {
    const first = await renderer.render({ ...target, viewport: { width: 600, height: 400 } });
    await renderer.render({ ...target, viewport: { width: 601, height: 400 } });
    const last = await renderer.render({ ...target, viewport: { width: 602, height: 400 } });
    expect(renderer.resources()).toMatchObject({ pages: 2, captures: 2, history: 1 });
    expect(renderer.resources().pngBytes).toBeLessThanOrEqual(1_000_000);
    await expect(renderer.diff(first.captureId!)).rejects.toThrow(/expired.*render/i);
    expect((await renderer.diff(last.captureId!)).changedPixels).toBe(0);
    const timings = [];
    for (let i = 0; i < 20; i++) timings.push((await renderer.render({ ...target, viewport: { width: 602, height: 400 } })).ms);
    expect(timings.sort((a, b) => a - b)[18]).toBeLessThanOrEqual(100);
  } finally { await renderer.close(); }
});

it("does not retain PNGs over the session byte budget", async () => {
  const renderer = await createRenderer({ root, limits: { pngBytes: 1 } });
  try {
    const result = await renderer.render(target);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join()).toContain("PNG retention budget");
    expect(result.complete).toBe(false);
    expect(renderer.resources().pngBytes).toBe(0);
  } finally { await renderer.close(); }
});

it("replays explicit time, random, browser environment and network fixtures before the first mount", async () => {
  const project = mkdtempSync(path.join(os.tmpdir(), "cp-fixtures-"));
  writeFileSync(path.join(project, "package.json"), '{"type":"module","dependencies":{"react":"*","react-dom":"*"}}');
  symlinkSync(path.join(root, "node_modules"), path.join(project, "node_modules"), "dir");
  const file = path.join(project, "Card.tsx");
  writeFileSync(file, `import {useEffect,useState} from "react";
    const stamp = Date.now(), value = Math.random();
    export default function Card() { const [name,setName]=useState("loading");
      useEffect(()=>{fetch("/api/name").then(r=>r.json()).then(v=>setName(v.name));},[]);
      return <p>{stamp} / {value.toFixed(4)} / {name} / {navigator.language} / {localStorage.getItem("flag")}</p>; }`);
  const renderer = await createRenderer({ root: project });
  try {
    const fixtures = { now: "2026-01-01T00:00:00.000Z", randomSeed: 42, locale: "en-GB", timezoneId: "UTC", network: { policy: "block-unmatched" as const, responses: [{ url: "/api/name", body: '{"name":"Fixture"}', contentType: "application/json" }] } };
    const before = await renderer.render({ file, fixtures, storage: { local: { flag: "first-mount" } } });
    expect(before.errors).toEqual([]);
    expect(before.snapshot).toContain("1767225600000");
    expect(before.snapshot).toContain("Fixture / en-GB / first-mount");
    expect(before.fixtureProvenance).toMatchObject({ clock: fixtures.now, randomSeed: 42, locale: "en-GB", timezoneId: "UTC", network: { policy: "block-unmatched", matched: ["GET /api/name"], blocked: [] } });
    expect(before.fixtureProvenance?.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(before.complete).toBe(true);
    const comparison = await renderer.diff(before.captureId!);
    expect(comparison.changedPixels).toBe(0);
    expect(comparison.after.fixtureProvenance?.digest).toBe(before.fixtureProvenance?.digest);
  } finally { await renderer.close(); rmSync(project, { recursive: true, force: true }); }
});

it("cancels a render in flight, skips cancelled queued work and leaves the next render usable", async () => {
  const renderer = await createRenderer({ root });
  try {
    await renderer.render(target);
    const controller = new AbortController();
    const pending = renderer.render({ ...target, actions: [{ wait: 5000 }] }, { signal: controller.signal });
    const checked = expect(pending).rejects.toThrow(/cancelled/i);
    setTimeout(() => controller.abort(), 100);
    await checked;
    const cancelled = new AbortController(); cancelled.abort();
    await expect(renderer.render(target, { signal: cancelled.signal })).rejects.toThrow(/cancelled/i);
    await expect(renderer.render({ ...target, actions: [{ wait: 5000 }] }, { timeoutMs: 100 })).rejects.toThrow(/timed out/i);
    expect((await renderer.render(target)).errors).toEqual([]);
  } finally { await renderer.close(); }
});

it("keeps engine error timestamps independent from an explicit application clock", async () => {
  const renderer = await createRenderer({ root });
  const fixtures = { now: "2026-01-01T00:00:00.000Z" };
  try {
    renderer.server.updateBuffer(target.file, 'import "missing-before-repair"; export function ProductCard(){return <p>First</p>}');
    expect((await renderer.render({ ...target, fixtures })).errors.join()).toContain("missing-before-repair");
    renderer.server.updateBuffer(target.file, undefined);
    expect((await renderer.render({ ...target, fixtures })).errors).toEqual([]);
    renderer.server.updateBuffer(target.file, 'import "missing-after-repair"; export function ProductCard(){return <p>Second</p>}');
    const failed = await renderer.render({ ...target, fixtures });
    expect(failed.errors.join()).toContain("missing-after-repair");
    expect(failed.errors.join()).not.toContain("missing-before-repair");
  } finally { await renderer.close(); }
});
