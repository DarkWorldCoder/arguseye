import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const file = path.join(root, "components/VerificationPanel.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("waits for an explicit state and reports expectations separately from render errors", async () => {
  const result = await renderer.render({ file, exportName: "VerificationPanel", props: { delay: 80 },
    ready: [{ target: { testId: "load-state" }, state: "text", value: "Ready to review", timeoutMs: 1000 }],
    expectations: [{ target: { role: "button", name: "Save", exact: true }, state: "count", value: 2 }],
  });
  expect(result.errors).toEqual([]);
  expect(result.readiness).toMatchObject([{ status: "passed", observed: { text: "Ready to review" } }]);
  expect(result.expectations).toMatchObject([{ status: "passed", observed: { count: 2 } }]);
  expect(result.target.ready![0].value).toBe("Ready to review");
  expect(result.readiness![0].ms).toBeLessThan(1000);
  const replay = await renderer.diff(result.captureId!);
  expect(replay.after.expectations![0].status).toBe("passed");
});

it("preserves the available image on readiness timeout without running dependent expectations", async () => {
  const result = await renderer.render({ file, exportName: "VerificationPanel", props: {},
    ready: [{ target: { text: "Never ready", exact: true }, state: "visible", timeoutMs: 40 }],
    expectations: [{ target: { role: "button" }, state: "count", value: 3 }],
  });
  expect(result.png.byteLength).toBeGreaterThan(0);
  expect(result.errors).toEqual([]);
  expect(result.complete).toBe(false);
  expect(result.readiness![0].status).toBe("failed");
  expect(result.expectations![0].status).toBe("not-run");
  expect(result.warnings.join()).toMatch(/readiness/i);
});

it("keeps failed expectations distinct and notices them even when pixels and accessible text stay identical", async () => {
  const before = await renderer.render({ file, exportName: "VerificationPanel", props: {}, expectations: [
    { target: { testId: "hidden-signal" }, state: "count", value: 1, timeoutMs: 30 },
  ] });
  expect(before.expectations![0].status).toBe("passed");
  const source = readFileSync(file, "utf8");
  renderer.server.updateBuffer(file, source.replace('<span data-testid="hidden-signal" hidden />', '<span data-testid="hidden-signal" hidden /><span data-testid="hidden-signal" hidden />'));
  try {
    const diff = await renderer.diff(before.captureId!);
    expect(diff.changedPixels).toBe(0);
    expect(diff.snapshotChanged).toBe(false);
    expect(diff.after.errors).toEqual([]);
    expect(diff.after.expectations![0].status).toBe("failed");
    expect(diff.after.complete).toBe(true);
    expect(diff.status).toBe("changed");
    expect(diff.expectationsChanged).toBe(true);
  } finally { renderer.server.updateBuffer(file, undefined); }
});

it("checks portal checkbox state, focus and expansion without first-match shortcuts", async () => {
  const result = await renderer.render({ file, exportName: "VerificationPanel", props: {}, actions: [
    { click: { role: "button", name: "Open dialog" } },
    { check: { role: "checkbox", name: "Accept", scope: "capture" } },
    { focus: { role: "button", name: "Confirm", scope: "capture" } },
  ], expectations: [
    { target: { role: "checkbox", name: "Accept", scope: "capture" }, state: "checked", value: true },
    { target: { role: "button", name: "Confirm", scope: "capture" }, state: "focused" },
    { target: { role: "button", name: "Open dialog" }, state: "expanded", value: true },
    { target: { role: "button", name: "Save", exact: true }, state: "visible", timeoutMs: 20 },
  ] });
  expect(result.errors).toEqual([]);
  expect(result.expectations!.map((c) => c.status)).toEqual(["passed", "passed", "passed", "failed"]);
  expect(result.expectations![3].message).toContain("Ambiguous target matched 2 elements");
});

it("rejects invalid checks, cancels pending readiness and recovers the renderer", async () => {
  await expect(renderer.render({ file, ready: [{ target: { role: "button" }, state: "count", value: -1 }] as any })).rejects.toThrow(/Invalid ready checks/);
  const abort = new AbortController();
  await expect(renderer.render({ file, exportName: "VerificationPanel", props: {}, ready: [
    { target: { text: "Never ready" }, state: "visible", timeoutMs: 5000 },
  ] }, { signal: abort.signal, onProgress: ({ message }) => { if (message === "Waiting for requested preview state") setTimeout(() => abort.abort(), 30); } })).rejects.toThrow(/cancelled/);
  expect((await renderer.render({ file, exportName: "VerificationPanel", props: {} })).errors).toEqual([]);
});

it("does not claim expectations ran after a component error", async () => {
  const result = await renderer.render({ file, exportName: "VerificationPanel", props: { fail: true }, expectations: [
    { target: { role: "button" }, state: "count", value: 0 },
  ] });
  expect(result.errors.join()).toContain("Fixture render failed");
  expect(result.expectations![0].status).toBe("not-run");
});

it("does not mistake a mixed checkbox for an unchecked checkbox", async () => {
  const source = readFileSync(file, "utf8");
  renderer.server.updateBuffer(file, source.replace('<input type="checkbox" />Accept', '<input type="checkbox" aria-checked="mixed" />Accept'));
  try {
    const result = await renderer.render({ file, exportName: "VerificationPanel", props: {}, actions: [{ click: { role: "button", name: "Open dialog" } }], expectations: [
      { target: { role: "checkbox", name: "Accept", scope: "capture" }, state: "checked", value: false, timeoutMs: 20 },
    ] });
    expect(result.expectations![0].status).toBe("failed");
    expect(result.expectations![0].observed?.checked).toBe("mixed");
  } finally { renderer.server.updateBuffer(file, undefined); }
});

it("replays a portable saved check in a fresh renderer and requires explicit browser-input export", async () => {
  const result = await renderer.render({ file, exportName: "VerificationPanel", props: {},
    expectations: [{ target: { role: "button", name: "Save", exact: true }, state: "count", value: 2 }],
    storage: { local: { privateExample: "not-for-export" } },
  });
  const recipe = renderer.recipe(result.captureId!);
  expect(recipe.version).toBe(1);
  expect(recipe.target.file).toBe("components/VerificationPanel.tsx");
  expect(JSON.stringify(recipe)).not.toContain("not-for-export");
  expect(recipe.omittedInputs).toEqual(["storage"]);
  const fresh = await createRenderer({ root });
  try {
    await expect(fresh.renderRecipe(recipe)).rejects.toThrow(/omitted.*storage/i);
    const explicit = renderer.recipe(result.captureId!, { includeBrowserInputs: true });
    const replay = await fresh.renderRecipe(JSON.parse(JSON.stringify(explicit)));
    expect(replay.errors).toEqual([]);
    expect(replay.expectations![0].status).toBe("passed");
    await expect(fresh.renderRecipe({ ...explicit, version: 99 })).rejects.toThrow(/recipe.*version/i);
    await expect(fresh.renderRecipe({ ...explicit, target: { ...explicit.target, file: "../outside.tsx" } })).rejects.toThrow(/outside.*project/i);
  } finally { await fresh.close(); }
});

it("observes disabled native, fieldset and ARIA controls and waits for them to become enabled", async () => {
  const result = await renderer.render({ file, exportName: "VerificationForm", props: {}, expectations: [
    { target: { role: "button", name: "Submit", exact: true }, state: "enabled", value: false },
    { target: { role: "button", name: "Archive", exact: true }, state: "enabled", value: false },
    { target: { role: "button", name: "Publish", exact: true }, state: "enabled", value: false },
    { target: { role: "button", name: "Missing", exact: true }, state: "enabled", value: false, timeoutMs: 20 },
  ] });
  expect(result.errors).toEqual([]);
  expect(result.expectations!.map((c) => c.status)).toEqual(["passed", "passed", "passed", "failed"]);
  expect(result.expectations!.slice(0, 3).map((c) => c.observed)).toMatchObject([
    { count: 1, enabled: false }, { count: 1, enabled: false }, { count: 1, enabled: false },
  ]);
  const ready = await renderer.render({ file, exportName: "VerificationForm", props: { delay: 100 },
    ready: [{ target: { role: "button", name: "Submit", exact: true }, state: "enabled", value: true, timeoutMs: 1000 }],
    expectations: [{ target: { role: "button", name: "Archive", exact: true }, state: "enabled", value: true }],
  });
  expect(ready.readiness![0].status).toBe("passed");
  expect(ready.readiness![0].ms).toBeLessThan(1000);
  expect(ready.expectations![0].status).toBe("passed");
  const recipe = renderer.recipe(ready.captureId!);
  expect((await renderer.renderRecipe(recipe)).expectations![0].status).toBe("passed");
});

it("rejects conflicting locator fields rather than silently dropping part of an agent's target", async () => {
  for (const target of [{ selector: "button", text: "Save" }, { role: "button", testId: "load-state" }, { role: "button", label: "Accept" }]) {
    await expect(renderer.render({ file, expectations: [{ target, state: "visible" }] })).rejects.toThrow(/exactly one locator/i);
    await expect(renderer.render({ file, actions: [{ click: target }] })).rejects.toThrow(/exactly one locator/i);
  }
  await expect(renderer.render({ file, ready: [{ target: { role: "button" }, state: "enabled" }] as any })).rejects.toThrow(/requires a boolean/);
});

it("keeps enabled checks within the warm-render p95 budget over 20 renders", async () => {
  const request = { file, exportName: "VerificationForm", props: {}, expectations: [
    { target: { role: "button", name: "Submit", exact: true }, state: "enabled" as const, value: false },
  ] };
  await renderer.render(request);
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const result = await renderer.render(request);
    expect(result.errors).toEqual([]);
    expect(result.expectations![0].status).toBe("passed");
    times.push(result.ms);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(times.length * 0.95) - 1];
  console.log("Enabled-check warm render p95", p95, "ms; samples", times);
  expect(p95).toBeLessThanOrEqual(100);
});
