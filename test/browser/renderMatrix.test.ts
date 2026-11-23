import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const file = path.join(root, "components/VerificationPanel.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("checks explicit viewport/theme cases with isolated state and bounded capture resources", async () => {
  const report = await renderer.renderMatrix({ target: { file, exportName: "VerificationForm", props: {} }, cases: [
    { id: "phone-light", viewport: { width: 390, height: 844 }, theme: "light", expectations: [{ target: { role: "button", name: "Publish" }, state: "enabled", value: false }] },
    { id: "desktop-dark", viewport: { width: 1280, height: 800 }, theme: "dark", expectations: [{ target: { role: "button", name: "Publish" }, state: "enabled", value: true, timeoutMs: 20 }] },
  ] });
  expect(report.cells.map((cell) => cell.status)).toEqual(["passed", "failed"]);
  expect(report.coverage).toMatchObject({ requested: 2, executed: 2, failed: 1, notRun: 0 });
  expect(report.cells[0].render?.viewport).toEqual({ width: 390, height: 844 });
  expect(report.cells[1].render?.target.theme).toBe("dark");
  expect(report.cells.every((cell) => cell.render?.captureId)).toBe(true);
  expect(report.ms).toBeLessThan(30000);
  expect(renderer.resources().pages).toBeLessThanOrEqual(4);
});

const card = path.join(root, "components/MatrixCard.tsx");
const cases = [
  { id: "phone-light", viewport: { width: 390, height: 844 }, theme: "light" as const },
  { id: "desktop-dark", viewport: { width: 1280, height: 800 }, theme: "dark" as const },
];

it("replays matching baselines with their original props and notices a real style edit", async () => {
  const report = await renderer.renderMatrix({ target: { file: card, exportName: "MatrixCard", props: { title: "A long plan name for a narrow screen" } }, cases });
  const baselines = report.cells.map((cell) => ({ id: cell.id, captureId: cell.render!.captureId }));
  const unchanged = await renderer.diffMatrix(baselines);
  expect(unchanged.cells.map((cell) => cell.status)).toEqual(["unchanged", "unchanged"]);
  const source = await renderer.server.readSource(card);
  renderer.server.updateBuffer(card, source.replace("padding:8px", "padding:18px"));
  try {
    const changed = await renderer.diffMatrix(baselines);
    expect(changed.cells.map((cell) => cell.status)).toEqual(["changed", "unchanged"]);
    expect(changed.coverage).toMatchObject({ requested: 2, executed: 2, compared: 2, changed: 1, unchanged: 1 });
    expect(changed.cells[0].diff?.after.target.props.title).toBe("A long plan name for a narrow screen");
    expect(changed.sourceConsistent).toBe(true);
  } finally { renderer.server.updateBuffer(card, undefined); }
});

it("resets interactive state and keeps failing cases and incomplete context visible", async () => {
  const report = await renderer.renderMatrix({ target: { file: card, exportName: "MatrixCard", props: {} }, cases: [
    { ...cases[0], id: "clicked", actions: [{ click: { role: "button", name: "Count 0" } }] },
    { ...cases[0], id: "fresh", expectations: [{ target: { role: "button", name: "Count 0" }, state: "visible" }] },
    { ...cases[0], id: "broken", props: { fail: true } },
    { ...cases[0], id: "ready-timeout", ready: [{ target: { text: "Never present" }, state: "visible", timeoutMs: 20 }] },
  ] });
  expect(report.cells.map((cell) => cell.status)).toEqual(["passed", "passed", "failed", "failed"]);
  expect(report.cells[0].render!.snapshot).toContain("Count 1");
  expect(report.cells[1].render!.snapshot).toContain("Count 0");
  expect(report.cells[2].errors.join()).toContain("MatrixCard requested failure");
  expect(report.cells[3].render!.complete).toBe(false);
  expect(report.complete).toBe(false);
});

it("never calls an absent or evicted baseline unchanged, including eviction during comparison", async () => {
  const small = await createRenderer({ root, limits: { captures: 2 } });
  try {
    const report = await small.renderMatrix({ target: { file: card, exportName: "MatrixCard", props: {} }, cases });
    const compared = await small.diffMatrix(report.cells.map((cell) => ({ id: cell.id, captureId: cell.render!.captureId })));
    expect(compared.coverage.compared).toBe(2);
    const expired = await small.diffMatrix([{ id: "old", captureId: report.cells[0].render!.captureId }, { id: "missing" }]);
    expect(expired.cells.map((cell) => cell.status)).toEqual(["not-compared", "not-compared"]);
    expect(expired.complete).toBe(false);
    expect(expired.coverage.executed).toBe(0);
    expect(small.resources().captures).toBeLessThanOrEqual(2);
  } finally { await small.close(); }
});

it("preserves completed cases on cancellation and lets the next queued render finish", async () => {
  const cancel = new AbortController();
  let starts = 0;
  const matrix = renderer.renderMatrix({ target: { file: card, exportName: "MatrixCard", props: {} }, cases: [...cases, { ...cases[0], id: "later" }] }, {
    signal: cancel.signal, onProgress: ({ phase }) => { if (phase === "source" && ++starts === 2) cancel.abort(); },
  });
  const next = renderer.render({ file: card, exportName: "MatrixCard", props: { title: "Next queued render" } });
  const report = await matrix;
  expect(report.cells.map((cell) => cell.status)).toEqual(["passed", "incomplete", "not-run"]);
  expect(report.errors.join()).toMatch(/cancelled/);
  expect(report.coverage).toMatchObject({ executed: 2, incomplete: 1, notRun: 1 });
  expect((await next).snapshot).toContain("Next queued render");
});

it("marks a batch inconsistent when source changes between cases", async () => {
  const source = await renderer.server.readSource(card);
  let starts = 0;
  try {
    const report = await renderer.renderMatrix({ target: { file: card, exportName: "MatrixCard", props: {} }, cases }, {
      onProgress: ({ phase }) => { if (phase === "source" && ++starts === 2) renderer.server.updateBuffer(card, source.replace('title = "Starter"', 'title = "Changed"')); },
    });
    expect(report.sourceConsistent).toBe(false);
    expect(report.status).toBe("incomplete");
    expect(report.warnings.join()).toContain("Source changed");
  } finally { renderer.server.updateBuffer(card, undefined); }
});

it("rejects ambiguous/oversized plans before rendering and bounds total runtime", async () => {
  expect(() => renderer.renderMatrix({ target: { file: card }, cases: [cases[0], cases[0]] })).toThrow(/unique/);
  expect(() => renderer.renderMatrix({ target: { file: card }, cases: Array.from({ length: 13 }, (_, i) => ({ ...cases[0], id: `case-${i}` })) })).toThrow();
  const report = await renderer.renderMatrix({ target: { file: card, exportName: "MatrixCard", actions: [{ wait: 1000 }] }, cases }, { timeoutMs: 100 });
  expect(report.complete).toBe(false);
  expect(report.coverage).toMatchObject({ executed: 1, incomplete: 1, notRun: 1 });
  expect(report.errors.join()).toMatch(/timed out/);
});

it("retains unresolved usage provenance when matching the matrix baselines", async () => {
  const usageFile = path.join(root, "app/page.tsx");
  const source = await renderer.server.readSource(usageFile);
  renderer.server.updateBuffer(usageFile, source.replace('price={99}', 'price={runtimePrice}'));
  try {
    const report = await renderer.renderMatrix({ target: { file: path.join(root, "components/ProductCard.tsx"), exportName: "ProductCard", usage: "app/page.tsx:9", props: { price: 99 } }, cases: [cases[0]] });
    expect(report.cells[0].render!.unresolved.join()).toContain("runtimePrice");
    expect(report.cells[0].status).toBe("incomplete");
    const diff = await renderer.diffMatrix([{ id: cases[0].id, captureId: report.cells[0].render!.captureId }]);
    expect(diff.cells[0].status).toBe("incomplete");
    expect(diff.cells[0].diff!.after.unresolved.join()).toContain("runtimePrice");
  } finally { renderer.server.updateBuffer(usageFile, undefined); }
});

it("does not invent a source change for an already-cancelled batch", async () => {
  const controller = new AbortController(); controller.abort();
  const report = await renderer.renderMatrix({ target: { file: card, exportName: "MatrixCard" }, cases }, { signal: controller.signal });
  expect(report.sourceConsistent).toBe(true);
  expect(report.coverage.notRun).toBe(2);
  expect(report.errors.join()).toContain("earlier captures are retained");
});

it("uses the same matrix contract in an installed Vue-only project", async () => {
  const vueRoot = path.resolve("test/fixtures/vue-app");
  const vue = await createRenderer({ root: vueRoot });
  try {
    const report = await vue.renderMatrix({ target: { file: path.join(vueRoot, "src/components/Card.vue"), props: { title: "Vue matrix", price: 12 } }, cases });
    expect(report.cells.map((cell) => cell.status)).toEqual(["passed", "passed"]);
    expect(report.cells[0].render!.snapshot).toContain('heading "Vue matrix"');
    expect((await vue.diffMatrix(report.cells.map((cell) => ({ id: cell.id, captureId: cell.render!.captureId })))).coverage.unchanged).toBe(2);
  } finally { await vue.close(); }
});
